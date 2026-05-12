import os

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv()

from api.routes.health import router as health_router
from api.routes.query import router as query_router
from api.routes.schema import router as schema_router

app = FastAPI(title="Text-to-SQL API", version="1.0.0")

_frontend = os.getenv("FRONTEND_URL", "").strip()
_origins = [o for o in (_frontend, "http://localhost:3000") if o]
if not _origins:
    _origins = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(query_router, prefix="/api")
app.include_router(schema_router, prefix="/api")
app.include_router(health_router, prefix="/api")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "message": "Internal server error",
            "detail": str(exc),
        },
    )


@app.on_event("startup")
async def startup_event():
    print("Text-to-SQL API is running")
