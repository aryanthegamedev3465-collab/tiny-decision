//! Tiny Decision Core Library
//!
//! Exposes all core subsystems: SOMI adapters, in-process inference,
//! calibration suite, pipeline execution engine, Axum local server,
//! HuggingFace download manager, data flywheel, MCP tool exporter,
//! SQLite database, and sandboxed WASM plugins.

pub mod calibration;
pub mod db;
pub mod flywheel;
pub mod hf;
pub mod inference;
pub mod mcp;
pub mod pipeline;
pub mod plugins;
pub mod server;
pub mod somi;
pub mod types;

pub use types::*;
