import { useEffect, useState } from "react";
import { getDatabaseSchema, type TableSchemaInfo } from "../api";

export interface SchemaExplorerProps {
  encodedPath: string | null;
}

export function SchemaExplorer({ encodedPath }: SchemaExplorerProps) {
  const [tables, setTables] = useState<TableSchemaInfo[]>([]);
  const [openTable, setOpenTable] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!encodedPath) {
      setTables([]);
      setOpenTable(null);
      return;
    }
    setLoading(true);
    setError(null);
    getDatabaseSchema(encodedPath)
      .then((data) => {
        setTables(data.tables);
        setOpenTable(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load schema");
        setTables([]);
      })
      .finally(() => setLoading(false));
  }, [encodedPath]);

  const toggle = (tableName: string) => {
    setOpenTable((current) => (current === tableName ? null : tableName));
  };

  if (!encodedPath) {
    return (
      <aside className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        Select a database to view its schema
      </aside>
    );
  }

  if (loading) {
    return (
      <aside className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        Loading schema…
      </aside>
    );
  }

  if (error) {
    return (
      <aside className="w-full rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        {error}
      </aside>
    );
  }

  if (tables.length === 0) {
    return (
      <aside className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        No tables found
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
        {tables.map((table) => {
          const isOpen = openTable === table.name;
          return (
            <li key={table.name}>
              <button
                type="button"
                onClick={() => toggle(table.name)}
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
                <span className="font-semibold text-slate-900">{table.name}</span>
                <span className="ml-auto shrink-0 text-xs text-slate-400">
                  {table.row_count.toLocaleString()} rows
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-slate-100 px-4 pb-4 pl-10">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400">
                        <th className="py-1.5 pr-4 font-medium uppercase tracking-wide">
                          Column
                        </th>
                        <th className="py-1.5 font-medium uppercase tracking-wide">
                          Type
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {table.columns.map((col) => (
                        <tr key={col.name}>
                          <td className="py-1.5 pr-4 font-mono text-slate-700">
                            {col.name}
                          </td>
                          <td className="py-1.5 text-slate-500">{col.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export default SchemaExplorer;
