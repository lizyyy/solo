from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import DeferralApplication, DeferralStatus
from ..schemas import (
    DeferralApplicationCreate, DeferralApplicationSubmit,
    DeferralApplicationReview, DeferralApplicationCancel,
    DeferralApplicationOut
)
from ..services import DeferralApplicationService

router = APIRouter(prefix="/applications", tags=["缓考申请"])


@router.post("/", response_model=DeferralApplicationOut)
def create_application(
    data: DeferralApplicationCreate,
    db: Session = Depends(get_db)
):
    try:
        application = DeferralApplicationService.create_application(db, data)
        db.commit()
        db.refresh(application)
        return application
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/submit", response_model=DeferralApplicationOut)
def submit_application(
    data: DeferralApplicationSubmit,
    db: Session = Depends(get_db)
):
    try:
        application = DeferralApplicationService.submit_application(
            db, data.application_id
        )
        db.commit()
        db.refresh(application)
        return application
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/review", response_model=DeferralApplicationOut)
def review_application(
    data: DeferralApplicationReview,
    db: Session = Depends(get_db)
):
    try:
        application = DeferralApplicationService.review_application(
            db,
            application_id=data.application_id,
            approved=data.approved,
            review_comment=data.review_comment,
            reviewer_id=data.reviewer_id
        )
        db.commit()
        db.refresh(application)
        return application
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cancel", response_model=DeferralApplicationOut)
def cancel_application(
    data: DeferralApplicationCancel,
    db: Session = Depends(get_db)
):
    try:
        application = DeferralApplicationService.cancel_application(
            db,
            application_id=data.application_id,
            reason=data.reason
        )
        db.commit()
        db.refresh(application)
        return application
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[DeferralApplicationOut])
def list_applications(
    status: str = None,
    student_id: int = None,
    db: Session = Depends(get_db)
):
    query = db.query(DeferralApplication)
    if status:
        query = query.filter(DeferralApplication.status == status)
    if student_id:
        query = query.filter(DeferralApplication.student_id == student_id)
    return query.order_by(DeferralApplication.created_at.desc()).all()


@router.get("/{application_id}", response_model=DeferralApplicationOut)
def get_application(
    application_id: int,
    db: Session = Depends(get_db)
):
    application = db.query(DeferralApplication).filter(
        DeferralApplication.id == application_id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="申请不存在")
    return application
