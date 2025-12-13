from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import List


_BASE_DIR = Path(__file__).resolve().parents[1]
_DB_DIR = _BASE_DIR / "DB"


@dataclass(frozen=True)
class Settings:
    """Uygulama genel konfigürasyonu."""

    secret_key: str = field(default_factory=lambda: os.getenv("BURSA_API_SECRET", "change-me"))
    algorithm: str = "HS256"
    access_token_expire_minutes: int = field(
        default_factory=lambda: int(os.getenv("BURSA_API_ACCESS_TOKEN_MINUTES", "120"))
    )
    admin_records_path: Path = field(default_factory=lambda: _DB_DIR / "AdminBilgileri.json")
    admin_credentials_path: Path = field(default_factory=lambda: _DB_DIR / "AdminCredentials.json")
    complaints_path: Path = field(default_factory=lambda: _DB_DIR / "SikayetBilgileri.json")
    allowed_origins: List[str] = field(default_factory=lambda: _resolve_allowed_origins())


def _resolve_allowed_origins() -> List[str]:
    raw = os.getenv("BURSA_API_ALLOWED_ORIGINS")
    if not raw:
        return ["*"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
