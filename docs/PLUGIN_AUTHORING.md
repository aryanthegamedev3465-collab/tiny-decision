# Tiny Decision Plugin SDK & Authoring Guide

Tiny Decision provides a sandboxed WebAssembly (WASM) plugin architecture powered by `wasmtime`. Plugins allow the community to add new model vendors, custom pipeline node types, and enterprise integrations without modifying core application code.

---

## 1. Plugin Categories

Tiny Decision supports two primary plugin categories:

1. **SOMI Adapter Plugins (`somi_adapter`)**
   Plugs in a new model vendor (e.g. OpenRouter, custom inference servers, proprietary corporate model gateways) via the standard System One Model Interface.
2. **Pipeline Node Plugins (`pipeline_node`)**
   Adds visual DAG nodes to the Pipeline Builder (e.g., Salesforce Lookups, Slack alerts, Postgres updates, Stripe dispute triggers).

---

## 2. Plugin Manifest (`plugin.json`)

Every plugin repository must include a root `plugin.json` defining its identity and capability permissions:

```json
{
  "id": "slack-alert",
  "name": "Slack Escalation Notifier",
  "version": "1.0.0",
  "description": "Dispatches low-confidence decision escalations to a Slack channel webhook.",
  "category": "pipeline_node",
  "entrypoint": "plugin.wasm",
  "permissions": {
    "network_hosts": [
      "hooks.slack.com"
    ],
    "filesystem_reads": [],
    "required_secrets": [
      "SLACK_WEBHOOK_URL"
    ]
  }
}
```

---

## 3. Capability-Based Sandboxing & Security

- **WASM Isolation:** Third-party plugins execute in a strict WASI runtime with memory and CPU cycle caps.
- **Explicit User Consent:** At plugin installation time, Tiny Decision displays a prompt listing all requested `network_hosts`, `filesystem_reads`, and secrets. The user must explicitly approve these before activation.
- **Secret Protection:** Secrets like API tokens are held securely in Windows DPAPI and passed into the WASM runtime on demand. They are never logged or stored in plain JSON exports.

---

## 4. Writing a SOMI Adapter Plugin in Rust

Compile your Rust crate to the `wasm32-wasip1` target:

```rust
// Cargo.toml
// [lib]
// crate-type = ["cdylib"]

use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct DecideRequest {
    state: serde_json::Value,
    questions: Vec<serde_json::Value>,
}

#[derive(Serialize)]
struct DecideResponse {
    answers: Vec<serde_json::Value>,
    latency_ms: u64,
    model_version: String,
}

#[no_mangle]
pub extern "C" fn somi_decide(ptr: *const u8, len: usize) -> u64 {
    // Read input payload from WASM memory buffer
    // Perform constrained decoding or HTTPS call to vendor
    // Return output buffer pointer
    0
}
```

---

## 5. Building & Packaging

```bash
# Build WASM binary
cargo build --target wasm32-wasip1 --release

# Copy to plugin directory
cp target/wasm32-wasip1/release/my_plugin.wasm dist/plugin.wasm
cp plugin.json dist/

# Test locally in Tiny Decision
tiny-decision-cli plugin install ./dist
```
