import { useState } from "react";

export interface SchemaExplorerProps {
  schema: Record<string, string>;
}

export function SchemaExplorer({ schema }: SchemaExplorerProps) {
  const [openTable, setOpenTable] = useState<string | null>(null);
  const tables = Object.entries(schema).sort(([a], [b]) => a.localeCompare(b));

  const toggle = (tableName: string) => {
    setOpenTable((current) => (current === tableName ? null : tableName));
  };

  if (tables.length === 0) {
    return (
      <aside className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        No schema available
      </aside>
    );
  }

  return (
    <aside className="w-full rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Schema
        </h2>
      </div>
      <ul className="divide-y divide-slate-100">
        {tables.map(([tableName, description]) => {
          const isOpen = openTable === tableName;
          return (
            <li key={tableName}>
              <button
                type="button"
                onClick={() => toggle(tableName)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-slate-50"
                aria-expanded={isOpen}
              >
                <svg
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                    isOpen ? "rotate-90" : ""
                  }`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-semibold text-slate-900">{tableName}</span>
              </button>
              {isOpen && (
                <p className="border-t border-slate-100 px-4 pb-4 pl-10 text-sm leading-relaxed text-slate-500">
                  {description}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export default SchemaExplorer;
