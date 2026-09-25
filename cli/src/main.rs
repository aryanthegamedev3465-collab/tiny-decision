//! Tiny Decision – CLI entry point.
//!
//! Provides `td` binary for scripted access to the core engine.

use anyhow::Result;
use clap::{Parser, Subcommand};
use tracing_subscriber::{EnvFilter, fmt};

#[derive(Parser)]
#[command(name = "td", version, about = "Tiny Decision CLI")]
struct Cli {
    /// Verbosity level (repeat for more: -v, -vv, -vvv)
    #[arg(short, long, action = clap::ArgAction::Count)]
    verbose: u8,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Start the embedded HTTP server
    Serve {
        /// Port to listen on
        #[arg(short, long, default_value_t = 11535)]
        port: u16,
    },
    /// Run a quick decision via stdin JSON
    Decide {
        /// Template ID to use
        #[arg(short, long)]
        template: String,
    },
    /// List locally available models
    Models,
    /// Export an MCP manifest
    McpExport {
        /// Pipeline or template ID
        #[arg(short, long)]
        id: String,
        /// Output path
        #[arg(short, long)]
        out: String,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    let level = match cli.verbose {
        0 => "warn",
        1 => "info",
        2 => "debug",
        _ => "trace",
    };

    fmt().with_env_filter(EnvFilter::new(level)).init();

    match cli.command {
        Commands::Serve { port } => {
            tracing::info!("Starting server on port {port}");
            tiny_decision_core::server::run_server(port).await?;
        }
        Commands::Decide { template } => {
            let state_json = {
                use std::io::Read;
                let mut s = String::new();
                std::io::stdin().read_to_string(&mut s)?;
                s
            };
            let state: serde_json::Value = serde_json::from_str(&state_json)?;
            let result =
                tiny_decision_core::server::cli_decide(&template, state).await?;
            println!("{}", serde_json::to_string_pretty(&result)?);
        }
        Commands::Models => {
            let models = tiny_decision_core::inference::list_loaded_models().await;
            for m in &models {
                println!("{:?}", m);
            }
        }
        Commands::McpExport { id, out } => {
            let manifest =
                tiny_decision_core::mcp::generate_mcp_manifest(&id).await?;
            let bytes = tiny_decision_core::mcp::export_standalone_server(&manifest)?;
            std::fs::write(&out, bytes)?;
            tracing::info!("Exported MCP bundle to {out}");
        }
    }

    Ok(())
}
