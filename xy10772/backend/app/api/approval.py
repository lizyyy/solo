from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models import ApprovalRecord, GrayRule, GrayStatus, ApprovalStatus
from app.schemas import ApprovalRecordCreate, ApprovalRecordResponse
from datetime import datetime

router = APIRouter()

@router.get("/records", response_model=List[ApprovalRecordResponse])
def get_approval_records(gray_rule_id: int = None, status: str = None, db: Session = Depends(get_db)):
    query = db.query(ApprovalRecord)
    if gray_rule_id:
        query = query.filter(ApprovalRecord.gray_rule_id == gray_rule_id)
    if status:
        query = query.filter(ApprovalRecord.status == status)
    return query.order_by(ApprovalRecord.created_at.desc()).all()

@router.post("/records", response_model=ApprovalRecordResponse)
def create_approval_record(record: ApprovalRecordCreate, db: Session = Depends(get_db)):
    db_record = ApprovalRecord(**record.dict())
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record

@router.post("/records/{record_id}/approve")
def approve_gray_rule(record_id: int, comment: str = None, db: Session = Depends(get_db)):
    record = db.query(ApprovalRecord).filter(ApprovalRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="审批记录不存在")
    
    record.status = ApprovalStatus.APPROVED
    record.comment = comment
    record.approved_at = datetime.utcnow()
    
    gray_rule = db.query(GrayRule).filter(GrayRule.id == record.gray_rule_id).first()
    if gray_rule:
        gray_rule.status = GrayStatus.APPROVED
        gray_rule.approved_by = record.approver
        gray_rule.approved_at = datetime.utcnow()
    
    db.commit()
    return {"message": "审批通过", "record_id": record_id}

@router.post("/records/{record_id}/reject")
def reject_gray_rule(record_id: int, comment: str, db: Session = Depends(get_db)):
    record = db.query(ApprovalRecord).filter(ApprovalRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="审批记录不存在")
    
    record.status = ApprovalStatus.REJECTED
    record.comment = comment
    record.approved_at = datetime.utcnow()
    
    gray_rule = db.query(GrayRule).filter(GrayRule.id == record.gray_rule_id).first()
    if gray_rule:
        gray_rule.status = GrayStatus.DRAFT
    
    db.commit()
    return {"message": "审批拒绝", "record_id": record_id}

@router.post("/manual-review")
def manual_review(rule_id: int, decision: str, reviewer: str, comment: str = None, db: Session = Depends(get_db)):
    rule = db.query(GrayRule).filter(GrayRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="灰度规则不存在")
    
    if decision == "approve":
        rule.status = GrayStatus.APPROVED
        rule.approved_by = reviewer
        rule.approved_at = datetime.utcnow()
    elif decision == "reject":
        rule.status = GrayStatus.DRAFT
    elif decision == "block":
        rule.status = GrayStatus.BLOCKED
        rule.completed_at = datetime.utcnow()
    
    approval = ApprovalRecord(
        gray_rule_id=rule_id,
        approver=reviewer,
        status=ApprovalStatus.APPROVED if decision == "approve" else ApprovalStatus.REJECTED,
        comment=comment,
        approved_at=datetime.utcnow()
    )
    db.add(approval)
    db.commit()
    
    return {"message": "人工复核完成", "rule_id": rule_id, "decision": decision}
