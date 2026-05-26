"""复核路由：对差异进行放行/退回/要求补材料，可覆盖金额。"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..models import ReviewAction
from ..services.deps import repo
from ..services.review import ReviewService


router = APIRouter()


class ReviewPayload(BaseModel):
    action: ReviewAction
    note: str = ""
    reviewer: str = Field(..., min_length=1)
    override_deposit: Optional[float] = None
    override_sales_cash: Optional[float] = None


@router.post("/batches/{batch_id}/discrepancies/{discrepancy_id}")
def review_discrepancy(
    batch_id: UUID,
    discrepancy_id: UUID,
    payload: ReviewPayload,
) -> dict:
    try:
        batch = ReviewService(repo).apply_review(
            batch_id=batch_id,
            discrepancy_id=discrepancy_id,
            action=payload.action,
            note=payload.note,
            reviewer=payload.reviewer,
            override_deposit=payload.override_deposit,
            override_sales_cash=payload.override_sales_cash,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"ok": True, "status": batch.status.value, "discrepancy_count": len(batch.discrepancies)}
