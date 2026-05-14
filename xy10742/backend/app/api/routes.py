from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from app.models.database import get_db
from app.models.schemas import (
    SliceRule, SliceRuleCreate,
    QualityRecord, QualityRecordCreate, QualityRecordWithApprovals,
    ApprovalRecord, ApprovalRecordCreate, Statistics
)
from app.services import quality_service

router = APIRouter()

@router.get("/rules", response_model=List[SliceRule])
def get_slice_rules(db: Session = Depends(get_db)):
    return quality_service.get_slice_rules(db)

@router.post("/rules", response_model=SliceRule)
def create_slice_rule(rule: SliceRuleCreate, db: Session = Depends(get_db)):
    return quality_service.create_slice_rule(db, rule)

@router.put("/rules/{rule_id}", response_model=SliceRule)
def update_slice_rule(rule_id: int, rule: SliceRuleCreate, db: Session = Depends(get_db)):
    updated = quality_service.update_slice_rule(db, rule_id, rule)
    if not updated:
        raise HTTPException(status_code=404, detail="Rule not found")
    return updated

@router.get("/records", response_model=List[QualityRecord])
def get_quality_records(status: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return quality_service.get_quality_records(db, skip, limit, status)

@router.get("/records/{record_id}", response_model=QualityRecordWithApprovals)
def get_quality_record(record_id: int, db: Session = Depends(get_db)):
    record = quality_service.get_quality_record(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    approvals = quality_service.get_approvals_by_record(db, record_id)
    result = record.__dict__
    result["approvals"] = approvals
    return result

@router.post("/records", response_model=QualityRecord)
def create_quality_record(record: QualityRecordCreate, db: Session = Depends(get_db)):
    return quality_service.create_quality_record(db, record)

@router.post("/records/{record_id}/recalculate", response_model=QualityRecord)
def recalculate_record(record_id: int, db: Session = Depends(get_db)):
    record = quality_service.recalculate_record(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record

@router.post("/approvals", response_model=ApprovalRecord)
def create_approval(approval: ApprovalRecordCreate, db: Session = Depends(get_db)):
    return quality_service.create_approval(db, approval)

@router.get("/statistics", response_model=Statistics)
def get_statistics(db: Session = Depends(get_db)):
    return quality_service.get_statistics(db)

@router.get("/export")
def export_records(db: Session = Depends(get_db)):
    output = quality_service.export_to_excel(db)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=quality_check_list.xlsx"}
    )
