from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, HTTPException, status

from .. import data_access, schemas, security
from ..config import get_settings

router = APIRouter()


@router.post("/login", response_model=schemas.AuthResponse)
def login(payload: schemas.AdminLoginRequest) -> schemas.AuthResponse:
    admin_record = data_access.find_admin_by_email(payload.email)
    if not admin_record:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Geçersiz e-posta veya şifre")

    password_hash = data_access.get_admin_password_hash(admin_record)
    if not password_hash or not security.verify_password(payload.password, password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Geçersiz e-posta veya şifre")

    settings = get_settings()
    expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    token = security.create_access_token(
        subject=str(admin_record.get("id")),
        role=str(admin_record.get("role", "ADMIN")),
        expires_delta=expires_delta
    )

    admin_out = schemas.AdminOut.model_validate(admin_record)

    return schemas.AuthResponse(
        access_token=token,
        token_type="bearer",
        expires_in=int(expires_delta.total_seconds()),
        admin=admin_out
    )
