from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from hmac import compare_digest
from typing import Any, Dict

from jose import JWTError, jwt

from .config import get_settings


class TokenValidationError(Exception):
    """Token çözümlenirken hata oluştuğunda fırlatılır."""


def hash_password(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _looks_like_sha256(value: str) -> bool:
    if not value or len(value) != 64:
        return False
    try:
        int(value, 16)
        return True
    except ValueError:
        return False


def verify_password(plain_password: str, stored_value: str | None) -> bool:
    if stored_value is None:
        return False

    stored_clean = stored_value.strip()

    if _looks_like_sha256(stored_clean):
        expected = hash_password(plain_password)
        return compare_digest(expected, stored_clean.lower())

    return compare_digest(plain_password, stored_clean)


def create_access_token(subject: str, role: str, expires_delta: timedelta | None = None) -> str:
    settings = get_settings()
    delta = expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    expire_at = datetime.now(timezone.utc) + delta
    to_encode = {"sub": subject, "role": role, "exp": expire_at}
    token = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return token


def decode_access_token(token: str) -> Dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as exc:
        raise TokenValidationError("Kimlik doğrulama tokenı geçersiz.") from exc
    return payload
