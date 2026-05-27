from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.review import (
    review_reconciliation,
    batch_review,
)
from app.services.calculator import recalculate_summaries
from app.schemas import ReviewRequest, RecalculateRequest

router = APIRouter(prefix="/api/review", tags=["复核"])


@router.post("/records/{rec_id}", summary="单条复核：放行/退回/要求补材料")
async def review_record(
    rec_id: int,
    req: ReviewRequest,
    db: Session = Depends(get_db),
):
    result = review_reconciliation(
        db, rec_id, req.action, req.comment, req.operator, req.final_amount
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "复核失败"))
    return result


@router.post("/batch", summary="批量复核")
async def review_batch(
    rec_ids: list[int],
    req: ReviewRequest,
    db: Session = Depends(get_db),
):
    result = batch_review(db, rec_ids, req.action, req.comment, req.operator)
    return result


@router.post("/recalculate", summary="重新计算汇总数据（复核改动后调用）")
async def recalculate(
    req: RecalculateRequest,
    db: Session = Depends(get_db),
):
    result = recalculate_summaries(db, req.batch_nos)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "重算失败"))
    return result
