# SOMI — System One Model Interface Specification

**Version:** v1  
**Status:** Stable  
**Last Updated:** 2026-09-25  
**Authors:** Tiny Decision Authors

---

## Table of Contents

1. [Overview](#overview)
2. [Design Principles](#design-principles)
3. [Transport](#transport)
4. [Authentication](#authentication)
5. [Endpoints](#endpoints)
   - [POST /somi/v1/decide](#post-somiv1decide)
   - [GET /somi/v1/health](#get-somiv1health)
   - [GET /somi/v1/models](#get-somiv1models)
   - [GET /somi/v1/templates](#get-somiv1templates)
6. [Request Schema](#request-schema)
7. [Response Schema](#response-schema)
8. [Question Types](#question-types)
9. [Answer Format](#answer-format)
10. [Error Codes](#error-codes)
11. [Adapter Authoring Guide](#adapter-authoring-guide)
12. [Native vs Adapted Badge Criteria](#native-vs-adapted-badge-criteria)
13. [Versioning](#versioning)
14. [Changelog](#changelog)

---

## Overview

**SOMI** (System One Model Interface) is a minimal, opinionated HTTP interface that standardises how AI decision models are invoked. Any model — local GGUF, cloud API, or rule-based engine — that implements SOMI can be plugged into Tiny Decision without code changes.

SOMI's design philosophy:

- **Typed questions, not free text.** Every question has a declared type (`choice`, `noul`, `score`) which constrains the answer space and enables automatic calibration.
- **Probabilities, not just answers.** Every answer includes a probability distribution so downstream systems can apply custom thresholds.
- **Calibration-aware.** Responses include a `calibrated` flag so consumers know whether raw or calibrated probabilities are returned.
- **Latency-transparent.** Per-question and total latency are always included.

---

## Design Principles

| Principle | Rationale |
|---|---|
| Stateless | Each `/decide` call is fully self-contained. No session management. |
| Typed | Question types are declared explicitly, not inferred. |
| Probabilistic | All answers carry probability distributions. |
| Auditable | Every response includes a `run_id` for correlation with audit logs. |
| Adapter-first | Cloud and local models are equal first-class citizens. |
| Minimal | The protocol defines only what is necessary. No GraphQL, no gRPC, no schemas beyond JSON. |

---

## Transport

| Property | Value |
|---|---|
| Protocol | HTTP/1.1 or HTTP/2 |
| Default port | 11535 (Tiny Decision local server) |
| Content-Type | `application/json` |
| Character Encoding | UTF-8 |
| TLS | Optional (local); required for remote endpoints |

---

## Authentication

The local server (port 11535) is unauthenticated by default. To enable token auth:

```json
// tauri.conf.json -> plugins -> http
{
  "requireApiKey": true,
  "apiKeyHeader": "X-TD-API-Key"
}
```

Remote SOMI adapters may use any auth mechanism they choose, configured in the plugin manifest.

---

## Endpoints

### POST /somi/v1/decide

The primary endpoint. Submit one or more typed questions about a state object and receive calibrated probability answers.

**Request:**

```
POST /somi/v1/decide
Content-Type: application/json
```

**Response:**

```
200 OK
Content-Type: application/json
```

---

### GET /somi/v1/health

Health check endpoint. Returns server status and loaded models.

**Response:**

```json
{
  "status": "ok",
  "somi_version": "v1",
  "server_version": "0.1.0",
  "uptime_seconds": 3600,
  "loaded_models": ["microsoft/phi-2", "google/gemma-2-2b-it"],
  "requests_served": 1024,
  "timestamp": "2026-09-25T10:15:30Z"
}
```

---

### GET /somi/v1/models

List all locally available models and their SOMI capabilities.

**Response:**

```json
{
  "models": [
    {
      "model_id": "microsoft/phi-2",
      "name": "Phi-2",
      "status": "loaded",
      "somi_type": "native",
      "supported_question_types": ["choice", "noul", "score"],
      "context_size": 2048,
      "quantization": "Q4_K_M",
      "size_bytes": 1610612736,
      "avg_latency_ms": 45
    }
  ]
}
```

---

### GET /somi/v1/templates

List all saved Decision Templates.

**Response:**

```json
{
  "templates": [
    {
      "id": "refund-eligibility",
      "name": "Refund Eligibility",
      "model_id": "microsoft/phi-2",
      "questions": [...],
      "calibrated": true,
      "last_eval_accuracy": 0.94,
      "last_eval_ece": 0.032
    }
  ]
}
```

---

## Request Schema

```json
{
  "$schema": "https://somi.tinydecision.com/schemas/v1/decide-request.json",
  "type": "object",
  "required": ["model_id", "state", "questions"],
  "properties": {
    "model_id": {
      "type": "string",
      "description": "HuggingFace model ID or adapter plugin ID (e.g. 'microsoft/phi-2', 'openrouter-adapter')",
      "example": "microsoft/phi-2"
    },
    "template_id": {
      "type": "string",
      "description": "Optional ID of a saved Decision Template. Overrides questions if provided.",
      "example": "refund-eligibility"
    },
    "state": {
      "type": "object",
      "description": "The decision context. Key-value pairs describing the current situation. Values may be strings, numbers, or booleans.",
      "example": {
        "order_value": 45.99,
        "days_since_purchase": 12,
        "customer_tier": "gold",
        "reason": "item_not_as_described"
      }
    },
    "questions": {
      "type": "array",
      "description": "One or more typed questions to answer about the state.",
      "minItems": 1,
      "maxItems": 10,
      "items": { "$ref": "#/definitions/Question" }
    },
    "options": {
      "type": "object",
      "properties": {
        "calibrate": {
          "type": "boolean",
          "default": true,
          "description": "Apply calibration model if available."
        },
        "temperature": {
          "type": "number",
          "minimum": 0.0,
          "maximum": 2.0,
          "default": 0.0,
          "description": "Sampling temperature. Use 0.0 for deterministic (greedy) decoding."
        },
        "timeout_ms": {
          "type": "integer",
          "minimum": 100,
          "maximum": 60000,
          "default": 5000,
          "description": "Per-question timeout in milliseconds."
        },
        "trace": {
          "type": "boolean",
          "default": false,
          "description": "Include reasoning trace in the response (increases latency)."
        }
      }
    }
  },
  "definitions": {
    "Question": {
      "type": "object",
      "required": ["id", "type", "text"],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-z0-9_-]+$",
          "description": "Unique identifier for this question within the request.",
          "example": "eligible"
        },
        "type": {
          "type": "string",
          "enum": ["choice", "noul", "score"],
          "description": "Question type."
        },
        "text": {
          "type": "string",
          "description": "The natural language question text, phrased for the model.",
          "example": "Is this return eligible for an automatic refund?"
        },
        "choices": {
          "type": "array",
          "items": { "type": "string" },
          "minItems": 2,
          "maxItems": 8,
          "description": "Required for type='choice'. The set of valid answer choices.",
          "example": ["yes", "no", "needs_review"]
        },
        "label": {
          "type": "string",
          "description": "Required for type='noul'. The concept being scored.",
          "example": "escalation_needed"
        },
        "context_fields": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Optional subset of state fields to include in this question's prompt. Omit to include all.",
          "example": ["order_value", "customer_tier"]
        }
      }
    }
  }
}
```

### Full Request Example

```json
{
  "model_id": "microsoft/phi-2",
  "template_id": "refund-eligibility-v2",
  "state": {
    "order_value": 45.99,
    "days_since_purchase": 12,
    "customer_tier": "gold",
    "reason": "item_not_as_described",
    "previous_refunds": 0,
    "item_category": "electronics"
  },
  "questions": [
    {
      "id": "eligible",
      "type": "choice",
      "text": "Based on the return details, is this return eligible for an automatic refund?",
      "choices": ["yes", "no", "needs_review"],
      "context_fields": ["order_value", "days_since_purchase", "customer_tier", "reason", "previous_refunds"]
    },
    {
      "id": "fraud_risk",
      "type": "noul",
      "text": "Does this return request show signs of return fraud?",
      "label": "fraud_risk"
    },
    {
      "id": "urgency",
      "type": "score",
      "text": "How urgent is this return request on a scale from 0 to 1?",
      "label": "urgency_score"
    }
  ],
  "options": {
    "calibrate": true,
    "temperature": 0.0,
    "timeout_ms": 3000,
    "trace": false
  }
}
```

---

## Response Schema

```json
{
  "$schema": "https://somi.tinydecision.com/schemas/v1/decide-response.json",
  "type": "object",
  "required": ["run_id", "model_id", "answers", "total_latency_ms", "somi_version"],
  "properties": {
    "run_id": {
      "type": "string",
      "description": "Globally unique run identifier (ULID format). Use for audit log correlation.",
      "example": "01J9XK2M3P4R5S6T7V8W9X0Y1Z"
    },
    "model_id": {
      "type": "string",
      "description": "The model that produced these answers."
    },
    "template_id": {
      "type": "string",
      "description": "Template ID if one was provided in the request."
    },
    "answers": {
      "type": "array",
      "items": { "$ref": "#/definitions/Answer" }
    },
    "total_latency_ms": {
      "type": "integer",
      "description": "Total wall-clock latency for the entire request in milliseconds."
    },
    "somi_version": {
      "type": "string",
      "enum": ["v1"],
      "description": "SOMI protocol version."
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 UTC timestamp of the response."
    },
    "trace": {
      "type": "object",
      "description": "Present only when options.trace=true. Contains per-question reasoning steps.",
      "properties": {
        "steps": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    }
  },
  "definitions": {
    "Answer": {
      "type": "object",
      "required": ["question_id", "value", "probabilities", "confidence", "calibrated", "latency_ms"],
      "properties": {
        "question_id": {
          "type": "string",
          "description": "Matches the 'id' field of the corresponding question."
        },
        "value": {
          "description": "The highest-probability answer. String for 'choice'/'noul', number for 'score'."
        },
        "probabilities": {
          "type": "object",
          "description": "Full probability distribution over all possible answers. Values sum to 1.0.",
          "additionalProperties": { "type": "number", "minimum": 0.0, "maximum": 1.0 },
          "example": { "yes": 0.87, "no": 0.09, "needs_review": 0.04 }
        },
        "confidence": {
          "type": "number",
          "minimum": 0.0,
          "maximum": 1.0,
          "description": "Probability of the top answer. Convenience alias for max(probabilities.values())."
        },
        "calibrated": {
          "type": "boolean",
          "description": "Whether a calibration model was applied to these probabilities."
        },
        "latency_ms": {
          "type": "integer",
          "description": "Time taken to answer this specific question in milliseconds."
        },
        "null_probability": {
          "type": "number",
          "description": "Present for type='noul'. Probability that the concept is absent/null."
        }
      }
    }
  }
}
```

### Full Response Example

```json
{
  "run_id": "01J9XK2M3P4R5S6T7V8W9X0Y1Z",
  "model_id": "microsoft/phi-2",
  "template_id": "refund-eligibility-v2",
  "answers": [
    {
      "question_id": "eligible",
      "value": "yes",
      "probabilities": {
        "yes": 0.87,
        "no": 0.09,
        "needs_review": 0.04
      },
      "confidence": 0.87,
      "calibrated": true,
      "latency_ms": 42
    },
    {
      "question_id": "fraud_risk",
      "value": null,
      "probabilities": {
        "present": 0.08,
        "absent": 0.92
      },
      "confidence": 0.92,
      "calibrated": true,
      "null_probability": 0.92,
      "latency_ms": 38
    },
    {
      "question_id": "urgency",
      "value": 0.31,
      "probabilities": {},
      "confidence": 0.31,
      "calibrated": false,
      "latency_ms": 31
    }
  ],
  "total_latency_ms": 115,
  "somi_version": "v1",
  "timestamp": "2026-09-25T10:15:30.123Z"
}
```

---

## Question Types

### `choice` — Categorical Classification

Pick exactly one answer from a fixed set of choices.

```json
{
  "id": "disposition",
  "type": "choice",
  "text": "What should happen to this support ticket?",
  "choices": ["resolve_automatically", "escalate_to_tier_1", "escalate_to_tier_2", "close_as_spam"]
}
```

**Answer probabilities:** One entry per choice, summing to 1.0.

**Use when:** You have a fixed, enumerable set of outcomes (binary or multi-class).

**Implementation notes:**
- Native models: extract logits for each choice token and apply softmax.
- Adapted models: prompt the model to output one of the choice words, parse the response, and estimate probabilities from log-probs or multiple samples.

---

### `noul` — Null-or-Value (Binary Presence)

Detect whether a concept is present or absent.

```json
{
  "id": "fraud_signal",
  "type": "noul",
  "text": "Does this transaction show signs of fraud?",
  "label": "fraud_signal"
}
```

**Answer probabilities:** `{ "present": float, "absent": float }`  
**Answer value:** `null` (absent) or the label string (present).

**Use when:** You want to detect a signal that may or may not be present — conceptually a binary choice, but semantically "nothing was found" is different from "something was found."

---

### `score` — Continuous Probability Score

Estimate a 0–1 float representing the intensity or probability of a concept.

```json
{
  "id": "churn_risk",
  "type": "score",
  "text": "On a scale from 0 to 1, how likely is this customer to churn in the next 30 days?",
  "label": "churn_risk"
}
```

**Answer value:** Float in [0, 1].  
**Answer probabilities:** Empty object `{}` (continuous output, no discrete distribution).

**Use when:** You need a gradient rather than a category. Note: scores are harder to calibrate. Use ECE-calibration with histogram binning.

---

## Error Codes

All error responses use HTTP 4xx/5xx and include this body:

```json
{
  "error": {
    "code": "MODEL_NOT_LOADED",
    "message": "Model 'microsoft/phi-2' is not loaded. Call load_model first.",
    "request_id": "01J9XK2M3P4R5S6T7V8W9X0Y1Z",
    "somi_version": "v1"
  }
}
```

| HTTP Status | Code | Description |
|---|---|---|
| 400 | `INVALID_REQUEST` | Request body fails JSON schema validation |
| 400 | `UNKNOWN_QUESTION_TYPE` | `type` field is not one of `choice`, `noul`, `score` |
| 400 | `MISSING_CHOICES` | `type=choice` but `choices` array is absent or empty |
| 400 | `TOO_MANY_QUESTIONS` | More than 10 questions in a single request |
| 404 | `MODEL_NOT_FOUND` | `model_id` is not registered |
| 409 | `MODEL_NOT_LOADED` | Model is registered but not loaded into memory |
| 409 | `TEMPLATE_NOT_FOUND` | `template_id` does not exist |
| 422 | `INFERENCE_FAILED` | Model produced an output that could not be parsed |
| 429 | `RATE_LIMITED` | Too many requests (adapter-specific limits) |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 503 | `MODEL_BUSY` | Model is currently processing another request (single-instance mode) |
| 504 | `TIMEOUT` | Question exceeded `options.timeout_ms` |

---

## Adapter Authoring Guide

An **Adapter** is a SOMI Adapter plugin that wraps any external model — cloud API, custom HTTP endpoint, or alternative local runtime — behind the SOMI interface. Your adapter receives a `SomiRequest` and must return a `SomiResponse`.

### Step 1: Scaffold

```bash
cargo new --lib my-adapter
cd my-adapter
```

### Step 2: Add dependencies

```toml
[lib]
crate-type = ["cdylib"]

[dependencies]
tiny-decision-sdk = "0.1"
serde_json = "1.0"
```

### Step 3: Implement the adapter interface

```rust
use tiny_decision_sdk::prelude::*;

/// Required export: SOMI Adapter entry point.
/// The host calls this function with each decide request.
#[somi_adapter]
pub fn decide(request: SomiRequest) -> Result<SomiResponse> {
    let client = HttpClient::new(); // WASM-safe HTTP client provided by SDK

    let mut answers = Vec::new();

    for question in &request.questions {
        let prompt = build_prompt(&request.state, question);
        
        let api_response = client.post("https://openrouter.ai/api/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", request.config.get_str("api_key")?))
            .json(&serde_json::json!({
                "model": "openai/gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "logprobs": true,
                "top_logprobs": 5
            }))
            .send()?;

        let probs = extract_probabilities(&api_response, question)?;
        let top_answer = probs.iter().max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
            .map(|(k, _)| k.clone())
            .unwrap_or_default();

        answers.push(SomiAnswer {
            question_id: question.id.clone(),
            value: serde_json::Value::String(top_answer.clone()),
            probabilities: probs,
            confidence: answers.last().map(|a: &SomiAnswer| a.probabilities[&top_answer]).unwrap_or(0.0),
            calibrated: false,
            latency_ms: 0, // filled by host
        });
    }

    Ok(SomiResponse {
        answers,
        adapter_model_id: Some("openai/gpt-4o-mini".to_string()),
    })
}

fn build_prompt(state: &serde_json::Value, question: &SomiQuestion) -> String {
    format!(
        "Context:\n{}\n\nQuestion: {}\n\nChoices: {}\n\nAnswer with exactly one choice word:",
        serde_json::to_string_pretty(state).unwrap_or_default(),
        question.text,
        question.choices.as_deref().unwrap_or(&[]).join(", ")
    )
}

fn extract_probabilities(
    response: &serde_json::Value,
    question: &SomiQuestion,
) -> Result<std::collections::HashMap<String, f64>> {
    let choices = question.choices.as_deref().unwrap_or(&[]);
    let logprobs = response["choices"][0]["logprobs"]["content"].as_array()
        .ok_or_else(|| anyhow::anyhow!("No logprobs in response"))?;
    
    let mut probs: std::collections::HashMap<String, f64> = choices.iter()
        .map(|c| (c.clone(), 0.001)) // small default
        .collect();

    for logprob_entry in logprobs {
        let token = logprob_entry["token"].as_str().unwrap_or("").trim().to_lowercase();
        let lp = logprob_entry["logprob"].as_f64().unwrap_or(-10.0);
        if let Some(v) = probs.get_mut(&token) {
            *v = (lp as f64).exp();
        }
    }

    // Normalise
    let total: f64 = probs.values().sum();
    if total > 0.0 {
        for v in probs.values_mut() { *v /= total; }
    }

    Ok(probs)
}
```

### Step 4: Build and install

```bash
cargo build --target wasm32-wasi --release
td plugin install ./plugin.json
```

### Step 5: Write `plugin.json`

```json
{
  "id": "my-openrouter-adapter",
  "name": "My OpenRouter Adapter",
  "version": "0.1.0",
  "type": "somi_adapter",
  "wasm_path": "./target/wasm32-wasi/release/my_adapter.wasm",
  "permissions": ["http_outbound"],
  "config_schema": {
    "api_key": { "type": "string", "secret": true, "required": true }
  }
}
```

---

## Native vs Adapted Badge Criteria

Every model in Tiny Decision displays one of two badges:

### 🏅 Native

A **Native** model produces SOMI-compliant probability distributions directly from its token vocabulary without requiring prompt engineering or output parsing.

**Criteria:**
1. The model is loaded as a GGUF via llama.cpp (or equivalent).
2. For `choice` questions: the model returns log-probabilities over the choice tokens in the first generated token position.
3. The choice tokens must be in the model's vocabulary as single tokens (i.e., `"yes"` → token ID 3582, `"no"` → token ID 694).
4. No multi-sample averaging is required.
5. Latency is ≤ 150ms on reference hardware (Apple M2, CPU-only, Q4_K_M quant).

**Examples:** Phi-2, Gemma-2-2B, Qwen-1.5-1.8B (with GGUF + appropriate prompt template)

### 🔌 Adapted

An **Adapted** model goes through a SOMI Adapter plugin that bridges the model's actual output format to SOMI's probability format.

**Criteria:**
- Anything that doesn't meet Native criteria (cloud APIs, alternative runtimes, models without GGUF).
- The adapter must still produce valid probability distributions (cannot return a single answer with no probabilities).
- The adapter must declare its approximate latency in `plugin.json` for Auto-Router to use.

**Examples:** OpenRouter (GPT-4o-mini), Anthropic Claude, Azure OpenAI, Ollama bridge

---

## Versioning

SOMI uses a single integer version prefix in the URL path (`/somi/v1/`). Breaking changes will increment this version. The `somi_version` field in all responses always reflects the version used, allowing clients to handle multiple versions simultaneously.

---

## Changelog

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2026-09-25 | Initial stable release. `choice`, `noul`, `score` types. Calibration flag. Latency reporting. |
