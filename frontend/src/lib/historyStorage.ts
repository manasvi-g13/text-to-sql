export interface HistoryEntry {
  id: string;
  question: string;
  sql: string;
  results: Record<string, any>[];
  timestamp: number;
  explanation?: string | null;
}

function historyKey(dbPath: string): string {
  return `history_${btoa(dbPath)}`;
}

function sessionNameKey(dbPath: string): string {
  return `session_name_${btoa(dbPath)}`;
}

export function loadHistory(dbPath: string): HistoryEntry[] {
  return JSON.parse(localStorage.getItem(historyKey(dbPath)) || "[]");
}

export function saveToHistory(dbPath: string, entry: HistoryEntry): void {
  const updated = [entry, ...loadHistory(dbPath)].slice(0, 50);
  localStorage.setItem(historyKey(dbPath), JSON.stringify(updated));
}

export function deleteHistoryEntry(dbPath: string, id: string): HistoryEntry[] {
  const updated = loadHistory(dbPath).filter((entry) => entry.id !== id);
  localStorage.setItem(historyKey(dbPath), JSON.stringify(updated));
  return updated;
}

export function getSessionName(dbPath: string, fallback: string): string {
  return localStorage.getItem(sessionNameKey(dbPath)) || fallback;
}

export function setSessionName(dbPath: string, name: string): void {
  localStorage.setItem(sessionNameKey(dbPath), name);
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
