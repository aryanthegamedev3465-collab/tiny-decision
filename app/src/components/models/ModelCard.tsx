import React, { useState } from "react";
import type { Model, QuantizationType } from "@/types";
import { useStore } from "@/store";
import {
  Cpu, HardDrive, Zap, Download, ChevronDown,
  CheckCircle2, AlertCircle, Loader2
} from "lucide-react";

interface ModelCardProps {
  model: Model;
  onSelect?: (model: Model) => void;
  selected?: boolean;
}

function SourceBadge({ source }: { source: Model["source"] }): React.ReactElement {
  const styles = {
    HuggingFace: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    Local:        "bg-blue-500/10 text-blue-400 border-blue-500/30",
    Hosted:       "bg-purple-500/10 text-purple-400 border-purple-500/30",
    Adapted:      "bg-accent-muted text-accent border-accent/30",
  };
  const labels = {
    HuggingFace: "HF",
    Local: "Local",
    Hosted: "Hosted",
    Adapted: "Adapted",
  };
  return (
    <span className={`px-1.5 py-0.5 text-2xs font-medium border rounded ${styles[source]}`}>
      {labels[source]}
    </span>
  );
}

function CapabilityBadge({ capability, supported }: { capability: string; supported: boolean }): React.ReactElement {
  return (
    <span
      className={`flex items-center gap-1 px-1.5 py-0.5 text-2xs rounded border ${
        supported
          ? "bg-accent-muted text-accent border-accent/30"
          : "bg-bg-elevated text-text-muted border-border"
      }`}
    >
      {supported
        ? <CheckCircle2 size={9} className="text-accent" />
        : <AlertCircle size={9} className="text-text-muted" />
      }
      {capability}
    </span>
  );
}

function RamBadge({ ramGb, loaded }: { ramGb?: number; loaded: boolean }): React.ReactElement {
  return (
    <span
      className={`flex items-center gap-1 px-1.5 py-0.5 text-2xs rounded border ${
        loaded
          ? "bg-accent-muted text-accent border-accent/30"
          : "bg-bg-elevated text-text-secondary border-border"
      }`}
    >
      <Cpu size={9} />
      {ramGb != null ? `${ramGb.toFixed(1)} GB` : "—"} RAM
      {loaded && <span className="text-accent">●</span>}
    </span>
  );
}

export function ModelCard({ model, onSelect, selected = false }: ModelCardProps): React.ReactElement {
  const [quantOpen, setQuantOpen] = useState(false);
  const [selectedQuant, setSelectedQuant] = useState<QuantizationType>(model.selectedQuant);

  const loadModel = useStore((s) => s.loadModel);
  const unloadModel = useStore((s) => s.unloadModel);
  const downloadModel = useStore((s) => s.downloadModel);
  const probeCapabilities = useStore((s) => s.probeCapabilities);

  const currentQuantOption = model.quantOptions.find((q) => q.quant === selectedQuant);
  const isDownloaded = model.downloadedQuants.includes(selectedQuant);

  const handleLoadToggle = async () => {
    if (model.loaded) await unloadModel(model.id);
    else await loadModel(model.id);
  };

  const handleDownload = async () => {
    await downloadModel(model.id, selectedQuant);
  };

  return (
    <div
      className={`
        relative flex flex-col bg-bg-surface border rounded-lg overflow-hidden cursor-pointer
        transition-all duration-150
        ${selected ? "border-accent shadow-glow-green" : "border-border hover:border-border-strong hover:shadow-card-hover"}
      `}
      onClick={() => onSelect?.(model)}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="text-text-primary font-semibold text-sm truncate">{model.displayName}</p>
            <p className="text-text-muted text-2xs truncate">{model.author}</p>
          </div>
          <SourceBadge source={model.source} />
        </div>

        <p className="text-text-secondary text-xs line-clamp-2 mb-3">{model.description}</p>

        {/* Stats row */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <RamBadge ramGb={model.ramUsedGb ?? currentQuantOption?.ramRequiredGb} loaded={model.loaded} />
          <span className="flex items-center gap-1 px-1.5 py-0.5 text-2xs rounded border bg-bg-elevated text-text-secondary border-border">
            <HardDrive size={9} />
            {currentQuantOption ? `${currentQuantOption.sizeGb.toFixed(1)} GB` : "—"}
          </span>
          <span className="flex items-center gap-1 px-1.5 py-0.5 text-2xs rounded border bg-bg-elevated text-text-secondary border-border">
            <Zap size={9} />
            {(model.contextLength / 1000).toFixed(0)}k ctx
          </span>
        </div>

        {/* Capabilities */}
        <div className="flex flex-wrap gap-1">
          {model.capabilities.map((cap) => (
            <CapabilityBadge key={cap.capability} capability={cap.capability} supported={cap.supported} />
          ))}
        </div>
      </div>

      {/* Quant selector */}
      <div className="px-4 pb-3 border-t border-border-subtle pt-3">
        <div className="relative">
          <button
            className="w-full flex items-center justify-between px-2.5 py-1.5 bg-bg-elevated border border-border rounded text-xs text-text-secondary hover:border-border-strong hover:text-text-primary transition-colors"
            onClick={(e) => { e.stopPropagation(); setQuantOpen((v) => !v); }}
          >
            <span className="font-mono">{selectedQuant}</span>
            <ChevronDown size={12} className={`transition-transform ${quantOpen ? "rotate-180" : ""}`} />
          </button>

          {quantOpen && (
            <div className="absolute bottom-full mb-1 left-0 right-0 bg-bg-elevated border border-border rounded shadow-modal z-10">
              {model.quantOptions.map((opt) => (
                <button
                  key={opt.quant}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs hover:bg-bg-overlay transition-colors ${
                    opt.quant === selectedQuant ? "text-accent" : "text-text-secondary"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedQuant(opt.quant);
                    setQuantOpen(false);
                  }}
                >
                  <span className="font-mono">{opt.quant}</span>
                  <div className="flex items-center gap-2 text-text-muted text-2xs">
                    {model.downloadedQuants.includes(opt.quant) && (
                      <CheckCircle2 size={10} className="text-accent" />
                    )}
                    <span>{opt.sizeGb.toFixed(1)} GB</span>
                    <span>{opt.ramRequiredGb.toFixed(1)} GB RAM</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex gap-2">
        {isDownloaded ? (
          <button
            onClick={(e) => { e.stopPropagation(); void handleLoadToggle(); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
              model.loaded
                ? "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
                : "bg-accent-muted border border-accent/30 text-accent hover:bg-accent/20"
            }`}
          >
            {model.loaded ? "Unload" : "Load"}
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); void handleDownload(); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium bg-accent-muted border border-accent/30 text-accent hover:bg-accent/20 transition-colors"
          >
            <Download size={12} />
            Download
          </button>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); void probeCapabilities(model.id); }}
          title="Probe capabilities"
          className="px-2.5 py-1.5 rounded text-xs font-medium bg-bg-elevated border border-border text-text-secondary hover:border-border-strong hover:text-text-primary transition-colors"
        >
          <Loader2 size={12} />
        </button>
      </div>
    </div>
  );
}
