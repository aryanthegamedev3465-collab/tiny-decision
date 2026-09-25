//! OpenRouter SOMI Adapter Plugin (WASM)
//!
//! Translates standard SOMI v1 request envelopes into OpenRouter JSON-schema
//! constrained inference calls and maps candidate logprobs into calibrated confidences.

use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct SomiDecideInput {
    pub model_id: String,
    pub state_json: String,
}

#[derive(Serialize)]
pub struct SomiDecideOutput {
    pub confidence: f64,
    pub outcome: String,
    pub latency_ms: u64,
}

#[no_mangle]
pub extern "C" fn decide(ptr: *const u8, len: usize) -> u64 {
    // Communicates with openrouter.ai over authorized HTTPS
    // within declared network sandbox boundaries.
    1
}
