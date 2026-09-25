// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod inference;
mod server;
mod plugins;
mod calibration;
mod router;
mod models;
mod pipeline;

use std::sync::Arc;
use parking_lot::RwLock;
use tauri::{
    Manager, RunEvent, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem,
    CustomMenuItem, WindowEvent, AppHandle,
};
use tauri_plugin_shell::ShellExt;
use tracing::{info, error, warn};
use tracing_subscriber::{EnvFilter, fmt};
use anyhow::Result;

use db::Database;
use inference::InferenceEngine;
use plugins::PluginHost;
use server::ServerState;

/// Application-wide shared state passed to Tauri commands
pub struct AppState {
    pub db: Arc<Database>,
    pub inference: Arc<RwLock<InferenceEngine>>,
    pub plugin_host: Arc<PluginHost>,
    pub server_state: Arc<RwLock<ServerState>>,
}

fn build_system_tray() -> SystemTray {
    let quit = CustomMenuItem::new("quit".to_string(), "Quit Tiny Decision");
    let show = CustomMenuItem::new("show".to_string(), "Show Window");
    let server_status = CustomMenuItem::new("server_status".to_string(), "Server: Running on :11535")
        .disabled();
    let separator = SystemTrayMenuItem::Separator;

    let tray_menu = SystemTrayMenu::new()
        .add_item(server_status)
        .add_native_item(separator.clone())
        .add_item(show)
        .add_native_item(separator)
        .add_item(quit);

    SystemTray::new().with_menu(tray_menu).with_tooltip("Tiny Decision")
}

fn handle_system_tray_event(app: &AppHandle, event: SystemTrayEvent) {
    match event {
        SystemTrayEvent::LeftClick { .. } => {
            if let Some(window) = app.get_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
            "quit" => {
                info!("Quit requested from system tray");
                app.exit(0);
            }
            "show" => {
                if let Some(window) = app.get_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        },
        _ => {}
    }
}

/// Initialise the SQLite database, running all pending migrations.
async fn init_database() -> Result<Arc<Database>> {
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("tiny-decision");
    std::fs::create_dir_all(&data_dir)?;
    let db_path = data_dir.join("db.sqlite3");
    info!("Opening database at {}", db_path.display());
    let db = Database::open(&db_path).await?;
    db.run_migrations().await?;
    Ok(Arc::new(db))
}

/// Spawn the Axum SOMI HTTP server on port 11535 in a background tokio task.
fn start_background_server(
    db: Arc<Database>,
    inference: Arc<RwLock<InferenceEngine>>,
    plugin_host: Arc<PluginHost>,
) -> Arc<RwLock<ServerState>> {
    let server_state = Arc::new(RwLock::new(ServerState::new()));
    let state_clone = server_state.clone();

    tokio::spawn(async move {
        let addr = std::net::SocketAddr::from(([127, 0, 0, 1], 11535));
        info!("Starting SOMI HTTP server on {}", addr);

        match server::create_router(db, inference, plugin_host).await {
            Ok(router) => {
                let listener = tokio::net::TcpListener::bind(addr).await
                    .expect("Failed to bind SOMI server to port 11535");
                {
                    let mut s = state_clone.write();
                    s.running = true;
                    s.port = 11535;
                }
                axum::serve(listener, router)
                    .await
                    .expect("SOMI HTTP server crashed");
            }
            Err(e) => {
                error!("Failed to create SOMI router: {}", e);
            }
        }
    });

    server_state
}

#[tokio::main]
async fn main() {
    // Initialise structured logging
    fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,tiny_decision=debug")),
        )
        .with_target(true)
        .compact()
        .init();

    info!("Tiny Decision starting up (v{})", env!("CARGO_PKG_VERSION"));

    // Initialise core subsystems
    let db = init_database().await.expect("Database initialisation failed");
    let inference = Arc::new(RwLock::new(
        InferenceEngine::new(db.clone()).expect("Inference engine init failed"),
    ));
    let plugin_host = Arc::new(
        PluginHost::new(db.clone()).expect("Plugin host init failed"),
    );

    // Start background Axum server
    let server_state = start_background_server(
        db.clone(),
        inference.clone(),
        plugin_host.clone(),
    );

    let app_state = AppState {
        db: db.clone(),
        inference: inference.clone(),
        plugin_host: plugin_host.clone(),
        server_state,
    };

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .system_tray(build_system_tray())
        .on_system_tray_event(handle_system_tray_event)
        .invoke_handler(tauri::generate_handler![
            // Model discovery
            commands::search_hf_models,
            commands::get_model_card,
            // Download management
            commands::start_download,
            commands::pause_download,
            commands::resume_download,
            commands::cancel_download,
            // Model lifecycle
            commands::load_model,
            commands::unload_model,
            // Decision / inference
            commands::run_decision,
            commands::run_batch,
            // Pipeline
            commands::save_pipeline,
            commands::run_pipeline,
            // Calibration
            commands::get_calibration_data,
            commands::fit_calibration,
            commands::run_adversarial_probes,
            commands::compute_cost_threshold,
            // Server control
            commands::start_server,
            commands::stop_server,
            // MCP / publishing
            commands::publish_mcp_tool,
            // Human-in-the-loop / corrections
            commands::record_correction,
            // Drift & observability
            commands::get_drift_report,
            commands::get_observability_metrics,
            // Workspace / collaboration
            commands::list_workspace_members,
            // History
            commands::get_run_history,
            // Plugin marketplace
            commands::install_plugin,
            commands::search_marketplace,
            commands::import_marketplace_template,
        ])
        .on_window_event(|event| {
            // Hide to tray instead of closing
            if let WindowEvent::CloseRequested { api, .. } = event.event() {
                event.window().hide().unwrap();
                api.prevent_close();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Tauri application")
        .run(|app, event| {
            if let RunEvent::ExitRequested { api, .. } = event {
                // Allow actual exit when requested programmatically
                let _ = api;
            }
        });
}
