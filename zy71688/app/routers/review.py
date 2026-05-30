from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import (
    Appeal, AppealStatus, Review, ChangeHistory, Flag, FlagType,
    Deduction, Processing,
)
from app.schemas import ReviewIn, ReviewOut, ChangeHistoryOut, AppealOut

router = APIRouter(prefix="/review", tags=["复核"])


class ManualCorrection(BaseModel):
    field_name: str
    new_value: str
    reason: Optional[str] = None


@router.post("/appeals/{appeal_id}", response_model=ReviewOut)
def submit_review(appeal_id: int, data: ReviewIn, db: Session = Depends(get_db)):
    appeal = db.query(Appeal).filter(Appeal.id == appeal_id).first()
    if not appeal:
        raise HTTPException(status_code=404, detail="申诉记录不存在")

    if appeal.status not in (AppealStatus.REVIEW, AppealStatus.RETURNED):
        raise HTTPException(status_code=400, detail=f"当前状态{appeal.status.value}不可复核")

    existing = db.query(Review).filter(Review.appeal_id == appeal_id).first()
    if existing:
        for field, new_val in data.model_dump(exclude_unset=True).items():
            setattr(existing, field, new_val)
        existing.reviewed_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        review = existing
    else:
        review = Review(appeal_id=appeal_id, **data.model_dump())
        db.add(review)

    if data.result == "approved":
        appeal.status = AppealStatus.APPROVED
    elif data.result == "rejected":
        appeal.status = AppealStatus.REJECTED
    elif data.result == "returned":
        appeal.status = AppealStatus.RETURNED
    else:
        appeal.status = AppealStatus.REVIEW

    appeal.reviewer = data.reviewed_by
    db.commit()
    db.refresh(review)
    return review


@router.post("/appeals/{appeal_id}/corrections", response_model=ChangeHistoryOut)
def manual_correction(
    appeal_id: int, correction: ManualCorrection, changed_by: Optional[str] = None, db: Session = Depends(get_db)
):
    appeal = db.query(Appeal).filter(Appeal.id == appeal_id).first()
    if not appeal:
        raise HTTPException(status_code=404, detail="申诉记录不存在")

    field = correction.field_name
    new_val = correction.new_value

    if hasattr(appeal, field):
        old_val = getattr(appeal, field)
        setattr(appeal, field, new_val)
    elif field.startswith("deduction."):
        parts = field.split(".", 2)
        if len(parts) == 3:
            try:
                ded_id = int(parts[1])
                ded = db.query(Deduction).filter(Deduction.id == ded_id, Deduction.appeal_id == appeal_id).first()
                if ded and hasattr(ded, parts[2]):
                    old_val = getattr(ded, parts[2])
                    setattr(ded, parts[2], new_val)
                else:
                    raise HTTPException(status_code=400, detail=f"无效字段: {field}")
            except ValueError:
                raise HTTPException(status_code=400, detail=f"无效扣款ID: {field}")
        else:
            raise HTTPException(status_code=400, detail=f"无效字段格式: {field}")
    elif field.startswith("processing."):
        parts = field.split(".", 2)
        if len(parts) == 2:
            proc = db.query(Processing).filter(Processing.appeal_id == appeal_id).first()
            if proc and hasattr(proc, parts[1]):
                old_val = getattr(proc, parts[1])
                setattr(proc, parts[1], new_val)
            else:
                raise HTTPException(status_code=400, detail=f"无效字段: {field}")
        else:
            raise HTTPException(status_code=400, detail=f"无效字段格式: {field}")
    else:
        raise HTTPException(status_code=400, detail=f"不支持的字段: {field}")

    old_val_str = str(old_val) if old_val is not None else None

    change = ChangeHistory(
        appeal_id=appeal_id,
        field_name=field,
        old_value=old_val_str,
        new_value=new_val,
        changed_by=changed_by,
        reason=correction.reason or "人工修正",
    )
    db.add(change)

    flag = Flag(
        appeal_id=appeal_id,
        flag_type=FlagType.DATA_INCONSISTENCY,
        detail=f"复核阶段人工修正: {field} 从 '{old_val_str}' 改为 '{new_val}'",
    )
    db.add(flag)

    db.commit()
    db.refresh(change)
    return change


@router.get("/appeals/{appeal_id}/history", response_model=list[ChangeHistoryOut])
def get_change_history(appeal_id: int, db: Session = Depends(get_db)):
    return db.query(ChangeHistory).filter(
        ChangeHistory.appeal_id == appeal_id
    ).order_by(ChangeHistory.changed_at.desc()).all()


@router.get("/appeals/{appeal_id}", response_model=AppealOut)
def get_review_detail(appeal_id: int, db: Session = Depends(get_db)):
    appeal = db.query(Appeal).filter(Appeal.id == appeal_id).first()
    if not appeal:
        raise HTTPException(status_code=404, detail="申诉记录不存在")
    return appeal
