import React from "react";
import type { DecisionRun, Answer, ChoiceAnswer, NoulAnswer, ScoreAnswer } from "@/types";
import { confidenceColor, confidenceTextClass, confidenceLabel } from "@/types";
import { useStore } from "@/store";
import { ThumbsDown, Clock } from "lucide-react";

interface ConfidenceBarProps {
  confidence: number;
  animated?: boolean;
}

function ConfidenceBar({ confidence, animated = true }: ConfidenceBarProps): React.ReactElement {
  const color = confidenceColor(confidence);
  const pct = (confidence * 100).toFixed(1);

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-bg-elevated rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${animated ? "confidence-bar" : ""}`}
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span
        className={`text-xs font-mono font-semibold w-12 text-right ${confidenceTextClass(confidence)}`}
      >
        {pct}%
      </span>
      <span
        className={`text-2xs px-1.5 py-0.5 rounded border text-right w-10 text-center ${confidenceTextClass(confidence)}`}
        style={{ backgroundColor: `${color}18`, borderColor: `${color}40` }}
      >
        {confidenceLabel(confidence)}
      </span>
    </div>
  );
}

function ProbabilityDistribution({ probs }: { probs: Record<string, number> }): React.ReactElement {
  const entries = Object.entries(probs).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] ?? 1;

  return (
    <div className="mt-2 space-y-1.5">
      {entries.map(([label, prob]) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-2xs text-text-secondary w-24 truncate">{label}</span>
          <div className="flex-1 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full rounded-full confidence-bar"
              style={{
                width: `${(prob / max) * 100}%`,
                backgroundColor: confidenceColor(prob),
              }}
            />
          </div>
          <span className="text-2xs font-mono text-text-muted w-10 text-right">
            {(prob * 100).toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function NoulAnswerDisplay({ answer }: { answer: NoulAnswer }): React.ReactElement {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span
          className={`text-sm font-bold ${answer.value ? "text-confidence-high" : "text-confidence-low"}`}
        >
          {answer.value ? "YES" : "NO"}
        </span>
        <div className="flex-1">
          <ConfidenceBar confidence={answer.confidence} />
        </div>
      </div>
      <div className="flex gap-3 text-2xs text-text-muted">
        <span>P(yes) = <span className="font-mono text-accent">{(answer.probability * 100).toFixed(2)}%</span></span>
        <span>P(no)  = <span className="font-mono text-confidence-low">{((1 - answer.probability) * 100).toFixed(2)}%</span></span>
      </div>
    </div>
  );
}

function ChoiceAnswerDisplay({ answer }: { answer: ChoiceAnswer }): React.ReactElement {
  return (
    <div>
      <div className="mb-2">
        <ConfidenceBar confidence={answer.confidence} />
      </div>
      <ProbabilityDistribution probs={answer.probabilities} />
      <div className="mt-2 flex flex-wrap gap-1">
        {answer.selectedIds.map((id) => (
          <span key={id} className="px-2 py-0.5 bg-accent-muted border border-accent/30 text-accent text-2xs rounded">
            {id}
          </span>
        ))}
      </div>
    </div>
  );
}

function ScoreAnswerDisplay({ answer }: { answer: ScoreAnswer }): React.ReactElement {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm font-bold text-text-primary">{answer.value.toFixed(2)}</span>
        <div className="flex-1">
          <ConfidenceBar confidence={answer.confidence} />
        </div>
      </div>
      {answer.distribution.length > 0 && (
        <div className="mt-2">
          <p className="text-2xs text-text-muted mb-1">Distribution</p>
          <div className="flex items-end gap-0.5 h-8">
            {answer.distribution.map(({ score, prob }) => {
              const pct = (prob * 100).toFixed(0);
              return (
                <div
                  key={score}
                  title={`Score ${score}: ${pct}%`}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${Math.max(pct, 2)}%`,
                    backgroundColor: confidenceColor(prob),
                    opacity: 0.8,
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AnswerRow({ answer, questionText }: { answer: Answer; questionText?: string }): React.ReactElement {
  return (
    <div className="border-b border-border-subtle pb-4 mb-4 last:border-0 last:mb-0 last:pb-0">
      {questionText && (
        <p className="text-text-secondary text-xs mb-2 font-medium">{questionText}</p>
      )}
      {answer.type === "Noul"   && <NoulAnswerDisplay answer={answer} />}
      {answer.type === "Choice" && <ChoiceAnswerDisplay answer={answer} />}
      {answer.type === "Score"  && <ScoreAnswerDisplay answer={answer} />}
    </div>
  );
}

interface AnswerDisplayProps {
  run: DecisionRun;
}

export function AnswerDisplay({ run }: AnswerDisplayProps): React.ReactElement {
  const markLastRunWrong = useStore((s) => s.markLastRunWrong);

  const questionMap = Object.fromEntries(run.questions.map((q) => [q.id, q.text]));

  return (
    <div className="flex flex-col gap-4">
      {/* Header metrics */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-bg-elevated border border-border rounded px-2.5 py-1.5">
            <Clock size={12} className="text-text-muted" />
            <span className="text-xs font-mono text-text-primary">{run.latencyMs} ms</span>
          </div>
          <div className="flex items-center gap-1.5 bg-bg-elevated border border-border rounded px-2.5 py-1.5">
            <span className="text-2xs text-text-muted">in</span>
            <span className="text-xs font-mono text-text-primary">{run.tokensIn}</span>
            <span className="text-2xs text-text-muted">out</span>
            <span className="text-xs font-mono text-text-primary">{run.tokensOut}</span>
            <span className="text-2xs text-text-muted">tok</span>
          </div>
          {run.cost != null && (
            <div className="flex items-center gap-1.5 bg-bg-elevated border border-border rounded px-2.5 py-1.5">
              <span className="text-2xs text-text-muted">$</span>
              <span className="text-xs font-mono text-text-primary">{run.cost.toFixed(6)}</span>
            </div>
          )}
        </div>

        <button
          onClick={() => void markLastRunWrong()}
          disabled={run.markedWrong}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            run.markedWrong
              ? "bg-red-900/20 border border-red-500/30 text-red-400 cursor-not-allowed"
              : "bg-bg-elevated border border-border text-text-secondary hover:border-status-error hover:text-status-error"
          }`}
        >
          <ThumbsDown size={12} />
          {run.markedWrong ? "Marked wrong" : "Mark as wrong"}
        </button>
      </div>

      {/* Answers */}
      <div className="bg-bg-surface border border-border rounded-lg p-4">
        {run.answers.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-4">No answers returned</p>
        ) : (
          run.answers.map((answer) => (
            <AnswerRow
              key={answer.questionId}
              answer={answer}
              questionText={questionMap[answer.questionId]}
            />
          ))
        )}
      </div>
    </div>
  );
}
