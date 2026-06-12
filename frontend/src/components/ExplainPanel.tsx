import { useEffect, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";

export interface ExplainPanelProps {
  explanation: string | null;
  loading: boolean;
}

// Claude sometimes writes bullet lines using "•" rather than markdown's
// "-"/"*" syntax; normalize those so react-markdown renders real <ul><li> lists.
function normalizeMarkdown(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^(\s*)[•]\s+/, "$1- "))
    .join("\n");
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h4 className="mt-3 text-sm font-semibold text-sky-900 first:mt-0">{children}</h4>
  ),
  h2: ({ children }) => (
    <h4 className="mt-3 text-sm font-semibold text-sky-900 first:mt-0">{children}</h4>
  ),
  h3: ({ children }) => (
    <h4 className="mt-3 text-sm font-semibold text-sky-900 first:mt-0">{children}</h4>
  ),
  p: ({ children }) => <p className="mt-2 first:mt-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-sky-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="mt-2 list-disc space-y-2 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mt-2 list-decimal space-y-2 pl-5">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  code: ({ children }) => (
    <code className="rounded bg-sky-100 px-1 py-0.5 font-mono text-xs text-sky-900">
      {children}
    </code>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800"
    >
      {children}
    </a>
  ),
};

export function ExplainPanel({ explanation, loading }: ExplainPanelProps) {
  const [visible, setVisible] = useState(false);
  const hasContent = Boolean(explanation && explanation.trim().length > 0);

  useEffect(() => {
    if (hasContent) {
      setVisible(false);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
  }, [hasContent]);

  if (loading) {
    return (
      <div
        className="w-full rounded-xl border border-sky-100 bg-sky-50/80 p-5 shadow-sm"
        aria-busy="true"
        aria-label="Loading explanation"
      >
        <div className="flex gap-3">
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-sky-200" />
          <div className="flex-1 space-y-3">
            <div className="h-4 w-40 animate-pulse rounded bg-sky-200" />
            <div className="h-3 w-full animate-pulse rounded bg-sky-100" />
            <div className="h-3 w-[92%] animate-pulse rounded bg-sky-100" />
            <div className="h-3 w-[85%] animate-pulse rounded bg-sky-100" />
            <div className="h-3 w-[78%] animate-pulse rounded bg-sky-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!hasContent) {
    return null;
  }

  return (
    <div
      className={`w-full rounded-xl border border-sky-200 bg-sky-50 p-5 shadow-sm transition-opacity duration-500 ease-out ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      role="region"
      aria-label="SQL explanation"
    >
      <div className="flex gap-3">
        <span className="text-2xl leading-none" aria-hidden>
          💡
        </span>
        <div className="min-w-0 flex-1 text-sm leading-relaxed text-sky-950/90">
          <h3 className="text-sm font-semibold text-sky-900">SQL Explanation</h3>
          <ReactMarkdown components={markdownComponents}>
            {normalizeMarkdown(explanation ?? "")}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

export default ExplainPanel;
