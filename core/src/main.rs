//! Tiny Decision – main Tauri application entry point.
//!
//! Registers all Tauri IPC commands and initialises the application state
//! (database, HTTP server, inference registry).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod calibration;
mod db;
mod flywheel;
mod hf;
mod inference;
mod mcp;
mod pipeline;
mod plugins;
mod server;
mod somi;
pub mod types;

use anyhow::Result;
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use rusqlite::Connection;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};
use tracing_subscriber::{EnvFilter, fmt};
use types::*;
use uuid::Uuid;

// ─────────────────────────────────────────────────────────────────────────────
// Global application state
// ─────────────────────────────────────────────────────────────────────────────

/// Shared mutable application state injected into every Tauri command via
/// `tauri::State<AppState>`.
pub struct AppState {
    pub db: Mutex<Connection>,
    pub db_path: PathBuf,
}

static APP_STATE: OnceCell<AppState> = OnceCell::new();

// ─────────────────────────────────────────────────────────────────────────────
// Tauri IPC commands
// ─────────────────────────────────────────────────────────────────────────────

// ── Workspace commands ────────────────────────────────────────────────────────

#[tauri::command]
async fn cmd_list_workspaces(state: State<'_, AppState>) -> Result<Vec<Workspace>, String> {
    let conn = state.db.lock();
    db::list_workspaces(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_create_workspace(
    state: State<'_, AppState>,
    name: String,
    storage_path: String,
) -> Result<Workspace, String> {
    let now = chrono::Utc::now();
    let ws = Workspace {
        id: Uuid::new_v4(),
        name,
        description: None,
        storage_path,
        created_at: now,
        updated_at: now,
        settings: WorkspaceSettings {
            default_escalation_policy_id: None,
            jev_api_url: None,
            flywheel_enabled: true,
            retention_days: Some(90),
        },
        is_default: false,
    };
    let conn = state.db.lock();
    db::upsert_workspace(&conn, &ws).map_err(|e| e.to_string())?;
    Ok(ws)
}

// ── Template commands ─────────────────────────────────────────────────────────

#[tauri::command]
async fn cmd_upsert_template(
    state: State<'_, AppState>,
    template: DecisionTemplate,
) -> Result<(), String> {
    let conn = state.db.lock();
    db::upsert_template(&conn, &template).map_err(|e| e.to_string())
}

// ── Model / HuggingFace commands ──────────────────────────────────────────────

#[tauri::command]
async fn cmd_search_hf_models(
    query: String,
    filter: Option<String>,
) -> Result<Vec<serde_json::Value>, String> {
    hf::search_models(&query, filter.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_get_model_card(model_id: String) -> Result<hf::ModelCard, String> {
    hf::get_model_card(&model_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_start_download(
    app: AppHandle,
    state: State<'_, AppState>,
    model: Model,
) -> Result<(), String> {
    let model_id = model.id;
    {
        let conn = state.db.lock();
        db::upsert_model(&conn, &model).map_err(|e| e.to_string())?;
    }
    // Spawn detached download task; progress emitted as Tauri events.
    tokio::spawn(async move {
        if let Err(e) = hf::download_manager::start_download(app, model_id).await {
            tracing::error!("Download failed for {model_id}: {e}");
        }
    });
    Ok(())
}

#[tauri::command]
async fn cmd_pause_download(model_id: Uuid) -> Result<(), String> {
    hf::download_manager::pause_download(model_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_cancel_download(model_id: Uuid) -> Result<(), String> {
    hf::download_manager::cancel_download(model_id)
        .await
        .map_err(|e| e.to_string())
}

// ── Inference commands ────────────────────────────────────────────────────────

#[tauri::command]
async fn cmd_load_model(model_id: Uuid, state: State<'_, AppState>) -> Result<(), String> {
    let model = {
        // Placeholder – real impl fetches from DB
        let _conn = state.db.lock();
        // TODO: db::get_model(&conn, &model_id)
        return Err("Not yet implemented".into());
    };
    #[allow(unreachable_code)]
    inference::load_model(&model).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_unload_model(model_id: Uuid) -> Result<(), String> {
    inference::unload_model(model_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_list_loaded_models() -> Vec<inference::LoadedModelInfo> {
    inference::list_loaded_models().await
}

// ── Decision commands ─────────────────────────────────────────────────────────

#[tauri::command]
async fn cmd_decide(
    state: State<'_, AppState>,
    request: DecideRequest,
) -> Result<DecideResponse, String> {
    server::cli_decide(
        &request.template_id.to_string(),
        request.state,
    )
    .await
    .map_err(|e| e.to_string())
}

// ── Calibration commands ──────────────────────────────────────────────────────

#[tauri::command]
async fn cmd_compute_ece(
    state: State<'_, AppState>,
    model_id: Uuid,
    question_id: Option<Uuid>,
) -> Result<f64, String> {
    let pairs = {
        let _conn = state.db.lock();
        vec![] // TODO: load from DB
    };
    if pairs.is_empty() {
        return Err("No labelled predictions found".into());
    }
    Ok(calibration::compute_ece(&pairs))
}

#[tauri::command]
async fn cmd_fit_calibration(
    state: State<'_, AppState>,
    model_id: Uuid,
    method: CalibrationMethod,
    eval_set_id: Option<Uuid>,
) -> Result<CalibrationProfile, String> {
    // Stub – full impl in calibration module
    Err("Not yet implemented".into())
}

// ── Flywheel commands ─────────────────────────────────────────────────────────

#[tauri::command]
async fn cmd_record_correction(
    state: State<'_, AppState>,
    payload: FeedbackPayload,
) -> Result<(), String> {
    let conn = state.db.lock();
    flywheel::record_correction(
        &conn,
        &payload.decision_call_id,
        &payload.question_id,
        &payload.correct_value,
    )
    .map_err(|e| e.to_string())
}

// ── Pipeline commands ─────────────────────────────────────────────────────────

#[tauri::command]
async fn cmd_run_pipeline(
    pipeline_id: Uuid,
    state_data: serde_json::Value,
    app_state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    Err("Not yet implemented".into())
}

// ── Plugin commands ───────────────────────────────────────────────────────────

#[tauri::command]
async fn cmd_load_plugin(
    manifest_path: String,
    state: State<'_, AppState>,
) -> Result<Plugin, String> {
    let plugin = plugins::load_plugin(&manifest_path)
        .await
        .map_err(|e| e.to_string())?;
    let conn = state.db.lock();
    db::upsert_plugin(&conn, &plugin).map_err(|e| e.to_string())?;
    Ok(plugin)
}

#[tauri::command]
async fn cmd_execute_plugin(
    plugin_id: Uuid,
    input: serde_json::Value,
) -> Result<serde_json::Value, String> {
    plugins::execute_plugin_wasm(plugin_id, input)
        .await
        .map_err(|e| e.to_string())
}

// ── MCP commands ──────────────────────────────────────────────────────────────

#[tauri::command]
async fn cmd_generate_mcp_manifest(source_id: String) -> Result<McpToolManifest, String> {
    mcp::generate_mcp_manifest(&source_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_export_mcp_bundle(source_id: String, out_path: String) -> Result<(), String> {
    let manifest = mcp::generate_mcp_manifest(&source_id)
        .await
        .map_err(|e| e.to_string())?;
    let bytes = mcp::export_standalone_server(&manifest).map_err(|e| e.to_string())?;
    std::fs::write(&out_path, bytes).map_err(|e| e.to_string())
}

// ─────────────────────────────────────────────────────────────────────────────
// Application bootstrap
// ─────────────────────────────────────────────────────────────────────────────

fn main() {
    // Initialise tracing.
    fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    tauri::Builder::default()
        .setup(|app| {
            // Determine the database path inside the app data directory.
            let app_data = app
                .path()
                .app_data_dir()
                .expect("Cannot resolve app data dir");
            std::fs::create_dir_all(&app_data)?;
            let db_path = app_data.join("tiny-decision.db");

            tracing::info!("Opening database at {}", db_path.display());
            let conn = db::open(&db_path).expect("Failed to open database");

            // Initialise global state.
            APP_STATE
                .set(AppState {
                    db: Mutex::new(conn),
                    db_path: db_path.clone(),
                })
                .expect("AppState already initialised");

            // Start the embedded HTTP server.
            let port = 11535u16;
            tokio::spawn(async move {
                if let Err(e) = server::run_server(port).await {
                    tracing::error!("HTTP server error: {e}");
                }
            });

            tracing::info!("Tiny Decision started");
            Ok(())
        })
        .manage(AppState {
            db: Mutex::new(
                // Re-open for the managed state (setup runs before manage is
                // injected, so we open a second handle here).
                db::open(
                    &dirs::data_dir()
                        .unwrap_or_else(|| PathBuf::from("."))
                        .join("tiny-decision")
                        .join("tiny-decision.db"),
                )
                .expect("Failed to open database for managed state"),
            ),
            db_path: dirs::data_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("tiny-decision")
                .join("tiny-decision.db"),
        })
        .invoke_handler(tauri::generate_handler![
            // Workspace
            cmd_list_workspaces,
            cmd_create_workspace,
            // Template
            cmd_upsert_template,
            // HuggingFace
            cmd_search_hf_models,
            cmd_get_model_card,
            cmd_start_download,
            cmd_pause_download,
            cmd_cancel_download,
            // Inference
            cmd_load_model,
            cmd_unload_model,
            cmd_list_loaded_models,
            // Decision
            cmd_decide,
            // Calibration
            cmd_compute_ece,
            cmd_fit_calibration,
            // Flywheel
            cmd_record_correction,
            // Pipeline
            cmd_run_pipeline,
            // Plugins
            cmd_load_plugin,
            cmd_execute_plugin,
            // MCP
            cmd_generate_mcp_manifest,
            cmd_export_mcp_bundle,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
