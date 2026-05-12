import os

from dotenv import load_dotenv
import chromadb
from sentence_transformers import SentenceTransformer

load_dotenv()

MODEL_NAME = "all-MiniLM-L6-v2"
COLLECTION_NAME = "table_descriptions"
_DEFAULT_CHROMA_PATH = "./chroma_store"

_embedding_model: SentenceTransformer | None = None
_collection = None


def _get_embedding_model() -> SentenceTransformer:
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = SentenceTransformer(MODEL_NAME)
    return _embedding_model


def _get_table_collection():
    global _collection
    if _collection is None:
        path = os.getenv("CHROMA_STORE_PATH", _DEFAULT_CHROMA_PATH)
        client = chromadb.PersistentClient(path=path)
        _collection = client.get_collection(COLLECTION_NAME)
    return _collection


def get_relevant_tables(question: str, top_k: int = 3) -> list[dict]:
    """
    Embed the natural-language question and retrieve the most semantically similar
    table entries from the ChromaDB ``table_descriptions`` collection (built from
    the semantic layer). Each result includes the table identifier and the full
    stored document text (table summary plus column-level guidance).

    Args:
        question: User question or instruction used as the retrieval query.
        top_k: Maximum number of tables to return, ordered by similarity (closest first).

    Returns:
        A list of dicts with keys ``table_name`` and ``description`` (one entry per hit).
    """
    model = _get_embedding_model()
    collection = _get_table_collection()
    vec = model.encode(question, convert_to_numpy=True)
    results = collection.query(
        query_embeddings=[vec.tolist()],
        n_results=top_k,
        include=["documents"],
    )
    ids = results.get("ids") or []
    docs = results.get("documents") or []
    id_row = ids[0] if ids else []
    doc_row = docs[0] if docs else []
    return [
        {"table_name": table_id, "description": text}
        for table_id, text in zip(id_row, doc_row)
    ]


def format_schema_for_prompt(tables: list[dict]) -> str:
    """
    Turn retrieved table dicts (from :func:`get_relevant_tables`) into a single
    markdown-flavored block suitable for injection into a system or tool prompt,
    with one section per table.

    Args:
        tables: List of ``{"table_name": ..., "description": ...}`` items.

    Returns:
        A single string with labeled sections separated by blank lines.
    """
    if not tables:
        return ""

    parts: list[str] = []
    for row in tables:
        name = row["table_name"]
        desc = row["description"].strip()
        parts.append(f"### Table: `{name}`\n{desc}")
    return "\n\n".join(parts)
