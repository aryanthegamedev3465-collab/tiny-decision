import React, { useState } from "react";
import {
  Search,
  Download,
  HardDrive,
  Cpu,
  ShieldCheck,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Play,
  Square,
  Sparkles,
  Layers,
  HelpCircle,
} from "lucide-react";
import { useStore } from "@/store";
import { ModelCard } from "@/components/models/ModelCard";
import { DownloadManager } from "@/components/models/DownloadManager";
import type { Model } from "@/types";

export function ModelsPage(): React.ReactElement {
  const models = useStore((s) => s.models);
  const searchResults = useStore((s) => s.searchResults);
  const isSearching = useStore((s) => s.isSearching);
  const searchHuggingFace = useStore((s) => s.searchHuggingFace);
  const loadModel = useStore((s) => s.loadModel);
  const unloadModel = useStore((s) => s.unloadModel);
  const probeCapabilities = useStore((s) => s.probeCapabilities);

  const [activeTab, setActiveTab] = useState<"installed" | "search">("installed");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("all");

  const filterChips = [
    { id: "all", label: "All Formats" },
    { id: "gguf", label: "GGUF Native" },
    { id: "onnx", label: "ONNX Runtime" },
    { id: "system-one", label: "System One Curated" },
    { id: "hosted", label: "Hosted (Jev/OpenRouter)" },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setActiveTab("search");
    searchHuggingFace(searchQuery);
  };

  const installedModels = models.filter((m) => m.downloadStatus === "complete" || m.source === "Hosted");

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] text-gray-200 overflow-y-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f] bg-[#111]">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">Model Manager</h1>
          <p className="text-xs text-gray-400">
            System One Model Registry (GGUF in-process, ONNX, and Hosted APIs)
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search bar */}
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search Hugging Face Hub..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#181818] border border-[#2a2a2a] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00e676] w-64 transition-colors"
            />
          </form>

          {/* Tab selector */}
          <div className="flex bg-[#181818] border border-[#2a2a2a] rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab("installed")}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                activeTab === "installed"
                  ? "bg-[#252525] text-[#00e676] shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Installed ({installedModels.length})
            </button>
            <button
              onClick={() => setActiveTab("search")}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                activeTab === "search"
                  ? "bg-[#252525] text-[#00e676] shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Hugging Face Hub
            </button>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 px-6 py-2.5 border-b border-[#1a1a1a] bg-[#0f0f0f]">
        <span className="text-[11px] text-gray-500 font-mono uppercase mr-1">Filter:</span>
        {filterChips.map((chip) => (
          <button
            key={chip.id}
            onClick={() => setSelectedTag(chip.id)}
            className={`px-2.5 py-0.5 rounded text-xs transition-colors ${
              selectedTag === chip.id
                ? "bg-[#00e676]/15 text-[#00e676] border border-[#00e676]/30 font-medium"
                : "bg-[#181818] text-gray-400 hover:text-gray-200 border border-transparent"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Active Downloads Section */}
      <div className="px-6 pt-4">
        <DownloadManager />
      </div>

      {/* Models Grid */}
      <div className="p-6">
        {activeTab === "installed" ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-300">
                Local Weights & Hot Memory Slots
              </h2>
              <span className="text-xs text-gray-500 font-mono">
                {models.filter((m) => m.isLoaded).length} loaded into memory
              </span>
            </div>

            {installedModels.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 border border-dashed border-[#222] rounded-xl text-center">
                <HardDrive size={36} className="text-gray-600 mb-3" />
                <h3 className="text-sm font-semibold text-gray-300">No models downloaded yet</h3>
                <p className="text-xs text-gray-500 max-w-sm mt-1 mb-4">
                  Search Hugging Face Hub to download quantized GGUF weights or connect a Jev hosted model.
                </p>
                <button
                  onClick={() => setActiveTab("search")}
                  className="px-4 py-2 bg-[#00e676] text-black text-xs font-semibold rounded-lg hover:bg-[#00c853] transition-colors"
                >
                  Explore System One Models
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {installedModels.map((m) => (
                  <ModelCard key={m.id} model={m} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-300">
                Hugging Face Discovery
              </h2>
              {isSearching && (
                <span className="text-xs text-[#00e676] font-mono flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#00e676] animate-ping" />
                  Querying HF API...
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.length > 0 ? (
                searchResults.map((m) => <ModelCard key={m.id} model={m} />)
              ) : (
                <div className="col-span-full py-12 text-center text-xs text-gray-500">
                  Search for models above, or select "System One Curated" from the filter tags.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
