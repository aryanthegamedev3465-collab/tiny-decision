import React from "react";
import {
  BarChart3,
  Activity,
  AlertTriangle,
  Zap,
  TrendingDown,
  Bell,
  ShieldAlert,
  Clock,
} from "lucide-react";
import { useStore } from "@/store";

export function ObservabilityPage(): React.ReactElement {
  const driftAlerts = useStore((s) => s.driftAlerts);

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] text-gray-200 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f] bg-[#111]">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">Observability & Production Monitoring</h1>
          <p className="text-xs text-gray-400">
            Real-time latency histograms, drift alerts, and decision distribution analytics
          </p>
        </div>
      </div>

      <div className="p-6 max-w-6xl flex flex-col gap-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#141414] border border-[#252525] rounded-xl p-4 flex flex-col gap-1">
            <span className="text-[11px] font-mono text-gray-500 uppercase">Throughput</span>
            <div className="text-2xl font-bold font-mono text-white flex items-baseline gap-1">
              128 <span className="text-xs text-gray-400 font-normal">req/sec</span>
            </div>
            <span className="text-[11px] text-[#00e676] font-mono">+12% vs last hour</span>
          </div>

          <div className="bg-[#141414] border border-[#252525] rounded-xl p-4 flex flex-col gap-1">
            <span className="text-[11px] font-mono text-gray-500 uppercase">p95 Latency</span>
            <div className="text-2xl font-bold font-mono text-[#ffd600] flex items-baseline gap-1">
              34 <span className="text-xs text-gray-400 font-normal">ms</span>
            </div>
            <span className="text-[11px] text-gray-400 font-mono">p50: 19ms | p99: 58ms</span>
          </div>

          <div className="bg-[#141414] border border-[#252525] rounded-xl p-4 flex flex-col gap-1">
            <span className="text-[11px] font-mono text-gray-500 uppercase">Mean Confidence</span>
            <div className="text-2xl font-bold font-mono text-[#00e676] flex items-baseline gap-1">
              92.4<span className="text-xs text-gray-400 font-normal">%</span>
            </div>
            <span className="text-[11px] text-gray-400 font-mono">Calibrated across 84k runs</span>
          </div>

          <div className="bg-[#141414] border border-[#252525] rounded-xl p-4 flex flex-col gap-1">
            <span className="text-[11px] font-mono text-gray-500 uppercase">Error Rate</span>
            <div className="text-2xl font-bold font-mono text-white flex items-baseline gap-1">
              0.02<span className="text-xs text-gray-400 font-normal">%</span>
            </div>
            <span className="text-[11px] text-[#00e676] font-mono">Zero timeout retries</span>
          </div>
        </div>

        {/* Drift Alerts Panel */}
        <div className="bg-[#141414] border border-[#252525] rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-[#222] bg-[#161616] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-[#ffd600]" />
              <h2 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                Active Drift Alerts (Section 4.7 Flywheel)
              </h2>
            </div>
            <span className="text-xs font-mono text-gray-400">Automatic weekly scans</span>
          </div>

          <div className="divide-y divide-[#1e1e1e]">
            {driftAlerts.length === 0 ? (
              <div className="p-4 flex items-center justify-between text-xs bg-[#121212]">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00e676]" />
                  <span className="text-gray-300">
                    No drift detected across active production templates. Baseline accuracy stable at &gt;94%.
                  </span>
                </div>
                <span className="text-xs font-mono text-[#00e676]">All healthy</span>
              </div>
            ) : (
              driftAlerts.map((alert) => (
                <div key={alert.id} className="p-4 flex items-center justify-between text-xs bg-[#161212]">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping" />
                    <div>
                      <span className="font-bold text-white">Template: {alert.templateId}</span>
                      <p className="text-gray-400 text-[11px] mt-0.5">
                        Metric: {alert.metric} shifted from {alert.baselineValue} to {alert.currentValue}
                      </p>
                    </div>
                  </div>
                  <button className="px-3 py-1 rounded bg-[#202020] text-gray-300 hover:text-white border border-[#333]">
                    Investigate
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Confidence Histogram Simulation */}
        <div className="bg-[#141414] border border-[#252525] rounded-xl p-5 flex flex-col gap-4">
          <h2 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
            Live Production Confidence Histogram (Last 24 Hours)
          </h2>
          <div className="flex items-end gap-2 h-40 pt-4 px-2 border-b border-[#222]">
            {[
              { label: "<0.5", height: "8%", count: 124, color: "bg-red-500" },
              { label: "0.5-0.6", height: "14%", count: 280, color: "bg-amber-500" },
              { label: "0.6-0.7", height: "22%", count: 540, color: "bg-yellow-500" },
              { label: "0.7-0.8", height: "35%", count: 910, color: "bg-[#00e676]/70" },
              { label: "0.8-0.9", height: "68%", count: 2150, color: "bg-[#00e676]/90" },
              { label: "0.9-1.0", height: "95%", count: 4890, color: "bg-[#00e676]" },
            ].map((bar, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-[10px] font-mono text-gray-500">{bar.count}</span>
                <div
                  className={`w-full rounded-t ${bar.color} transition-all duration-500`}
                  style={{ height: bar.height }}
                />
                <span className="text-[10px] font-mono text-gray-400 mt-1">{bar.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
