from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from database import get_db
from models import (
    UploadResponse,
    ReportResponse,
    TraceDetailResponse,
    BatchResponse,
    FollowupReminderResponse,
    FollowupRuleCreate,
    FollowupRuleResponse,
)
from services import DataProcessor
from models import FollowupRule

router = APIRouter(prefix="/api/v1", tags=["followup"])


@router.post("/upload/purchase", response_model=UploadResponse)
async def upload_purchase_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="请上传CSV格式文件")

    content = await file.read()
    processor = DataProcessor(db)

    try:
        result = processor.process_purchase_csv(content, file.filename)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/upload/customers", response_model=UploadResponse)
async def upload_customers_json(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="请上传JSON格式文件")

    content = await file.read()
    processor = DataProcessor(db)

    try:
        result = processor.process_customers_json(content, file.filename)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/upload/rules", response_model=UploadResponse)
async def upload_rules_json(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="请上传JSON格式文件")

    content = await file.read()
    processor = DataProcessor(db)

    try:
        result = processor.process_rules_json(content, file.filename)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/rules", response_model=FollowupRuleResponse)
def create_rule(rule: FollowupRuleCreate, db: Session = Depends(get_db)):
    existing = db.query(FollowupRule).filter(FollowupRule.rule_id == rule.rule_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"规则ID {rule.rule_id} 已存在")

    db_rule = FollowupRule(**rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.get("/rules", response_model=List[FollowupRuleResponse])
def list_rules(db: Session = Depends(get_db)):
    rules = db.query(FollowupRule).all()
    return rules


@router.post("/report/generate", response_model=ReportResponse)
def generate_report(
    batch_no: Optional[str] = Query(None, description="批次号"),
    db: Session = Depends(get_db),
):
    processor = DataProcessor(db)
    report = processor.generate_followup_report(batch_no)
    return report


@router.get("/trace/{trace_id}", response_model=TraceDetailResponse)
def get_trace_detail(trace_id: str, db: Session = Depends(get_db)):
    processor = DataProcessor(db)
    detail = processor.get_trace_detail(trace_id)
    if not detail.get("reminder") and not detail.get("processed_record"):
        raise HTTPException(status_code=404, detail="未找到该追踪ID的相关记录")
    return detail


@router.get("/reminders", response_model=List[FollowupReminderResponse])
def list_reminders(
    customer_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    from models import FollowupReminder

    query = db.query(FollowupReminder)
    if customer_id:
        query = query.filter(FollowupReminder.customer_id == customer_id)
    if status:
        query = query.filter(FollowupReminder.status == status)

    return query.order_by(FollowupReminder.created_at.desc()).all()


@router.get("/batches", response_model=List[BatchResponse])
def list_batches(db: Session = Depends(get_db)):
    from models import Batch

    batches = db.query(Batch).order_by(Batch.processed_at.desc()).all()
    return batches


@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "pharmacy-followup-api",
    }
