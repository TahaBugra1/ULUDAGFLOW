from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from .config import get_settings


def _load_json(path: Path) -> Any:
    if not path.exists():
        raise FileNotFoundError(f"Veri dosyası bulunamadı: {path}")
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_admin_records() -> List[Dict[str, Any]]:
    settings = get_settings()
    records = _load_json(settings.admin_records_path)
    if not isinstance(records, list):
        raise ValueError("Admin kayıt formatı geçersiz.")
    return records


def load_admin_credentials() -> Dict[str, Dict[str, Any]]:
    settings = get_settings()
    credentials = _load_json(settings.admin_credentials_path)
    if not isinstance(credentials, dict):
        raise ValueError("Admin kimlik dosyası geçersiz.")
    return credentials


def load_complaints() -> List[Dict[str, Any]]:
    settings = get_settings()
    data = _load_json(settings.complaints_path)
    if not isinstance(data, list):
        raise ValueError("Şikayet veri formatı list olmalıdır.")
    return data


def save_complaints(items: List[Dict[str, Any]]) -> None:
    settings = get_settings()
    with settings.complaints_path.open("w", encoding="utf-8") as handle:
        json.dump(items, handle, ensure_ascii=False, indent=2)


def _iter_credentials(credentials: Dict[str, Dict[str, Any]]) -> Iterable[Dict[str, Any]]:
    for item in credentials.values():
        if isinstance(item, dict):
            yield item


def find_admin_by_email(email: str) -> Optional[Dict[str, Any]]:
    email_lower = email.strip().lower()
    for record in load_admin_records():
        if str(record.get("email", "")).lower() == email_lower:
            return record
    return None


def find_admin_by_id(admin_id: str) -> Optional[Dict[str, Any]]:
    for record in load_admin_records():
        if str(record.get("id")) == admin_id:
            return record
    return None


def get_admin_password_hash(admin_record: Dict[str, Any]) -> Optional[str]:
    credentials = load_admin_credentials()
    admin_id = admin_record.get("id")
    if admin_id and admin_id in credentials:
        record = credentials[admin_id]
        password = record.get("password")
        return password or record.get("password_hash")

    admin_email = str(admin_record.get("email", "")).lower()
    for entry in _iter_credentials(credentials):
        if str(entry.get("email", "")).lower() == admin_email:
            password = entry.get("password")
            return password or entry.get("password_hash")
    return None
