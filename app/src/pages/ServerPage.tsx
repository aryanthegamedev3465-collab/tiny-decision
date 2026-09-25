import React, { useState } from "react";
import {
  Server,
  Play,
  Square,
  Copy,
  Download,
  Share2,
  CheckCircle2,
  Terminal,
  ExternalLink,
  Code,
} from "lucide-react";
import { useStore } from "@/store";

export function ServerPage(): React.ReactElement {
  const status = useStore((s) => s.status);
  const startServer = useStore((s) => s.startServer);
  const stopServer = useStore((s) => s.stopServer);
  const port = useStore((s) => s.port);

  const [activeLang, setActiveLang] = useState<"curl" | "python" | "typescript">("curl");
  const [copied, setCopied] = useState(false);

  const isRunning = status === "running";

  const codeSnippets = {
    curl: `curl -X POST http://127.0.0.1:${port}/v1/decide \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "default",
    "state": { "text": "Customer order #8491 refund request" },
    "questions": [
      {
        "type": "Noul",
        "id": "q_eligible",
        "text": "Is this customer eligible for a full refund?"
      }
    ]
  }'`,
    python: `import requests

resp = requests.post("http://127.0.0.1:${port}/v1/decide", json={
    "model": "default",
    "state": {"text": "Customer order #8491 refund request"},
    "questions": [{
        "type": "Noul",
        "id": "q_eligible",
        "text": "Is this customer eligible for a full refund?"
    }]
})
decision = resp.json()
print("Confidence:", decision["answers"][0]["confidence"])`,
    typescript: `import fetch from "node-fetch";

const res = await fetch("http://127.0.0.1:${port}/v1/decide", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "default",
    state: { text: "Customer order #8491 refund request" },
    questions: [
      {
        type: "Noul",
        id: "q_eligible",
        text: "Is this customer eligible for a full refund?",
      },
    ],
  }),
});
const data = await res.json();
console.log("Decision:", data);`,
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippets[activeLang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] text-gray-200 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f] bg-[#111]">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">Local API Server & MCP Export</h1>
          <p className="text-xs text-gray-400">
            Ship decisions directly into production agents, pipelines, and external applications
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => (isRunning ? stopServer() : startServer())}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md ${
              isRunning
                ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                : "bg-[#00e676] text-black hover:bg-[#00c853] shadow-[#00e676]/20"
            }`}
          >
            {isRunning ? (
              <>
                <Square size={13} fill="currentColor" />
                Stop Server
              </>
            ) : (
              <>
                <Play size={13} fill="currentColor" />
                Start Server (:{port})
              </>
            )}
          </button>
        </div>
      </div>

      <div className="p-6 max-w-6xl flex flex-col gap-6">
        {/* Server Status Hero */}
        <div className="bg-[#141414] border border-[#252525] rounded-xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                isRunning
                  ? "bg-[#00e676]/15 border-[#00e676]/40 text-[#00e676]"
                  : "bg-gray-800/30 border-gray-700/50 text-gray-500"
              }`}
            >
              <Server size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Local Server Endpoint</span>
                <span
                  className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                    isRunning
                      ? "bg-[#00e676]/15 text-[#00e676] border border-[#00e676]/30"
                      : "bg-gray-800 text-gray-400"
                  }`}
                >
                  {isRunning ? "Listening" : "Stopped"}
                </span>
              </div>
              <p className="text-xs font-mono text-gray-400 mt-0.5">
                http://127.0.0.1:{port}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => window.open(`http://127.0.0.1:${port}/v1/openapi.json`, "_blank")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e1e1e] hover:bg-[#282828] text-xs text-gray-300 border border-[#333] transition-colors"
            >
              <Download size={13} />
              OpenAPI JSON
            </button>
          </div>
        </div>

        {/* Code Snippets Section */}
        <div className="bg-[#141414] border border-[#252525] rounded-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#222] bg-[#161616]">
            <div className="flex items-center gap-2">
              <Code size={16} className="text-[#00e676]" />
              <span className="text-xs font-bold text-gray-200">Integration Client Snippets</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-[#1f1f1f] rounded-lg p-0.5 border border-[#333]">
                {(["curl", "python", "typescript"] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setActiveLang(lang)}
                    className={`px-3 py-1 text-xs rounded font-mono capitalize ${
                      activeLang === lang ? "bg-[#2a2a2a] text-[#00e676] font-bold" : "text-gray-400"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>

              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#202020] hover:bg-[#282828] text-xs text-gray-300 border border-[#333]"
              >
                {copied ? <CheckCircle2 size={13} className="text-[#00e676]" /> : <Copy size={13} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <pre className="p-4 text-xs font-mono text-gray-300 bg-[#0d0d0d] overflow-x-auto leading-relaxed">
            {codeSnippets[activeLang]}
          </pre>
        </div>

        {/* MCP Export Card */}
        <div className="bg-[#141414] border border-[#252525] rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 size={18} className="text-[#00e676]" />
              <div>
                <h3 className="text-sm font-bold text-white">Model Context Protocol (MCP) Export</h3>
                <p className="text-xs text-gray-400">
                  Allow external agents (Claude, Cursor, custom bots) to call your decisions as native tools
                </p>
              </div>
            </div>
            <button className="px-3 py-1.5 rounded-lg bg-[#00e676] text-black text-xs font-bold hover:bg-[#00c853]">
              Publish as MCP Tool
            </button>
          </div>

          <div className="bg-[#181818] border border-[#262626] rounded-lg p-3 text-xs font-mono text-gray-400">
            <code>
              {`// Claude Desktop configuration snippet (claude_desktop_config.json):
{
  "mcpServers": {
    "tiny-decision": {
      "command": "node",
      "args": ["C:/Users/Dell/.gemini/antigravity/scratch/tiny-decision/docs/mcp-server.js"]
    }
  }
}`}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
