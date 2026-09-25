import React, { useState } from "react";
import {
  GitBranch,
  Save,
  Play,
  Download,
  FileCode,
  Layers,
  Sparkles,
  Columns,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useStore } from "@/store";
import { PipelineCanvas } from "@/components/pipeline/PipelineCanvas";

export function PipelinePage(): React.ReactElement {
  const pipelines = useStore((s) => s.pipelines);
  const activePipelineId = useStore((s) => s.activePipelineId);
  const savePipeline = useStore((s) => s.savePipeline);
  const exportPipelineAsCode = useStore((s) => s.exportPipelineAsCode);
  const promotePipeline = useStore((s) => s.promotePipeline);

  const [activeLang, setActiveLang] = useState<"python" | "node">("python");
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportedCode, setExportedCode] = useState("");
  const [showDiffModal, setShowDiffModal] = useState(false);

  const activePipeline =
    pipelines.find((p) => p.id === activePipelineId) || {
      id: "pipeline-refund-main",
      name: "Autonomous Refund Resolution DAG",
      version: "1.2.0",
      status: "production" as const,
      nodes: [],
      edges: [],
    };

  const handleExport = async (lang: "python" | "node") => {
    setActiveLang(lang);
    const code = await exportPipelineAsCode(activePipeline.id, lang);
    setExportedCode(code);
    setShowExportModal(true);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] text-gray-200 overflow-hidden">
      {/* Top pipeline bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#1f1f1f] bg-[#111]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <GitBranch size={16} className="text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-wide">
                {activePipeline.name}
              </h1>
              <span className="text-[11px] font-mono px-2 py-0.2 rounded bg-[#1e1e1e] text-gray-400 border border-[#333]">
                v{activePipeline.version}
              </span>
              <span
                className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                  activePipeline.status === "production"
                    ? "bg-[#00e676]/15 text-[#00e676] border border-[#00e676]/30"
                    : activePipeline.status === "shadow"
                    ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                    : "bg-[#ffd600]/15 text-[#ffd600] border border-[#ffd600]/30"
                }`}
              >
                {activePipeline.status}
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              DAG control flow: Decision, Branch, Fan-out, Ensemble & Human Escalation
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDiffModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181818] hover:bg-[#222] text-xs font-medium text-gray-300 border border-[#2a2a2a] transition-colors"
          >
            <Columns size={13} />
            Decision Diff
          </button>

          <button
            onClick={() => handleExport("python")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181818] hover:bg-[#222] text-xs font-medium text-gray-300 border border-[#2a2a2a] transition-colors"
          >
            <FileCode size={13} />
            Export Code
          </button>

          <button
            onClick={() => promotePipeline(activePipeline.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00e676] text-black text-xs font-bold hover:bg-[#00c853] transition-colors"
          >
            <CheckCircle2 size={13} />
            Promote to Prod
          </button>
        </div>
      </div>

      {/* Main visual canvas */}
      <div className="flex-1 p-4 overflow-hidden relative">
        <PipelineCanvas />
      </div>

      {/* Code Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#141414] border border-[#282828] rounded-xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#222] pb-3">
              <h2 className="text-sm font-bold text-white">Runnable Pipeline Script</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport("python")}
                  className={`px-3 py-1 text-xs rounded font-mono ${
                    activeLang === "python" ? "bg-[#00e676] text-black font-bold" : "bg-[#222] text-gray-300"
                  }`}
                >
                  Python
                </button>
                <button
                  onClick={() => handleExport("node")}
                  className={`px-3 py-1 text-xs rounded font-mono ${
                    activeLang === "node" ? "bg-[#00e676] text-black font-bold" : "bg-[#222] text-gray-300"
                  }`}
                >
                  Node.js / TS
                </button>
              </div>
            </div>

            <pre className="bg-[#0a0a0a] border border-[#222] rounded-lg p-4 text-xs font-mono text-gray-300 overflow-x-auto max-h-80 leading-relaxed">
              {exportedCode ||
                `# Tiny Decision Generated Client\nimport requests\n\ndef run():\n    return requests.post("http://127.0.0.1:11535/v1/pipelines/${activePipeline.id}/run", json={"state": {}}).json()`}
            </pre>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#222]">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-1.5 rounded-lg bg-[#222] text-xs text-gray-300 hover:text-white"
              >
                Close
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(exportedCode);
                  setShowExportModal(false);
                }}
                className="px-4 py-1.5 rounded-lg bg-[#00e676] text-xs text-black font-bold hover:bg-[#00c853]"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decision Diff Modal */}
      {showDiffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#141414] border border-[#282828] rounded-xl max-w-3xl w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#222] pb-3">
              <div className="flex items-center gap-2">
                <Columns size={16} className="text-[#00e676]" />
                <h2 className="text-sm font-bold text-white">Decision Diff Tool</h2>
              </div>
              <span className="text-xs text-gray-400 font-mono">Comparing: v1.1.0 vs v1.2.0</span>
            </div>

            <div className="text-xs text-gray-400">
              Evaluated against 1,000 recent validation rows. <strong>14 decisions flipped outcome</strong>.
            </div>

            <div className="border border-[#222] rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-xs font-mono text-left">
                <thead className="bg-[#1c1c1c] text-gray-400 border-b border-[#282828]">
                  <tr>
                    <th className="p-2">Row ID</th>
                    <th className="p-2">v1.1.0 (Baseline)</th>
                    <th className="p-2">v1.2.0 (Candidate)</th>
                    <th className="p-2">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e1e] text-gray-300">
                  <tr className="hover:bg-[#1a1a1a]">
                    <td className="p-2 text-gray-500">row_00124</td>
                    <td className="p-2 text-red-400">Reject (0.64)</td>
                    <td className="p-2 text-[#00e676]">Approve (0.91)</td>
                    <td className="p-2 text-[#00e676]">+0.27 conf</td>
                  </tr>
                  <tr className="hover:bg-[#1a1a1a]">
                    <td className="p-2 text-gray-500">row_00492</td>
                    <td className="p-2 text-[#ffd600]">Escalate (0.52)</td>
                    <td className="p-2 text-[#00e676]">Approve (0.88)</td>
                    <td className="p-2 text-blue-400">Escalation bypassed</td>
                  </tr>
                  <tr className="hover:bg-[#1a1a1a]">
                    <td className="p-2 text-gray-500">row_00781</td>
                    <td className="p-2 text-[#00e676]">Approve (0.86)</td>
                    <td className="p-2 text-rose-400">Escalate (0.49)</td>
                    <td className="p-2 text-amber-400">Safety margin caught</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#222]">
              <button
                onClick={() => setShowDiffModal(false)}
                className="px-4 py-1.5 rounded-lg bg-[#00e676] text-xs text-black font-bold hover:bg-[#00c853]"
              >
                Accept & Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
