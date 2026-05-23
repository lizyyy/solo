from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from schemas import ReviewCreate, ReviewUpdate, ReviewResponse
from services import create_review, update_review_status, log_exception, get_device_by_serial
from models import Review

router = APIRouter()


@router.post("/", response_model=ReviewResponse)
def create_new_review(review: ReviewCreate, db: Session = Depends(get_db)):
    try:
        return create_review(db, review)
    except ValueError as e:
        log_exception(db, review.serial_number, "/reviews/", review.model_dump(), str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log_exception(db, review.serial_number, "/reviews/", review.model_dump(), str(e))
        raise HTTPException(status_code=500, detail="服务器内部错误")


@router.put("/{review_id}", response_model=ReviewResponse)
def update_review(review_id: int, review_update: ReviewUpdate, db: Session = Depends(get_db)):
    try:
        return update_review_status(db, review_id, review_update.status, review_update.comments)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[ReviewResponse])
def list_reviews(serial_number: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(Review)
    if serial_number:
        device = get_device_by_serial(db, serial_number)
        if device:
            query = query.filter(Review.device_id == device.id)
    return query.offset(skip).limit(limit).all()
