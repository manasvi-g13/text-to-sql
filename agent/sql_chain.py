"""
Text-to-SQL orchestration: retrieval, Claude generation, safety checks, execution, logging.
"""

from __future__ import annotations

import re
import sys
import time
from pathlib import Path

import yaml
from anthropic import Anthropic
from dotenv import load_dotenv
from sqlalchemy import text

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


def _execute_sql(sql: str) -> list[dict]:
    with engine.connect() as conn:
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


def run_query(question: str, explain: bool = False, skip_guard: bool = False) -> dict:
    """
    Generate SQLite from ``question``, validate it, optionally cap rows, execute against
    ``DATABASE_URL``, optionally fetch a plain-English explanation, and persist an audit row.

    Retrieval pulls schema context via Chroma; few-shot YAML illustrates patterns. Unsafe SQL
    (writes/DDL/exec keywords) returns early with ``requires_confirmation`` and does not run,
    unless ``skip_guard`` is True (human-approved execution path).

    Args:
        question: Natural language question for the warehouse.
        explain: When True, asks Claude for a concise bullet-point explanation of the final SQL.
        skip_guard: When True, skip ``check_sql`` and execute generated SQL after ``inject_limit``.

    Returns:
        On success: ``sql``, ``results`` (list of row dicts), ``latency_ms``, ``tables_used``
        (comma-separated names), and ``explanation`` (str or ``None`` if ``explain`` is False).

        On guard failure: ``requires_confirmation``, ``sql``, ``reason``, plus ``latency_ms``,
        ``tables_used``, ``results`` (``None``), ``explanation`` (``None``).
    """
    started = time.perf_counter()

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
    results = _execute_sql(sql_final)

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
