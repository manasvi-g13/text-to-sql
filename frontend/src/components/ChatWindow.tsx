import type { FormEvent, KeyboardEvent } from "react";

export type ChatMode = "generate" | "explain";

export interface ChatWindowProps {
  value: string;
  onChange: (value: string) => void;
  onGenerate: (question: string) => void;
  onExplain: (question: string) => void;
  loading: boolean;
  loadingMode?: ChatMode | null;
  disabled?: boolean;
}

export function ChatWindow({
  value,
  onChange,
  onGenerate,
  onExplain,
  loading,
  loadingMode = null,
  disabled = false,
}: ChatWindowProps) {
  const isDisabled = loading || disabled;

  const submit = (mode: ChatMode) => {
    const question = value.trim();
    if (!question || isDisabled) {
      return;
    }
    if (mode === "generate") {
      onGenerate(question);
    } else {
      onExplain(question);
    }
    onChange("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit("generate");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit("generate");
    }
  };

  const buttonBase =
    "inline-flex min-w-[7.5rem] items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  const Spinner = (
    <span
      className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
      aria-hidden
    />
  );

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-wrap gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        placeholder="Ask anything about your data..."
        className="min-w-[12rem] flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        aria-label="Question"
      />
      <button
        type="submit"
        disabled={isDisabled || !value.trim()}
        aria-busy={loading && loadingMode === "generate"}
        className={`${buttonBase} bg-sky-600 hover:bg-sky-500 focus:ring-sky-400`}
      >
        {loading && loadingMode === "generate" ? Spinner : "Generate SQL"}
      </button>
      <button
        type="button"
        onClick={() => submit("explain")}
        disabled={isDisabled || !value.trim()}
        aria-busy={loading && loadingMode === "explain"}
        className={`${buttonBase} bg-purple-600 hover:bg-purple-500 focus:ring-purple-400`}
      >
        {loading && loadingMode === "explain" ? Spinner : "Explain"}
      </button>
    </form>
  );
}

export default ChatWindow;
