"""批次路由：创建、列表、详情、删除。"""
from __future__ import annotations

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..models import Batch, BatchStatus
from ..services.deps import repo


router = APIRouter()


class BatchCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    period_start: Optional[date] = None
    period_end: Optional[date] = None


class BatchBrief(BaseModel):
    id: UUID
    name: str
    status: BatchStatus
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    created_at: str
    deposit_count: int
    sales_count: int
    petty_count: int
    discrepancy_count: int


def _brief(b: Batch) -> BatchBrief:
    return BatchBrief(
        id=b.id,
        name=b.name,
        status=b.status,
        period_start=b.period_start,
        period_end=b.period_end,
        created_at=b.created_at.isoformat(),
        deposit_count=len(b.deposits),
        sales_count=len(b.sales),
        petty_count=len(b.petty_cash),
        discrepancy_count=len(b.discrepancies),
    )


@router.post("", response_model=BatchBrief)
def create_batch(payload: BatchCreate) -> BatchBrief:
    batch = Batch(**payload.model_dump())
    repo.save(batch)
    return _brief(batch)


@router.get("", response_model=list[BatchBrief])
def list_batches() -> list[BatchBrief]:
    return [_brief(b) for b in repo.list()]


@router.get("/{batch_id}")
def get_batch(batch_id: UUID) -> dict:
    b = repo.get(batch_id)
    if b is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    return b.model_dump(mode="json")


@router.delete("/{batch_id}")
def delete_batch(batch_id: UUID) -> dict:
    if not repo.delete(batch_id):
        raise HTTPException(status_code=404, detail="批次不存在")
    return {"ok": True}
