import React, { useState } from "react";
import { Plus, X, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import type { Question, ChoiceQuestion, NoulQuestion, ScoreQuestion, QuestionType } from "@/types";
import { useStore } from "@/store";

function nanoid(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface QuestionEditorProps {
  question: Question;
  index: number;
  total: number;
  onUpdate: (q: Question) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function ChoiceEditor({ question, onUpdate }: { question: ChoiceQuestion; onUpdate: (q: Question) => void }): React.ReactElement {
  const addOption = () => {
    onUpdate({
      ...question,
      options: [...question.options, { id: nanoid(), label: "" }],
    });
  };

  const updateOption = (idx: number, label: string) => {
    const options = question.options.map((o, i) => i === idx ? { ...o, label } : o);
    onUpdate({ ...question, options });
  };

  const removeOption = (idx: number) => {
    const options = question.options.filter((_, i) => i !== idx);
    onUpdate({ ...question, options });
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-text-muted text-xs">Options</span>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={question.multiSelect}
            onChange={(e) => onUpdate({ ...question, multiSelect: e.target.checked })}
            className="rounded border-border"
          />
          Multi-select
        </label>
      </div>
      {question.options.map((opt, i) => (
        <div key={opt.id} className="flex items-center gap-2">
          <input
            value={opt.label}
            onChange={(e) => updateOption(i, e.target.value)}
            placeholder={`Option ${i + 1}`}
            className="flex-1 bg-bg-elevated border border-border rounded px-2.5 py-1.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
          />
          <button onClick={() => removeOption(i)} className="text-text-muted hover:text-status-error">
            <X size={12} />
          </button>
        </div>
      ))}
      <button
        onClick={addOption}
        className="flex items-center gap-1 text-xs text-text-muted hover:text-accent transition-colors"
      >
        <Plus size={12} /> Add option
      </button>
    </div>
  );
}

function ScoreEditor({ question, onUpdate }: { question: ScoreQuestion; onUpdate: (q: Question) => void }): React.ReactElement {
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {(["min", "max", "step"] as const).map((field) => (
        <div key={field}>
          <label className="text-2xs text-text-muted capitalize block mb-1">{field}</label>
          <input
            type="number"
            value={question[field]}
            onChange={(e) => onUpdate({ ...question, [field]: Number(e.target.value) })}
            className="w-full bg-bg-elevated border border-border rounded px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
          />
        </div>
      ))}
    </div>
  );
}

function QuestionEditor({ question, index, total, onUpdate, onRemove, onMoveUp, onMoveDown }: QuestionEditorProps): React.ReactElement {
  return (
    <div className="bg-bg-elevated border border-border rounded-lg p-3">
      <div className="flex items-start gap-2">
        <div className="text-text-muted cursor-grab mt-0.5">
          <GripVertical size={14} />
        </div>
        <div className="flex-1 min-w-0">
          {/* Type badge + controls */}
          <div className="flex items-center justify-between mb-2">
            <span
              className={`px-2 py-0.5 text-2xs rounded border font-medium ${
                question.type === "Choice"
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                  : question.type === "Noul"
                  ? "bg-accent-muted text-accent border-accent/30"
                  : "bg-purple-500/10 text-purple-400 border-purple-500/30"
              }`}
            >
              {question.type}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={onMoveUp} disabled={index === 0} className="text-text-muted hover:text-text-primary disabled:opacity-30">
                <ChevronUp size={12} />
              </button>
              <button onClick={onMoveDown} disabled={index === total - 1} className="text-text-muted hover:text-text-primary disabled:opacity-30">
                <ChevronDown size={12} />
              </button>
              <button onClick={onRemove} className="text-text-muted hover:text-status-error">
                <X size={12} />
              </button>
            </div>
          </div>

          {/* Question text */}
          <input
            value={question.text}
            onChange={(e) => onUpdate({ ...question, text: e.target.value } as Question)}
            placeholder="Question text…"
            className="w-full bg-bg-surface border border-border rounded px-2.5 py-1.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
          />

          {/* Type-specific editor */}
          {question.type === "Choice" && <ChoiceEditor question={question} onUpdate={onUpdate} />}
          {question.type === "Score"  && <ScoreEditor question={question} onUpdate={onUpdate} />}
          {question.type === "Noul"   && (
            <p className="text-text-muted text-2xs mt-2">Model returns Yes/No + confidence probability.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function QuestionBuilder(): React.ReactElement {
  const questions = useStore((s) => s.questions);
  const addQuestion = useStore((s) => s.addQuestion);
  const updateQuestion = useStore((s) => s.updateQuestion);
  const removeQuestion = useStore((s) => s.removeQuestion);
  const reorderQuestions = useStore((s) => s.reorderQuestions);

  const handleAdd = (type: QuestionType) => {
    const id = nanoid();
    if (type === "Choice") {
      addQuestion({ type: "Choice", id, text: "", options: [{ id: nanoid(), label: "Yes" }, { id: nanoid(), label: "No" }], multiSelect: false });
    } else if (type === "Noul") {
      addQuestion({ type: "Noul", id, text: "" });
    } else {
      addQuestion({ type: "Score", id, text: "", min: 1, max: 10, step: 1 });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Question list */}
      {questions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-text-muted border border-dashed border-border rounded-lg">
          <p className="text-sm mb-1">No questions yet</p>
          <p className="text-xs">Add a question below</p>
        </div>
      )}

      {questions.map((q, i) => (
        <QuestionEditor
          key={q.id}
          question={q}
          index={i}
          total={questions.length}
          onUpdate={updateQuestion}
          onRemove={() => removeQuestion(q.id)}
          onMoveUp={() => reorderQuestions(i, i - 1)}
          onMoveDown={() => reorderQuestions(i, i + 1)}
        />
      ))}

      {/* Add buttons */}
      <div className="flex gap-2">
        {(["Noul", "Choice", "Score"] as QuestionType[]).map((type) => (
          <button
            key={type}
            onClick={() => handleAdd(type)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border text-text-secondary hover:border-accent hover:text-accent bg-bg-surface transition-colors"
          >
            <Plus size={11} />
            {type}
          </button>
        ))}
      </div>
    </div>
  );
}
