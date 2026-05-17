from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from database import get_db
from models import Review, Device, Quote
from schemas import ReviewCreate, ReviewUpdate, ReviewResponse, ReviewStatus
from exceptions import (
    NotFoundException, InvalidStatusException,
    AlreadyProcessedException, ReviewRequiredException
)

router = APIRouter()

REVIEW_FLOW = {
    "pending": ["in_progress", "needs_manual"],
    "in_progress": ["approved", "rejected", "needs_manual"],
    "needs_manual": ["approved", "rejected"],
    "approved": [],
    "rejected": []
}


def can_transition(current_status: str, new_status: str) -> bool:
    return new_status in REVIEW_FLOW.get(current_status, [])


@router.post("/", response_model=ReviewResponse)
def create_review(review: ReviewCreate, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.id == review.device_id).first()
    if not device:
        raise NotFoundException("设备", review.device_id)

    quote = db.query(Quote).filter(Quote.id == review.quote_id).first()
    if not quote:
        raise NotFoundException("报价", review.quote_id)

    existing_review = db.query(Review).filter(
        Review.device_id == review.device_id,
        Review.quote_id == review.quote_id
    ).first()
    if existing_review:
        raise AlreadyProcessedException("该报价已有复核记录")

    db_review = Review(**review.dict())
    db.add(db_review)
    db.commit()
    db.refresh(db_review)

    response = ReviewResponse(
        id=db_review.id,
        device_id=db_review.device_id,
        quote_id=db_review.quote_id,
        serial_number=device.serial_number,
        status=db_review.status,
        reviewer=db_review.reviewer,
        review_notes=db_review.review_notes,
        resolution=db_review.resolution,
        reviewed_at=db_review.reviewed_at,
        created_at=db_review.created_at,
        updated_at=db_review.updated_at
    )
    return response


@router.patch("/{review_id}", response_model=ReviewResponse)
def update_review(
    review_id: int,
    review_update: ReviewUpdate,
    db: Session = Depends(get_db)
):
    db_review = db.query(Review).filter(Review.id == review_id).first()
    if not db_review:
        raise NotFoundException("复核记录", review_id)

    if db_review.status in ["approved", "rejected"]:
        raise AlreadyProcessedException("复核已完成，无法修改")

    if not can_transition(db_review.status, review_update.status):
        raise InvalidStatusException(
            db_review.status,
            f"可转换状态: {REVIEW_FLOW[db_review.status]}"
        )

    db_review.status = review_update.status
    if review_update.reviewer:
        db_review.reviewer = review_update.reviewer
    if review_update.review_notes:
        db_review.review_notes = review_update.review_notes
    if review_update.resolution:
        db_review.resolution = review_update.resolution

    if review_update.status in ["approved", "rejected"]:
        db_review.reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(db_review)

    device = db.query(Device).filter(Device.id == db_review.device_id).first()

    if review_update.status == "approved":
        device.status = "review_approved"
    elif review_update.status == "rejected":
        device.status = "review_rejected"
    elif review_update.status == "needs_manual":
        device.status = "needs_manual_review"
    db.commit()

    response = ReviewResponse(
        id=db_review.id,
        device_id=db_review.device_id,
        quote_id=db_review.quote_id,
        serial_number=device.serial_number,
        status=db_review.status,
        reviewer=db_review.reviewer,
        review_notes=db_review.review_notes,
        resolution=db_review.resolution,
        reviewed_at=db_review.reviewed_at,
        created_at=db_review.created_at,
        updated_at=db_review.updated_at
    )
    return response


@router.get("/", response_model=List[ReviewResponse])
def list_reviews(
    skip: int = 0,
    limit: int = 100,
    device_id: int = None,
    status: str = None,
    reviewer: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(Review)
    if device_id:
        query = query.filter(Review.device_id == device_id)
    if status:
        query = query.filter(Review.status == status)
    if reviewer:
        query = query.filter(Review.reviewer == reviewer)

    reviews = query.offset(skip).limit(limit).all()
    results = []
    for r in reviews:
        device = db.query(Device).filter(Device.id == r.device_id).first()
        results.append(ReviewResponse(
            id=r.id,
            device_id=r.device_id,
            quote_id=r.quote_id,
            serial_number=device.serial_number if device else "",
            status=r.status,
            reviewer=r.reviewer,
            review_notes=r.review_notes,
            resolution=r.resolution,
            reviewed_at=r.reviewed_at,
            created_at=r.created_at,
            updated_at=r.updated_at
        ))
    return results


@router.get("/{review_id}", response_model=ReviewResponse)
def get_review(review_id: int, db: Session = Depends(get_db)):
    db_review = db.query(Review).filter(Review.id == review_id).first()
    if not db_review:
        raise NotFoundException("复核记录", review_id)

    device = db.query(Device).filter(Device.id == db_review.device_id).first()

    response = ReviewResponse(
        id=db_review.id,
        device_id=db_review.device_id,
        quote_id=db_review.quote_id,
        serial_number=device.serial_number,
        status=db_review.status,
        reviewer=db_review.reviewer,
        review_notes=db_review.review_notes,
        resolution=db_review.resolution,
        reviewed_at=db_review.reviewed_at,
        created_at=db_review.created_at,
        updated_at=db_review.updated_at
    )
    return response


@router.post("/{review_id}/request-manual")
def request_manual_review(review_id: int, db: Session = Depends(get_db)):
    db_review = db.query(Review).filter(Review.id == review_id).first()
    if not db_review:
        raise NotFoundException("复核记录", review_id)

    if db_review.status == "needs_manual":
        raise AlreadyProcessedException("已申请人工复核")

    if not can_transition(db_review.status, "needs_manual"):
        raise InvalidStatusException(db_review.status, "needs_manual")

    db_review.status = "needs_manual"
    db.commit()

    raise ReviewRequiredException("需要人工复核")
