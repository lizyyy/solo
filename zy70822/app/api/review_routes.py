from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional

from app.models import get_db, ReviewAction
from app.services import ReviewService

router = APIRouter()


class ReviewRequest(BaseModel):
    action: ReviewAction
    reviewer: str
    review_notes: Optional[str] = None
    decision_reason: Optional[str] = None


class BatchReviewRequest(BaseModel):
    record_ids: List[str]
    action: ReviewAction
    reviewer: str
    batch_notes: Optional[str] = None


@router.post("/{record_id}", response_model=Dict[str, Any])
async def review_record(
    record_id: str,
    request: ReviewRequest,
    db: Session = Depends(get_db)
):
    """人工复核单条记录"""
    try:
        service = ReviewService(db)
        result = service.review_record(
            record_id=record_id,
            action=request.action,
            reviewer=request.reviewer,
            review_notes=request.review_notes,
            decision_reason=request.decision_reason
        )
        
        return {
            "success": True,
            "message": f"记录 {record_id} 复核完成",
            "data": result
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch", response_model=Dict[str, Any])
async def batch_review(
    request: BatchReviewRequest,
    db: Session = Depends(get_db)
):
    """批量复核记录"""
    try:
        service = ReviewService(db)
        result = service.batch_review(
            record_ids=request.record_ids,
            action=request.action,
            reviewer=request.reviewer,
            batch_notes=request.batch_notes
        )
        
        return {
            "success": True,
            "message": f"批量复核完成，成功处理 {result['processed_count']} 条，失败 {result['error_count']} 条",
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
