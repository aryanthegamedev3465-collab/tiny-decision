# Tiny Decision Technical Architecture

Tiny Decision is designed from the ground up as a durable desktop platform for System One typed decision models on Windows.

---

## 1. System Overview & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           Windows 10 / 11 Desktop                              │
├────────────────────────────────────────────────────────────────────────────────┤
│  Frontend (Tauri Webview): React 18 + TypeScript + Zustand + Tailwind CSS      │
│  - Pipeline Builder (react-flow DAG canvas)                                    │
│  - Calibration Suite (Reliability diagrams via Recharts)                       │
│  - Model Manager & Discovery (Hugging Face Hub integration)                    │
│  - Interactive Playground & Batch Runner                                       │
├──────────────────────────────▲─────────────────────────────────────────────────┤
│                              │ Tauri IPC (Zero serialization overhead)         │
├──────────────────────────────▼─────────────────────────────────────────────────┤
│  Rust Backend Core (In-Process Runtime)                                        │
│  ┌──────────────────────┐  ┌───────────────────────┐  ┌─────────────────────┐  │
│  │ Hot Model Registry   │  │ SOMI Multi-Vendor     │  │ Calibration Engine  │  │
│  │ - GGUF (llama-cpp-2) │  │ - Local GGUF Adapter  │  │ - ECE & Binning     │  │
│  │ - ONNX (ort)         │  │ - Local ONNX Adapter  │  │ - Platt / Temp / Iso│  │
│  │ - DXGI VRAM Auto-GPU │  │ - Jev Hosted Adapter  │  │ - Adversarial Probe │  │
│  │ - Concurrent Hot Slots│ │ - Adapted GBNF Fallback│ │ - Cost Thresholding │  │
│  └──────────────────────┘  └───────────────────────┘  └─────────────────────┘  │
│  ┌──────────────────────┐  ┌───────────────────────┐  ┌─────────────────────┐  │
│  │ Axum HTTP Server     │  │ SQLite Database       │  │ WASM Plugin Sandbox │  │
│  │ - 127.0.0.1:11535    │  │ - rusqlite (WAL mode) │  │ - wasmtime runtime  │  │
│  │ - /v1/decide         │  │ - Run history & Eval  │  │ - Capability grants │  │
│  │ - MCP stdio / HTTP   │  │ - DPAPI Secrets Store │  │ - Adapter/Node types│  │
│  └──────────────────────┘  └───────────────────────┘  └─────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. In-Process Inference Architecture

Sub-100ms latency is non-negotiable for System One decision models. Traditional sidecar architectures (spawning Python subprocesses or Docker containers) introduce a 20–50ms process-boundary IPC hop and high memory overhead.

Tiny Decision embeds inference runtimes directly into the Rust backend:
- **GGUF Weights:** Loaded through `llama-cpp-2` bindings with direct CPU thread pinning and Windows DXGI GPU layer offload detection.
- **ONNX Models:** Executed via `ort` (ONNX Runtime) utilizing DirectML hardware acceleration.
- **Hot Model Registry:** Supports multiple active models resident in memory simultaneously. The Auto-Router dynamically selects the model with the lowest Expected Calibration Error (ECE) for each question type.

---

## 3. Calibration Engine (The Moat)

Public coverage of early System One models highlights that "confident does not equal correct." Tiny Decision treats calibration as an actionable product feature:
1. **Expected Calibration Error (ECE):**
   $$\text{ECE} = \sum_{m=1}^{M} \frac{|B_m|}{N} \left| \text{acc}(B_m) - \text{conf}(B_m) \right|$$
2. **Post-Hoc Recalibration:**
   Fits temperature scaling ($p = \sigma(z/T)$), Platt scaling, or monotonic isotonic regression onto user validation datasets.
   Profiles are applied at inference time as a lightweight post-processing step with **zero model retraining required**.
3. **Adversarial Stress-Testing:**
   Injects semantic conflicts, prompt overrides, and negation flips to verify that decision boundaries do not flip under trivial perturbation.

---

## 4. Model Context Protocol (MCP) Export

Tiny Decision turns local models into live agent tools. A single click compiles any `DecisionTemplate` into an MCP tool:
- Converts typed Choice/Noul/Score questions into strict JSON Schema properties.
- Exposes tools via an embedded stdio or HTTP MCP server compatible with Claude Desktop, Cursor, and custom agent loops.
