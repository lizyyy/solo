from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.review import ReviewCreate, ReviewUpdate, ReviewResponse
from app.services.review_service import ReviewService

router = APIRouter(prefix="/api/v1/reviews", tags=["裁判复核"])


@router.post("/", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review(review_data: ReviewCreate, db: AsyncSession = Depends(get_db)):
    """创建复核记录"""
    service = ReviewService(db)
    review = await service.create_review(review_data)
    if not review:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="创建复核失败")
    await db.commit()
    return review


@router.get("/", response_model=List[ReviewResponse])
async def list_reviews(
    appeal_id: Optional[int] = None,
    result_version_id: Optional[int] = None,
    status: Optional[str] = None,
    reviewer_id: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """列出复核记录"""
    service = ReviewService(db)
    reviews = await service.list_reviews(
        appeal_id=appeal_id,
        result_version_id=result_version_id,
        status=status,
        reviewer_id=reviewer_id,
        limit=limit,
        offset=offset,
    )
    return reviews


@router.get("/{review_id}", response_model=ReviewResponse)
async def get_review(review_id: int, db: AsyncSession = Depends(get_db)):
    """获取复核记录"""
    service = ReviewService(db)
    review = await service.get_review(review_id)
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="复核不存在")
    return review


@router.put("/{review_id}", response_model=ReviewResponse)
async def update_review(
    review_id: int,
    update_data: ReviewUpdate,
    db: AsyncSession = Depends(get_db),
):
    """更新复核记录"""
    service = ReviewService(db)
    review = await service.update_review(review_id, update_data)
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="复核不存在")
    await db.commit()
    return review


@router.post("/{review_id}/submit", response_model=ReviewResponse)
async def submit_review(review_id: int, db: AsyncSession = Depends(get_db)):
    """提交复核记录"""
    service = ReviewService(db)
    review = await service.submit_review(review_id)
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="复核不存在")
    await db.commit()
    return review


@router.post("/{review_id}/approve", response_model=ReviewResponse)
async def approve_review(
    review_id: int,
    approved_by: str = Query(..., description="审批人"),
    db: AsyncSession = Depends(get_db),
):
    """批准复核记录"""
    service = ReviewService(db)
    review = await service.approve_review(review_id, approved_by)
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="复核不存在")
    await db.commit()
    return review


@router.post("/{review_id}/reject", response_model=ReviewResponse)
async def reject_review(
    review_id: int,
    rejected_by: str = Query(..., description="拒绝人"),
    reason: str = Query(..., description="拒绝原因"),
    db: AsyncSession = Depends(get_db),
):
    """拒绝复核记录"""
    service = ReviewService(db)
    review = await service.reject_review(review_id, rejected_by, reason)
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="复核不存在")
    await db.commit()
    return review


@router.get("/drafts", response_model=List[ReviewResponse])
async def list_draft_reviews(
    reviewer_id: Optional[str] = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """获取草稿复核记录"""
    service = ReviewService(db)
    reviews = await service.list_draft_reviews(reviewer_id=reviewer_id, limit=limit)
    return reviews
