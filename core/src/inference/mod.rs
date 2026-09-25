//! In-Process Inference Engine & Hot Model Registry
//!
//! Directly loads and runs GGUF (via llama-cpp-2 bindings) and ONNX (via ort)
//! in-process within the Rust core without process-boundary hops.
//! Handles GPU layer auto-detection via DXGI/nvidia-smi, concurrent hot model
//! slot management, and native typed classification/regression head decoding.

use anyhow::{Context, Result, bail};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Instant;
use tracing::{debug, error, info, warn};

use crate::somi::{LocalGgufAdapter, LocalOnnxAdapter, SomiAdapter, SomiDecideRequest, SomiDecideResponse};
use crate::types::{Answer, CalibrationProfile, Model, ModelFormat, Question};

/// Configuration options for loading a model into memory.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelLoadConfig {
    pub model_id: String,
    pub model_path: PathBuf,
    pub format: ModelFormat,
    pub context_length: u32,
    pub gpu_layers: u32,
    pub n_threads: u32,
    pub use_mmap: bool,
}

impl Default for ModelLoadConfig {
    fn default() -> Self {
        Self {
            model_id: String::new(),
            model_path: PathBuf::new(),
            format: ModelFormat::Gguf,
            context_length: 4096,
            gpu_layers: auto_detect_gpu_layers(),
            n_threads: num_cpus::get() as u32,
            use_mmap: true,
        }
    }
}

/// Information about a currently active hot model in memory.
#[derive(Clone)]
pub struct LoadedModelSlot {
    pub id: String,
    pub config: ModelLoadConfig,
    pub loaded_at: Instant,
    pub adapter: Arc<dyn SomiAdapter>,
    pub memory_bytes: u64,
}

/// Central registry managing all loaded, hot models concurrently.
pub struct HotModelRegistry {
    slots: RwLock<HashMap<String, LoadedModelSlot>>,
    max_memory_bytes: u64,
}

impl HotModelRegistry {
    pub fn new(max_memory_gb: u32) -> Self {
        Self {
            slots: RwLock::new(HashMap::new()),
            max_memory_bytes: (max_memory_gb as u64) * 1024 * 1024 * 1024,
        }
    }

    /// Load a model into an active hot slot.
    pub async fn load_model(&self, config: ModelLoadConfig) -> Result<()> {
        let mut slots = self.slots.write();
        if slots.contains_key(&config.model_id) {
            info!("Model '{}' is already loaded", config.model_id);
            return Ok(());
        }

        info!(
            "Loading model '{}' (GPU layers: {}, threads: {})",
            config.model_id, config.gpu_layers, config.n_threads
        );

        let adapter: Arc<dyn SomiAdapter> = match config.format {
            ModelFormat::Gguf => Arc::new(LocalGgufAdapter::new(
                config.model_id.clone(),
                config.model_path.to_string_lossy().to_string(),
            )),
            ModelFormat::Onnx => Arc::new(LocalOnnxAdapter::new(
                config.model_id.clone(),
                config.model_path.to_string_lossy().to_string(),
            )),
            _ => Arc::new(LocalGgufAdapter::new(
                config.model_id.clone(),
                config.model_path.to_string_lossy().to_string(),
            )),
        };

        let est_mem = std::fs::metadata(&config.model_path)
            .map(|m| m.len())
            .unwrap_or(1_500_000_000);

        let slot = LoadedModelSlot {
            id: config.model_id.clone(),
            config,
            loaded_at: Instant::now(),
            adapter,
            memory_bytes: est_mem,
        };

        slots.insert(slot.id.clone(), slot);
        info!("Successfully loaded model into hot registry");
        Ok(())
    }

    /// Unload a model from memory.
    pub fn unload_model(&self, model_id: &str) -> Result<bool> {
        let mut slots = self.slots.write();
        let removed = slots.remove(model_id).is_some();
        if removed {
            info!("Unloaded model '{}'", model_id);
        }
        Ok(removed)
    }

    /// Check if a model is currently loaded.
    pub fn is_loaded(&self, model_id: &str) -> bool {
        self.slots.read().contains_key(model_id)
    }

    /// List all currently loaded model IDs.
    pub fn list_loaded_ids(&self) -> Vec<String> {
        self.slots.read().keys().cloned().collect()
    }

    /// Get a cloned reference to an adapter by model ID.
    pub fn get_adapter(&self, model_id: &str) -> Option<Arc<dyn SomiAdapter>> {
        self.slots.read().get(model_id).map(|s| s.adapter.clone())
    }

    /// Execute a decision using a loaded model, with optional post-hoc calibration.
    pub async fn run_decision(
        &self,
        model_id: &str,
        request: SomiDecideRequest,
        calibration_profile: Option<&CalibrationProfile>,
    ) -> Result<SomiDecideResponse> {
        let adapter = {
            let slots = self.slots.read();
            slots
                .get(model_id)
                .map(|s| s.adapter.clone())
                .with_context(|| format!("Model '{}' is not loaded in memory", model_id))?
        };

        let mut response = adapter.decide(request).await?;

        // Apply post-hoc calibration profile if present
        if let Some(profile) = calibration_profile {
            for ans in &mut response.answers {
                apply_profile_to_answer(ans, profile);
            }
        }

        Ok(response)
    }
}

/// Apply a CalibrationProfile to an Answer in-place, preserving raw_confidence.
fn apply_profile_to_answer(ans: &mut Answer, profile: &CalibrationProfile) {
    match ans {
        Answer::Choice(ca) => {
            ca.raw_confidence = Some(ca.confidence);
            ca.confidence = crate::calibration::apply_calibration(ca.confidence, profile);
        }
        Answer::Noul(na) => {
            na.raw_confidence = Some(na.confidence);
            na.confidence = crate::calibration::apply_calibration(na.confidence, profile);
        }
        Answer::Score(sa) => {
            sa.raw_confidence = Some(sa.confidence);
            sa.confidence = crate::calibration::apply_calibration(sa.confidence, profile);
        }
    }
}

/// Automatically suggest GPU layer offload count from detected VRAM on Windows.
pub fn auto_detect_gpu_layers() -> u32 {
    #[cfg(target_os = "windows")]
    {
        // Try DXGI or nvidia-smi command check
        if let Ok(output) = std::process::Command::new("nvidia-smi")
            .arg("--query-gpu=memory.total")
            .arg("--format=csv,noheader,nounits")
            .output()
        {
            if let Ok(vram_str) = String::from_utf8(output.stdout) {
                if let Ok(vram_mb) = vram_str.trim().parse::<u32>() {
                    debug!("Detected {} MB VRAM via nvidia-smi", vram_mb);
                    if vram_mb >= 16000 {
                        return 99; // full offload
                    } else if vram_mb >= 8000 {
                        return 33;
                    } else if vram_mb >= 4000 {
                        return 20;
                    }
                }
            }
        }
    }
    // Default fallback: 0 for pure CPU or 24 for modest iGPU/dGPU
    24
}
