import { useCallback, useMemo, useState, type ReactNode } from "react";
import { executeSql } from "../api";

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
  dbPath?: string | null;
}

function formatRunCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
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

export function SqlDisplay({ sql, latency_ms, tables_used, dbPath }: SqlDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<{
    sql: string;
    results: Record<string, any>[];
    latency_ms: number;
  } | null>(null);

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

  const runQuerySql = useCallback(async () => {
    setRunning(true);
    setRunError(null);
    try {
      const response = await executeSql({ sql, db_path: dbPath ?? null });
      if (response.requires_confirmation) {
        setRunError(
          response.reason ?? "Query was blocked by the safety guard.",
        );
        setRunResult(null);
        return;
      }
      setRunResult({
        sql: response.sql,
        results: response.results,
        latency_ms: response.latency_ms,
      });
    } catch (err: unknown) {
      setRunError(err instanceof Error ? err.message : "Query failed");
      setRunResult(null);
    } finally {
      setRunning(false);
    }
  }, [sql, dbPath]);

  const runColumns = useMemo(() => {
    if (!runResult || runResult.results.length === 0) {
      return [];
    }
    const keys = new Set<string>();
    for (const row of runResult.results) {
      Object.keys(row).forEach((k) => keys.add(k));
    }
    return Array.from(keys);
  }, [runResult]);

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
          onClick={() => void runQuerySql()}
          disabled={running}
          aria-busy={running}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? "Running…" : "Run Query"}
        </button>

        <button
          type="button"
          onClick={() => void copySql()}
          className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          {copied ? "Copied!" : "Copy SQL"}
        </button>
      </div>

      {runError && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
          role="alert"
        >
          {runError}
        </div>
      )}

      {runResult && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Query results
            </h3>
            <span className="text-xs text-slate-400">
              {runResult.results.length.toLocaleString()} row
              {runResult.results.length === 1 ? "" : "s"} ·{" "}
              {Math.round(runResult.latency_ms)}ms
            </span>
          </div>

          {runResult.results.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-xs text-slate-500 shadow-sm">
              No results found
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {runColumns.map((col) => (
                        <th
                          key={col}
                          scope="col"
                          className="whitespace-nowrap px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {runResult.results.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className={`transition-colors hover:bg-slate-100 ${
                          rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/80"
                        }`}
                      >
                        {runColumns.map((col) => (
                          <td
                            key={col}
                            className="whitespace-nowrap px-4 py-2 text-slate-700"
                          >
                            {formatRunCell(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SqlDisplay;
