//! SQLite schema migrations and connection pool for Tiny Decision.
//!
//! All tables are created in a single migration function.  Future schema
//! changes should add numbered migration blocks inside [`run_migrations`].

use anyhow::{Context, Result};
use rusqlite::{Connection, params};
use std::path::Path;
use tracing::{debug, info};

/// Open (or create) the SQLite database at `db_path` and run all pending
/// schema migrations.
pub fn open(db_path: &Path) -> Result<Connection> {
    let conn = Connection::open(db_path)
        .with_context(|| format!("Cannot open SQLite DB at {}", db_path.display()))?;

    // Enable WAL mode for better concurrent read performance.
    conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;")?;

    run_migrations(&conn)?;
    Ok(conn)
}

/// Execute all pending schema migrations in version order.
pub fn run_migrations(conn: &Connection) -> Result<()> {
    // Bootstrap the version-tracking table.
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_version (
            version     INTEGER NOT NULL,
            applied_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        );",
    )?;

    let current_version: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    debug!("Current DB schema version: {current_version}");

    let migrations: &[(i64, &str)] = &[
        (1, MIGRATION_1),
        (2, MIGRATION_2),
    ];

    for (ver, sql) in migrations {
        if *ver > current_version {
            info!("Applying DB migration v{ver}");
            conn.execute_batch(sql)?;
            conn.execute(
                "INSERT INTO schema_version (version) VALUES (?1)",
                params![ver],
            )?;
        }
    }

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Migration 1 – initial schema
// ─────────────────────────────────────────────────────────────────────────────
const MIGRATION_1: &str = "
-- ── Workspace ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspace (
    id              TEXT    PRIMARY KEY,
    name            TEXT    NOT NULL,
    description     TEXT,
    storage_path    TEXT    NOT NULL,
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL,
    settings_json   TEXT    NOT NULL DEFAULT '{}',
    is_default      INTEGER NOT NULL DEFAULT 0
);

-- ── State ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS state (
    id              TEXT    PRIMARY KEY,
    workspace_id    TEXT    NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    data_json       TEXT    NOT NULL,
    label           TEXT,
    schema_version  TEXT    NOT NULL DEFAULT '1.0.0',
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_state_workspace ON state(workspace_id);

-- ── DecisionTemplate ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decision_template (
    id                      TEXT    PRIMARY KEY,
    workspace_id            TEXT    NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name                    TEXT    NOT NULL,
    description             TEXT,
    default_model_id        TEXT,
    escalation_policy_id    TEXT,
    schema_version          TEXT    NOT NULL DEFAULT '1.0.0',
    is_archived             INTEGER NOT NULL DEFAULT 0,
    tags_json               TEXT    NOT NULL DEFAULT '[]',
    state_schema_json       TEXT,
    created_at              TEXT    NOT NULL,
    updated_at              TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_template_workspace ON decision_template(workspace_id);

-- ── Question ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS question (
    id              TEXT    PRIMARY KEY,
    template_id     TEXT    NOT NULL REFERENCES decision_template(id) ON DELETE CASCADE,
    text            TEXT    NOT NULL,
    question_type   TEXT    NOT NULL,
    choices_json    TEXT    NOT NULL DEFAULT '[]',
    description     TEXT,
    ordinal         INTEGER NOT NULL DEFAULT 0,
    required        INTEGER NOT NULL DEFAULT 1,
    default_value   TEXT,
    created_at      TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_question_template ON question(template_id);

-- ── EscalationPolicy ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escalation_policy (
    id                      TEXT    PRIMARY KEY,
    workspace_id            TEXT    NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name                    TEXT    NOT NULL,
    confidence_threshold    REAL    NOT NULL DEFAULT 0.7,
    timeout_secs            INTEGER,
    channel                 TEXT    NOT NULL DEFAULT 'in_app',
    destination             TEXT    NOT NULL,
    message_template        TEXT,
    created_at              TEXT    NOT NULL,
    updated_at              TEXT    NOT NULL
);

-- ── Model ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS model (
    id                          TEXT    PRIMARY KEY,
    workspace_id                TEXT    NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name                        TEXT    NOT NULL,
    description                 TEXT,
    source                      TEXT    NOT NULL,
    format                      TEXT    NOT NULL,
    hf_repo_id                  TEXT,
    hf_filename                 TEXT,
    local_path                  TEXT,
    sha256                      TEXT,
    has_native_head             INTEGER NOT NULL DEFAULT 0,
    supported_types_json        TEXT    NOT NULL DEFAULT '[]',
    gpu_layers                  INTEGER,
    download_status             TEXT    NOT NULL DEFAULT 'pending',
    download_progress_pct       REAL    NOT NULL DEFAULT 0,
    jev_model_id                TEXT,
    tags_json                   TEXT    NOT NULL DEFAULT '[]',
    context_window              INTEGER,
    parameter_count_billions    REAL,
    created_at                  TEXT    NOT NULL,
    updated_at                  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_model_workspace ON model(workspace_id);

-- ── DecisionCall ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decision_call (
    id                  TEXT    PRIMARY KEY,
    template_id         TEXT    NOT NULL REFERENCES decision_template(id),
    state_id            TEXT    NOT NULL REFERENCES state(id),
    workspace_id        TEXT    NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    model_id            TEXT    REFERENCES model(id),
    pipeline_id         TEXT,
    final_decision_json TEXT,
    escalated           INTEGER NOT NULL DEFAULT 0,
    escalation_reason   TEXT,
    total_latency_ms    INTEGER NOT NULL DEFAULT 0,
    tokens_used         INTEGER,
    cost_usd_cents      REAL,
    meta_json           TEXT    NOT NULL DEFAULT '{}',
    created_at          TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_call_template ON decision_call(template_id);
CREATE INDEX IF NOT EXISTS idx_call_workspace ON decision_call(workspace_id);
CREATE INDEX IF NOT EXISTS idx_call_created  ON decision_call(created_at);

-- ── Answer ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS answer (
    id                      TEXT    PRIMARY KEY,
    decision_call_id        TEXT    NOT NULL REFERENCES decision_call(id) ON DELETE CASCADE,
    question_id             TEXT    NOT NULL REFERENCES question(id),
    raw_value_json          TEXT    NOT NULL,
    confidence              REAL    NOT NULL DEFAULT 0,
    probabilities_json      TEXT    NOT NULL DEFAULT '[]',
    calibration_profile_id  TEXT,
    ground_truth_json       TEXT,
    latency_ms              INTEGER NOT NULL DEFAULT 0,
    created_at              TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_answer_call     ON answer(decision_call_id);
CREATE INDEX IF NOT EXISTS idx_answer_question ON answer(question_id);

-- ── Pipeline ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline (
    id              TEXT    PRIMARY KEY,
    workspace_id    TEXT    NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name            TEXT    NOT NULL,
    description     TEXT,
    version         TEXT    NOT NULL DEFAULT '1.0.0',
    is_archived     INTEGER NOT NULL DEFAULT 0,
    timeout_secs    INTEGER,
    tags_json       TEXT    NOT NULL DEFAULT '[]',
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL
);

-- ── PipelineNode ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_node (
    id              TEXT    PRIMARY KEY,
    pipeline_id     TEXT    NOT NULL REFERENCES pipeline(id) ON DELETE CASCADE,
    kind            TEXT    NOT NULL,
    label           TEXT    NOT NULL,
    config_json     TEXT    NOT NULL DEFAULT '{}',
    next_nodes_json TEXT    NOT NULL DEFAULT '[]',
    fallback_node   TEXT,
    timeout_secs    INTEGER,
    retry_policy_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_node_pipeline ON pipeline_node(pipeline_id);

-- ── CalibrationProfile ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calibration_profile (
    id              TEXT    PRIMARY KEY,
    model_id        TEXT    NOT NULL REFERENCES model(id) ON DELETE CASCADE,
    question_id     TEXT,
    method          TEXT    NOT NULL,
    ece_before      REAL    NOT NULL DEFAULT 0,
    ece_after       REAL    NOT NULL DEFAULT 0,
    params_json     TEXT    NOT NULL DEFAULT '{}',
    sample_count    INTEGER NOT NULL DEFAULT 0,
    eval_set_id     TEXT,
    created_at      TEXT    NOT NULL
);

-- ── EvalSet ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eval_set (
    id              TEXT    PRIMARY KEY,
    template_id     TEXT    NOT NULL REFERENCES decision_template(id) ON DELETE CASCADE,
    workspace_id    TEXT    NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name            TEXT    NOT NULL,
    description     TEXT,
    is_baseline     INTEGER NOT NULL DEFAULT 0,
    tags_json       TEXT    NOT NULL DEFAULT '[]',
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL
);

-- ── EvalItem ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eval_item (
    id                  TEXT    PRIMARY KEY,
    eval_set_id         TEXT    NOT NULL REFERENCES eval_set(id) ON DELETE CASCADE,
    state_id            TEXT    NOT NULL REFERENCES state(id),
    question_id         TEXT    NOT NULL REFERENCES question(id),
    ground_truth_json   TEXT    NOT NULL,
    source              TEXT    NOT NULL DEFAULT 'manual_label',
    created_at          TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_eval_item_set ON eval_item(eval_set_id);

-- ── DriftAlert ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drift_alert (
    id                  TEXT    PRIMARY KEY,
    template_id         TEXT    NOT NULL REFERENCES decision_template(id) ON DELETE CASCADE,
    workspace_id        TEXT    NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    severity            TEXT    NOT NULL,
    metric              TEXT    NOT NULL,
    baseline_value      REAL    NOT NULL,
    current_value       REAL    NOT NULL,
    delta               REAL    NOT NULL,
    window_days         INTEGER NOT NULL,
    acknowledged        INTEGER NOT NULL DEFAULT 0,
    acknowledged_at     TEXT,
    detail_json         TEXT    NOT NULL DEFAULT '{}',
    created_at          TEXT    NOT NULL
);

-- ── Plugin ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plugin (
    id                      TEXT    PRIMARY KEY,
    workspace_id            TEXT    NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name                    TEXT    NOT NULL,
    description             TEXT,
    version                 TEXT    NOT NULL,
    wasm_path               TEXT    NOT NULL,
    input_schema_json       TEXT    NOT NULL DEFAULT '{}',
    output_schema_json      TEXT    NOT NULL DEFAULT '{}',
    declared_caps_json      TEXT    NOT NULL DEFAULT '[]',
    granted_caps_json       TEXT    NOT NULL DEFAULT '[]',
    enabled                 INTEGER NOT NULL DEFAULT 1,
    is_somi_adapter         INTEGER NOT NULL DEFAULT 0,
    is_pipeline_node        INTEGER NOT NULL DEFAULT 0,
    installed_at            TEXT    NOT NULL,
    updated_at              TEXT    NOT NULL
);

-- ── CapabilityGrant ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capability_grant (
    id              TEXT    PRIMARY KEY,
    plugin_id       TEXT    NOT NULL REFERENCES plugin(id) ON DELETE CASCADE,
    capability_json TEXT    NOT NULL,
    status          TEXT    NOT NULL DEFAULT 'pending',
    granted_by      TEXT,
    granted_at      TEXT,
    expires_at      TEXT
);

-- ── MCPExport ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mcp_export (
    id              TEXT    PRIMARY KEY,
    workspace_id    TEXT    NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name            TEXT    NOT NULL,
    description     TEXT,
    source_id       TEXT    NOT NULL,
    source_kind     TEXT    NOT NULL,
    manifest_json   TEXT    NOT NULL,
    active_port     INTEGER,
    enabled         INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL
);
";

// ─────────────────────────────────────────────────────────────────────────────
// Migration 2 – download history table
// ─────────────────────────────────────────────────────────────────────────────
const MIGRATION_2: &str = "
-- ── DownloadHistory ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS download_history (
    id              TEXT    PRIMARY KEY,
    model_id        TEXT    NOT NULL REFERENCES model(id) ON DELETE CASCADE,
    url             TEXT    NOT NULL,
    bytes_total     INTEGER,
    bytes_downloaded INTEGER NOT NULL DEFAULT 0,
    started_at      TEXT    NOT NULL,
    completed_at    TEXT,
    status          TEXT    NOT NULL DEFAULT 'pending',
    error_message   TEXT,
    etag            TEXT,
    sha256_verified INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_dl_model ON download_history(model_id);
";

// ─────────────────────────────────────────────────────────────────────────────
// CRUD helpers
// ─────────────────────────────────────────────────────────────────────────────

use crate::types::*;
use chrono::Utc;
use uuid::Uuid;

/// Insert or replace a workspace row.
pub fn upsert_workspace(conn: &Connection, ws: &Workspace) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO workspace
            (id, name, description, storage_path, created_at, updated_at, settings_json, is_default)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        params![
            ws.id.to_string(),
            ws.name,
            ws.description,
            ws.storage_path,
            ws.created_at.to_rfc3339(),
            ws.updated_at.to_rfc3339(),
            serde_json::to_string(&ws.settings)?,
            ws.is_default as i32,
        ],
    )?;
    Ok(())
}

/// Fetch a workspace by ID.
pub fn get_workspace(conn: &Connection, id: &Uuid) -> Result<Option<Workspace>> {
    let mut stmt = conn.prepare(
        "SELECT id,name,description,storage_path,created_at,updated_at,settings_json,is_default
         FROM workspace WHERE id=?1",
    )?;
    let mut rows = stmt.query(params![id.to_string()])?;
    if let Some(row) = rows.next()? {
        let ws = row_to_workspace(row)?;
        return Ok(Some(ws));
    }
    Ok(None)
}

/// List all workspaces.
pub fn list_workspaces(conn: &Connection) -> Result<Vec<Workspace>> {
    let mut stmt = conn.prepare(
        "SELECT id,name,description,storage_path,created_at,updated_at,settings_json,is_default
         FROM workspace ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map([], |row| Ok(row_to_workspace(row).unwrap()))?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

fn row_to_workspace(row: &rusqlite::Row<'_>) -> Result<Workspace> {
    Ok(Workspace {
        id: Uuid::parse_str(&row.get::<_, String>(0)?)?,
        name: row.get(1)?,
        description: row.get(2)?,
        storage_path: row.get(3)?,
        created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
            .map(|dt| dt.with_timezone(&Utc))?,
        updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
            .map(|dt| dt.with_timezone(&Utc))?,
        settings: serde_json::from_str(&row.get::<_, String>(6)?)?,
        is_default: row.get::<_, i32>(7)? != 0,
    })
}

/// Insert or replace a decision template (questions stored separately).
pub fn upsert_template(conn: &Connection, t: &DecisionTemplate) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO decision_template
            (id,workspace_id,name,description,default_model_id,escalation_policy_id,
             schema_version,is_archived,tags_json,state_schema_json,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
        params![
            t.id.to_string(),
            t.workspace_id.to_string(),
            t.name,
            t.description,
            t.default_model_id.map(|u| u.to_string()),
            t.escalation_policy_id.map(|u| u.to_string()),
            t.schema_version,
            t.is_archived as i32,
            serde_json::to_string(&t.tags)?,
            t.state_schema.as_ref().map(|v| serde_json::to_string(v).unwrap()),
            t.created_at.to_rfc3339(),
            t.updated_at.to_rfc3339(),
        ],
    )?;
    // Upsert each question.
    for q in &t.questions {
        upsert_question(conn, q)?;
    }
    Ok(())
}

/// Insert or replace a question row.
pub fn upsert_question(conn: &Connection, q: &Question) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO question
            (id,template_id,text,question_type,choices_json,description,ordinal,required,default_value,created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        params![
            q.id.to_string(),
            q.template_id.to_string(),
            q.text,
            serde_json::to_string(&q.question_type)?.trim_matches('"').to_string(),
            serde_json::to_string(&q.choices)?,
            q.description,
            q.ordinal,
            q.required as i32,
            q.default_value.as_ref().map(|v| serde_json::to_string(v).unwrap()),
            q.created_at.to_rfc3339(),
        ],
    )?;
    Ok(())
}

/// Insert a completed decision call (with its answers).
pub fn insert_decision_call(conn: &Connection, call: &DecisionCall) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO decision_call
            (id,template_id,state_id,workspace_id,model_id,pipeline_id,
             final_decision_json,escalated,escalation_reason,total_latency_ms,
             tokens_used,cost_usd_cents,meta_json,created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
        params![
            call.id.to_string(),
            call.template_id.to_string(),
            call.state_id.to_string(),
            call.workspace_id.to_string(),
            call.model_id.map(|u| u.to_string()),
            call.pipeline_id.map(|u| u.to_string()),
            call.final_decision.as_ref().map(|v| serde_json::to_string(v).unwrap()),
            call.escalated as i32,
            call.escalation_reason,
            call.total_latency_ms as i64,
            call.tokens_used.map(|u| u as i64),
            call.cost_usd_cents,
            serde_json::to_string(&call.meta)?,
            call.created_at.to_rfc3339(),
        ],
    )?;
    for ans in &call.answers {
        insert_answer(conn, ans)?;
    }
    Ok(())
}

/// Insert a single answer row.
pub fn insert_answer(conn: &Connection, ans: &Answer) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO answer
            (id,decision_call_id,question_id,raw_value_json,confidence,
             probabilities_json,calibration_profile_id,ground_truth_json,latency_ms,created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        params![
            ans.id.to_string(),
            ans.decision_call_id.to_string(),
            ans.question_id.to_string(),
            serde_json::to_string(&ans.raw_value)?,
            ans.confidence,
            serde_json::to_string(&ans.probabilities)?,
            ans.calibration_profile_id.map(|u| u.to_string()),
            ans.ground_truth.as_ref().map(|v| serde_json::to_string(v).unwrap()),
            ans.latency_ms as i64,
            ans.created_at.to_rfc3339(),
        ],
    )?;
    Ok(())
}

/// Update the ground-truth of an answer (flywheel correction).
pub fn set_answer_ground_truth(
    conn: &Connection,
    answer_id: &Uuid,
    ground_truth: &serde_json::Value,
) -> Result<()> {
    conn.execute(
        "UPDATE answer SET ground_truth_json=?1 WHERE id=?2",
        params![
            serde_json::to_string(ground_truth)?,
            answer_id.to_string(),
        ],
    )?;
    Ok(())
}

/// Insert a model record.
pub fn upsert_model(conn: &Connection, m: &Model) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO model
            (id,workspace_id,name,description,source,format,hf_repo_id,hf_filename,
             local_path,sha256,has_native_head,supported_types_json,gpu_layers,
             download_status,download_progress_pct,jev_model_id,tags_json,
             context_window,parameter_count_billions,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21)",
        params![
            m.id.to_string(),
            m.workspace_id.to_string(),
            m.name,
            m.description,
            serde_json::to_string(&m.source)?.trim_matches('"').to_string(),
            serde_json::to_string(&m.format)?.trim_matches('"').to_string(),
            m.hf_repo_id,
            m.hf_filename,
            m.local_path,
            m.sha256,
            m.has_native_head as i32,
            serde_json::to_string(&m.supported_question_types)?,
            m.gpu_layers,
            serde_json::to_string(&m.download_status)?.trim_matches('"').to_string(),
            m.download_progress_pct as f64,
            m.jev_model_id,
            serde_json::to_string(&m.tags)?,
            m.context_window.map(|u| u as i64),
            m.parameter_count_billions.map(|f| f as f64),
            m.created_at.to_rfc3339(),
            m.updated_at.to_rfc3339(),
        ],
    )?;
    Ok(())
}

/// Update model download progress.
pub fn update_model_download(
    conn: &Connection,
    model_id: &Uuid,
    status: &DownloadStatus,
    progress_pct: f32,
) -> Result<()> {
    let status_str = serde_json::to_string(status)?.trim_matches('"').to_string();
    conn.execute(
        "UPDATE model SET download_status=?1, download_progress_pct=?2, updated_at=?3 WHERE id=?4",
        params![
            status_str,
            progress_pct as f64,
            Utc::now().to_rfc3339(),
            model_id.to_string(),
        ],
    )?;
    Ok(())
}

/// Insert an eval item.
pub fn insert_eval_item(conn: &Connection, item: &EvalItem) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO eval_item
            (id,eval_set_id,state_id,question_id,ground_truth_json,source,created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![
            item.id.to_string(),
            item.eval_set_id.to_string(),
            item.state_id.to_string(),
            item.question_id.to_string(),
            serde_json::to_string(&item.ground_truth)?,
            serde_json::to_string(&item.source)?.trim_matches('"').to_string(),
            item.created_at.to_rfc3339(),
        ],
    )?;
    Ok(())
}

/// Insert a drift alert.
pub fn insert_drift_alert(conn: &Connection, alert: &DriftAlert) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO drift_alert
            (id,template_id,workspace_id,severity,metric,baseline_value,current_value,
             delta,window_days,acknowledged,acknowledged_at,detail_json,created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
        params![
            alert.id.to_string(),
            alert.template_id.to_string(),
            alert.workspace_id.to_string(),
            serde_json::to_string(&alert.severity)?.trim_matches('"').to_string(),
            alert.metric,
            alert.baseline_value,
            alert.current_value,
            alert.delta,
            alert.window_days as i64,
            alert.acknowledged as i32,
            alert.acknowledged_at.map(|dt| dt.to_rfc3339()),
            serde_json::to_string(&alert.detail)?,
            alert.created_at.to_rfc3339(),
        ],
    )?;
    Ok(())
}

/// Insert or replace a plugin record.
pub fn upsert_plugin(conn: &Connection, p: &Plugin) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO plugin
            (id,workspace_id,name,description,version,wasm_path,
             input_schema_json,output_schema_json,declared_caps_json,
             granted_caps_json,enabled,is_somi_adapter,is_pipeline_node,
             installed_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)",
        params![
            p.id.to_string(),
            p.workspace_id.to_string(),
            p.name,
            p.description,
            p.version,
            p.wasm_path,
            serde_json::to_string(&p.input_schema)?,
            serde_json::to_string(&p.output_schema)?,
            serde_json::to_string(&p.declared_capabilities)?,
            serde_json::to_string(&p.granted_capabilities)?,
            p.enabled as i32,
            p.is_somi_adapter as i32,
            p.is_pipeline_node as i32,
            p.installed_at.to_rfc3339(),
            p.updated_at.to_rfc3339(),
        ],
    )?;
    Ok(())
}

/// Fetch all answers with ground-truth set for a given template / time window.
/// Used by calibration and drift engines.
pub fn get_answered_with_ground_truth(
    conn: &Connection,
    template_id: &Uuid,
    since: &chrono::DateTime<Utc>,
) -> Result<Vec<(Answer, serde_json::Value)>> {
    let mut stmt = conn.prepare(
        "SELECT a.id, a.decision_call_id, a.question_id, a.raw_value_json,
                a.confidence, a.probabilities_json, a.calibration_profile_id,
                a.ground_truth_json, a.latency_ms, a.created_at
         FROM answer a
         JOIN decision_call dc ON dc.id = a.decision_call_id
         WHERE dc.template_id = ?1
           AND a.ground_truth_json IS NOT NULL
           AND dc.created_at >= ?2
         ORDER BY a.created_at ASC",
    )?;
    let mut out = Vec::new();
    let rows = stmt.query_map(
        params![template_id.to_string(), since.to_rfc3339()],
        |row| {
            let gt_json: String = row.get(7)?;
            Ok((row_to_answer(row), gt_json))
        },
    )?;
    for r in rows {
        let (ans_res, gt_json) = r?;
        let ans = ans_res?;
        let gt: serde_json::Value = serde_json::from_str(&gt_json)
            .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?;
        out.push((ans, gt));
    }
    Ok(out)
}

fn row_to_answer(row: &rusqlite::Row<'_>) -> Result<Answer, rusqlite::Error> {
    Ok(Answer {
        id: Uuid::parse_str(&row.get::<_, String>(0)?)
            .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?,
        decision_call_id: Uuid::parse_str(&row.get::<_, String>(1)?)
            .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?,
        question_id: Uuid::parse_str(&row.get::<_, String>(2)?)
            .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?,
        raw_value: serde_json::from_str(&row.get::<_, String>(3)?)
            .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?,
        confidence: row.get(4)?,
        probabilities: serde_json::from_str(&row.get::<_, String>(5)?)
            .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?,
        calibration_profile_id: row
            .get::<_, Option<String>>(6)?
            .and_then(|s| Uuid::parse_str(&s).ok()),
        ground_truth: row
            .get::<_, Option<String>>(7)?
            .and_then(|s| serde_json::from_str(&s).ok()),
        latency_ms: row.get::<_, i64>(8)? as u64,
        created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(9)?)
            .map(|dt| dt.with_timezone(&Utc))
            .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?,
    })
}
