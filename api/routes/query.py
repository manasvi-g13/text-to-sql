import csv
import io
import sys
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from agent.sql_chain import run_query

router = APIRouter()


class QueryRequest(BaseModel):
    question: str
    explain: bool = False
    confirmed: bool = False


class QueryResponse(BaseModel):
    sql: str
    results: list[dict[str, Any]]
    latency_ms: float
    tables_used: list[str]
    explanation: Optional[str] = None
    requires_confirmation: bool = False
    reason: Optional[str] = None


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


@router.post("/query", response_model=QueryResponse)
def post_query(body: QueryRequest):
    try:
        if body.confirmed:
            raw = run_query(body.question, explain=body.explain, skip_guard=True)
        else:
            raw = run_query(body.question, explain=body.explain, skip_guard=False)
            if raw.get("requires_confirmation"):
                return _raw_to_response(raw)
        return _raw_to_response(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/query/export-csv")
def export_csv(question: str):
    try:
        raw = run_query(question, explain=False, skip_guard=False)
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
