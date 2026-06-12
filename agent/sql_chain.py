"""
Text-to-SQL orchestration: retrieval, Claude generation, safety checks, execution, logging.
"""

from __future__ import annotations

import re
import sqlite3
import sys
import time
from pathlib import Path

import yaml
from anthropic import Anthropic
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

load_dotenv()

from agent.hitl_guard import check_sql, inject_limit
from agent.retriever import format_schema_for_prompt, get_relevant_tables
from model.database import SessionLocal, engine
from model.schema import QueryLog

ANTHROPIC_MODEL = "claude-sonnet-4-5"
MAX_TOKENS = 1000
FEW_SHOT_PATH = Path(__file__).resolve().parent / "few_shot_examples.yaml"
DEFAULT_DB_PATH = (_ROOT / "data" / "olist.db").resolve()


def _format_few_shot_examples(raw: list) -> str:
    blocks: list[str] = []
    for i, item in enumerate(raw, start=1):
        q = item["question"].strip()
        sql = item["sql"].strip()
        blocks.append(f"Example {i}:\nQuestion: {q}\nSQL:\n{sql}")
    return "\n\n".join(blocks)


def _clean_generated_sql(raw: str) -> str:
    s = raw.strip()
    s = re.sub(r"^\s*```(?:sql)?\s*", "", s, flags=re.IGNORECASE | re.MULTILINE)
    s = re.sub(r"\s*```\s*$", "", s, flags=re.MULTILINE)
    return s.strip()


def _extract_assistant_text(response) -> str:
    parts: list[str] = []
    for block in response.content:
        if getattr(block, "text", None):
            parts.append(block.text)
    return "".join(parts).strip()


def _resolve_db_path(db_path: str | None) -> Path | None:
    """
    Resolve ``db_path`` to an absolute path, or ``None`` when it refers to the
    default Olist database (or is unset), in which case the default ``engine``
    and Chroma-backed schema retrieval should be used.
    """
    if not db_path:
        return None
    resolved = Path(db_path)
    if not resolved.is_absolute():
        resolved = _ROOT / resolved
    resolved = resolved.resolve()
    if resolved == DEFAULT_DB_PATH:
        return None
    return resolved


def _get_engine(db_path: str | None):
    resolved = _resolve_db_path(db_path)
    if resolved is None:
        return engine
    return create_engine(f"sqlite:///{resolved}")


def _introspect_schema(db_path: Path) -> tuple[str, list[str]]:
    """
    Inspect a SQLite file directly (no Chroma/semantic layer) and build a
    markdown schema block plus the list of table names it contains.
    """
    conn = sqlite3.connect(db_path)
    try:
        cur = conn.execute(
            "SELECT name FROM sqlite_master "
            "WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
        table_names = [row[0] for row in cur.fetchall()]

        sections: list[str] = []
        for table in table_names:
            safe_table = table.replace('"', '""')
            cols = conn.execute(f'PRAGMA table_info("{safe_table}")').fetchall()
            col_lines = "\n".join(f"- {col[1]} ({col[2] or 'UNKNOWN'})" for col in cols)
            sections.append(f"### Table: `{table}`\nColumns:\n{col_lines}")

        return "\n\n".join(sections), table_names
    finally:
        conn.close()


def _execute_sql(sql: str, db_engine=None) -> list[dict]:
    db_engine = db_engine or engine
    with db_engine.connect() as conn:
        result = conn.execute(text(sql))
        rows = result.mappings().all()
        return [dict(r) for r in rows]


def _log_query(
    *,
    question: str,
    generated_sql: str,
    tables_used: str,
    latency_ms: float,
    explain_requested: bool,
) -> None:
    session = SessionLocal()
    try:
        session.add(
            QueryLog(
                question=question,
                generated_sql=generated_sql,
                tables_used=tables_used,
                latency_ms=latency_ms,
                explain_requested=explain_requested,
            )
        )
        session.commit()
    finally:
        session.close()


def run_query(
    question: str,
    explain: bool = False,
    skip_guard: bool = False,
    db_path: str | None = None,
) -> dict:
    """
    Generate SQLite from ``question``, validate it, optionally cap rows, execute against
    ``DATABASE_URL`` (or ``db_path``), optionally fetch a plain-English explanation, and
    persist an audit row.

    For the default Olist database, retrieval pulls schema context via Chroma and the
    few-shot YAML illustrates patterns. For any other ``db_path``, the schema is introspected
    directly from the SQLite file (no Chroma/few-shot context, since those are specific to the
    Olist semantic layer). Unsafe SQL (writes/DDL/exec keywords) returns early with
    ``requires_confirmation`` and does not run, unless ``skip_guard`` is True (human-approved
    execution path).

    Args:
        question: Natural language question for the warehouse.
        explain: When True, asks Claude for a concise bullet-point explanation of the final SQL.
        skip_guard: When True, skip ``check_sql`` and execute generated SQL after ``inject_limit``.
        db_path: Optional path to a SQLite file to query instead of the default Olist database.
            ``None`` (or a path resolving to the default database) uses the existing
            Chroma-backed schema retrieval.

    Returns:
        On success: ``sql``, ``results`` (list of row dicts), ``latency_ms``, ``tables_used``
        (comma-separated names), and ``explanation`` (str or ``None`` if ``explain`` is False).

        On guard failure: ``requires_confirmation``, ``sql``, ``reason``, plus ``latency_ms``,
        ``tables_used``, ``results`` (``None``), ``explanation`` (``None``).
    """
    started = time.perf_counter()

    resolved_db_path = _resolve_db_path(db_path)

    if resolved_db_path is None:
        tables = get_relevant_tables(question)
        tables_used = ",".join(t["table_name"] for t in tables)
        schema_block = format_schema_for_prompt(tables)

        with FEW_SHOT_PATH.open(encoding="utf-8") as fh:
            few_shot_raw = yaml.safe_load(fh)
        few_shot_block = _format_few_shot_examples(few_shot_raw)

        system_prompt = (
            "You are an expert at SQLite for analytics. Use ONLY the schema and patterns below.\n\n"
            "## Relevant schema\n"
            f"{schema_block}\n\n"
            "## Few-shot examples\n"
            f"{few_shot_block}\n\n"
            "## Instructions\n"
            "- Respond with ONLY executable SQLite SQL.\n"
            "- Do not wrap the query in markdown fences.\n"
            "- Do not include commentary, labels, or text before or after the SQL.\n"
        )
    else:
        schema_block, table_names = _introspect_schema(resolved_db_path)
        tables_used = ",".join(table_names)

        system_prompt = (
            "You are an expert at SQLite for analytics. Use ONLY the schema below — it "
            "describes the tables and columns actually present in this database.\n\n"
            "## Database schema\n"
            f"{schema_block}\n\n"
            "## Instructions\n"
            "- Respond with ONLY executable SQLite SQL.\n"
            "- Do not wrap the query in markdown fences.\n"
            "- Do not include commentary, labels, or text before or after the SQL.\n"
            "- Only reference tables and columns listed in the schema above.\n"
        )

    client = Anthropic()
    gen_response = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=MAX_TOKENS,
        temperature=0,
        system=system_prompt,
        messages=[{"role": "user", "content": question}],
    )
    raw_sql = _extract_assistant_text(gen_response)
    sql_clean = _clean_generated_sql(raw_sql)

    if not skip_guard:
        guard = check_sql(sql_clean)
        if not guard["safe"]:
            latency_ms = (time.perf_counter() - started) * 1000
            _log_query(
                question=question,
                generated_sql=sql_clean,
                tables_used=tables_used,
                latency_ms=latency_ms,
                explain_requested=explain,
            )
            return {
                "requires_confirmation": True,
                "sql": sql_clean,
                "reason": guard["reason"],
                "latency_ms": latency_ms,
                "tables_used": tables_used,
                "results": None,
                "explanation": None,
            }

    sql_final = inject_limit(sql_clean)
    db_engine = engine if resolved_db_path is None else create_engine(f"sqlite:///{resolved_db_path}")
    results = _execute_sql(sql_final, db_engine)

    explanation: str | None = None
    if explain:
        expl_response = client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=MAX_TOKENS,
            temperature=0,
            system=(
                "You are a SQL teacher. Explain this SQL query in plain English line by line "
                "using bullet points. Be concise and avoid jargon."
            ),
            messages=[
                {
                    "role": "user",
                    "content": f"Original question:\n{question}\n\nSQL:\n{sql_final}",
                }
            ],
        )
        explanation = _extract_assistant_text(expl_response)

    latency_ms = (time.perf_counter() - started) * 1000
    _log_query(
        question=question,
        generated_sql=sql_final,
        tables_used=tables_used,
        latency_ms=latency_ms,
        explain_requested=explain,
    )

    return {
        "sql": sql_final,
        "results": results,
        "latency_ms": latency_ms,
        "tables_used": tables_used,
        "explanation": explanation,
    }


def run_sql(sql: str, db_path: str | None = None, skip_guard: bool = False) -> dict:
    """
    Execute a pre-generated SQL string directly (no LLM call), applying the same
    safety guard and row-limit injection as :func:`run_query`. Used by the "Run
    Query" action to (re-)execute SQL that has already been generated/displayed.

    Args:
        sql: SQL text to validate and execute.
        db_path: Optional path to a SQLite file to query instead of the default
            Olist database.
        skip_guard: When True, skip ``check_sql`` (human-approved execution path).

    Returns:
        On success: ``sql`` (after ``inject_limit``), ``results``, ``latency_ms``,
        ``requires_confirmation`` (False), ``reason`` (None).

        On guard failure: ``requires_confirmation`` (True), ``sql`` (unmodified),
        ``reason``, ``latency_ms``, ``results`` (None).
    """
    started = time.perf_counter()
    sql_clean = sql.strip()

    if not skip_guard:
        guard = check_sql(sql_clean)
        if not guard["safe"]:
            return {
                "sql": sql_clean,
                "results": None,
                "latency_ms": (time.perf_counter() - started) * 1000,
                "requires_confirmation": True,
                "reason": guard["reason"],
            }

    sql_final = inject_limit(sql_clean)
    results = _execute_sql(sql_final, _get_engine(db_path))

    return {
        "sql": sql_final,
        "results": results,
        "latency_ms": (time.perf_counter() - started) * 1000,
        "requires_confirmation": False,
        "reason": None,
    }
