from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from .. import data_access, schemas

router = APIRouter()

_STATUS_MAP: Dict[str, str] = {
    "COZULDU": "RESOLVED",
    "KAPANDI": "RESOLVED",
    "ISLEMDE": "OPEN",
    "BEKLEMEDE": "OPEN",
    "ACIL": "OPEN",
}


def _normalize_status(raw: Optional[str]) -> str:
    if not raw:
        return "OPEN"
    candidate = raw.strip().upper()
    return _STATUS_MAP.get(candidate, "OPEN")


def _ensure_datetime(value: Optional[str]) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return datetime.now(timezone.utc)


def _transform_complaint(record: Dict[str, object]) -> schemas.ComplaintOut:
    user_id = str(record.get("citizenId") or record.get("user_id") or f"anonymous-{record.get('id')}")
    user_name = str(record.get("citizenName") or record.get("user_name") or "Bursa Vatandaşı")
    neighborhood = str(record.get("neighborhood") or record.get("address") or "")

    data = {
        "id": str(record.get("id")),
        "user_id": user_id,
        "user_name": user_name,
        "district": str(record.get("district") or "Bursa"),
        "neighborhood": neighborhood,
        "text": str(record.get("text") or ""),
        "category": str(record.get("category") or "DIGER"),
        "created_at": _ensure_datetime(record.get("createdAt") or record.get("created_at")),
        "status": _normalize_status(str(record.get("status") or "")),
        "likes": int(record.get("likes") or 0),
        "likedBy": list(record.get("likedBy") or []),
        "adminReply": record.get("adminReply"),
    }

    return schemas.ComplaintOut.model_validate(data)


def _group_counts(items: Iterable[schemas.ComplaintOut], attr: str) -> List[Dict[str, object]]:
    counts: Dict[str, int] = {}
    for item in items:
        key = getattr(item, attr)
        counts[key] = counts.get(key, 0) + 1
    return [{"name": key, "value": value} for key, value in counts.items()]


@router.get("/", response_model=List[schemas.ComplaintOut])
def list_complaints(district: Optional[str] = Query(default=None, description="Filtrelenecek ilçe")) -> List[schemas.ComplaintOut]:
    records = data_access.load_complaints()
    items = [_transform_complaint(rec) for rec in records]
    if district:
        items = [item for item in items if item.district.lower() == district.lower()]
    return items


@router.get("/summary", response_model=schemas.ComplaintSummary)
def complaint_summary() -> schemas.ComplaintSummary:
    records = data_access.load_complaints()
    items = [_transform_complaint(rec) for rec in records]

    return schemas.ComplaintSummary(
        total=len(items),
        by_category=_group_counts(items, "category"),
        by_status=_group_counts(items, "status"),
        last_updated=datetime.now(timezone.utc),
    )


@router.get("/{complaint_id}", response_model=schemas.ComplaintOut)
def get_complaint(complaint_id: str) -> schemas.ComplaintOut:
    records = data_access.load_complaints()
    for record in records:
        if str(record.get("id")) == complaint_id:
            return _transform_complaint(record)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Şikayet bulunamadı")
