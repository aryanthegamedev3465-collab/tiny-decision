import React, { useState } from "react";
import {
  Zap,
  RotateCcw,
  ThumbsDown,
  CheckCircle,
  Copy,
  Sparkles,
  Layers,
  ChevronDown,
  Cpu,
  Flame,
  ShieldCheck,
  Send,
} from "lucide-react";
import { useStore } from "@/store";
import { QuestionBuilder } from "@/components/playground/QuestionBuilder";
import { AnswerDisplay } from "@/components/playground/AnswerDisplay";

export function PlaygroundPage(): React.ReactElement {
  const stateJson = useStore((s) => s.stateJson);
  const setStateJson = useStore((s) => s.setStateJson);
  const stateJsonError = useStore((s) => s.stateJsonError);
  const tokenCount = useStore((s) => s.tokenCount);
  const questions = useStore((s) => s.questions);
  const lastRun = useStore((s) => s.lastRun);
  const isRunning = useStore((s) => s.isRunning);
  const elapsedMs = useStore((s) => s.elapsedMs);
  const runDecision = useStore((s) => s.runDecision);
  const markLastRunWrong = useStore((s) => s.markLastRunWrong);
  const models = useStore((s) => s.models);
  const selectedModelId = useStore((s) => s.selectedModelId);
  const setSelectedModel = useStore((s) => s.setSelectedModel);

  const [markedWrong, setMarkedWrong] = useState(false);
  const [quickPrompt, setQuickPrompt] = useState("");

  const handleRun = async () => {
    setMarkedWrong(false);
    await runDecision();
  };

  const handleMarkWrong = async () => {
    await markLastRunWrong();
    setMarkedWrong(true);
  };

  const handleApplyPreset = (type: "refund" | "spam" | "credit" | "sentiment") => {
    if (type === "refund") {
      setStateJson(
        JSON.stringify(
          {
            order_id: "ORD-94182",
            customer_tier: "platinum",
            requested_refund_amount: 149.99,
            delivered_days_ago: 5,
            item_condition: "unopened",
            prior_refund_count: 0,
            reason: "Incorrect size ordered",
          },
          null,
          2
        )
      );
    } else if (type === "spam") {
      setStateJson(
        JSON.stringify(
          {
            subject: "URGENT: Your account credentials have been suspended",
            sender: "no-reply@sec-verify-bank.com",
            body: "Click here immediately to verify your billing information: http://bit.ly/bank-auth-92",
            spf_pass: false,
            dkim_pass: false,
          },
          null,
          2
        )
      );
    } else if (type === "credit") {
      setStateJson(
        JSON.stringify(
          {
            applicant_id: "APP-40291",
            credit_score: 742,
            annual_income: 115000,
            loan_amount_requested: 25000,
            debt_to_income_ratio: 0.18,
            bankruptcies: 0,
          },
          null,
          2
        )
      );
    } else if (type === "sentiment") {
      setStateJson(
        JSON.stringify(
          {
            feedback_text: "The delivery arrived two days early and the setup was seamless. Outstanding support!",
            user_rating: 5,
            channel: "in-app-review",
          },
          null,
          2
        )
      );
    }
  };

  const loadedModels = models.filter((m) => m.isLoaded || m.source === "Hosted");

  return (
    <div className="flex flex-col h-full bg-[#060709] text-gray-200 overflow-hidden">
      {/* Top action header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.06] bg-[#0c0e14]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#00ff88]/10 border border-[#00ff88]/30 flex items-center justify-center shadow-[0_0_12px_rgba(0,255,136,0.2)]">
            <Zap size={16} className="text-[#00ff88]" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-white tracking-wide uppercase font-mono">
              Decision Workbench
            </h1>
            <p className="text-[11px] text-gray-400">Sub-100ms In-Process Typed Inference</p>
          </div>
        </div>

        {/* Presets */}
        <div className="hidden lg:flex items-center gap-1.5 bg-white/[0.03] p-1 rounded-lg border border-white/[0.06]">
          <span className="text-[10px] text-gray-500 font-mono px-2 uppercase">Presets:</span>
          <button
            onClick={() => handleApplyPreset("refund")}
            className="text-xs px-2.5 py-1 rounded-md text-gray-300 hover:text-[#00f0ff] hover:bg-[#00f0ff]/10 transition-colors font-mono"
          >
            Refund
          </button>
          <button
            onClick={() => handleApplyPreset("spam")}
            className="text-xs px-2.5 py-1 rounded-md text-gray-300 hover:text-[#ff0055] hover:bg-[#ff0055]/10 transition-colors font-mono"
          >
            Spam
          </button>
          <button
            onClick={() => handleApplyPreset("credit")}
            className="text-xs px-2.5 py-1 rounded-md text-gray-300 hover:text-[#ffb703] hover:bg-[#ffb703]/10 transition-colors font-mono"
          >
            Credit Risk
          </button>
          <button
            onClick={() => handleApplyPreset("sentiment")}
            className="text-xs px-2.5 py-1 rounded-md text-gray-300 hover:text-[#00ff88] hover:bg-[#00ff88]/10 transition-colors font-mono"
          >
            Sentiment
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Model picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono">Model:</span>
            <select
              value={selectedModelId || ""}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-[#121520] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00f0ff] font-mono"
            >
              <option value="auto-best-of-loaded">Auto (best ECE router)</option>
              {loadedModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.isNative ? "Native" : "Adapted"})
                </option>
              ))}
            </select>
          </div>

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={isRunning || questions.length === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-[#00f0ff] to-[#00ff88] text-black font-extrabold text-xs hover:opacity-95 transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(0,240,255,0.3)]"
          >
            <Zap size={14} className={isRunning ? "animate-spin" : ""} />
            {isRunning ? "Deciding..." : "Execute Decision"}
          </button>
        </div>
      </div>

      {/* Main split workbench */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Context State & Questions */}
        <div className="flex-1 flex flex-col border-r border-white/[0.06] overflow-y-auto p-5 gap-5">
          {/* State (Context) Editor */}
          <div className="glass-card rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-300 font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
                Context Payload (State)
              </label>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-gray-400 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.08]">
                  ~{tokenCount} tokens
                </span>
                <button
                  onClick={() => handleApplyPreset("refund")}
                  className="text-[11px] text-[#00f0ff] hover:underline font-mono"
                >
                  Reset Sample
                </button>
              </div>
            </div>

            <div className="relative">
              <textarea
                value={stateJson}
                onChange={(e) => setStateJson(e.target.value)}
                placeholder="Enter context state as JSON or freeform facts..."
                rows={7}
                className="w-full bg-[#090b10] border border-white/[0.08] rounded-xl p-3 text-xs font-mono text-gray-200 focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff]/30 leading-relaxed resize-none shadow-inner"
              />
              {stateJsonError && (
                <div className="text-[11px] text-[#ff0055] mt-1 font-mono">
                  {stateJsonError}
                </div>
              )}
            </div>
          </div>

          {/* Question Builder */}
          <div className="flex flex-col gap-2 flex-1">
            <QuestionBuilder />
          </div>
        </div>

        {/* Right Column: Execution Results & Probability Distributions */}
        <div className="w-[460px] bg-[#090b10]/95 flex flex-col overflow-y-auto p-5 border-l border-white/[0.06]">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[#00ff88]" />
              <h2 className="text-xs font-extrabold text-gray-200 uppercase tracking-wider font-mono">
                Model Output & Calibrated Confidence
              </h2>
            </div>
            {lastRun && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#ffb703]/10 text-[#ffb703] border border-[#ffb703]/30 flex items-center gap-1 shadow-[0_0_8px_rgba(255,183,3,0.2)]">
                <Zap size={11} />
                {lastRun.latencyMs || elapsedMs} ms
              </span>
            )}
          </div>

          {lastRun ? (
            <div className="flex flex-col gap-4 mt-4 animate-in fade-in duration-200">
              <AnswerDisplay answers={lastRun.answers} questions={questions} />

              {/* Flywheel Correction Card */}
              <div className="glass-card rounded-xl p-3.5 flex items-center justify-between mt-2 border border-white/[0.08]">
                <div>
                  <p className="text-xs font-bold text-gray-200">Verdict Inaccurate?</p>
                  <p className="text-[11px] text-gray-400">Instantly queues feedback into EvalSet</p>
                </div>
                <button
                  onClick={handleMarkWrong}
                  disabled={markedWrong}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    markedWrong
                      ? "bg-[#ff0055]/15 text-[#ff0055] border-[#ff0055]/30 cursor-default"
                      : "bg-white/[0.05] text-gray-300 hover:text-white border-white/[0.1] hover:border-[#ff0055]/50 hover:bg-[#ff0055]/10"
                  }`}
                >
                  <ThumbsDown size={13} className={markedWrong ? "text-[#ff0055]" : ""} />
                  {markedWrong ? "Logged to Flywheel" : "Mark as Wrong"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#00f0ff]/10 to-[#00ff88]/10 border border-white/[0.08] flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(0,240,255,0.1)]">
                <Sparkles className="text-[#00f0ff]" size={24} />
              </div>
              <p className="text-xs font-bold text-gray-200 uppercase tracking-wider font-mono">
                System One Engine Idle
              </p>
              <p className="text-[11px] text-gray-500 mt-1 max-w-[240px] leading-relaxed">
                Click a preset or specify questions on the left, then click Execute Decision to experience sub-100ms output.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
