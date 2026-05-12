import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from dotenv import load_dotenv
import chromadb
from sentence_transformers import SentenceTransformer

from agent.semantic_layer import TABLE_DESCRIPTIONS

load_dotenv()

MODEL_NAME = "all-MiniLM-L6-v2"
COLLECTION_NAME = "table_descriptions"


def _format_table_document(table_name: str, info: dict) -> str:
    lines = [
        f"Table: {table_name}",
        "",
        info["description"].strip(),
        "",
        "Columns:",
    ]
    for col_name, col_desc in info["columns"].items():
        lines.append(f"- {col_name}: {col_desc.strip()}")
    return "\n".join(lines)


def main() -> None:
    chroma_path = os.getenv("CHROMA_STORE_PATH", "./chroma_store")
    model = SentenceTransformer(MODEL_NAME)
    client = chromadb.PersistentClient(path=chroma_path)

    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass

    collection = client.create_collection(name=COLLECTION_NAME)

    for table_name, info in TABLE_DESCRIPTIONS.items():
        doc = _format_table_document(table_name, info)
        embedding = model.encode(doc, convert_to_numpy=True)
        collection.add(
            ids=[table_name],
            documents=[doc],
            embeddings=[embedding.tolist()],
        )
        print(f"✓ Indexed {table_name}")

    print("Index built successfully")


if __name__ == "__main__":
    main()
