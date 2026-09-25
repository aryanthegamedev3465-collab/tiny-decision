import React, { useState } from "react";
import {
  Store,
  Search,
  Star,
  Download,
  ShieldCheck,
  GitFork,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { useStore } from "@/store";

export function MarketplacePage(): React.ReactElement {
  const [query, setQuery] = useState("");

  const templates = [
    {
      id: "tpl-refund-router",
      name: "E-Commerce Refund & Return Eligibility",
      author: "retail-ai-team",
      downloads: 1420,
      stars: 4.9,
      eceScore: 0.022,
      accuracy: 97.4,
      isNative: true,
      description: "Automated instant refund classification with high precision thresholding and audit logging.",
      tags: ["e-commerce", "finance", "support"],
    },
    {
      id: "tpl-spam-guard",
      name: "Inbound Email Phishing & Spam Triage",
      author: "security-ops",
      downloads: 3890,
      stars: 4.8,
      eceScore: 0.019,
      accuracy: 98.9,
      isNative: true,
      description: "Noul-class binary decision filter for high-volume corporate email gateways.",
      tags: ["security", "email", "noul"],
    },
    {
      id: "tpl-resume-screen",
      name: "Engineering Resume Keyword & Skill Matcher",
      author: "talent-flows",
      downloads: 870,
      stars: 4.6,
      eceScore: 0.065,
      accuracy: 89.1,
      isNative: false,
      description: "Continuous score decision node matching technical candidates against role specifications.",
      tags: ["hr", "recruiting", "score"],
    },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] text-gray-200 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f] bg-[#111]">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">Template & Pipeline Marketplace</h1>
          <p className="text-xs text-gray-400">
            Community templates with verified public calibration scorecards
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="Search verified templates..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-[#181818] border border-[#2a2a2a] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00e676] w-64"
          />
        </div>
      </div>

      <div className="p-6 max-w-6xl flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-[#141414] border border-[#252525] hover:border-[#333] rounded-xl p-5 flex flex-col justify-between transition-all hover:scale-[1.01]"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                      tpl.isNative
                        ? "bg-[#00e676]/15 text-[#00e676] border border-[#00e676]/30"
                        : "bg-gray-700/30 text-gray-400 border border-gray-700/50"
                    }`}
                  >
                    {tpl.isNative ? "Native System One" : "Adapted LLM"}
                  </span>
                  <div className="flex items-center gap-1 text-[#ffd600] text-xs font-mono">
                    <Star size={12} fill="#ffd600" />
                    <span>{tpl.stars}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white mb-1">{tpl.name}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{tpl.description}</p>
                </div>

                {/* Calibration scorecard pill */}
                <div className="bg-[#191919] border border-[#262626] rounded-lg p-2.5 flex items-center justify-between text-[11px] font-mono">
                  <div>
                    <span className="text-gray-500 block text-[9px] uppercase">Calibrated ECE</span>
                    <span className="text-[#00e676] font-bold">{(tpl.eceScore * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[9px] uppercase">Accuracy</span>
                    <span className="text-white font-bold">{tpl.accuracy}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[9px] uppercase">Downloads</span>
                    <span className="text-gray-300 font-bold">{tpl.downloads}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tpl.tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-[#1e1e1e] text-gray-400">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-[#222]">
                <span className="text-[11px] text-gray-500 font-mono">by @{tpl.author}</span>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00e676] text-black text-xs font-bold hover:bg-[#00c853] transition-colors">
                  <Download size={13} />
                  Import Template
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
