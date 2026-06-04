const API_BASE = "/api";

const JSON_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
};

export interface QueryRequest {
  question: string;
  explain: boolean;
  confirmed: boolean;
}

export interface QueryResponse {
  sql: string;
  results: Record<string, any>[];
  latency_ms: number;
  tables_used: string[];
  explanation: string | null;
  requires_confirmation: boolean;
  reason: string | null;
}

async function throwIfNotOk(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }
  let detail = response.statusText;
  try {
    const body = (await response.json()) as { detail?: string | unknown };
    if (body.detail !== undefined) {
      detail =
        typeof body.detail === "string"
          ? body.detail
          : JSON.stringify(body.detail);
    }
  } catch {
    // non-JSON error body
  }
  throw new Error(detail);
}

export async function runQuery(request: QueryRequest): Promise<QueryResponse> {
  const response = await fetch(`${API_BASE}/query`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(request),
  });
  await throwIfNotOk(response);
  return response.json() as Promise<QueryResponse>;
}

export async function getSchema(): Promise<Record<string, string>> {
  const response = await fetch(`${API_BASE}/schema`, {
    method: "GET",
    headers: JSON_HEADERS,
  });
  await throwIfNotOk(response);
  return response.json() as Promise<Record<string, string>>;
}

export function exportCSV(question: string): void {
  void (async () => {
    const url = `${API_BASE}/query/export-csv?question=${encodeURIComponent(question)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: JSON_HEADERS,
    });
    await throwIfNotOk(response);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "results.csv";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
  })();
}
