# Human-In-The-Loop safety guard: blocks mutating / DDL SQL and caps row counts.

import re

_DANGEROUS_KEYWORDS = re.compile(
    r"\b(?:INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC)\b",
    re.IGNORECASE,
)

_LIMIT_CLAUSE = re.compile(r"\bLIMIT\b", re.IGNORECASE)


def check_sql(sql: str) -> dict:
    """
    Scan SQL for disallowed keywords that indicate writes, DDL, or execution.

    Matching is case-insensitive and uses word boundaries so identifiers like
    ``updated_at`` do not trigger on ``UPDATE`` alone (unless ``UPDATE`` appears
    as its own SQL keyword).

    Args:
        sql: Raw SQL string from the model or user.

    Returns:
        ``{"safe": True}`` if no dangerous keywords are found; otherwise
        ``{"safe": False, "reason": ..., "blocked_keyword": ...}`` with the
        first matched keyword uppercased (e.g. ``DROP``).
    """
    match = _DANGEROUS_KEYWORDS.search(sql)
    if not match:
        return {"safe": True}
    blocked = match.group(0).upper()
    return {
        "safe": False,
        "reason": f"Query contains dangerous keyword: {blocked}",
        "blocked_keyword": blocked,
    }


def inject_limit(sql: str, limit: int = 1000) -> str:
    """
    Ensure a SELECT-style query cannot return unbounded rows by adding ``LIMIT``.

    If the string already contains a ``LIMIT`` clause (case-insensitive, whole
    word), returns the input unchanged. Otherwise appends ``LIMIT <limit>``
    immediately before a trailing semicolon (if present) or at the end of the
    string.

    Args:
        sql: SQL text to normalize.
        limit: Maximum rows when injecting (default 1000).

    Returns:
        Possibly modified SQL string.
    """
    if _LIMIT_CLAUSE.search(sql):
        return sql

    suffix = f" LIMIT {limit}"
    trimmed = sql.rstrip()
    if trimmed.endswith(";"):
        body = trimmed[:-1].rstrip()
        return f"{body}{suffix};"
    return f"{trimmed}{suffix}"
