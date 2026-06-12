import { useMemo, useState } from "react";
import type { DatabaseInfo } from "../api";
import {
  deleteHistoryEntry,
  getSessionName,
  loadHistory,
  setSessionName,
  timeAgo,
  type HistoryEntry,
} from "../lib/historyStorage";
import {
  ChatBubbleIcon,
  DatabaseIcon,
  HelpIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SparkleIcon,
  TrashIcon,
  UploadIcon,
} from "./icons";

export interface SidebarProps {
  databases: DatabaseInfo[];
  selectedDb: DatabaseInfo | null;
  onSelectDb: (db: DatabaseInfo) => void;
  onUpload: (file: File) => void;
  uploading: boolean;
  uploadError: string | null;
  onNewChat: () => void;
  onSelectHistory: (entry: HistoryEntry, db: DatabaseInfo) => void;
  currentEntryId?: string;
  historyRefreshKey: number;
}

export function Sidebar({
  databases,
  selectedDb,
  onSelectDb,
  onUpload,
  uploading,
  uploadError,
  onNewChat,
  onSelectHistory,
  currentEntryId,
  historyRefreshKey,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [renamingDbPath, setRenamingDbPath] = useState<string | null>(null);
  const [localVersion, setLocalVersion] = useState(0);
  const [openPanel, setOpenPanel] = useState<"settings" | "help" | null>(null);

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return databases
      .map((db) => {
        const entries = loadHistory(db.db_path).filter((entry) =>
          term ? entry.question.toLowerCase().includes(term) : true,
        );
        return { db, label: getSessionName(db.db_path, db.db_name), entries };
      })
      .filter((group) => group.entries.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [databases, search, historyRefreshKey, localVersion]);

  const handleUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    e.target.value = "";
  };

  const handleRename = (dbPath: string, name: string) => {
    if (name.trim()) {
      setSessionName(dbPath, name.trim());
    }
    setRenamingDbPath(null);
    setLocalVersion((v) => v + 1);
  };

  const handleDelete = (dbPath: string, id: string) => {
    deleteHistoryEntry(dbPath, id);
    setLocalVersion((v) => v + 1);
  };

  const togglePanel = (panel: "settings" | "help") => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-[#1a1f2e] text-slate-300">
      <div className="flex items-center gap-2 border-b border-slate-800/80 px-4 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <SparkleIcon className="h-4 w-4" />
        </div>
        <span className="truncate text-sm font-semibold text-white">AI Text-to-SQL</span>
      </div>

      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <PlusIcon className="h-4 w-4" />
          New Chat
        </button>
      </div>

      <div className="px-3 pt-5">
        <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Databases
        </h3>
        <ul className="mt-2 space-y-0.5">
          {databases.map((db) => {
            const isActive = selectedDb?.db_path === db.db_path;
            return (
              <li key={db.db_path}>
                <button
                  type="button"
                  onClick={() => onSelectDb(db)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                    isActive
                      ? "bg-indigo-600 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <DatabaseIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{db.db_name}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <label
          className={`mt-2 flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white ${
            uploading ? "pointer-events-none opacity-60" : ""
          }`}
        >
          <UploadIcon className="h-4 w-4 shrink-0" />
          {uploading ? "Uploading…" : "Add Database"}
          <input
            type="file"
            accept=".db,.sqlite,.sqlite3"
            className="hidden"
            onChange={handleUploadChange}
            disabled={uploading}
          />
        </label>
        {uploadError && <p className="mt-1 px-2 text-xs text-red-400">{uploadError}</p>}
      </div>

      <div className="mt-5 flex min-h-0 flex-1 flex-col px-3 pb-2">
        <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          History
        </h3>
        <div className="relative mt-2">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search history"
            aria-label="Search history"
            className="w-full rounded-md border border-slate-700 bg-slate-800 py-1.5 pl-8 pr-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="mt-2 flex-1 space-y-3 overflow-y-auto">
          {groups.length === 0 ? (
            <p className="px-1 py-4 text-center text-xs text-slate-500">
              {search.trim() ? "No matching queries" : "No queries yet"}
            </p>
          ) : (
            groups.map(({ db, label, entries }) => (
              <div key={db.db_path}>
                {renamingDbPath === db.db_path ? (
                  <input
                    autoFocus
                    defaultValue={label}
                    className="w-full rounded-md bg-slate-800 px-1.5 py-1 text-xs font-medium text-white outline-none focus:ring-1 focus:ring-indigo-500"
                    onBlur={(e) => handleRename(db.db_path, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleRename(db.db_path, (e.target as HTMLInputElement).value);
                      }
                    }}
                  />
                ) : (
                  <h4
                    className="cursor-default truncate px-1 text-xs font-medium text-slate-400"
                    title="Double-click to rename"
                    onDoubleClick={() => setRenamingDbPath(db.db_path)}
                  >
                    {label}
                  </h4>
                )}
                <ul className="mt-1 space-y-0.5">
                  {entries.map((entry) => {
                    const isActive = entry.id === currentEntryId;
                    return (
                      <li key={entry.id} className="group flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectHistory(entry, db)}
                          className={`flex min-w-0 flex-1 items-start gap-1.5 rounded-md px-2 py-1.5 text-left text-xs transition ${
                            isActive
                              ? "bg-indigo-600/20 text-white"
                              : "text-slate-400 hover:bg-slate-800 hover:text-white"
                          }`}
                        >
                          <ChatBubbleIcon className="mt-0.5 h-3 w-3 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{entry.question}</span>
                            <span className="block text-[10px] text-slate-500">
                              {timeAgo(entry.timestamp)}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(db.db_path, entry.id)}
                          aria-label="Delete from history"
                          className="shrink-0 p-1 text-slate-500 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                        >
                          <TrashIcon className="h-3 w-3" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="relative border-t border-slate-800/80 p-3">
        {openPanel === "settings" && (
          <div className="absolute bottom-full left-3 right-3 mb-2 rounded-lg border border-slate-700 bg-slate-800 p-3 text-xs text-slate-300 shadow-lg">
            <p className="font-semibold text-white">Connection</p>
            <p className="mt-1 text-slate-400">API base: /api</p>
            <p className="mt-1 text-slate-400">
              Active database: {selectedDb?.db_name ?? "None"}
            </p>
          </div>
        )}
        {openPanel === "help" && (
          <div className="absolute bottom-full left-3 right-3 mb-2 rounded-lg border border-slate-700 bg-slate-800 p-3 text-xs text-slate-300 shadow-lg">
            <p className="font-semibold text-white">How to use</p>
            <ol className="mt-1 list-decimal space-y-1 pl-4 text-slate-400">
              <li>Select or upload a database</li>
              <li>Ask a question in plain English</li>
              <li>Review the generated SQL</li>
              <li>Run it and explore the results</li>
            </ol>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => togglePanel("settings")}
            className={`flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-slate-800 hover:text-white ${
              openPanel === "settings" ? "bg-slate-800 text-white" : "text-slate-400"
            }`}
          >
            <SettingsIcon className="h-4 w-4" />
            Settings
          </button>
          <button
            type="button"
            onClick={() => togglePanel("help")}
            className={`flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-slate-800 hover:text-white ${
              openPanel === "help" ? "bg-slate-800 text-white" : "text-slate-400"
            }`}
          >
            <HelpIcon className="h-4 w-4" />
            Help
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
