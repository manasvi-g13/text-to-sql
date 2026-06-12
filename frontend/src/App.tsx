import { useCallback, useEffect, useState } from "react";
import {
  exportCSV,
  listDatabases,
  runQuery,
  uploadDatabase,
  type DatabaseInfo,
  type QueryResponse,
} from "./api";
import { ApprovalModal } from "./components/ApprovalModal";
import { ChatWindow, type ChatMode } from "./components/ChatWindow";
import { ExplainPanel } from "./components/ExplainPanel";
import { ResultsTable } from "./components/ResultsTable";
import { SchemaExplorer } from "./components/SchemaExplorer";
import Sidebar from "./components/Sidebar";
import { SqlDisplay } from "./components/SqlDisplay";
import TopNavbar from "./components/TopNavbar";
import { WelcomeScreen, WelcomeSidePanel } from "./components/WelcomeScreen";
import { saveToHistory, type HistoryEntry } from "./lib/historyStorage";

function makeHistoryEntry(question: string, response: QueryResponse): HistoryEntry {
  return {
    id: crypto.randomUUID(),
    question,
    sql: response.sql,
    results: response.results,
    timestamp: Date.now(),
    explanation: response.explanation ?? null,
  };
}

function App() {
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [selectedDb, setSelectedDb] = useState<DatabaseInfo | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [question, setQuestion] = useState("");
  const [lastExplain, setLastExplain] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState<ChatMode | null>(null);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentEntryId, setCurrentEntryId] = useState<string | undefined>(undefined);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  useEffect(() => {
    listDatabases()
      .then((dbs) => {
        setDatabases(dbs);
        if (dbs.length > 0) {
          setSelectedDb((current) => current ?? dbs[0]);
        }
      })
      .catch(() => setDbError("Failed to load databases"));
  }, []);

  const handleSelectDb = useCallback((db: DatabaseInfo) => {
    setSelectedDb(db);
    setQuestion("");
    setResult(null);
    setError(null);
    setPendingConfirmation(false);
    setCurrentEntryId(undefined);
    setHistoryRefreshKey((k) => k + 1);
  }, []);

  const handleNewChat = useCallback(() => {
    setQuestion("");
    setResult(null);
    setError(null);
    setPendingConfirmation(false);
    setCurrentEntryId(undefined);
  }, []);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setUploadError(null);
      try {
        const data = await uploadDatabase(file);
        const newDb: DatabaseInfo = {
          db_name: data.db_name,
          db_path: data.db_path,
          encoded_path: data.encoded_path,
        };
        setDatabases((prev) => [...prev, newDb]);
        handleSelectDb(newDb);
      } catch (err: unknown) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [handleSelectDb],
  );

  const runQueryMode = useCallback(
    async (q: string, explain: boolean, mode: ChatMode) => {
      if (!selectedDb) {
        return;
      }
      setQuestion(q);
      setLastExplain(explain);
      setLoading(true);
      setLoadingMode(mode);
      setError(null);
      setPendingConfirmation(false);
      setCurrentEntryId(undefined);
      try {
        const response = await runQuery({
          question: q,
          explain,
          confirmed: false,
          db_path: selectedDb.db_path,
        });
        setResult(response);
        if (response.requires_confirmation) {
          setPendingConfirmation(true);
        } else {
          const entry = makeHistoryEntry(q, response);
          saveToHistory(selectedDb.db_path, entry);
          setCurrentEntryId(entry.id);
          setHistoryRefreshKey((k) => k + 1);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Query failed";
        setError(message);
        setResult(null);
      } finally {
        setLoading(false);
        setLoadingMode(null);
      }
    },
    [selectedDb],
  );

  const handleGenerate = useCallback(
    (q: string) => void runQueryMode(q, false, "generate"),
    [runQueryMode],
  );

  const handleExplain = useCallback(
    (q: string) => void runQueryMode(q, true, "explain"),
    [runQueryMode],
  );

  const handleConfirm = useCallback(async () => {
    if (!question || !selectedDb) {
      return;
    }
    setLoading(true);
    setPendingConfirmation(false);
    setError(null);
    try {
      const response = await runQuery({
        question,
        explain: lastExplain,
        confirmed: true,
        db_path: selectedDb.db_path,
      });
      setResult(response);
      const entry = makeHistoryEntry(question, response);
      saveToHistory(selectedDb.db_path, entry);
      setCurrentEntryId(entry.id);
      setHistoryRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Query failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [question, lastExplain, selectedDb]);

  const handleCancelApproval = useCallback(() => {
    setPendingConfirmation(false);
  }, []);

  const handleExport = useCallback(() => {
    if (question) {
      exportCSV(question, selectedDb?.db_path);
    }
  }, [question, selectedDb]);

  const handleSelectHistory = useCallback(
    (entry: HistoryEntry, db: DatabaseInfo) => {
      setSelectedDb((current) => (current?.db_path === db.db_path ? current : db));
      setQuestion(entry.question);
      setResult({
        sql: entry.sql,
        results: entry.results,
        latency_ms: 0,
        tables_used: [],
        explanation: entry.explanation ?? null,
        requires_confirmation: false,
        reason: null,
      });
      setCurrentEntryId(entry.id);
      setError(null);
      setPendingConfirmation(false);
    },
    [],
  );

  const handleExampleSelect = useCallback((q: string) => {
    setQuestion(q);
  }, []);

  const showExplainPanel =
    (loading && loadingMode === "explain") || Boolean(result?.explanation);

  return (
    <div className="flex h-screen overflow-hidden bg-white text-slate-900">
      <Sidebar
        databases={databases}
        selectedDb={selectedDb}
        onSelectDb={handleSelectDb}
        onUpload={(file) => void handleUpload(file)}
        uploading={uploading}
        uploadError={uploadError}
        onNewChat={handleNewChat}
        onSelectHistory={handleSelectHistory}
        currentEntryId={currentEntryId}
        historyRefreshKey={historyRefreshKey}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavbar
          databases={databases}
          selectedDb={selectedDb}
          onSelectDb={handleSelectDb}
          onNewChat={handleNewChat}
        />

        <main className="flex-1 overflow-y-auto bg-white">
          <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6">
            <div className="min-w-0 flex-1 space-y-6">
              <ChatWindow
                value={question}
                onChange={setQuestion}
                onGenerate={handleGenerate}
                onExplain={handleExplain}
                loading={loading}
                loadingMode={loadingMode}
                disabled={!selectedDb}
              />

              {dbError && (
                <div
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  role="alert"
                >
                  {dbError}
                </div>
              )}

              {error && (
                <div
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  role="alert"
                >
                  {error}
                </div>
              )}

              {showExplainPanel && (
                <ExplainPanel
                  explanation={result?.explanation ?? null}
                  loading={loading && loadingMode === "explain" && !result?.explanation}
                />
              )}

              {result ? (
                <div className="space-y-6">
                  <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                    <SqlDisplay
                      sql={result.sql}
                      latency_ms={result.latency_ms}
                      tables_used={result.tables_used}
                      dbPath={selectedDb?.db_path}
                    />
                  </section>

                  {!result.requires_confirmation && (
                    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                      <ResultsTable
                        results={result.results ?? []}
                        question={question}
                        onExport={handleExport}
                      />
                    </section>
                  )}
                </div>
              ) : (
                <WelcomeScreen
                  databases={databases}
                  selectedDb={selectedDb}
                  onSelectDb={handleSelectDb}
                  onUpload={(file) => void handleUpload(file)}
                  uploading={uploading}
                  onExampleSelect={handleExampleSelect}
                />
              )}
            </div>

            <aside className="hidden w-80 shrink-0 lg:block">
              {result ? (
                <SchemaExplorer encodedPath={selectedDb?.encoded_path ?? null} />
              ) : (
                <WelcomeSidePanel selectedDb={selectedDb} databaseCount={databases.length} />
              )}
            </aside>
          </div>
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
