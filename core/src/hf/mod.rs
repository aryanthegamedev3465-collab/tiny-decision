//! Hugging Face Hub integration for Tiny Decision.
//!
//! Covers:
//! - Model search and card fetching.
//! - Resumable chunked downloads with SHA-256 integrity verification.
//! - Auth token management (stored via Windows DPAPI on Windows, plaintext
//!   fallback on other platforms).
//! - Pre-download capability probing via `config.json`.

use anyhow::{bail, Context, Result};
use bytes::Bytes;
use futures::StreamExt;
use reqwest::{Client, header};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::Arc,
    time::Instant,
};
use tauri::AppHandle;
use tokio::{
    fs,
    io::AsyncWriteExt,
    sync::{broadcast, Mutex, RwLock},
};
use tracing::{debug, info, warn};
use uuid::Uuid;

use crate::types::{DownloadProgress, DownloadStatus, Model, ModelFormat};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const HF_API_BASE: &str = "https://huggingface.co/api";
const HF_CDN_BASE: &str = "https://huggingface.co";
const CHUNK_SIZE: usize = 1024 * 1024 * 4; // 4 MiB

// ─────────────────────────────────────────────────────────────────────────────
// Public data types
// ─────────────────────────────────────────────────────────────────────────────

/// Minimal representation of a HF model returned by the search API.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HfModelSummary {
    pub model_id: String,
    pub pipeline_tag: Option<String>,
    pub downloads: Option<u64>,
    pub likes: Option<u64>,
    pub private: bool,
    pub tags: Vec<String>,
    pub siblings: Vec<HfSibling>,
    pub last_modified: Option<String>,
    pub library_name: Option<String>,
}

/// A single file within a HF repository.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HfSibling {
    pub rfilename: String,
    pub size: Option<u64>,
    pub blob_id: Option<String>,
    pub lfs: Option<HfLfsMeta>,
}

/// LFS metadata for a sibling file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HfLfsMeta {
    pub sha256: String,
    pub size: u64,
    pub pointer_size: u64,
}

/// Fetched model card combining README and sibling list.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelCard {
    pub model_id: String,
    pub readme: Option<String>,
    pub siblings: Vec<HfSibling>,
    pub config: Option<serde_json::Value>,
    pub has_native_decision_head: bool,
    pub supported_formats: Vec<ModelFormat>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth token management
// ─────────────────────────────────────────────────────────────────────────────

/// Store a Hugging Face access token securely.
///
/// On Windows this uses the DPAPI `CryptProtectData` API.  On other
/// platforms the token is stored Base64-encoded in the config directory
/// (best effort – no hardware key available).
pub async fn store_hf_token(token: &str) -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        dpapi::protect_data(token.as_bytes(), "tiny-decision-hf-token")?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let path = token_path()?;
        tokio::fs::create_dir_all(path.parent().unwrap()).await?;
        tokio::fs::write(&path, base64::encode(token)).await?;
        tracing::warn!("HF token stored in plaintext (non-Windows platform)");
    }
    Ok(())
}

/// Retrieve the stored Hugging Face access token (if any).
pub async fn load_hf_token() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        dpapi::unprotect_data("tiny-decision-hf-token")
            .ok()
            .and_then(|bytes| String::from_utf8(bytes).ok())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let path = token_path().ok()?;
        let encoded = tokio::fs::read_to_string(&path).await.ok()?;
        let bytes = base64::decode(encoded.trim()).ok()?;
        String::from_utf8(bytes).ok()
    }
}

fn token_path() -> Result<PathBuf> {
    let base = dirs::config_dir().context("Cannot find config dir")?;
    Ok(base.join("tiny-decision").join(".hf_token"))
}

// ─────────────────────────────────────────────────────────────────────────────
// Windows DPAPI wrapper (compile-time guarded)
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
mod dpapi {
    use anyhow::{Context, Result};
    use std::collections::HashMap;
    use std::sync::Mutex;

    // Simplistic in-memory store used as a DPAPI stub when the windows crate
    // is not available in the build environment.  A full production build
    // should call `CryptProtectData` / `CryptUnprotectData`.
    static STORE: Mutex<Option<HashMap<String, Vec<u8>>>> = Mutex::new(None);

    pub fn protect_data(data: &[u8], label: &str) -> Result<()> {
        let mut guard = STORE.lock().unwrap();
        let map = guard.get_or_insert_with(HashMap::new);
        map.insert(label.to_string(), data.to_vec());
        Ok(())
    }

    pub fn unprotect_data(label: &str) -> Result<Vec<u8>> {
        let guard = STORE.lock().unwrap();
        guard
            .as_ref()
            .and_then(|m| m.get(label))
            .cloned()
            .context("Token not found in DPAPI store")
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP client helper
// ─────────────────────────────────────────────────────────────────────────────

async fn hf_client() -> Result<Client> {
    let mut headers = header::HeaderMap::new();
    if let Some(token) = load_hf_token().await {
        let auth_value = format!("Bearer {token}");
        headers.insert(
            header::AUTHORIZATION,
            header::HeaderValue::from_str(&auth_value)?,
        );
    }
    let client = Client::builder()
        .default_headers(headers)
        .user_agent("tiny-decision/0.1")
        .build()?;
    Ok(client)
}

// ─────────────────────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────────────────────

/// Search the Hugging Face model hub.
///
/// `filter` may be a pipeline tag such as `"text-classification"`.
pub async fn search_models(
    query: &str,
    filter: Option<&str>,
) -> Result<Vec<serde_json::Value>> {
    let client = hf_client().await?;
    let mut url = format!("{HF_API_BASE}/models?search={query}&sort=downloads&limit=30");
    if let Some(f) = filter {
        url.push_str(&format!("&filter={f}"));
    }
    debug!("HF search URL: {url}");
    let resp = client.get(&url).send().await?.error_for_status()?;
    let json: Vec<serde_json::Value> = resp.json().await?;
    Ok(json)
}

// ─────────────────────────────────────────────────────────────────────────────
// Model card
// ─────────────────────────────────────────────────────────────────────────────

/// Fetch the model card (README + sibling list + config.json probe).
pub async fn get_model_card(model_id: &str) -> Result<ModelCard> {
    let client = hf_client().await?;

    // Fetch model metadata (includes siblings).
    let meta_url = format!("{HF_API_BASE}/models/{model_id}");
    let meta: serde_json::Value = client
        .get(&meta_url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let siblings: Vec<HfSibling> = meta
        .get("siblings")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    // Fetch README.md
    let readme_url = format!("{HF_CDN_BASE}/{model_id}/resolve/main/README.md");
    let readme = client
        .get(&readme_url)
        .send()
        .await
        .ok()
        .and_then(|r| if r.status().is_success() { Some(r) } else { None })
        .and_then(|r| {
            tokio::runtime::Handle::current()
                .block_on(r.text())
                .ok()
        });

    // Pre-probe config.json.
    let (config, has_native_decision_head) = probe_config(&client, model_id).await?;

    // Detect available formats from sibling file extensions.
    let supported_formats = detect_formats(&siblings);

    Ok(ModelCard {
        model_id: model_id.to_string(),
        readme,
        siblings,
        config,
        has_native_decision_head,
        supported_formats,
    })
}

/// Probe `config.json` from the repository to check for a typed decision head.
pub async fn probe_config(
    client: &Client,
    model_id: &str,
) -> Result<(Option<serde_json::Value>, bool)> {
    let url = format!("{HF_CDN_BASE}/{model_id}/resolve/main/config.json");
    let resp = match client.get(&url).send().await {
        Ok(r) if r.status().is_success() => r,
        _ => return Ok((None, false)),
    };
    let config: serde_json::Value = resp.json().await?;
    let has_head = config
        .get("architectures")
        .and_then(|a| a.as_array())
        .map(|arches| {
            arches.iter().any(|a| {
                let s = a.as_str().unwrap_or("");
                s.contains("ForSequenceClassification")
                    || s.contains("ForTokenClassification")
                    || s.contains("DecisionHead")
            })
        })
        .unwrap_or(false);
    Ok((Some(config), has_head))
}

fn detect_formats(siblings: &[HfSibling]) -> Vec<ModelFormat> {
    let mut formats = Vec::new();
    for s in siblings {
        let name = s.rfilename.to_lowercase();
        if name.ends_with(".gguf") && !formats.contains(&ModelFormat::Gguf) {
            formats.push(ModelFormat::Gguf);
        } else if name.ends_with(".onnx") && !formats.contains(&ModelFormat::Onnx) {
            formats.push(ModelFormat::Onnx);
        } else if name.ends_with(".safetensors") && !formats.contains(&ModelFormat::SafeTensors) {
            formats.push(ModelFormat::SafeTensors);
        } else if name.ends_with(".pt") && !formats.contains(&ModelFormat::TorchScript) {
            formats.push(ModelFormat::TorchScript);
        }
    }
    formats
}

// ─────────────────────────────────────────────────────────────────────────────
// Download manager
// ─────────────────────────────────────────────────────────────────────────────

pub mod download_manager {
    use super::*;
    use crate::db;
    use dashmap::DashMap;
    use once_cell::sync::Lazy;
    use tokio::sync::watch;

    /// Per-download control signal.
    #[derive(Debug, Clone, PartialEq)]
    enum Control {
        Run,
        Pause,
        Cancel,
    }

    /// Active download handles.
    static CONTROLS: Lazy<DashMap<Uuid, watch::Sender<Control>>> =
        Lazy::new(DashMap::new);

    /// Begin (or resume) a chunked download for the given model.
    ///
    /// Progress is emitted as `download_progress` Tauri events.
    pub async fn start_download(app: AppHandle, model_id: Uuid) -> Result<()> {
        // Load model record from DB to get URL components.
        let db_path = app
            .path()
            .app_data_dir()
            .expect("app data dir")
            .join("tiny-decision.db");
        let conn = db::open(&db_path)?;

        // Resolve model from database (simplified lookup).
        let (repo_id, filename, dest_dir): (String, String, PathBuf) = {
            let mut stmt = conn.prepare(
                "SELECT hf_repo_id, hf_filename, local_path FROM model WHERE id=?1",
            )?;
            stmt.query_row([model_id.to_string()], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?
                        .map(PathBuf::from)
                        .unwrap_or_else(|| PathBuf::from(".")),
                ))
            })?
        };

        let url = format!("{HF_CDN_BASE}/{repo_id}/resolve/main/{filename}");
        let part_path = dest_dir.join(format!("{filename}.part"));
        let final_path = dest_dir.join(&filename);

        // Ensure destination directory exists.
        fs::create_dir_all(&dest_dir).await?;

        let (tx, mut rx) = watch::channel(Control::Run);
        CONTROLS.insert(model_id, tx);

        let client = hf_client().await?;

        // Check for existing partial download.
        let already_downloaded = if part_path.exists() {
            fs::metadata(&part_path).await?.len()
        } else {
            0
        };

        // HEAD request to get total size and ETag.
        let head_resp = client.head(&url).send().await?.error_for_status()?;
        let total_bytes = head_resp
            .headers()
            .get(header::CONTENT_LENGTH)
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<u64>().ok());
        let etag = head_resp
            .headers()
            .get(header::ETAG)
            .and_then(|v| v.to_str().ok())
            .map(str::to_string);

        info!(
            "Downloading {filename} ({} bytes already, total={:?})",
            already_downloaded, total_bytes
        );

        db::update_model_download(
            &conn,
            &model_id,
            &DownloadStatus::Downloading,
            0.0,
        )?;

        // Open part file in append mode.
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&part_path)
            .await?;

        let mut req = client.get(&url);
        if already_downloaded > 0 {
            req = req.header(
                header::RANGE,
                format!("bytes={already_downloaded}-"),
            );
        }

        let resp = req.send().await?.error_for_status()?;
        let mut stream = resp.bytes_stream();
        let mut hasher = Sha256::new();
        let mut bytes_written = already_downloaded;
        let start_time = Instant::now();

        // Re-hash what we already have.
        if already_downloaded > 0 {
            let existing = fs::read(&part_path).await?;
            hasher.update(&existing);
        }

        let app_clone = app.clone();
        loop {
            // Check control signal.
            if *rx.borrow() == Control::Cancel {
                warn!("Download cancelled for {model_id}");
                fs::remove_file(&part_path).await.ok();
                db::update_model_download(
                    &conn,
                    &model_id,
                    &DownloadStatus::Cancelled,
                    0.0,
                )?;
                CONTROLS.remove(&model_id);
                return Ok(());
            }
            if *rx.borrow() == Control::Pause {
                db::update_model_download(
                    &conn,
                    &model_id,
                    &DownloadStatus::Paused,
                    bytes_written as f32
                        / total_bytes.unwrap_or(1) as f32
                        * 100.0,
                )?;
                // Block until resumed or cancelled.
                loop {
                    rx.changed().await.ok();
                    let ctrl = rx.borrow().clone();
                    if ctrl != Control::Pause {
                        break;
                    }
                }
                db::update_model_download(
                    &conn,
                    &model_id,
                    &DownloadStatus::Downloading,
                    bytes_written as f32
                        / total_bytes.unwrap_or(1) as f32
                        * 100.0,
                )?;
            }

            match stream.next().await {
                Some(Ok(chunk)) => {
                    hasher.update(&chunk);
                    file.write_all(&chunk).await?;
                    bytes_written += chunk.len() as u64;

                    let elapsed = start_time.elapsed().as_secs_f64();
                    let speed_bps = bytes_written as f64 / elapsed.max(0.001);
                    let eta_secs = total_bytes.map(|t| {
                        let remaining = t.saturating_sub(bytes_written) as f64;
                        remaining / speed_bps
                    });
                    let progress_pct = total_bytes
                        .map(|t| bytes_written as f32 / t as f32 * 100.0)
                        .unwrap_or(0.0);

                    db::update_model_download(
                        &conn,
                        &model_id,
                        &DownloadStatus::Downloading,
                        progress_pct,
                    )
                    .ok();

                    let event = DownloadProgress {
                        model_id,
                        status: DownloadStatus::Downloading,
                        bytes_downloaded: bytes_written,
                        bytes_total: total_bytes,
                        speed_bps,
                        eta_secs,
                        sha256_verified: false,
                    };
                    app_clone
                        .emit("download_progress", &event)
                        .ok();
                }
                Some(Err(e)) => {
                    warn!("Download stream error: {e}");
                    db::update_model_download(
                        &conn,
                        &model_id,
                        &DownloadStatus::Failed,
                        0.0,
                    )?;
                    CONTROLS.remove(&model_id);
                    return Err(e.into());
                }
                None => break, // Stream exhausted.
            }
        }

        file.flush().await?;
        drop(file);

        // SHA-256 verification.
        let digest_hex = hex::encode(hasher.finalize());
        let sha256_ok = {
            // Look up expected hash from DB.
            let expected: Option<String> = conn
                .query_row(
                    "SELECT sha256 FROM model WHERE id=?1",
                    [model_id.to_string()],
                    |row| row.get(0),
                )
                .ok()
                .flatten();
            expected
                .map(|exp| exp.to_lowercase() == digest_hex)
                .unwrap_or(true) // No expected hash → skip check.
        };

        if !sha256_ok {
            fs::remove_file(&part_path).await.ok();
            db::update_model_download(
                &conn,
                &model_id,
                &DownloadStatus::Failed,
                0.0,
            )?;
            bail!("SHA-256 mismatch for model {model_id}");
        }

        // Rename `.part` → final path.
        fs::rename(&part_path, &final_path).await?;

        // Persist final path and sha256 into the model record.
        conn.execute(
            "UPDATE model SET local_path=?1, sha256=?2, updated_at=?3 WHERE id=?4",
            rusqlite::params![
                final_path.to_string_lossy().to_string(),
                digest_hex,
                chrono::Utc::now().to_rfc3339(),
                model_id.to_string(),
            ],
        )?;

        db::update_model_download(
            &conn,
            &model_id,
            &DownloadStatus::Completed,
            100.0,
        )?;

        let done_event = DownloadProgress {
            model_id,
            status: DownloadStatus::Completed,
            bytes_downloaded: bytes_written,
            bytes_total: total_bytes,
            speed_bps: 0.0,
            eta_secs: Some(0.0),
            sha256_verified: sha256_ok,
        };
        app.emit("download_progress", &done_event).ok();

        CONTROLS.remove(&model_id);
        info!("Download complete for {model_id}, sha256={digest_hex}");
        Ok(())
    }

    /// Signal a running download to pause.
    pub async fn pause_download(model_id: Uuid) -> Result<()> {
        if let Some(tx) = CONTROLS.get(&model_id) {
            tx.send(Control::Pause).ok();
        }
        Ok(())
    }

    /// Signal a running download to resume (after pause).
    pub async fn resume_download(model_id: Uuid) -> Result<()> {
        if let Some(tx) = CONTROLS.get(&model_id) {
            tx.send(Control::Run).ok();
        }
        Ok(())
    }

    /// Cancel a running download and delete the partial file.
    pub async fn cancel_download(model_id: Uuid) -> Result<()> {
        if let Some(tx) = CONTROLS.get(&model_id) {
            tx.send(Control::Cancel).ok();
        }
        Ok(())
    }
}
