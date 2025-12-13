from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import admin, auth, complaints

settings = get_settings()

app = FastAPI(
    title="Bursa Su Ağı API",
    version="0.1.0",
    description="Reaktif izleme ve yönetişim için REST katmanı",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(admin.router, prefix="/admins", tags=["admins"])
app.include_router(complaints.router, prefix="/complaints", tags=["complaints"])


@app.get("/health", tags=["health"])
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
