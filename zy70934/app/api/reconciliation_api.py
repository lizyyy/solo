from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.services.auto_check_engine import AutoCheckEngine
from app.services.review_service import ReviewService, RecalculateService
from app.models.models import ReconciliationResult, ReconciliationDetail, ReviewRecord
from app.schemas.schemas import (
    ReconciliationResultResponse, ReconciliationDetailResponse,
    ReviewRecordCreate, ReviewRecordResponse, RecalculateResult,
    ReconciliationSummary
)

router = APIRouter(prefix="/api/reconciliation", tags=["对账管理"])


@router.post("/auto-check/{project_id}", response_model=ReconciliationResultResponse)
def run_auto_check(project_id: int, db: Session = Depends(get_db)):
    engine = AutoCheckEngine(db)
    try:
        result = engine.run_auto_reconciliation(project_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"自动对账失败: {str(e)}")


@router.get("/results", response_model=List[ReconciliationResultResponse])
def list_results(db: Session = Depends(get_db)):
    results = db.query(ReconciliationResult).order_by(
        ReconciliationResult.created_at.desc()
    ).all()
    return results


@router.get("/results/{result_id}", response_model=ReconciliationResultResponse)
def get_result(result_id: int, db: Session = Depends(get_db)):
    result = db.query(ReconciliationResult).filter(
        ReconciliationResult.id == result_id
    ).first()
    if not result:
        raise HTTPException(status_code=404, detail="对账结果不存在")
    return result


@router.get("/results/{result_id}/details", response_model=List[ReconciliationDetailResponse])
def get_result_details(result_id: int, db: Session = Depends(get_db)):
    details = db.query(ReconciliationDetail).filter(
        ReconciliationDetail.reconciliation_result_id == result_id
    ).all()
    return details


@router.get("/details/{detail_id}", response_model=ReconciliationDetailResponse)
def get_detail(detail_id: int, db: Session = Depends(get_db)):
    detail = db.query(ReconciliationDetail).filter(
        ReconciliationDetail.id == detail_id
    ).first()
    if not detail:
        raise HTTPException(status_code=404, detail="对账明细不存在")
    return detail


@router.get("/results/{result_id}/summary", response_model=ReconciliationSummary)
def get_result_summary(result_id: int, db: Session = Depends(get_db)):
    service = RecalculateService(db)
    try:
        return service.get_summary(result_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/review", response_model=ReviewRecordResponse)
def add_review(review: ReviewRecordCreate, db: Session = Depends(get_db)):
    service = ReviewService(db)
    try:
        result = service.add_review(review)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"复核失败: {str(e)}")


@router.post("/recalculate/{result_id}", response_model=RecalculateResult)
def recalculate_result(result_id: int, db: Session = Depends(get_db)):
    service = RecalculateService(db)
    try:
        return service.recalculate_result(result_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/details/{detail_id}/reviews", response_model=List[ReviewRecordResponse])
def get_detail_reviews(detail_id: int, db: Session = Depends(get_db)):
    reviews = db.query(ReviewRecord).filter(
        ReviewRecord.reconciliation_detail_id == detail_id
    ).order_by(ReviewRecord.review_time.desc()).all()
    return reviews
