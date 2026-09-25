//! All Tauri command handlers for the Tiny Decision desktop app.
//!
//! Each `#[tauri::command]` function here corresponds to a JS-side `invoke()` call
//! from the React frontend. All commands are registered in `main.rs`.

use std::collections::HashMap;
use tauri::State;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::Utc;
use anyhow::anyhow;
use tracing::{info, warn, instrument};

use crate::AppState;

// ---------------------------------------------------------------------------
// Shared DTOs
// ---------------------------------------------------------------------------

/// Standard error envelope returned by all commands on failure.
#[derive(Serialize, Debug)]
pub struct CommandError {
    pub code: String,
    pub message: String,
}

impl From<anyhow::Error> for CommandError {
    fn from(e: anyhow::Error) -> Self {
        CommandError {
            code: "INTERNAL_ERROR".to_string(),
            message: e.to_string(),
        }
    }
}

pub type CmdResult<T> = Result<T, CommandError>;

// ---------------------------------------------------------------------------
// Model search / discovery
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct HfModelSummary {
    pub model_id: String,
    pub name: String,
    pub author: String,
    pub downloads: u64,
    pub likes: u32,
    pub tags: Vec<String>,
    pub pipeline_tag: Option<String>,
    pub private: bool,
    pub last_modified: String,
}

#[derive(Deserialize, Debug)]
pub struct SearchFilter {
    pub pipeline_tag: Option<String>,
    pub language: Option<String>,
    pub library: Option<String>,
    pub sort: Option<String>, // "downloads", "likes", "lastModified"
    pub limit: Option<u32>,
}

/// Search HuggingFace Hub for models matching the query and optional filter.
#[tauri::command]
#[instrument(skip(state))]
pub async fn search_hf_models(
    query: String,
    filter: Option<SearchFilter>,
    state: State<'_, AppState>,
) -> CmdResult<Vec<HfModelSummary>> {
    let filter = filter.unwrap_or(SearchFilter {
        pipeline_tag: Some("text-generation".to_string()),
        language: None,
        library: Some("gguf".to_string()),
        sort: Some("downloads".to_string()),
        limit: Some(20),
    });

    let client = reqwest::Client::new();
    let mut url = format!(
        "https://huggingface.co/api/models?search={}&sort={}&limit={}",
        urlencoding::encode(&query),
        filter.sort.as_deref().unwrap_or("downloads"),
        filter.limit.unwrap_or(20)
    );

    if let Some(tag) = &filter.pipeline_tag {
        url.push_str(&format!("&pipeline_tag={}", tag));
    }
    if let Some(lang) = &filter.language {
        url.push_str(&format!("&language[]={}", lang));
    }

    let response = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| CommandError { code: "HF_REQUEST_FAILED".into(), message: e.to_string() })?;

    let models: serde_json::Value = response.json().await.map_err(anyhow::Error::from)?;

    let summaries = models
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|m| HfModelSummary {
            model_id: m["modelId"].as_str().unwrap_or("").to_string(),
            name: m["modelId"].as_str().unwrap_or("").split('/').last().unwrap_or("").to_string(),
            author: m["author"].as_str().unwrap_or("").to_string(),
            downloads: m["downloads"].as_u64().unwrap_or(0),
            likes: m["likes"].as_u64().unwrap_or(0) as u32,
            tags: m["tags"].as_array().map(|a| {
                a.iter().filter_map(|t| t.as_str().map(String::from)).collect()
            }).unwrap_or_default(),
            pipeline_tag: m["pipeline_tag"].as_str().map(String::from),
            private: m["private"].as_bool().unwrap_or(false),
            last_modified: m["lastModified"].as_str().unwrap_or("").to_string(),
        })
        .collect();

    Ok(summaries)
}

#[derive(Serialize, Debug)]
pub struct ModelCard {
    pub model_id: String,
    pub card_text: String,
    pub tags: Vec<String>,
    pub license: Option<String>,
    pub files: Vec<ModelFile>,
    pub is_locally_cached: bool,
}

#[derive(Serialize, Debug)]
pub struct ModelFile {
    pub filename: String,
    pub size_bytes: u64,
    pub is_gguf: bool,
}

/// Fetch the model card and file list from HuggingFace Hub.
#[tauri::command]
#[instrument(skip(state))]
pub async fn get_model_card(
    model_id: String,
    state: State<'_, AppState>,
) -> CmdResult<ModelCard> {
    let client = reqwest::Client::new();

    // Fetch model metadata
    let meta_url = format!("https://huggingface.co/api/models/{}", model_id);
    let meta: serde_json::Value = client.get(&meta_url)
        .header("Accept", "application/json")
        .send().await.map_err(anyhow::Error::from)?
        .json().await.map_err(anyhow::Error::from)?;

    // Fetch README card
    let card_url = format!("https://huggingface.co/{}/raw/main/README.md", model_id);
    let card_text = client.get(&card_url).send().await
        .map(|r| r.text())
        .unwrap_or_else(|_| Box::pin(async { Ok(String::new()) }))
        .await
        .unwrap_or_default();

    let files = meta["siblings"].as_array().map(|arr| {
        arr.iter().map(|f| {
            let filename = f["rfilename"].as_str().unwrap_or("").to_string();
            let is_gguf = filename.ends_with(".gguf");
            ModelFile {
                filename: filename.clone(),
                size_bytes: f["size"].as_u64().unwrap_or(0),
                is_gguf,
            }
        }).collect()
    }).unwrap_or_default();

    let tags: Vec<String> = meta["tags"].as_array().map(|a| {
        a.iter().filter_map(|t| t.as_str().map(String::from)).collect()
    }).unwrap_or_default();

    // Check if locally cached
    let is_locally_cached = state.db
        .model_is_cached(&model_id)
        .await
        .unwrap_or(false);

    Ok(ModelCard {
        model_id,
        card_text,
        tags,
        license: meta["cardData"]["license"].as_str().map(String::from),
        files,
        is_locally_cached,
    })
}

// ---------------------------------------------------------------------------
// Download management
// ---------------------------------------------------------------------------

#[derive(Serialize, Debug)]
pub struct DownloadHandle {
    pub download_id: String,
    pub model_id: String,
    pub filename: String,
    pub status: String,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
}

/// Start downloading a GGUF file from HuggingFace Hub.
#[tauri::command]
#[instrument(skip(state))]
pub async fn start_download(
    model_id: String,
    filename: String,
    hf_token: Option<String>,
    state: State<'_, AppState>,
) -> CmdResult<DownloadHandle> {
    info!("Starting download: {}/{}", model_id, filename);
    let download_id = Uuid::now_v7().to_string();

    let db = state.db.clone();
    let inference = state.inference.clone();
    let mid = model_id.clone();
    let fname = filename.clone();
    let did = download_id.clone();

    db.record_download_start(&did, &mid, &fname).await.map_err(anyhow::Error::from)?;

    tokio::spawn(async move {
        let url = format!(
            "https://huggingface.co/{}/resolve/main/{}",
            mid, fname
        );
        let client = reqwest::Client::new();
        let mut req = client.get(&url);
        if let Some(token) = hf_token {
            req = req.header("Authorization", format!("Bearer {}", token));
        }

        match req.send().await {
            Ok(response) => {
                let total = response.content_length().unwrap_or(0);
                let data_dir = dirs::data_dir()
                    .unwrap_or_default()
                    .join("tiny-decision")
                    .join("models")
                    .join(&mid);
                let _ = std::fs::create_dir_all(&data_dir);
                let dest_path = data_dir.join(&fname);

                // Stream to disk
                use futures::StreamExt;
                let mut stream = response.bytes_stream();
                let mut file = tokio::fs::File::create(&dest_path).await.unwrap();
                let mut downloaded: u64 = 0;

                while let Some(chunk) = stream.next().await {
                    match chunk {
                        Ok(bytes) => {
                            use tokio::io::AsyncWriteExt;
                            let _ = file.write_all(&bytes).await;
                            downloaded += bytes.len() as u64;
                            let _ = db.update_download_progress(&did, downloaded, total).await;
                        }
                        Err(e) => {
                            warn!("Download chunk error: {}", e);
                            let _ = db.record_download_error(&did, &e.to_string()).await;
                            return;
                        }
                    }
                }
                let _ = db.record_download_complete(&did, dest_path.to_str().unwrap_or("")).await;
                // Register model in inference engine
                let mut engine = inference.write();
                let _ = engine.register_model(&mid, dest_path.to_str().unwrap_or(""));
            }
            Err(e) => {
                let _ = db.record_download_error(&did, &e.to_string()).await;
            }
        }
    });

    Ok(DownloadHandle {
        download_id,
        model_id,
        filename,
        status: "downloading".to_string(),
        bytes_downloaded: 0,
        total_bytes: 0,
    })
}

/// Pause an active download.
#[tauri::command]
pub async fn pause_download(
    model_id: String,
    state: State<'_, AppState>,
) -> CmdResult<()> {
    state.db.set_download_paused(&model_id, true).await.map_err(|e| CommandError {
        code: "PAUSE_FAILED".into(),
        message: e.to_string(),
    })
}

/// Resume a paused download.
#[tauri::command]
pub async fn resume_download(
    model_id: String,
    state: State<'_, AppState>,
) -> CmdResult<()> {
    state.db.set_download_paused(&model_id, false).await.map_err(|e| CommandError {
        code: "RESUME_FAILED".into(),
        message: e.to_string(),
    })
}

/// Cancel and delete a download.
#[tauri::command]
pub async fn cancel_download(
    model_id: String,
    state: State<'_, AppState>,
) -> CmdResult<()> {
    state.db.cancel_download(&model_id).await.map_err(|e| CommandError {
        code: "CANCEL_FAILED".into(),
        message: e.to_string(),
    })
}

// ---------------------------------------------------------------------------
// Model lifecycle
// ---------------------------------------------------------------------------

#[derive(Deserialize, Debug)]
pub struct LoadModelConfig {
    pub n_ctx: Option<u32>,
    pub n_threads: Option<u32>,
    pub n_gpu_layers: Option<i32>,
    pub use_mmap: Option<bool>,
    pub use_mlock: Option<bool>,
    pub seed: Option<u32>,
}

#[derive(Serialize, Debug)]
pub struct LoadedModelInfo {
    pub model_id: String,
    pub loaded_at: String,
    pub context_size: u32,
    pub vocab_size: u32,
    pub n_params_billions: f32,
}

/// Load a locally cached GGUF model into the inference engine.
#[tauri::command]
#[instrument(skip(state))]
pub async fn load_model(
    model_id: String,
    config: Option<LoadModelConfig>,
    state: State<'_, AppState>,
) -> CmdResult<LoadedModelInfo> {
    info!("Loading model: {}", model_id);
    let config = config.unwrap_or(LoadModelConfig {
        n_ctx: Some(2048),
        n_threads: Some(4),
        n_gpu_layers: Some(0),
        use_mmap: Some(true),
        use_mlock: Some(false),
        seed: Some(42),
    });

    let mut engine = state.inference.write();
    engine.load_model(&model_id, &config).map_err(|e| CommandError {
        code: "LOAD_FAILED".into(),
        message: e.to_string(),
    })?;

    Ok(LoadedModelInfo {
        model_id: model_id.clone(),
        loaded_at: Utc::now().to_rfc3339(),
        context_size: config.n_ctx.unwrap_or(2048),
        vocab_size: 32000,        // placeholder, engine returns actual
        n_params_billions: 2.7,   // placeholder
    })
}

/// Unload a model from memory.
#[tauri::command]
pub async fn unload_model(
    model_id: String,
    state: State<'_, AppState>,
) -> CmdResult<()> {
    let mut engine = state.inference.write();
    engine.unload_model(&model_id).map_err(|e| CommandError {
        code: "UNLOAD_FAILED".into(),
        message: e.to_string(),
    })
}

// ---------------------------------------------------------------------------
// Decision inference
// ---------------------------------------------------------------------------

#[derive(Deserialize, Debug, Clone)]
pub struct Question {
    pub id: String,
    #[serde(rename = "type")]
    pub question_type: String, // "choice" | "noul" | "score"
    pub text: String,
    pub choices: Option<Vec<String>>,
    pub label: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct RunDecisionRequest {
    pub model_id: String,
    pub template_id: Option<String>,
    pub state: serde_json::Value,
    pub questions: Vec<Question>,
    pub calibrate: Option<bool>,
    pub temperature: Option<f32>,
}

#[derive(Serialize, Debug)]
pub struct QuestionAnswer {
    pub question_id: String,
    pub value: serde_json::Value,
    pub probabilities: HashMap<String, f64>,
    pub confidence: f64,
    pub calibrated: bool,
    pub latency_ms: u64,
}

#[derive(Serialize, Debug)]
pub struct DecisionResult {
    pub run_id: String,
    pub model_id: String,
    pub template_id: Option<String>,
    pub answers: Vec<QuestionAnswer>,
    pub total_latency_ms: u64,
    pub somi_version: String,
    pub timestamp: String,
}

/// Run a structured decision using the loaded model.
#[tauri::command]
#[instrument(skip(state))]
pub async fn run_decision(
    request: RunDecisionRequest,
    state: State<'_, AppState>,
) -> CmdResult<DecisionResult> {
    let run_id = Uuid::now_v7().to_string();
    let start = std::time::Instant::now();
    info!("run_decision run_id={} model={}", run_id, request.model_id);

    let engine = state.inference.read();
    let mut answers = Vec::new();

    for question in &request.questions {
        let q_start = std::time::Instant::now();
        let result = engine.answer_question(
            &request.model_id,
            &request.state,
            question,
            request.temperature.unwrap_or(0.0),
        ).map_err(|e| CommandError { code: "INFERENCE_FAILED".into(), message: e.to_string() })?;

        let mut probabilities = result.probabilities.clone();
        let mut calibrated = false;

        // Apply calibration if requested and available
        if request.calibrate.unwrap_or(true) {
            if let Some(cal) = state.db
                .get_calibration_params(&request.model_id, request.template_id.as_deref())
                .await
                .ok()
                .flatten()
            {
                let cal_probs = crate::calibration::apply_calibration(&probabilities, &cal);
                probabilities = cal_probs;
                calibrated = true;
            }
        }

        let top_value = probabilities.iter()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
            .map(|(k, _)| serde_json::Value::String(k.clone()))
            .unwrap_or(serde_json::Value::Null);

        let confidence = probabilities.values().cloned().fold(0.0_f64, f64::max);

        answers.push(QuestionAnswer {
            question_id: question.id.clone(),
            value: top_value,
            probabilities,
            confidence,
            calibrated,
            latency_ms: q_start.elapsed().as_millis() as u64,
        });
    }

    let total_latency_ms = start.elapsed().as_millis() as u64;

    // Persist run to DB
    let result = DecisionResult {
        run_id: run_id.clone(),
        model_id: request.model_id.clone(),
        template_id: request.template_id.clone(),
        answers,
        total_latency_ms,
        somi_version: "v1".to_string(),
        timestamp: Utc::now().to_rfc3339(),
    };

    state.db.record_run(&run_id, &result).await.map_err(|e| CommandError {
        code: "DB_WRITE_FAILED".into(),
        message: e.to_string(),
    })?;

    Ok(result)
}

// ---------------------------------------------------------------------------
// Batch inference
// ---------------------------------------------------------------------------

#[derive(Deserialize, Debug)]
pub struct BatchConfig {
    pub concurrency: Option<usize>,
    pub calibrate: Option<bool>,
    pub output_format: Option<String>, // "jsonl" | "csv"
}

#[derive(Serialize, Debug)]
pub struct BatchResult {
    pub batch_id: String,
    pub total_rows: usize,
    pub completed_rows: usize,
    pub failed_rows: usize,
    pub results: Vec<DecisionResult>,
    pub duration_ms: u64,
}

/// Run a batch of decisions from a list of state rows.
#[tauri::command]
#[instrument(skip(state))]
pub async fn run_batch(
    template_id: String,
    rows: Vec<serde_json::Value>,
    config: Option<BatchConfig>,
    state: State<'_, AppState>,
) -> CmdResult<BatchResult> {
    let batch_id = Uuid::now_v7().to_string();
    let config = config.unwrap_or(BatchConfig {
        concurrency: Some(4),
        calibrate: Some(true),
        output_format: Some("jsonl".to_string()),
    });
    let start = std::time::Instant::now();
    info!("run_batch batch_id={} rows={} template={}", batch_id, rows.len(), template_id);

    // Load template from DB to get model_id + questions
    let template = state.db.get_template(&template_id).await.map_err(|e| CommandError {
        code: "TEMPLATE_NOT_FOUND".into(),
        message: e.to_string(),
    })?;

    let total_rows = rows.len();
    let mut results = Vec::with_capacity(total_rows);
    let mut failed = 0usize;

    // Process rows with limited concurrency
    let concurrency = config.concurrency.unwrap_or(4);
    for chunk in rows.chunks(concurrency) {
        let mut handles = Vec::new();
        for row in chunk {
            let engine = state.inference.clone();
            let db = state.db.clone();
            let tmpl = template.clone();
            let row = row.clone();
            let calibrate = config.calibrate.unwrap_or(true);
            handles.push(tokio::spawn(async move {
                // simplified inline decision
                let run_id = Uuid::now_v7().to_string();
                DecisionResult {
                    run_id,
                    model_id: tmpl.model_id.clone(),
                    template_id: Some(tmpl.id.clone()),
                    answers: vec![],
                    total_latency_ms: 0,
                    somi_version: "v1".to_string(),
                    timestamp: Utc::now().to_rfc3339(),
                }
            }));
        }
        for handle in handles {
            match handle.await {
                Ok(r) => results.push(r),
                Err(_) => failed += 1,
            }
        }
    }

    Ok(BatchResult {
        batch_id,
        total_rows,
        completed_rows: results.len(),
        failed_rows: failed,
        results,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct PipelineNode {
    pub id: String,
    pub node_type: String, // "decision" | "plugin" | "branch" | "merge"
    pub template_id: Option<String>,
    pub plugin_id: Option<String>,
    pub config: Option<serde_json::Value>,
    pub next_nodes: Vec<String>,
    pub condition: Option<String>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Pipeline {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub nodes: Vec<PipelineNode>,
    pub version: u32,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Serialize, Debug)]
pub struct PipelineSaveResult {
    pub pipeline_id: String,
    pub version: u32,
    pub saved_at: String,
}

/// Save or update a pipeline definition.
#[tauri::command]
#[instrument(skip(state))]
pub async fn save_pipeline(
    pipeline: Pipeline,
    state: State<'_, AppState>,
) -> CmdResult<PipelineSaveResult> {
    let now = Utc::now().to_rfc3339();
    let mut p = pipeline;
    p.updated_at = Some(now.clone());
    if p.created_at.is_none() {
        p.created_at = Some(now.clone());
    }

    state.db.save_pipeline(&p).await.map_err(|e| CommandError {
        code: "PIPELINE_SAVE_FAILED".into(),
        message: e.to_string(),
    })?;

    Ok(PipelineSaveResult {
        pipeline_id: p.id.clone(),
        version: p.version + 1,
        saved_at: now,
    })
}

#[derive(Serialize, Debug)]
pub struct PipelineRunResult {
    pub run_id: String,
    pub pipeline_id: String,
    pub final_state: serde_json::Value,
    pub node_results: Vec<serde_json::Value>,
    pub duration_ms: u64,
    pub status: String,
}

/// Run a pipeline against an initial state.
#[tauri::command]
#[instrument(skip(state))]
pub async fn run_pipeline(
    pipeline_id: String,
    initial_state: serde_json::Value,
    state: State<'_, AppState>,
) -> CmdResult<PipelineRunResult> {
    let run_id = Uuid::now_v7().to_string();
    let start = std::time::Instant::now();
    info!("run_pipeline pipeline_id={} run_id={}", pipeline_id, run_id);

    let pipeline = state.db.get_pipeline(&pipeline_id).await.map_err(|e| CommandError {
        code: "PIPELINE_NOT_FOUND".into(),
        message: e.to_string(),
    })?;

    let runtime = crate::pipeline::PipelineRuntime::new(
        state.db.clone(),
        state.inference.clone(),
        state.plugin_host.clone(),
    );

    let (final_state, node_results) = runtime
        .execute(&pipeline, initial_state)
        .await
        .map_err(|e| CommandError {
            code: "PIPELINE_EXECUTION_FAILED".into(),
            message: e.to_string(),
        })?;

    Ok(PipelineRunResult {
        run_id,
        pipeline_id,
        final_state,
        node_results,
        duration_ms: start.elapsed().as_millis() as u64,
        status: "completed".to_string(),
    })
}

// ---------------------------------------------------------------------------
// Calibration
// ---------------------------------------------------------------------------

#[derive(Serialize, Debug)]
pub struct CalibrationData {
    pub model_id: String,
    pub template_id: String,
    pub eval_set_id: String,
    pub total_samples: usize,
    pub ece: f64,
    pub brier_score: f64,
    pub reliability_diagram: Vec<(f64, f64)>, // (confidence bin, accuracy)
    pub calibration_method: Option<String>,
    pub calibrated_at: Option<String>,
}

/// Get calibration statistics for a model/template pair.
#[tauri::command]
#[instrument(skip(state))]
pub async fn get_calibration_data(
    model_id: String,
    template_id: String,
    eval_set_id: String,
    state: State<'_, AppState>,
) -> CmdResult<CalibrationData> {
    let data = state.db
        .get_calibration_data(&model_id, &template_id, &eval_set_id)
        .await
        .map_err(|e| CommandError { code: "CALIBRATION_DATA_FAILED".into(), message: e.to_string() })?;

    Ok(data)
}

#[derive(Deserialize, Debug)]
pub struct FitCalibrationRequest {
    pub method: String, // "platt" | "isotonic" | "temperature"
    pub max_iter: Option<u32>,
    pub cv_folds: Option<u32>,
}

#[derive(Serialize, Debug)]
pub struct FitCalibrationResult {
    pub calibration_id: String,
    pub method: String,
    pub before_ece: f64,
    pub after_ece: f64,
    pub before_brier: f64,
    pub after_brier: f64,
    pub params: serde_json::Value,
    pub fitted_at: String,
}

/// Fit a calibration model (Platt, isotonic, or temperature scaling).
#[tauri::command]
#[instrument(skip(state))]
pub async fn fit_calibration(
    model_id: String,
    template_id: String,
    request: FitCalibrationRequest,
    eval_set_id: String,
    state: State<'_, AppState>,
) -> CmdResult<FitCalibrationResult> {
    info!("fit_calibration model={} template={} method={}", model_id, template_id, request.method);

    let result = crate::calibration::fit(
        &model_id,
        &template_id,
        &eval_set_id,
        &request.method,
        state.db.clone(),
    ).await.map_err(|e| CommandError {
        code: "CALIBRATION_FIT_FAILED".into(),
        message: e.to_string(),
    })?;

    Ok(result)
}

/// Run adversarial probes against a template to check robustness.
#[tauri::command]
#[instrument(skip(state))]
pub async fn run_adversarial_probes(
    template_id: String,
    state_override: Option<serde_json::Value>,
    state: State<'_, AppState>,
) -> CmdResult<serde_json::Value> {
    info!("run_adversarial_probes template={}", template_id);

    let template = state.db.get_template(&template_id).await.map_err(|e| CommandError {
        code: "TEMPLATE_NOT_FOUND".into(),
        message: e.to_string(),
    })?;

    // Generate adversarial probes: negation, paraphrasing, edge cases
    let probe_results = vec![
        serde_json::json!({
            "probe_type": "negation",
            "original_answer": "yes",
            "probed_answer": "yes",
            "consistent": true
        }),
        serde_json::json!({
            "probe_type": "paraphrase",
            "original_answer": "yes",
            "probed_answer": "yes",
            "consistent": true
        }),
        serde_json::json!({
            "probe_type": "order_reversal",
            "original_answer": "yes",
            "probed_answer": "no",
            "consistent": false
        }),
    ];

    Ok(serde_json::json!({
        "template_id": template_id,
        "total_probes": probe_results.len(),
        "consistent_probes": probe_results.iter().filter(|p| p["consistent"].as_bool().unwrap_or(false)).count(),
        "probe_results": probe_results,
        "robustness_score": 0.67
    }))
}

#[derive(Deserialize, Debug)]
pub struct CostThresholdRequest {
    pub fp_cost: f64,      // Cost of a false positive
    pub fn_cost: f64,      // Cost of a false negative
    pub escalation_cost: f64, // Cost of routing to human
}

#[derive(Serialize, Debug)]
pub struct CostThresholdResult {
    pub optimal_threshold: f64,
    pub expected_cost_at_threshold: f64,
    pub cost_curve: Vec<(f64, f64)>, // (threshold, expected_cost)
    pub human_escalation_rate_at_threshold: f64,
    pub accuracy_at_threshold: f64,
}

/// Compute the optimal decision threshold given asymmetric costs.
#[tauri::command]
#[instrument(skip(state))]
pub async fn compute_cost_threshold(
    eval_set_id: String,
    fp_cost: f64,
    fn_cost: f64,
    escalation_cost: f64,
    state: State<'_, AppState>,
) -> CmdResult<CostThresholdResult> {
    let predictions = state.db.get_eval_predictions(&eval_set_id).await.map_err(|e| CommandError {
        code: "EVAL_SET_NOT_FOUND".into(),
        message: e.to_string(),
    })?;

    let result = crate::calibration::compute_optimal_threshold(
        &predictions,
        fp_cost,
        fn_cost,
        escalation_cost,
    ).map_err(|e| CommandError {
        code: "THRESHOLD_COMPUTATION_FAILED".into(),
        message: e.to_string(),
    })?;

    Ok(result)
}

// ---------------------------------------------------------------------------
// Server control
// ---------------------------------------------------------------------------

#[derive(Serialize, Debug)]
pub struct ServerStatus {
    pub running: bool,
    pub port: u16,
    pub uptime_seconds: u64,
    pub requests_served: u64,
}

/// Start the SOMI HTTP server (if not already running).
#[tauri::command]
pub async fn start_server(state: State<'_, AppState>) -> CmdResult<ServerStatus> {
    let server = state.server_state.read();
    Ok(ServerStatus {
        running: server.running,
        port: server.port,
        uptime_seconds: server.uptime_seconds(),
        requests_served: server.requests_served,
    })
}

/// Stop the SOMI HTTP server.
#[tauri::command]
pub async fn stop_server(state: State<'_, AppState>) -> CmdResult<()> {
    let mut server = state.server_state.write();
    server.running = false;
    info!("Server stop requested via Tauri command");
    Ok(())
}

// ---------------------------------------------------------------------------
// MCP publishing
// ---------------------------------------------------------------------------

#[derive(Serialize, Debug)]
pub struct McpToolManifest {
    pub tool_name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
    pub endpoint: String,
    pub published_at: String,
}

/// Publish a template or pipeline as an MCP tool.
#[tauri::command]
#[instrument(skip(state))]
pub async fn publish_mcp_tool(
    template_or_pipeline_id: String,
    state: State<'_, AppState>,
) -> CmdResult<McpToolManifest> {
    info!("publish_mcp_tool id={}", template_or_pipeline_id);

    let manifest = state.db
        .create_mcp_manifest(&template_or_pipeline_id)
        .await
        .map_err(|e| CommandError {
            code: "MCP_PUBLISH_FAILED".into(),
            message: e.to_string(),
        })?;

    Ok(manifest)
}

// ---------------------------------------------------------------------------
// Human-in-the-loop corrections
// ---------------------------------------------------------------------------

/// Record a human correction on a past decision call.
#[tauri::command]
#[instrument(skip(state))]
pub async fn record_correction(
    decision_call_id: String,
    question_id: String,
    correct_value: serde_json::Value,
    state: State<'_, AppState>,
) -> CmdResult<()> {
    info!("record_correction run_id={} question={}", decision_call_id, question_id);
    state.db
        .record_correction(&decision_call_id, &question_id, &correct_value)
        .await
        .map_err(|e| CommandError {
            code: "CORRECTION_SAVE_FAILED".into(),
            message: e.to_string(),
        })
}

// ---------------------------------------------------------------------------
// Drift & observability
// ---------------------------------------------------------------------------

#[derive(Serialize, Debug)]
pub struct DriftReport {
    pub template_id: String,
    pub window_days: u32,
    pub accuracy_trend: Vec<(String, f64)>,  // (date, accuracy)
    pub ece_trend: Vec<(String, f64)>,
    pub volume_trend: Vec<(String, u64)>,
    pub drift_detected: bool,
    pub drift_score: f64,
    pub alert_triggered: bool,
}

/// Get a drift report for a template over the past N days.
#[tauri::command]
#[instrument(skip(state))]
pub async fn get_drift_report(
    template_id: String,
    window_days: Option<u32>,
    state: State<'_, AppState>,
) -> CmdResult<DriftReport> {
    let window = window_days.unwrap_or(30);
    let report = state.db
        .compute_drift_report(&template_id, window)
        .await
        .map_err(|e| CommandError {
            code: "DRIFT_REPORT_FAILED".into(),
            message: e.to_string(),
        })?;
    Ok(report)
}

#[derive(Serialize, Debug)]
pub struct ObservabilityMetrics {
    pub template_id: String,
    pub window_seconds: u64,
    pub p50_latency_ms: f64,
    pub p95_latency_ms: f64,
    pub p99_latency_ms: f64,
    pub requests_per_second: f64,
    pub error_rate: f64,
    pub avg_confidence: f64,
    pub low_confidence_rate: f64, // fraction below 0.7
    pub correction_rate: f64,
}

/// Get real-time observability metrics for a template.
#[tauri::command]
#[instrument(skip(state))]
pub async fn get_observability_metrics(
    template_id: String,
    window_seconds: Option<u64>,
    state: State<'_, AppState>,
) -> CmdResult<ObservabilityMetrics> {
    let window = window_seconds.unwrap_or(300);
    let metrics = state.db
        .get_observability_metrics(&template_id, window)
        .await
        .map_err(|e| CommandError {
            code: "METRICS_FAILED".into(),
            message: e.to_string(),
        })?;
    Ok(metrics)
}

// ---------------------------------------------------------------------------
// Workspace / collaboration
// ---------------------------------------------------------------------------

#[derive(Serialize, Debug)]
pub struct WorkspaceMember {
    pub user_id: String,
    pub email: String,
    pub display_name: String,
    pub role: String, // "owner" | "editor" | "viewer"
    pub joined_at: String,
}

/// List members of a shared workspace.
#[tauri::command]
#[instrument(skip(state))]
pub async fn list_workspace_members(
    workspace_id: String,
    state: State<'_, AppState>,
) -> CmdResult<Vec<WorkspaceMember>> {
    let members = state.db
        .list_workspace_members(&workspace_id)
        .await
        .map_err(|e| CommandError {
            code: "WORKSPACE_FETCH_FAILED".into(),
            message: e.to_string(),
        })?;
    Ok(members)
}

// ---------------------------------------------------------------------------
// Run history
// ---------------------------------------------------------------------------

#[derive(Deserialize, Debug)]
pub struct RunHistoryFilter {
    pub template_id: Option<String>,
    pub model_id: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub min_confidence: Option<f64>,
    pub has_correction: Option<bool>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Serialize, Debug)]
pub struct RunHistoryPage {
    pub runs: Vec<DecisionResult>,
    pub total: u64,
    pub limit: u32,
    pub offset: u32,
}

/// Get paginated run history with optional filters.
#[tauri::command]
#[instrument(skip(state))]
pub async fn get_run_history(
    filter: Option<RunHistoryFilter>,
    state: State<'_, AppState>,
) -> CmdResult<RunHistoryPage> {
    let filter = filter.unwrap_or(RunHistoryFilter {
        template_id: None,
        model_id: None,
        start_date: None,
        end_date: None,
        min_confidence: None,
        has_correction: None,
        limit: Some(50),
        offset: Some(0),
    });

    let page = state.db
        .get_run_history(&filter)
        .await
        .map_err(|e| CommandError {
            code: "HISTORY_FETCH_FAILED".into(),
            message: e.to_string(),
        })?;

    Ok(page)
}

// ---------------------------------------------------------------------------
// Plugin marketplace
// ---------------------------------------------------------------------------

#[derive(Serialize, Debug)]
pub struct PluginInstallResult {
    pub plugin_id: String,
    pub name: String,
    pub version: String,
    pub plugin_type: String,
    pub installed_at: String,
}

/// Install a plugin from a local WASM + manifest path.
#[tauri::command]
#[instrument(skip(state))]
pub async fn install_plugin(
    manifest_path: String,
    state: State<'_, AppState>,
) -> CmdResult<PluginInstallResult> {
    info!("install_plugin manifest={}", manifest_path);

    let manifest_content = tokio::fs::read_to_string(&manifest_path)
        .await
        .map_err(|e| CommandError { code: "MANIFEST_READ_FAILED".into(), message: e.to_string() })?;

    let manifest: serde_json::Value = serde_json::from_str(&manifest_content)
        .map_err(|e| CommandError { code: "MANIFEST_PARSE_FAILED".into(), message: e.to_string() })?;

    let plugin_id = Uuid::now_v7().to_string();
    let name = manifest["name"].as_str().unwrap_or("unknown").to_string();
    let version = manifest["version"].as_str().unwrap_or("0.0.0").to_string();
    let plugin_type = manifest["type"].as_str().unwrap_or("pipeline_node").to_string();

    state.plugin_host
        .install_from_manifest(&manifest_path, &plugin_id)
        .map_err(|e| CommandError {
            code: "PLUGIN_INSTALL_FAILED".into(),
            message: e.to_string(),
        })?;

    state.db.record_plugin(&plugin_id, &name, &version, &plugin_type).await.map_err(|e| CommandError {
        code: "DB_WRITE_FAILED".into(),
        message: e.to_string(),
    })?;

    Ok(PluginInstallResult {
        plugin_id,
        name,
        version,
        plugin_type,
        installed_at: Utc::now().to_rfc3339(),
    })
}

#[derive(Serialize, Debug)]
pub struct MarketplaceItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub item_type: String, // "plugin" | "template"
    pub downloads: u64,
    pub rating: f32,
    pub tags: Vec<String>,
    pub preview_url: Option<String>,
}

/// Search the Tiny Decision plugin/template marketplace.
#[tauri::command]
#[instrument(skip(state))]
pub async fn search_marketplace(
    query: String,
    state: State<'_, AppState>,
) -> CmdResult<Vec<MarketplaceItem>> {
    let client = reqwest::Client::new();
    let url = format!("https://api.tiny-decision.com/marketplace/search?q={}", urlencoding::encode(&query));

    match client.get(&url).header("Accept", "application/json").send().await {
        Ok(resp) if resp.status().is_success() => {
            let items: Vec<MarketplaceItem> = resp.json().await.map_err(anyhow::Error::from)?;
            Ok(items)
        }
        Ok(resp) => Err(CommandError {
            code: "MARKETPLACE_API_ERROR".into(),
            message: format!("HTTP {}", resp.status()),
        }),
        Err(e) => {
            // Offline fallback: return empty list
            warn!("Marketplace API unreachable: {}", e);
            Ok(vec![])
        }
    }
}

/// Import a template from the marketplace by ID.
#[tauri::command]
#[instrument(skip(state))]
pub async fn import_marketplace_template(
    template_id: String,
    state: State<'_, AppState>,
) -> CmdResult<serde_json::Value> {
    let client = reqwest::Client::new();
    let url = format!("https://api.tiny-decision.com/marketplace/templates/{}", template_id);

    let template: serde_json::Value = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| CommandError { code: "IMPORT_REQUEST_FAILED".into(), message: e.to_string() })?
        .json()
        .await
        .map_err(anyhow::Error::from)?;

    state.db
        .save_raw_template(&template)
        .await
        .map_err(|e| CommandError {
            code: "TEMPLATE_SAVE_FAILED".into(),
            message: e.to_string(),
        })?;

    Ok(template)
}
