import React, { useState } from "react";
import {
  History as HistoryIcon,
  Search,
  Filter,
  CheckCircle,
  Zap,
  RotateCcw,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { useStore } from "@/store";

export function HistoryPage(): React.ReactElement {
  const [filterText, setFilterText] = useState("");

  const mockHistory = [
    {
      id: "run-94812",
      model: "jev-decision-1.5b",
      template: "refund-eligibility",
      outcome: "Approved",
      confidence: 0.94,
      latency: 28,
      timestamp: "2 mins ago",
      status: "success",
    },
    {
      id: "run-94811",
      model: "phi-3-mini-adapted",
      template: "spam-email-router",
      outcome: "Spam",
      confidence: 0.88,
      latency: 142,
      timestamp: "14 mins ago",
      status: "success",
    },
    {
      id: "run-94810",
      model: "jev-decision-1.5b",
      template: "refund-eligibility",
      outcome: "Escalated",
      confidence: 0.49,
      latency: 31,
      timestamp: "1 hour ago",
      status: "escalated",
    },
    {
      id: "run-94809",
      model: "auto-router",
      template: "content-flagging",
      outcome: "Safe",
      confidence: 0.97,
      latency: 35,
      timestamp: "3 hours ago",
      status: "success",
    },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] text-gray-200 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f] bg-[#111]">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">Decision History</h1>
          <p className="text-xs text-gray-400">
            Immutable audit trail of all single, batch, and pipeline decision invocations
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search run ID, model, template..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="bg-[#181818] border border-[#2a2a2a] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00e676] w-64"
            />
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl">
        <div className="bg-[#141414] border border-[#252525] rounded-xl overflow-hidden">
          <table className="w-full text-xs text-left font-mono">
            <thead className="bg-[#181818] text-gray-400 border-b border-[#222]">
              <tr>
                <th className="p-3">Run ID</th>
                <th className="p-3">Model</th>
                <th className="p-3">Template</th>
                <th className="p-3">Decision Outcome</th>
                <th className="p-3">Confidence</th>
                <th className="p-3">Latency</th>
                <th className="p-3">Time</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e1e] text-gray-200">
              {mockHistory.map((row) => (
                <tr key={row.id} className="hover:bg-[#181818] transition-colors">
                  <td className="p-3 font-bold text-[#00e676]">{row.id}</td>
                  <td className="p-3 text-gray-300">{row.model}</td>
                  <td className="p-3 text-gray-400">{row.template}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        row.outcome === "Approved" || row.outcome === "Safe"
                          ? "bg-[#00e676]/15 text-[#00e676]"
                          : row.outcome === "Spam"
                          ? "bg-red-500/15 text-red-400"
                          : "bg-[#ffd600]/15 text-[#ffd600]"
                      }`}
                    >
                      {row.outcome}
                    </span>
                  </td>
                  <td className="p-3 font-bold">
                    <span
                      className={
                        row.confidence >= 0.85
                          ? "text-[#00e676]"
                          : row.confidence >= 0.5
                          ? "text-[#ffd600]"
                          : "text-red-400"
                      }
                    >
                      {(row.confidence * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="p-3 text-gray-400 flex items-center gap-1">
                    <Zap size={11} className="text-[#ffd600]" />
                    {row.latency} ms
                  </td>
                  <td className="p-3 text-gray-500">{row.timestamp}</td>
                  <td className="p-3 text-right">
                    <button className="px-2 py-1 rounded bg-[#202020] hover:bg-[#282828] text-gray-300 text-[11px] border border-[#333]">
                      Re-run
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
