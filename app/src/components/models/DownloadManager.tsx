import React from "react";
import type { Model } from "@/types";
import { useStore } from "@/store";
import { Pause, Play, X, Download } from "lucide-react";

interface DownloadManagerProps {
  model: Model;
}

function formatSpeed(mbps?: number): string {
  if (mbps == null) return "—";
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(1)} GB/s`;
  return `${mbps.toFixed(1)} MB/s`;
}

function formatEta(secs?: number): string {
  if (secs == null) return "—";
  if (secs < 60) return `${Math.round(secs)}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

export function DownloadManager({ model }: DownloadManagerProps): React.ReactElement {
  const pauseDownload  = useStore((s) => s.pauseDownload);
  const resumeDownload = useStore((s) => s.resumeDownload);
  const cancelDownload = useStore((s) => s.cancelDownload);

  const progress = model.downloadProgress ?? 0;
  const isActive = model.downloadStatus === "downloading" || model.downloadStatus === "paused";

  if (!isActive && model.downloadStatus !== "error") return <></>;

  const statusColors = {
    downloading: "bg-accent",
    paused:      "bg-status-warning",
    complete:    "bg-accent",
    error:       "bg-status-error",
    idle:        "bg-bg-elevated",
  };

  return (
    <div className="bg-bg-surface border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Download size={14} className="text-accent" />
          <span className="text-text-primary text-sm font-medium truncate max-w-48">{model.displayName}</span>
        </div>
        <div className="flex items-center gap-1">
          {model.downloadStatus === "downloading" && (
            <button
              onClick={() => void pauseDownload(model.id)}
              className="p-1.5 rounded hover:bg-bg-elevated text-text-muted hover:text-status-warning transition-colors"
              title="Pause"
            >
              <Pause size={12} />
            </button>
          )}
          {model.downloadStatus === "paused" && (
            <button
              onClick={() => void resumeDownload(model.id)}
              className="p-1.5 rounded hover:bg-bg-elevated text-text-muted hover:text-accent transition-colors"
              title="Resume"
            >
              <Play size={12} />
            </button>
          )}
          <button
            onClick={() => void cancelDownload(model.id)}
            className="p-1.5 rounded hover:bg-bg-elevated text-text-muted hover:text-status-error transition-colors"
            title="Cancel"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${statusColors[model.downloadStatus]}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-2xs text-text-muted">
        <span className="font-mono">{progress.toFixed(1)}%</span>
        <div className="flex items-center gap-3">
          <span>{formatSpeed(model.downloadSpeedMbps)}</span>
          <span>ETA {formatEta(model.downloadEtaSecs)}</span>
          {model.downloadStatus === "paused" && (
            <span className="text-status-warning">Paused</span>
          )}
          {model.downloadStatus === "error" && (
            <span className="text-status-error">Error</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function DownloadManagerList(): React.ReactElement {
  const models = useStore((s) => s.models);
  const activeDownloads = models.filter(
    (m) => m.downloadStatus === "downloading" || m.downloadStatus === "paused" || m.downloadStatus === "error"
  );

  if (activeDownloads.length === 0) return <></>;

  return (
    <div className="flex flex-col gap-2">
      {activeDownloads.map((model) => (
        <DownloadManager key={model.id} model={model} />
      ))}
    </div>
  );
}
