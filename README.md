# ⚡ Tiny Decision

<p align="center">
  <img src="assets/logo.jpg" alt="Tiny Decision Logo" width="140" style="border-radius: 24px; box-shadow: 0 0 35px rgba(0, 255, 136, 0.4);" />
</p>

<p align="center">
  <strong>A Local Harness & Deployment Platform for System One AI Models on Windows</strong><br>
  <em>Sub-50ms in-process decisions, empirical calibration trust, visual DAG pipelines, and one-click MCP agent tool export.</em>
</p>

<p align="center">
  <a href="https://github.com/aryanthegamedev3465-collab/tiny-decision/releases"><img src="https://img.shields.io/github/v/release/aryanthegamedev3465-collab/tiny-decision?color=%2300ff88&label=release" alt="Release" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="#"><img src="https://img.shields.io/badge/platform-Windows%2010%20%2F%2011-00f0ff.svg" alt="Platform: Windows" /></a>
  <a href="./docs/SOMI_SPEC.md"><img src="https://img.shields.io/badge/SOMI%20Spec-v1.0-9d4edd.svg" alt="SOMI Spec v1.0" /></a>
  <a href="#"><img src="https://img.shields.io/badge/latency-%3C%2050ms-ffb703.svg" alt="Latency < 50ms" /></a>
</p>

---

## 🌟 Why Tiny Decision?

LM Studio became the trusted, polished local home for prose-generation models (Llama, Mistral). But **System One models** (Jev-class, typed classification & regression heads) are a fundamentally distinct category: **they don't generate freeform text — they make instant, structured decisions.**

Tiny Decision owns the three pillars needed for this category:

1. **The Calibration Trust Moat:** The fatal flaw of small decision models is that *"confident ≠ correct"*. Tiny Decision makes calibration measurable and actionable: Expected Calibration Error (ECE) tracking, visual Reliability Diagrams, and **post-hoc recalibration** (Temperature & Platt scaling) that fixes confidence **with zero model retraining**.
2. **Prototype to Production:** Test a decision in the visual workbench $\rightarrow$ evaluate 10,000 rows in the batch runner $\rightarrow$ **ship as an MCP tool** or local REST API (`127.0.0.1:11535`) in one click.
3. **Vendor Neutrality (SOMI):** Tiny Decision defines the open **System One Model Interface (SOMI)**. Any current or future model vendor (local GGUF, local ONNX, Jev hosted API, OpenRouter) plugs in through the identical contract.

---


---

## 🏗️ Architecture

Tiny Decision embeds inference runtimes **in-process** in Rust (Tauri 2.x backend) to eliminate the 20–50ms process-boundary IPC hop common in Python sidecars.

```mermaid
flowchart TD
    subgraph Desktop["Windows Desktop (Tauri 2.x + React 18 + Zustand)"]
        UI["Grok-Styled React UI\n(Playground, Visual DAG Canvas, Reliability Diagrams)"]
        TC["Tauri IPC Bridge\n(commands.rs)"]
    end

    subgraph Core["Rust Core Engine (In-Process Runtime)"]
        HMR["Hot Model Registry\n(Concurrent in-memory slots)"]
        GGUF["llama-cpp-2 (GGUF)\nDXGI VRAM Auto-GPU"]
        ONNX["ort (ONNX Runtime)\nDirectML acceleration"]
        SOMI["SOMI Abstraction Layer\n(GGUF, ONNX, Jev, Adapted LLM, Auto-Router)"]
        CALIB["Calibration Engine\n(ECE, Platt, Temperature, Isotonic, Adversarial Probes)"]
        DAG["11-Node Pipeline Engine\n(Decision, Branch, Fanout, Loop, Ensemble, Shadow)"]
        AXUM["Axum REST Server\n(127.0.0.1:11535)"]
        DB["SQLite Storage\n(rusqlite with WAL mode & DPAPI)"]
    end

    subgraph Production["Production Targets"]
        MCP["Model Context Protocol (MCP)\n(Claude Desktop, Cursor, Custom Agents)"]
        API["REST Clients\n(Python, TypeScript, curl)"]
        CI["CI/CD Gate\n(tiny-decision-cli)"]
    end

    UI <-->|Tauri IPC| TC
    TC <--> HMR
    HMR --> GGUF
    HMR --> ONNX
    SOMI --> HMR
    CALIB --> SOMI
    DAG --> CALIB
    AXUM --> DAG
    DB <--> AXUM

    AXUM --> API
    AXUM --> MCP
    Core --> CI
```

---

## ⚡ Quick Start

### Option A: Download the Windows App (Recommended)
Download the latest portable release from **[Releases](https://github.com/aryanthegamedev3465-collab/tiny-decision/releases)**:
1. Download `tiny-decision-v1.0.0-windows-x64.zip`.
2. Extract the folder anywhere on Windows 10/11.
3. Double-click `Tiny Decision.bat` or run `td.exe`.

### Option B: Run from Source

```powershell
# 1. Clone repository
git clone https://github.com/aryanthegamedev3465-collab/tiny-decision.git
cd tiny-decision

# 2. Run the frontend in dev mode
cd app
npm install
npm run dev

# 3. Build the CLI binary
cd ..
cargo build --release --bin td
```

---

## 🔌 System One Model Interface (SOMI v1)

Every model in Tiny Decision satisfies the uniform SOMI HTTP contract:

```http
POST http://127.0.0.1:11535/somi/v1/decide
Content-Type: application/json

{
  "state": {
    "order_id": "ORD-94182",
    "customer_tier": "platinum",
    "item_condition": "unopened",
    "days_since_delivery": 4
  },
  "questions": [
    {
      "type": "Noul",
      "id": "q_eligible",
      "text": "Is this customer eligible for an immediate full refund?"
    }
  ]
}
```

### Response:
```json
{
  "answers": [
    {
      "question_id": "q_eligible",
      "type": "Noul",
      "value": true,
      "confidence": 0.942,
      "raw_confidence": 0.910,
      "probability": 0.942,
      "latency_ms": 28
    }
  ],
  "latency_ms": 28,
  "model_version": "jev-decision-1.5b"
}
```

---

## 🤖 MCP Export — Ship Decisions as Agent Tools

Any decision template can be published as an MCP tool directly into **Claude Desktop** or **Cursor**.

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tiny-decision": {
      "command": "node",
      "args": ["C:/path/to/tiny-decision/docs/mcp-server.js"]
    }
  }
}
```

Now, Claude can call `decide_refund_eligibility({ state: { ... } })` as a native sub-50ms tool with zero custom glue code.

---

## 📊 The Calibration Suite

### Expected Calibration Error (ECE)
$$\text{ECE} = \sum_{m=1}^{M} \frac{|B_m|}{N} \left| \text{acc}(B_m) - \text{conf}(B_m) \right|$$

- **Reliability Diagrams:** Plots reported confidence buckets against empirical accuracy.
- **Post-Hoc Recalibration:** Fits Temperature scaling ($T$), Platt scaling ($A, B$), or non-parametric Isotonic regression.
- **Adversarial Probe Generator:** Automatically perturbs state text (conflict injection, prompt injection overrides, negation swaps) to stress-test fragile boundaries.
- **Cost-Matrix Threshold Tuning:** Minimizes enterprise financial risk based on the cost of false positives, false negatives, and human escalations.

---

## 📦 Project Layout

```
tiny-decision/
├── assets/                         # Curated models manifest & app logo
├── app/                            # React 18 + TypeScript + Tailwind frontend
│   ├── src/pages/                  # Models, Playground, Batch, Pipelines, Calibration, etc.
│   └── src-tauri/                  # Tauri 2.x desktop configuration & commands
├── core/                           # Rust core library (inference, SOMI, calibration, server)
├── cli/                            # tiny-decision-cli (td binary)
├── docs/                           # SOMI spec, plugin guide, architecture, OpenAPI spec
└── plugins/examples/               # WASM plugins (Slack alert, OpenRouter adapter)
```

---

## 📜 License

MIT License © 2026 Tiny Decision Authors. See [`LICENSE`](./LICENSE) for details.
