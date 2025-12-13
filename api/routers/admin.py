from __future__ import annotations

from fastapi import APIRouter, Depends

from .. import dependencies, schemas

router = APIRouter()


@router.get("/me", response_model=schemas.AdminOut)
def read_current_admin(current_admin: schemas.AdminOut = Depends(dependencies.get_current_admin)) -> schemas.AdminOut:
    return current_admin
