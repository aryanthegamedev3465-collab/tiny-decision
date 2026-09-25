import React, { useState } from "react";
import {
  Layers,
  Upload,
  Play,
  RotateCcw,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Clock,
  Zap,
} from "lucide-react";
import { useStore } from "@/store";

export function BatchPage(): React.ReactElement {
  const jobs = useStore((s) => s.jobs);
  const createJob = useStore((s) => s.createJob);
  const startJob = useStore((s) => s.startJob);
  const rerunJob = useStore((s) => s.rerunJob);
  const exportResults = useStore((s) => s.exportResults);

  const [concurrency, setConcurrency] = useState(8);
  const [selectedFile, setSelectedFile] = useState<string | null>("sample_evaluation_data.csv");
  const [templateName, setTemplateName] = useState("refund-eligibility-v1");

  const handleStartNewBatch = async () => {
    await createJob({
      name: `Batch Evaluation: ${templateName}`,
      templateId: "tpl-refund-1",
      totalRows: 1250,
      concurrency,
      filePath: selectedFile || "sample.csv",
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] text-gray-200 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f] bg-[#111]">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">Batch Runner</h1>
          <p className="text-xs text-gray-400">
            High-throughput offline batch processing across CSV & JSONL datasets
          </p>
        </div>

        <button
          onClick={handleStartNewBatch}
          className="flex items-center gap-2 px-4 py-2 bg-[#00e676] text-black font-bold text-xs rounded-lg hover:bg-[#00c853] transition-colors"
        >
          <Play size={14} />
          Launch New Batch
        </button>
      </div>

      <div className="p-6 flex flex-col gap-6 max-w-6xl">
        {/* Configuration Card */}
        <div className="bg-[#141414] border border-[#252525] rounded-xl p-5 flex flex-col gap-4">
          <h2 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
            Job Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* File selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-400 font-medium">Input Dataset</label>
              <div className="flex items-center gap-2 bg-[#1b1b1b] border border-[#2a2a2a] rounded-lg p-2 text-xs">
                <FileSpreadsheet size={16} className="text-[#00e676]" />
                <span className="truncate flex-1 font-mono text-gray-300">
                  {selectedFile || "Select CSV/JSONL file..."}
                </span>
                <button className="text-[11px] text-[#00e676] hover:underline font-medium">
                  Browse
                </button>
              </div>
            </div>

            {/* Template picker */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-400 font-medium">Decision Template</label>
              <select
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="bg-[#1b1b1b] border border-[#2a2a2a] rounded-lg p-2 text-xs text-gray-200 focus:outline-none focus:border-[#00e676]"
              >
                <option value="refund-eligibility-v1">Refund Eligibility v1.2</option>
                <option value="spam-email-router">Spam & Phishing Classifier v2.0</option>
                <option value="content-moderation">Content Moderation & Flagging</option>
              </select>
            </div>

            {/* Concurrency slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="text-gray-400 font-medium">Concurrency Level</label>
                <span className="font-mono text-[#00e676] font-bold">{concurrency} workers</span>
              </div>
              <input
                type="range"
                min={1}
                max={32}
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                className="accent-[#00e676] cursor-pointer mt-2"
              />
            </div>
          </div>
        </div>

        {/* Active & Historical Jobs Table */}
        <div className="bg-[#141414] border border-[#252525] rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-[#222] bg-[#161616] flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
              Batch Execution History
            </h2>
            <span className="text-xs text-gray-500 font-mono">
              {jobs.length} total batch runs
            </span>
          </div>

          <div className="divide-y divide-[#1e1e1e]">
            {jobs.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">
                No batch jobs recorded yet. Launch a batch job above to process thousands of decisions.
              </div>
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="p-4 flex flex-col gap-3 hover:bg-[#181818] transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          job.status === "complete"
                            ? "bg-[#00e676]"
                            : job.status === "running"
                            ? "bg-[#ffd600] animate-ping"
                            : "bg-red-400"
                        }`}
                      />
                      <span className="text-xs font-bold text-white">{job.name}</span>
                      <span className="text-[11px] font-mono text-gray-500">
                        ({job.processedRows} / {job.totalRows} rows)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => exportResults(job.id, "csv")}
                        className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#202020] hover:bg-[#282828] text-xs text-gray-300 border border-[#333] transition-colors"
                      >
                        <Download size={12} />
                        Export CSV
                      </button>
                      <button
                        onClick={() => rerunJob(job.id)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#202020] hover:bg-[#282828] text-xs text-gray-300 border border-[#333] transition-colors"
                      >
                        <RotateCcw size={12} />
                        Re-run Against New Model
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-[#202020] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#00e676] h-full transition-all duration-300 rounded-full"
                      style={{
                        width: `${Math.round((job.processedRows / (job.totalRows || 1)) * 100)}%`,
                      }}
                    />
                  </div>

                  {/* Metrics bar */}
                  <div className="flex items-center gap-6 text-[11px] font-mono text-gray-400">
                    <span className="flex items-center gap-1">
                      <Zap size={11} className="text-[#00e676]" />
                      Speed: <strong>{job.rowsPerSec || 342} rows/sec</strong>
                    </span>
                    <span>
                      Avg Confidence:{" "}
                      <strong className="text-[#00e676]">
                        {((job.avgConfidence || 0.91) * 100).toFixed(1)}%
                      </strong>
                    </span>
                    <span>
                      Avg Latency: <strong>{job.avgLatencyMs || 24} ms</strong>
                    </span>
                    <span>
                      Est. Cost: <strong>${(job.totalCostEstimate || 0.0).toFixed(4)}</strong>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
