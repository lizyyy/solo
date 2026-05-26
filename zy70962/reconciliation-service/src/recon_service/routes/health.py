"""健康检查."""
from __future__ import annotations

from fastapi import APIRouter


router = APIRouter()


@router.get("")
def ping() -> dict:
    return {"status": "ok", "service": "reconciliation-service"}
