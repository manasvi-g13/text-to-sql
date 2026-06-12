import type { ChangeEvent } from "react";
import type { DatabaseInfo } from "../api";
import { CodeIcon, DatabaseIcon, DownloadIcon, LightbulbIcon, PlayIcon, UploadIcon } from "./icons";

const FEATURES = [
  {
    title: "Generate SQL",
    description: "Ask in plain English and get production-ready SQL instantly.",
    icon: CodeIcon,
    bg: "bg-sky-100",
    fg: "text-sky-600",
  },
  {
    title: "Explain SQL",
    description: "Understand what a query does and why, in plain language.",
    icon: LightbulbIcon,
    bg: "bg-purple-100",
    fg: "text-purple-600",
  },
  {
    title: "Run & View Results",
    description: "Execute any query against your database and preview the rows.",
    icon: PlayIcon,
    bg: "bg-emerald-100",
    fg: "text-emerald-600",
  },
  {
    title: "Download Results",
    description: "Export query results to CSV with a single click.",
    icon: DownloadIcon,
    bg: "bg-amber-100",
    fg: "text-amber-600",
  },
] as const;

const EXAMPLE_QUESTIONS = [
  "Top 10 products by revenue",
  "Monthly order trends",
  "Which states have the most cancellations?",
  "Top 5 product categories by revenue",
  "Average delivery time by region",
  "Which sellers have the highest review scores?",
] as const;

export interface WelcomeScreenProps {
  databases: DatabaseInfo[];
  selectedDb: DatabaseInfo | null;
  onSelectDb: (db: DatabaseInfo) => void;
  onUpload: (file: File) => void;
  uploading: boolean;
  onExampleSelect: (question: string) => void;
}

export function WelcomeScreen({
  databases,
  selectedDb,
  onSelectDb,
  onUpload,
  uploading,
  onExampleSelect,
}: WelcomeScreenProps) {
  const demoDb = databases.find((db) => db.db_name.toLowerCase().includes("demo")) ?? databases[0] ?? null;
  const isDemoSelected = demoDb !== null && selectedDb?.db_path === demoDb.db_path;

  const handleUploadChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    e.target.value = "";
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Welcome back!</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ask questions about your data in plain English — I&apos;ll turn them into SQL, run
          them, and explain the results.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-slate-700">Choose a Database</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => demoDb && onSelectDb(demoDb)}
            disabled={!demoDb}
            className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isDemoSelected
                ? "border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
              <DatabaseIcon className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Use Demo Database</h3>
            <p className="text-xs text-slate-500">
              Explore the Olist e-commerce dataset — orders, products, customers, reviews and
              more.
            </p>
            {isDemoSelected && (
              <span className="text-xs font-medium text-indigo-600">Selected</span>
            )}
          </button>

          <label
            className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition ${
              uploading
                ? "cursor-not-allowed border-slate-200 opacity-60"
                : "cursor-pointer border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <UploadIcon className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Upload Your Own Database</h3>
            <p className="text-xs text-slate-500">
              Upload a SQLite (.db, .sqlite, .sqlite3) file and ask questions about your own
              data.
            </p>
            {uploading && <span className="text-xs font-medium text-emerald-600">Uploading…</span>}
            <input
              type="file"
              accept=".db,.sqlite,.sqlite3"
              className="hidden"
              onChange={handleUploadChange}
              disabled={uploading}
            />
          </label>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-700">What can you do?</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-slate-200 p-4">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${feature.bg} ${feature.fg}`}>
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-800">{feature.title}</h3>
              <p className="mt-1 text-xs text-slate-500">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-700">Example Questions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => onExampleSelect(question)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
            >
              {question}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

const HOW_IT_WORKS_STEPS = [
  "Select or upload a database",
  "Ask a question in plain English",
  "Review the generated SQL",
  "Run it and explore the results",
] as const;

export interface WelcomeSidePanelProps {
  selectedDb: DatabaseInfo | null;
  databaseCount: number;
}

export function WelcomeSidePanel({ selectedDb, databaseCount }: WelcomeSidePanelProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-800">How it works</h3>
        <ol className="mt-3 space-y-3">
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <li key={step} className="flex items-start gap-3 text-sm text-slate-600">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-semibold text-white">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">Status</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Database</dt>
            <dd className="font-medium text-slate-800">{selectedDb?.db_name ?? "None selected"}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Available databases</dt>
            <dd className="font-medium text-slate-800">{databaseCount}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Connection</dt>
            <dd className="flex items-center gap-1.5 font-medium text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Ready
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export default WelcomeScreen;
