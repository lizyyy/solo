from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models.models import ReviewStatus
from ..schemas.schemas import (
    ReviewRequestCreate,
    ReviewRequestResponse,
    ReviewApproveRequest
)
from ..services import StateMachineService, ReviewService

router = APIRouter(prefix="/api/reviews", tags=["审核管理"])

state_machine = StateMachineService()
review_service = ReviewService(state_machine)


@router.post("", response_model=ReviewRequestResponse, summary="提交审核请求")
def create_review(data: ReviewRequestCreate, db: Session = Depends(get_db)):
    try:
        review = review_service.create_review_request(db, data)
        db.commit()
        db.refresh(review)
        return review
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/process", response_model=ReviewRequestResponse, summary="处理审核请求（通过/驳回）")
def process_review(data: ReviewApproveRequest, db: Session = Depends(get_db)):
    try:
        review = review_service.process_review(db, data)
        db.commit()
        db.refresh(review)
        return review
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[ReviewRequestResponse], summary="获取审核请求列表")
def list_reviews(
    rule_id: Optional[int] = None,
    status: Optional[ReviewStatus] = None,
    reviewer: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    return review_service.list_reviews(
        db=db,
        rule_id=rule_id,
        status=status,
        reviewer=reviewer,
        limit=limit,
        offset=offset
    )


@router.get("/{review_id}", response_model=ReviewRequestResponse, summary="获取审核请求详情")
def get_review(review_id: int, db: Session = Depends(get_db)):
    review = review_service.get_review(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="审核请求不存在")
    return review


@router.get("/summary/pending-count", summary="获取待审核数量")
def get_pending_count(db: Session = Depends(get_db)):
    return {
        "pending_reviews": review_service.get_pending_reviews_count(db),
        "message": "请及时处理待审核的规则"
    }
