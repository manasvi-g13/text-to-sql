import { useState } from "react";
import type { DatabaseInfo } from "../api";
import { ChevronDownIcon, DatabaseIcon, PlusIcon, SettingsIcon } from "./icons";

export interface TopNavbarProps {
  databases: DatabaseInfo[];
  selectedDb: DatabaseInfo | null;
  onSelectDb: (db: DatabaseInfo) => void;
  onNewChat: () => void;
}

const USER_INITIALS = "AV";

export function TopNavbar({ databases, selectedDb, onSelectDb, onNewChat }: TopNavbarProps) {
  const [dbMenuOpen, setDbMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="relative">
        <button
          type="button"
          onClick={() => setDbMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <DatabaseIcon className="h-4 w-4 text-slate-400" />
          <span className="max-w-[10rem] truncate sm:max-w-[16rem]">
            {selectedDb?.db_name ?? "Select database"}
          </span>
          <ChevronDownIcon className="h-4 w-4 text-slate-400" />
        </button>

        {dbMenuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setDbMenuOpen(false)} />
            <div className="absolute left-0 top-full z-20 mt-1 w-60 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {databases.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-400">No databases available</p>
              ) : (
                databases.map((db) => {
                  const isActive = selectedDb?.db_path === db.db_path;
                  return (
                    <button
                      key={db.db_path}
                      type="button"
                      onClick={() => {
                        onSelectDb(db);
                        setDbMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                        isActive
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <DatabaseIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{db.db_name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onNewChat}
          className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:inline-flex"
        >
          <PlusIcon className="h-4 w-4" />
          New Chat
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label="Settings"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <SettingsIcon className="h-5 w-5" />
          </button>
          {settingsOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSettingsOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg">
                <p className="font-semibold text-slate-800">Connection</p>
                <p className="mt-1 flex items-center gap-1.5 text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Backend connected
                </p>
                <p className="mt-2 text-slate-500">
                  Active database:{" "}
                  <span className="font-medium text-slate-700">
                    {selectedDb?.db_name ?? "None"}
                  </span>
                </p>
              </div>
            </>
          )}
        </div>

        <div
          className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white"
          aria-hidden
        >
          {USER_INITIALS}
        </div>
      </div>
    </header>
  );
}

export default TopNavbar;
