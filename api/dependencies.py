from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from . import data_access, schemas, security

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_admin(token: str = Depends(oauth2_scheme)) -> schemas.AdminOut:
    try:
        payload = security.decode_access_token(token)
    except security.TokenValidationError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    admin_id = payload.get("sub")
    if not admin_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token geçersiz.")

    admin_record = data_access.find_admin_by_id(admin_id)
    if not admin_record:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Yönetici bulunamadı.")

    return schemas.AdminOut.model_validate(admin_record)
