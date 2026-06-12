import base64
import csv
import io
import sqlite3
import sys
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from agent.sql_chain import run_query, run_sql

router = APIRouter()

DATA_DIR = _ROOT / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
OLIST_DB_PATH = DATA_DIR / "olist.db"

ALLOWED_DB_EXTENSIONS = {".db", ".sqlite", ".sqlite3"}
SQLITE_MAGIC = b"SQLite format 3\x00"


class QueryRequest(BaseModel):
    question: str
    explain: bool = False
    confirmed: bool = False
    db_path: Optional[str] = None


class QueryResponse(BaseModel):
    sql: str
    results: list[dict[str, Any]]
    latency_ms: float
    tables_used: list[str]
    explanation: Optional[str] = None
    requires_confirmation: bool = False
    reason: Optional[str] = None


class ExecuteSqlRequest(BaseModel):
    sql: str
    db_path: Optional[str] = None
    confirmed: bool = False


class ExecuteSqlResponse(BaseModel):
    sql: str
    results: list[dict[str, Any]]
    latency_ms: float
    requires_confirmation: bool = False
    reason: Optional[str] = None


class ColumnInfo(BaseModel):
    name: str
    type: str


class UploadedTableInfo(BaseModel):
    name: str
    columns: list[ColumnInfo]


class TableSchemaInfo(BaseModel):
    name: str
    row_count: int
    columns: list[ColumnInfo]


class UploadDatabaseResponse(BaseModel):
    db_name: str
    db_path: str
    encoded_path: str
    tables: list[UploadedTableInfo]


class DatabaseInfo(BaseModel):
    db_name: str
    db_path: str
    encoded_path: str


class ListDatabasesResponse(BaseModel):
    databases: list[DatabaseInfo]


class DatabaseSchemaResponse(BaseModel):
    db_path: str
    tables: list[TableSchemaInfo]


def _tables_used_to_list(value: str | list[str]) -> list[str]:
    if isinstance(value, list):
        return value
    return [t.strip() for t in value.split(",") if t.strip()]


def _raw_to_response(data: dict) -> QueryResponse:
    results = data.get("results")
    if results is None:
        results = []
    return QueryResponse(
        sql=data["sql"],
        results=results,
        latency_ms=float(data["latency_ms"]),
        tables_used=_tables_used_to_list(data["tables_used"]),
        explanation=data.get("explanation"),
        requires_confirmation=bool(data.get("requires_confirmation", False)),
        reason=data.get("reason"),
    )


def _relative_db_path(path: Path) -> str:
    return path.resolve().relative_to(_ROOT).as_posix()


def _encode_db_path(path: Path) -> str:
    raw = _relative_db_path(path)
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii").rstrip("=")


def _decode_db_path(encoded_path: str) -> Path:
    padded = encoded_path + "=" * (-len(encoded_path) % 4)
    try:
        raw = base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8")
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid encoded database path") from e

    resolved = (_ROOT / raw).resolve()
    if not resolved.is_relative_to(DATA_DIR):
        raise HTTPException(status_code=400, detail="Database path is outside the data directory")
    if not resolved.is_file():
        raise HTTPException(status_code=404, detail="Database not found")
    return resolved


def _list_tables(conn: sqlite3.Connection) -> list[str]:
    cur = conn.execute(
        "SELECT name FROM sqlite_master "
        "WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    return [row[0] for row in cur.fetchall()]


def _table_columns(conn: sqlite3.Connection, table: str) -> list[ColumnInfo]:
    safe_table = table.replace('"', '""')
    cur = conn.execute(f'PRAGMA table_info("{safe_table}")')
    return [ColumnInfo(name=row[1], type=row[2] or "UNKNOWN") for row in cur.fetchall()]


def _table_row_count(conn: sqlite3.Connection, table: str) -> int:
    safe_table = table.replace('"', '""')
    cur = conn.execute(f'SELECT COUNT(*) FROM "{safe_table}"')
    return int(cur.fetchone()[0])


@router.post("/query", response_model=QueryResponse)
def post_query(body: QueryRequest):
    try:
        if body.confirmed:
            raw = run_query(
                body.question, explain=body.explain, skip_guard=True, db_path=body.db_path
            )
        else:
            raw = run_query(
                body.question, explain=body.explain, skip_guard=False, db_path=body.db_path
            )
            if raw.get("requires_confirmation"):
                return _raw_to_response(raw)
        return _raw_to_response(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/query/execute", response_model=ExecuteSqlResponse)
def execute_sql(body: ExecuteSqlRequest):
    try:
        raw = run_sql(body.sql, db_path=body.db_path, skip_guard=body.confirmed)
        return ExecuteSqlResponse(
            sql=raw["sql"],
            results=raw.get("results") or [],
            latency_ms=float(raw["latency_ms"]),
            requires_confirmation=bool(raw.get("requires_confirmation", False)),
            reason=raw.get("reason"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/database/upload", response_model=UploadDatabaseResponse)
async def upload_database(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_DB_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type {suffix!r}. Expected one of {sorted(ALLOWED_DB_EXTENSIONS)}.",
        )

    contents = await file.read()
    if contents[: len(SQLITE_MAGIC)] != SQLITE_MAGIC:
        raise HTTPException(status_code=400, detail="File is not a valid SQLite database")

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    safe_name = Path(file.filename).name
    dest = UPLOADS_DIR / safe_name
    if dest.exists():
        stem, ext = Path(safe_name).stem, Path(safe_name).suffix
        counter = 1
        while dest.exists():
            dest = UPLOADS_DIR / f"{stem}_{counter}{ext}"
            counter += 1

    dest.write_bytes(contents)

    try:
        conn = sqlite3.connect(dest)
        try:
            tables = [
                UploadedTableInfo(name=name, columns=_table_columns(conn, name))
                for name in _list_tables(conn)
            ]
        finally:
            conn.close()
    except sqlite3.Error as e:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Failed to read SQLite file: {e}") from e

    return UploadDatabaseResponse(
        db_name=dest.stem,
        db_path=_relative_db_path(dest),
        encoded_path=_encode_db_path(dest),
        tables=tables,
    )


@router.get("/database/list", response_model=ListDatabasesResponse)
def list_databases():
    databases: list[DatabaseInfo] = []

    if OLIST_DB_PATH.is_file():
        databases.append(
            DatabaseInfo(
                db_name="olist (demo)",
                db_path=_relative_db_path(OLIST_DB_PATH),
                encoded_path=_encode_db_path(OLIST_DB_PATH),
            )
        )

    if UPLOADS_DIR.is_dir():
        for path in sorted(UPLOADS_DIR.iterdir()):
            if path.is_file() and path.suffix.lower() in ALLOWED_DB_EXTENSIONS:
                databases.append(
                    DatabaseInfo(
                        db_name=path.stem,
                        db_path=_relative_db_path(path),
                        encoded_path=_encode_db_path(path),
                    )
                )

    return ListDatabasesResponse(databases=databases)


@router.get("/database/schema/{encoded_path}", response_model=DatabaseSchemaResponse)
def get_database_schema(encoded_path: str):
    resolved = _decode_db_path(encoded_path)
    try:
        conn = sqlite3.connect(f"file:{resolved}?mode=ro", uri=True)
        try:
            tables = [
                TableSchemaInfo(
                    name=name,
                    row_count=_table_row_count(conn, name),
                    columns=_table_columns(conn, name),
                )
                for name in _list_tables(conn)
            ]
        finally:
            conn.close()
    except sqlite3.Error as e:
        raise HTTPException(status_code=400, detail=f"Failed to read SQLite file: {e}") from e

    return DatabaseSchemaResponse(db_path=_relative_db_path(resolved), tables=tables)


@router.get("/query/export-csv")
def export_csv(question: str, db_path: Optional[str] = None):
    try:
        raw = run_query(question, explain=False, skip_guard=False, db_path=db_path)
        if raw.get("requires_confirmation"):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Query requires human confirmation before export. "
                    "Use POST /api/query with confirmed=true, then export from those results."
                ),
            )
        results = raw.get("results") or []
        buf = io.StringIO()
        if results:
            fieldnames = list(results[0].keys())
            writer = csv.DictWriter(buf, fieldnames=fieldnames)
            writer.writeheader()
            for row in results:
                writer.writerow(
                    {k: row.get(k) for k in fieldnames},
                )
        content = buf.getvalue().encode("utf-8")
        return StreamingResponse(
            iter([content]),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="results.csv"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
