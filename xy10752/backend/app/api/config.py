from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
from models import SLARule, PauseReason, Holiday
from schemas import SLARuleCreate, SLARuleResponse, PauseReasonCreate, PauseReasonResponse, HolidayCreate, HolidayResponse

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("/sla-rules", response_model=List[SLARuleResponse])
def get_sla_rules(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(SLARule).offset(skip).limit(limit).all()


@router.post("/sla-rules", response_model=SLARuleResponse)
def create_sla_rule(rule_data: SLARuleCreate, db: Session = Depends(get_db)):
    rule = SLARule(**rule_data.dict())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.put("/sla-rules/{rule_id}", response_model=SLARuleResponse)
def update_sla_rule(rule_id: int, rule_data: SLARuleCreate, db: Session = Depends(get_db)):
    rule = db.query(SLARule).filter(SLARule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="SLA规则不存在")

    for field, value in rule_data.dict().items():
        setattr(rule, field, value)

    db.commit()
    db.refresh(rule)
    return rule


@router.get("/pause-reasons", response_model=List[PauseReasonResponse])
def get_pause_reasons(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(PauseReason).filter(PauseReason.is_active == True).offset(skip).limit(limit).all()


@router.post("/pause-reasons", response_model=PauseReasonResponse)
def create_pause_reason(reason_data: PauseReasonCreate, db: Session = Depends(get_db)):
    existing = db.query(PauseReason).filter(PauseReason.code == reason_data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="原因代码已存在")

    reason = PauseReason(**reason_data.dict())
    db.add(reason)
    db.commit()
    db.refresh(reason)
    return reason


@router.delete("/pause-reasons/{reason_id}")
def delete_pause_reason(reason_id: int, db: Session = Depends(get_db)):
    reason = db.query(PauseReason).filter(PauseReason.id == reason_id).first()
    if not reason:
        raise HTTPException(status_code=404, detail="暂停原因不存在")

    reason.is_active = False
    db.commit()
    return {"message": "已删除"}


@router.get("/holidays", response_model=List[HolidayResponse])
def get_holidays(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Holiday).offset(skip).limit(limit).all()


@router.post("/holidays", response_model=HolidayResponse)
def create_holiday(holiday_data: HolidayCreate, db: Session = Depends(get_db)):
    existing = db.query(Holiday).filter(Holiday.date == holiday_data.date).first()
    if existing:
        raise HTTPException(status_code=400, detail="该日期已存在")

    holiday = Holiday(**holiday_data.dict())
    db.add(holiday)
    db.commit()
    db.refresh(holiday)
    return holiday


@router.delete("/holidays/{holiday_id}")
def delete_holiday(holiday_id: int, db: Session = Depends(get_db)):
    holiday = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="节假日不存在")

    db.delete(holiday)
    db.commit()
    return {"message": "已删除"}
