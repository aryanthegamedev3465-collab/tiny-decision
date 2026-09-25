//! Tiny Decision – shared types.
//!
//! Every struct here derives `serde::{Serialize, Deserialize}` and `ts_rs::TS`.
//! The TypeScript export macro `export!` is triggered from `build.rs` via
//! `TS::export_all_to("../frontend/src/bindings")`.

#![allow(clippy::module_name_repetitions)]

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ts_rs::TS;
use uuid::Uuid;

// ─────────────────────────────────────────────────────────────────────────────
// Enumerations
// ─────────────────────────────────────────────────────────────────────────────

/// The kind of answer a question expects.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum QuestionType {
    /// Discrete choice from a fixed option set.
    Choice,
    /// Binary yes/no (no-or-unlikely = 0 .. certain = 1).
    Noul,
    /// Continuous regression score (domain defined per question).
    Score,
}

/// Source of an ML model artefact.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum ModelSource {
    /// Downloaded from Hugging Face Hub.
    HuggingFace,
    /// Hosted by the Jev API.
    JevHosted,
    /// Manually placed by the user.
    Local,
    /// Provided through a plugin.
    Plugin,
}

/// Runtime format of the model weight file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ModelFormat {
    Gguf,
    Onnx,
    SafeTensors,
    TorchScript,
    Other,
}

/// Calibration method applied to raw confidence scores.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum CalibrationMethod {
    TemperatureScaling,
    PlattScaling,
    IsotonicRegression,
    None,
}

/// Status of a background model download.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum DownloadStatus {
    Pending,
    Downloading,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

/// Severity of a drift alert.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum AlertSeverity {
    Info,
    Warning,
    Critical,
}

/// Node type inside a pipeline.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum NodeKind {
    Decision,
    Branch,
    ParallelFanout,
    FanIn,
    Loop,
    Ensemble,
    HumanEscalation,
    ModelEscalation,
    Shadow,
    Cache,
    Output,
}

/// Escalation channel.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum EscalationChannel {
    Email,
    Slack,
    Webhook,
    InApp,
    Sms,
}

/// Grant status for a plugin capability.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum GrantStatus {
    Pending,
    Approved,
    Denied,
    Revoked,
}

// ─────────────────────────────────────────────────────────────────────────────
// Core data model structs
// ─────────────────────────────────────────────────────────────────────────────

/// Arbitrary context blob passed into every decision call.
///
/// Backed by a `TEXT` column containing JSON in SQLite.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct State {
    pub id: Uuid,
    pub workspace_id: Uuid,
    /// Opaque JSON context consumed by templates and models.
    pub data: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// Optional label for human reference.
    pub label: Option<String>,
    /// Schema version tag (semver string).
    pub schema_version: String,
}

/// A single question within a decision template.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Question {
    pub id: Uuid,
    pub template_id: Uuid,
    pub text: String,
    pub question_type: QuestionType,
    /// For `Choice` questions – ordered list of option labels.
    pub choices: Vec<String>,
    /// Human-readable description shown in the UI.
    pub description: Option<String>,
    /// Display order within the template.
    pub ordinal: i32,
    /// Whether an answer to this question is mandatory.
    pub required: bool,
    /// Default option index (for `Choice`) or value (for `Score`/`Noul`).
    pub default_value: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

/// A recorded answer to a question for a given decision call.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Answer {
    pub id: Uuid,
    pub decision_call_id: Uuid,
    pub question_id: Uuid,
    /// Model-assigned raw value (choice index, probability, or regression output).
    pub raw_value: serde_json::Value,
    /// Calibrated confidence (0.0 – 1.0).
    pub confidence: f64,
    /// Softmax probabilities over options (for Choice).
    pub probabilities: Vec<f64>,
    /// Calibration profile applied (null = none).
    pub calibration_profile_id: Option<Uuid>,
    /// Ground-truth label set by the flywheel.
    pub ground_truth: Option<serde_json::Value>,
    /// Latency of the model call in milliseconds.
    pub latency_ms: u64,
    pub created_at: DateTime<Utc>,
}

/// A full invocation of a decision template against a state.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DecisionCall {
    pub id: Uuid,
    pub template_id: Uuid,
    pub state_id: Uuid,
    pub workspace_id: Uuid,
    pub model_id: Option<Uuid>,
    pub pipeline_id: Option<Uuid>,
    pub answers: Vec<Answer>,
    /// Aggregated final decision value (template-defined semantics).
    pub final_decision: Option<serde_json::Value>,
    /// Whether this call was escalated to a human.
    pub escalated: bool,
    pub escalation_reason: Option<String>,
    /// Total wall-clock latency in milliseconds.
    pub total_latency_ms: u64,
    /// Token usage if LLM backend was used.
    pub tokens_used: Option<u32>,
    /// Cost in USD-cents if metered backend.
    pub cost_usd_cents: Option<f64>,
    pub created_at: DateTime<Utc>,
    /// Metadata bag for callers.
    pub meta: HashMap<String, serde_json::Value>,
}

/// A reusable decision template defining questions and model configuration.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DecisionTemplate {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub questions: Vec<Question>,
    /// Default model to use for this template.
    pub default_model_id: Option<Uuid>,
    /// Escalation policy applied to every call.
    pub escalation_policy_id: Option<Uuid>,
    pub schema_version: String,
    pub is_archived: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// Arbitrary tags.
    pub tags: Vec<String>,
    /// JSON-Schema for the expected `State.data` shape.
    pub state_schema: Option<serde_json::Value>,
}

/// Policy defining when and how to escalate to a human.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct EscalationPolicy {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    /// Minimum confidence threshold; calls below this are escalated.
    pub confidence_threshold: f64,
    /// Escalation fires after this many seconds without a decision.
    pub timeout_secs: Option<u64>,
    pub channel: EscalationChannel,
    /// Destination URL / email / Slack channel.
    pub destination: String,
    /// Jinja2 template for the notification payload.
    pub message_template: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A named, versioned pipeline of decision nodes.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Pipeline {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub nodes: Vec<PipelineNode>,
    /// Semver string.
    pub version: String,
    pub is_archived: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// Global timeout for the whole pipeline in seconds.
    pub timeout_secs: Option<u64>,
    pub tags: Vec<String>,
}

/// A single node in a pipeline graph.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct PipelineNode {
    pub id: Uuid,
    pub pipeline_id: Uuid,
    pub kind: NodeKind,
    pub label: String,
    /// Node-specific configuration (varies by kind).
    pub config: serde_json::Value,
    /// IDs of successor nodes on the default (success) edge.
    pub next_nodes: Vec<Uuid>,
    /// ID of successor node on the failure / fallback edge.
    pub fallback_node: Option<Uuid>,
    /// Per-node timeout in seconds; triggers `fallback_node` on expiry.
    pub timeout_secs: Option<u64>,
    /// Retry policy for this node.
    pub retry_policy: Option<RetryPolicy>,
}

/// Retry policy attached to a pipeline node.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct RetryPolicy {
    pub max_attempts: u32,
    pub initial_backoff_ms: u64,
    pub backoff_multiplier: f64,
    pub max_backoff_ms: u64,
    /// HTTP status codes that trigger a retry.
    pub retryable_status_codes: Vec<u16>,
}

/// Registered ML model (local or hosted).
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Model {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub source: ModelSource,
    pub format: ModelFormat,
    /// HuggingFace repo_id, e.g. `"Qwen/Qwen2.5-0.5B-Instruct-GGUF"`.
    pub hf_repo_id: Option<String>,
    /// Filename within the HF repo.
    pub hf_filename: Option<String>,
    /// Absolute local path of the weight file once downloaded.
    pub local_path: Option<String>,
    /// SHA-256 hex digest for integrity verification.
    pub sha256: Option<String>,
    /// Whether the model has a native typed-decision head.
    pub has_native_head: bool,
    /// Supported question types.
    pub supported_question_types: Vec<QuestionType>,
    /// GPU layers to offload; None = CPU only; Some(−1) = all.
    pub gpu_layers: Option<i32>,
    pub download_status: DownloadStatus,
    pub download_progress_pct: f32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// Jev API model identifier (when source = JevHosted).
    pub jev_model_id: Option<String>,
    pub tags: Vec<String>,
    pub context_window: Option<u32>,
    pub parameter_count_billions: Option<f32>,
}

/// Calibration profile that maps raw confidence to calibrated confidence.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct CalibrationProfile {
    pub id: Uuid,
    pub model_id: Uuid,
    pub question_id: Option<Uuid>,
    pub method: CalibrationMethod,
    /// ECE before calibration.
    pub ece_before: f64,
    /// ECE after calibration.
    pub ece_after: f64,
    /// Fitted parameter(s) (method-dependent).
    pub params: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub sample_count: u32,
    pub eval_set_id: Option<Uuid>,
}

/// A curated evaluation dataset.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct EvalSet {
    pub id: Uuid,
    pub template_id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub items: Vec<EvalItem>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_baseline: bool,
    pub tags: Vec<String>,
}

/// A single (state, question, ground_truth) row in an eval set.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct EvalItem {
    pub id: Uuid,
    pub eval_set_id: Uuid,
    pub state_id: Uuid,
    pub question_id: Uuid,
    pub ground_truth: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub source: EvalItemSource,
}

/// How this eval item was created.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum EvalItemSource {
    ManualLabel,
    FlyWheelCorrection,
    Synthetic,
}

/// Detected performance drift alert.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DriftAlert {
    pub id: Uuid,
    pub template_id: Uuid,
    pub workspace_id: Uuid,
    pub severity: AlertSeverity,
    pub metric: String,
    pub baseline_value: f64,
    pub current_value: f64,
    pub delta: f64,
    pub window_days: u32,
    pub created_at: DateTime<Utc>,
    pub acknowledged: bool,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub detail: serde_json::Value,
}

/// Full drift comparison report returned by the flywheel.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DriftReport {
    pub template_id: Uuid,
    pub baseline_eval_set_id: Uuid,
    pub window_days: u32,
    pub metrics: HashMap<String, DriftMetric>,
    pub alerts: Vec<DriftAlert>,
    pub generated_at: DateTime<Utc>,
}

/// A single metric comparison within a drift report.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DriftMetric {
    pub name: String,
    pub baseline: f64,
    pub current: f64,
    pub delta: f64,
    pub delta_pct: f64,
    pub significant: bool,
}

/// An isolated workspace (tenant).
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Workspace {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    /// Base directory for artefacts (models, eval sets, etc.).
    pub storage_path: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub settings: WorkspaceSettings,
    pub is_default: bool,
}

/// Configurable settings for a workspace.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct WorkspaceSettings {
    /// Default escalation policy ID.
    pub default_escalation_policy_id: Option<Uuid>,
    /// Jev API base URL.
    pub jev_api_url: Option<String>,
    /// Whether data flywheel recording is enabled.
    pub flywheel_enabled: bool,
    /// Number of days to retain decision call records.
    pub retention_days: Option<u32>,
}

/// An installed plugin.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Plugin {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    /// Semantic version of the plugin.
    pub version: String,
    /// WASM entry-point path.
    pub wasm_path: String,
    /// JSON-Schema describing the plugin's input.
    pub input_schema: serde_json::Value,
    /// JSON-Schema describing the plugin's output.
    pub output_schema: serde_json::Value,
    /// Which capabilities this plugin declares it needs.
    pub declared_capabilities: Vec<PluginCapability>,
    /// Which of the declared capabilities have been granted.
    pub granted_capabilities: Vec<CapabilityGrant>,
    pub installed_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub enabled: bool,
    /// Whether this plugin exposes a SOMI adapter.
    pub is_somi_adapter: bool,
    /// Whether this plugin exposes a pipeline node.
    pub is_pipeline_node: bool,
}

/// A capability that a plugin may request.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum PluginCapability {
    NetworkAccess,
    FileSystemRead,
    FileSystemWrite,
    DatabaseRead,
    DatabaseWrite,
    SpawnProcess,
    GpuAccess,
    Custom(String),
}

/// User-granted (or denied) permission for a plugin capability.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct CapabilityGrant {
    pub id: Uuid,
    pub plugin_id: Uuid,
    pub capability: PluginCapability,
    pub status: GrantStatus,
    pub granted_by: Option<String>,
    pub granted_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
}

/// A registered MCP export descriptor.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct McpExport {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    /// Either a `template_id` or `pipeline_id`.
    pub source_id: Uuid,
    #[serde(rename = "source_kind")]
    pub source_kind: McpSourceKind,
    /// Generated MCP tool manifest (JSON).
    pub manifest: serde_json::Value,
    /// Port of the running MCP server (if active).
    pub active_port: Option<u16>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub enabled: bool,
}

/// Discriminant for McpExport source.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum McpSourceKind {
    Template,
    Pipeline,
}

/// MCP tool manifest structure following the MCP spec.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct McpToolManifest {
    pub schema_version: String,
    pub name: String,
    pub description: String,
    pub tools: Vec<McpTool>,
    pub resources: Vec<McpResource>,
    pub server_url: Option<String>,
}

/// A single MCP tool entry.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct McpTool {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
    pub output_schema: serde_json::Value,
}

/// A single MCP resource entry.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct McpResource {
    pub name: String,
    pub description: String,
    pub uri_template: String,
    pub schema: serde_json::Value,
}

/// Download progress event emitted to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DownloadProgress {
    pub model_id: Uuid,
    pub status: DownloadStatus,
    pub bytes_downloaded: u64,
    pub bytes_total: Option<u64>,
    pub speed_bps: f64,
    pub eta_secs: Option<f64>,
    pub sha256_verified: bool,
}

/// Payload returned by `POST /v1/decide`.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DecideResponse {
    pub call: DecisionCall,
    pub escalated: bool,
    pub escalation_reason: Option<String>,
}

/// Request body for `POST /v1/decide`.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DecideRequest {
    pub template_id: Uuid,
    pub state: serde_json::Value,
    /// Override the default model.
    pub model_id: Option<Uuid>,
    /// Override the default pipeline.
    pub pipeline_id: Option<Uuid>,
    pub meta: Option<HashMap<String, serde_json::Value>>,
}

/// Feedback / correction from a human reviewer.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct FeedbackPayload {
    pub decision_call_id: Uuid,
    pub question_id: Uuid,
    pub correct_value: serde_json::Value,
    pub reviewer_id: Option<String>,
    pub note: Option<String>,
}
