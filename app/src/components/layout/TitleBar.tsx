import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Zap, Cpu, Server } from "lucide-react";
import { useStore } from "@/store";

export function TitleBar(): React.ReactElement {
  const activePage = useStore((s) => s.activePage);
  const serverStatus = useStore((s) => s.status);
  const port = useStore((s) => s.port);

  const PAGE_LABELS: Record<string, string> = {
    models: "Models & Hugging Face Hub",
    playground: "Playground Workbench",
    batch: "High-Throughput Batch Runner",
    pipelines: "Visual Pipeline DAG Builder",
    calibration: "Calibration & Expected Calibration Error (ECE)",
    marketplace: "Community Template Marketplace",
    server: "Local API Server & MCP Export",
    observability: "Production Observability & Metrics",
    history: "Decision Audit History",
    team: "Team Collaboration & Git PRs",
    settings: "System & Hardware Settings",
  };

  const handleMinimize = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch { /* desktop only */ }
  };

  const handleMaximize = async () => {
    try {
      const win = getCurrentWindow();
      const isMax = await win.isMaximized();
      if (isMax) await win.unmaximize();
      else await win.maximize();
    } catch { /* desktop only */ }
  };

  const handleClose = async () => {
    try {
      await getCurrentWindow().close();
    } catch { /* desktop only */ }
  };

  return (
    <header
      data-tauri-drag-region
      className="tauri-drag flex items-center h-10 bg-[#08090d] border-b border-white/[0.06] select-none flex-shrink-0 px-3 z-30"
    >
      {/* Brand & Logo */}
      <div className="flex items-center gap-2.5 pr-4 border-r border-white/[0.08]">
        <div className="w-5 h-5 rounded overflow-hidden shadow-[0_0_10px_rgba(0,255,136,0.3)] border border-[#00ff88]/40">
          <img src="/icons/icon.png" alt="TD" className="w-full h-full object-cover" />
        </div>
        <span className="font-extrabold text-xs tracking-wider gradient-text-cyan font-mono uppercase">
          TINY DECISION
        </span>
      </div>

      {/* Active Section Breadcrumb */}
      <div className="flex-1 flex items-center gap-3 px-4">
        <span className="text-gray-400 text-xs font-medium">
          {PAGE_LABELS[activePage] ?? activePage}
        </span>

        {/* Live Status Indicators */}
        <div className="flex items-center gap-2 text-[11px] font-mono">
          {serverStatus === "running" ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 shadow-[0_0_8px_rgba(0,255,136,0.2)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-ping" />
              127.0.0.1:{port}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.04] text-gray-500 border border-white/[0.06]">
              <Server size={11} />
              Server Ready
            </span>
          )}

          <span className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/20">
            <Zap size={10} />
            Sub-50ms
          </span>
        </div>
      </div>

      {/* Window Controls */}
      <div className="tauri-no-drag flex items-center h-full">
        <button
          onClick={handleMinimize}
          className="h-full px-3.5 text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          title="Minimize"
        >
          <Minus size={13} />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full px-3.5 text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          title="Maximize"
        >
          <Square size={11} />
        </button>
        <button
          onClick={handleClose}
          className="h-full px-3.5 text-gray-400 hover:text-white hover:bg-[#ff0055] transition-colors"
          title="Close"
        >
          <X size={13} />
        </button>
      </div>
    </header>
  );
}
