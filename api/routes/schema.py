import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException

_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

router = APIRouter()


@router.get("/schema")
def get_schema():
    try:
        from agent.semantic_layer import TABLE_DESCRIPTIONS

        return {
            table_name: info["description"]
            for table_name, info in TABLE_DESCRIPTIONS.items()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
