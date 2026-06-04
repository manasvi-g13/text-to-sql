import { useCallback, useMemo, useState, type ReactNode } from "react";

const SQL_KEYWORDS = [
  "GROUP BY",
  "ORDER BY",
  "SELECT",
  "FROM",
  "WHERE",
  "LIMIT",
  "JOIN",
  "WITH",
  "AS",
] as const;

const KEYWORD_PATTERN = new RegExp(
  `^(${SQL_KEYWORDS.map((k) => k.replace(/\s+/g, "\\s+")).join("|")})\\b`,
  "i",
);

const NUMBER_PATTERN = /^-?\d+(\.\d+)?/;

export interface SqlDisplayProps {
  sql: string;
  latency_ms: number;
  tables_used: string[];
}

function highlightSql(sql: string, tablesUsed: string[]): ReactNode[] {
  const sortedTables = [...tablesUsed].sort((a, b) => b.length - a.length);
  const nodes: ReactNode[] = [];
  let pos = 0;
  let key = 0;

  while (pos < sql.length) {
    const rest = sql.slice(pos);

    const whitespace = rest.match(/^\s+/);
    if (whitespace) {
      nodes.push(whitespace[0]);
      pos += whitespace[0].length;
      continue;
    }

    const keyword = rest.match(KEYWORD_PATTERN);
    if (keyword) {
      nodes.push(
        <span key={key++} className="text-sky-400 font-semibold">
          {keyword[0]}
        </span>,
      );
      pos += keyword[0].length;
      continue;
    }

    let tableMatched = false;
    for (const table of sortedTables) {
      if (rest.length >= table.length && rest.slice(0, table.length).toLowerCase() === table.toLowerCase()) {
        const after = rest[table.length];
        if (!after || /[^a-zA-Z0-9_]/.test(after)) {
          nodes.push(
            <span key={key++} className="text-emerald-400">
              {rest.slice(0, table.length)}
            </span>,
          );
          pos += table.length;
          tableMatched = true;
          break;
        }
      }
    }
    if (tableMatched) {
      continue;
    }

    const number = rest.match(NUMBER_PATTERN);
    if (number) {
      nodes.push(
        <span key={key++} className="text-orange-400">
          {number[0]}
        </span>,
      );
      pos += number[0].length;
      continue;
    }

    nodes.push(rest[0]);
    pos += 1;
  }

  return nodes;
}

export function SqlDisplay({ sql, latency_ms, tables_used }: SqlDisplayProps) {
  const [copied, setCopied] = useState(false);
  const highlighted = useMemo(
    () => highlightSql(sql, tables_used),
    [sql, tables_used],
  );

  const copySql = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [sql]);

  const latencyLabel = `${Math.round(latency_ms)}ms`;

  return (
    <div className="w-full space-y-3">
      <div className="relative rounded-xl bg-slate-900 shadow-lg ring-1 ring-slate-800">
        <span className="absolute right-3 top-3 rounded-md bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300 ring-1 ring-slate-700">
          {latencyLabel}
        </span>
        <pre className="overflow-x-auto p-4 pt-10 font-mono text-sm leading-relaxed text-slate-100">
          <code>{highlighted}</code>
        </pre>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tables_used.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {tables_used.map((table) => (
              <span
                key={table}
                className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200"
              >
                {table}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-slate-400">No tables listed</span>
        )}

        <button
          type="button"
          onClick={() => void copySql()}
          className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          {copied ? "Copied!" : "Copy SQL"}
        </button>
      </div>
    </div>
  );
}

export default SqlDisplay;
