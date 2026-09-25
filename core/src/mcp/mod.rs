//! Model Context Protocol (MCP) Export & Embedded Server (Section 4.8)
//!
//! Enables publishing any DecisionTemplate or Pipeline as an MCP Tool
//! so autonomous agents (Claude, Cursor, custom agent loops) can execute
//! sub-100ms typed decisions directly with zero custom glue code.

use anyhow::{Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::info;
use uuid::Uuid;

use crate::types::{DecisionTemplate, MCPExport, Question, QuestionType};

/// MCP Tool definition according to the Model Context Protocol specification.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
    pub output_schema: serde_json::Value,
}

/// Manifest published to discovery registries or embedded in stdio MCP server.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpManifest {
    pub protocol_version: String,
    pub server_info: McpServerInfo,
    pub tools: Vec<McpToolDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerInfo {
    pub name: String,
    pub version: String,
}

/// Generate an MCP Tool definition from a DecisionTemplate.
pub fn generate_mcp_tool_from_template(template: &DecisionTemplate) -> McpToolDefinition {
    let tool_name = format!(
        "decide_{}",
        template
            .name
            .to_lowercase()
            .replace(' ', "_")
            .replace('-', "_")
    );

    // Build input JSON Schema
    let input_schema = serde_json::json!({
        "type": "object",
        "properties": {
            "state": {
                "type": "object",
                "description": "The contextual information, facts, or payload to decide upon."
            }
        },
        "required": ["state"]
    });

    // Build output JSON Schema based on typed questions
    let mut properties = serde_json::Map::new();
    let mut required = Vec::new();

    for q in &template.questions {
        match q {
            Question::Choice(cq) => {
                let options: Vec<String> = cq.options.iter().map(|o| o.id.clone()).collect();
                properties.insert(
                    cq.id.clone(),
                    serde_json::json!({
                        "type": "string",
                        "enum": options,
                        "description": cq.text
                    }),
                );
                required.push(cq.id.clone());
            }
            Question::Noul(nq) => {
                properties.insert(
                    nq.id.clone(),
                    serde_json::json!({
                        "type": "boolean",
                        "description": nq.text
                    }),
                );
                required.push(nq.id.clone());
            }
            Question::Score(sq) => {
                properties.insert(
                    sq.id.clone(),
                    serde_json::json!({
                        "type": "number",
                        "minimum": sq.min,
                        "maximum": sq.max,
                        "description": sq.text
                    }),
                );
                required.push(sq.id.clone());
            }
        }
    }

    properties.insert(
        "confidence".to_string(),
        serde_json::json!({
            "type": "number",
            "minimum": 0.0,
            "maximum": 1.0,
            "description": "Post-calibrated confidence score"
        }),
    );
    required.push("confidence".to_string());

    let output_schema = serde_json::json!({
        "type": "object",
        "properties": properties,
        "required": required
    });

    McpToolDefinition {
        name: tool_name,
        description: format!("Executes typed decision template: {}", template.name),
        input_schema,
        output_schema,
    }
}

/// Create a standalone exportable MCP server script (Node.js stdio MCP server).
pub fn export_standalone_mcp_server(tool: &McpToolDefinition, template_id: &str) -> String {
    format!(
r#"#!/usr/bin/env node
// Auto-generated MCP Server for Tiny Decision tool: {tool_name}
// Protocol: Model Context Protocol (MCP) stdio transport
import {{ Server }} from "@modelcontextprotocol/sdk/server/index.js";
import {{ StdioServerTransport }} from "@modelcontextprotocol/sdk/server/stdio.js";
import {{ CallToolRequestSchema, ListToolsRequestSchema }} from "@modelcontextprotocol/sdk/types.js";

const TINY_DECISION_ENDPOINT = process.env.TINY_DECISION_ENDPOINT || "http://127.0.0.1:11535";

const server = new Server(
  {{ name: "tiny-decision-{tool_name}", version: "1.0.0" }},
  {{ capabilities: {{ tools: {{}} }} }}
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({{
  tools: [{
    name: "{tool_name}",
    description: "{description}",
    inputSchema: {input_schema}
  }]
}}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {{
  if (request.params.name !== "{tool_name}") {{
    throw new Error(`Unknown tool: ${{request.params.name}}`);
  }}

  const state = request.params.arguments?.state || {{}};
  const resp = await fetch(`${{TINY_DECISION_ENDPOINT}}/v1/decide`, {{
    method: "POST",
    headers: {{ "Content-Type": "application/json" }},
    body: JSON.stringify({{
      model: "default",
      state: state,
      questions: []
    }})
  }});

  const data = await resp.json();
  return {{
    content: [{{ type: "text", text: JSON.stringify(data) }}]
  }};
}});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Tiny Decision MCP stdio server running for {tool_name}");
"#,
        tool_name = tool.name,
        description = tool.description,
        input_schema = serde_json::to_string(&tool.input_schema).unwrap_or_default(),
    )
}
