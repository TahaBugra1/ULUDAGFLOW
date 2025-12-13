from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class AdminOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    department: Optional[str] = None
    phone: Optional[str] = None
    permissions: Optional[List[str]] = None
    districts: Optional[List[str]] = None
    createdAt: Optional[datetime] = Field(default=None, alias="createdAt")

    class Config:
        populate_by_name = True


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    admin: AdminOut


class TokenPayload(BaseModel):
    sub: str
    role: Optional[str]
    exp: int


class ComplaintOut(BaseModel):
    id: str
    user_id: str
    user_name: str
    district: str
    neighborhood: str
    text: str
    category: str
    created_at: datetime
    status: Literal["OPEN", "RESOLVED"]
    likes: int = 0
    likedBy: List[str] = Field(default_factory=list)
    adminReply: Optional[str] = None

    class Config:
        populate_by_name = True


class ComplaintSummary(BaseModel):
    total: int
    by_category: List[dict]
    by_status: List[dict]
    last_updated: datetime
