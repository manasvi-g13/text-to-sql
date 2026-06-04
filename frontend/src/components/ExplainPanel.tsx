import { useEffect, useMemo, useState } from "react";

export interface ExplainPanelProps {
  explanation: string | null;
  loading: boolean;
}

function parseBulletLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, ""));
}

export function ExplainPanel({ explanation, loading }: ExplainPanelProps) {
  const [visible, setVisible] = useState(false);

  const bullets = useMemo(
    () => (explanation ? parseBulletLines(explanation) : []),
    [explanation],
  );

  useEffect(() => {
    if (explanation && bullets.length > 0) {
      setVisible(false);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
  }, [explanation, bullets.length]);

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

  if (!explanation || bullets.length === 0) {
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
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-sky-900">SQL Explanation</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-sky-950/90">
            {bullets.map((line, index) => (
              <li key={`${index}-${line.slice(0, 24)}`}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default ExplainPanel;
