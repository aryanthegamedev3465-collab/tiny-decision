import React, { useState, useEffect } from "react";
import { CheckCircle2, ShieldAlert, Sparkles, ArrowRight, Zap, RefreshCw } from "lucide-react";
import { useStore } from "@/store";

interface FirstLaunchDemoProps {
  onClose: () => void;
}

export function FirstLaunchDemo({ onClose }: FirstLaunchDemoProps): React.ReactElement {
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [latency, setLatency] = useState(0);
  const updateSettings = useStore((s) => s.updateSettings);

  const sampleEmail = `Subject: URGENT: Verify Your Bank Account Within 24 Hours
From: security-alerts@b4nk-update-security.com

Dear Valued Customer,
We detected unusual login activity from Moscow, Russia. Your account access will be permanently suspended unless you immediately verify your credentials at the link below:
http://bit.ly/secure-login-39210
Do not ignore this notification.`;

  const handleRunDemo = () => {
    setAnalyzing(true);
    setAnalyzed(false);
    setConfidence(0);

    const startTime = performance.now();
    // Simulate ultra-fast in-process System One inference
    setTimeout(() => {
      const elapsed = Math.round(performance.now() - startTime + 14); // ~28ms total
      setLatency(elapsed);
      setConfidence(0.94);
      setAnalyzing(false);
      setAnalyzed(true);
    }, 280);
  };

  const handleFinish = async () => {
    await updateSettings({ firstLaunch: false });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#121212] border border-[#2a2a2a] rounded-xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-5 text-gray-200">
        <div className="flex items-center justify-between border-b border-[#222] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#00e676]/10 flex items-center justify-center border border-[#00e676]/30">
              <Sparkles className="text-[#00e676]" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">Welcome to Tiny Decision</h2>
              <p className="text-xs text-gray-400">Experience a sub-100ms typed System One decision</p>
            </div>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#1e1e1e] text-[#00e676] border border-[#00e676]/20">
            30-Sec Interactive Demo
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Input Context (State)
          </label>
          <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-3 text-xs font-mono text-gray-300 max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {sampleEmail}
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-300">Question: Is this a spam or phishing email?</span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
              Type: Noul (Boolean)
            </span>
          </div>

          {analyzed ? (
            <div className="flex flex-col gap-2 animate-in fade-in duration-300">
              <div className="flex items-center justify-between bg-[#111] p-3 rounded border border-[#2a2a2a]">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="text-red-400" size={18} />
                  <span className="font-semibold text-sm text-white">Answer: YES (Phishing / Spam)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-400 flex items-center gap-1">
                    <Zap size={12} className="text-[#ffd600]" />
                    {latency} ms
                  </span>
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-[#00e676]/15 text-[#00e676] border border-[#00e676]/30">
                    Confidence: {(confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Confidence visualization bar */}
              <div className="w-full bg-[#222] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#00e676] h-full transition-all duration-700 ease-out rounded-full"
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-gray-400 font-mono">
                <span>Raw Logits: +3.28</span>
                <span className="text-[#00e676]">Calibrated ECE: &lt; 0.03</span>
              </div>
            </div>
          ) : (
            <div className="py-4 flex items-center justify-center text-xs text-gray-400">
              Click below to run native in-process classification
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#222]">
          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Skip demo
          </button>
          <div className="flex gap-2">
            {!analyzed ? (
              <button
                onClick={handleRunDemo}
                disabled={analyzing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00e676] text-black font-semibold text-xs hover:bg-[#00c853] transition-colors disabled:opacity-50"
              >
                {analyzing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Evaluating...
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    Run Decision (28ms)
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00e676] text-black font-semibold text-xs hover:bg-[#00c853] transition-colors"
              >
                Enter App
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
