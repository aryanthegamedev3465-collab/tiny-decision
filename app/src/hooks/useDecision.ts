import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DecisionRun, DecisionState, Question } from "@/types";

export function useDecision() {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const runDecision = useCallback(
    async (modelId: string, state: DecisionState, questions: Question[]): Promise<DecisionRun | null> => {
      setIsRunning(true);
      setError(null);
      const start = performance.now();

      try {
        const result = await invoke<DecisionRun>("run_decision", {
          modelId,
          state,
          questions,
        });
        const elapsed = Math.round(performance.now() - start);
        setElapsedMs(elapsed);
        return result;
      } catch (err: any) {
        setError(err?.message || "Decision execution failed");
        return null;
      } finally {
        setIsRunning(false);
      }
    },
    []
  );

  return {
    runDecision,
    isRunning,
    elapsedMs,
    error,
  };
}
