import { useCallback, useEffect, useState } from "react";
import {
  exportCSV,
  getSchema,
  runQuery,
  type QueryResponse,
} from "./api";
import { ApprovalModal } from "./components/ApprovalModal";
import { ChatWindow } from "./components/ChatWindow";
import { ExplainPanel } from "./components/ExplainPanel";
import { ResultsTable } from "./components/ResultsTable";
import { SchemaExplorer } from "./components/SchemaExplorer";
import { SqlDisplay } from "./components/SqlDisplay";

function App() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [explainMode, setExplainMode] = useState(false);
  const [schema, setSchema] = useState<Record<string, string>>({});
  const [showSchema, setShowSchema] = useState(true);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSchema()
      .then(setSchema)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to load schema";
        setError(message);
      });
  }, []);

  const handleSubmit = useCallback(
    async (q: string) => {
      setQuestion(q);
      setLoading(true);
      setError(null);
      setPendingConfirmation(false);
      try {
        const response = await runQuery({
          question: q,
          explain: explainMode,
          confirmed: false,
        });
        setResult(response);
        if (response.requires_confirmation) {
          setPendingConfirmation(true);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Query failed";
        setError(message);
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [explainMode],
  );

  const handleConfirm = useCallback(async () => {
    if (!question) {
      return;
    }
    setLoading(true);
    setPendingConfirmation(false);
    setError(null);
    try {
      const response = await runQuery({
        question,
        explain: explainMode,
        confirmed: true,
      });
      setResult(response);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Query failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [question, explainMode]);

  const handleCancelApproval = useCallback(() => {
    setPendingConfirmation(false);
  }, []);

  const handleExport = useCallback(() => {
    if (question) {
      exportCSV(question);
    }
  }, [question]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100">
      <header className="border-b border-slate-800 bg-[#0f172a]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
              Text-to-SQL Agent
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">
              Natural language analytics on your warehouse
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSchema((v) => !v)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              showSchema
                ? "bg-sky-600 text-white hover:bg-sky-500"
                : "border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
            }`}
          >
            Schema
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        {showSchema && (
          <aside className="w-full shrink-0 lg:w-72 xl:w-80">
            <SchemaExplorer schema={schema} />
          </aside>
        )}

        <main className="min-w-0 flex-1 space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg sm:p-6">
            <label className="mb-4 flex cursor-pointer items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-200">
                Explain SQL in plain English
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={explainMode}
                onClick={() => setExplainMode((v) => !v)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  explainMode ? "bg-sky-500" : "bg-slate-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    explainMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </label>

            <ChatWindow onSubmit={handleSubmit} loading={loading} />
          </div>

          {error && (
            <div
              className="rounded-lg border border-red-500/40 bg-red-950/50 px-4 py-3 text-sm text-red-200"
              role="alert"
            >
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-6">
              <section className="rounded-xl border border-slate-800 bg-white p-4 shadow-lg sm:p-6">
                <SqlDisplay
                  sql={result.sql}
                  latency_ms={result.latency_ms}
                  tables_used={result.tables_used}
                />
              </section>

              {(explainMode || result.explanation) && (
                <ExplainPanel
                  explanation={result.explanation}
                  loading={loading && explainMode && !result.explanation}
                />
              )}

              {!result.requires_confirmation && (
                <section className="rounded-xl border border-slate-800 bg-white p-4 shadow-lg sm:p-6">
                  <ResultsTable
                    results={result.results ?? []}
                    question={question}
                    onExport={handleExport}
                  />
                </section>
              )}
            </div>
          )}
        </main>
      </div>

      {pendingConfirmation && result && (
        <ApprovalModal
          sql={result.sql}
          reason={result.reason ?? "This query was blocked by the safety guard."}
          onConfirm={() => void handleConfirm()}
          onCancel={handleCancelApproval}
        />
      )}
    </div>
  );
}

export default App;
