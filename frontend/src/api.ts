const API_BASE = "/api";

const JSON_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
};

export interface QueryRequest {
  question: string;
  explain: boolean;
  confirmed: boolean;
  db_path?: string | null;
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

export interface ExecuteSqlRequest {
  sql: string;
  db_path?: string | null;
  confirmed?: boolean;
}

export interface ExecuteSqlResponse {
  sql: string;
  results: Record<string, any>[];
  latency_ms: number;
  requires_confirmation: boolean;
  reason: string | null;
}

export interface DatabaseInfo {
  db_name: string;
  db_path: string;
  encoded_path: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
}

export interface UploadedTableInfo {
  name: string;
  columns: ColumnInfo[];
}

export interface UploadDatabaseResponse extends DatabaseInfo {
  tables: UploadedTableInfo[];
}

export interface TableSchemaInfo {
  name: string;
  row_count: number;
  columns: ColumnInfo[];
}

export interface DatabaseSchemaResponse {
  db_path: string;
  tables: TableSchemaInfo[];
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

export function exportCSV(question: string, dbPath?: string | null): void {
  void (async () => {
    const params = new URLSearchParams({ question });
    if (dbPath) {
      params.set("db_path", dbPath);
    }
    const url = `${API_BASE}/query/export-csv?${params.toString()}`;
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

export async function executeSql(request: ExecuteSqlRequest): Promise<ExecuteSqlResponse> {
  const response = await fetch(`${API_BASE}/query/execute`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(request),
  });
  await throwIfNotOk(response);
  return response.json() as Promise<ExecuteSqlResponse>;
}

export async function listDatabases(): Promise<DatabaseInfo[]> {
  const response = await fetch(`${API_BASE}/database/list`, {
    method: "GET",
    headers: JSON_HEADERS,
  });
  await throwIfNotOk(response);
  const data = (await response.json()) as { databases: DatabaseInfo[] };
  return data.databases;
}

export async function uploadDatabase(file: File): Promise<UploadDatabaseResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE}/database/upload`, {
    method: "POST",
    body: formData,
  });
  await throwIfNotOk(response);
  return response.json() as Promise<UploadDatabaseResponse>;
}

export async function getDatabaseSchema(encodedPath: string): Promise<DatabaseSchemaResponse> {
  const response = await fetch(`${API_BASE}/database/schema/${encodedPath}`, {
    method: "GET",
    headers: JSON_HEADERS,
  });
  await throwIfNotOk(response);
  return response.json() as Promise<DatabaseSchemaResponse>;
}
