from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
from database import get_db
from models import Batch, InquiryForm, RuleVersion
from schemas import (
    BatchCreate, BatchResponse, BatchWithForms, InquiryFormCreate,
    ProcessingResult, QueryFilter, QueryResponse, BatchQueryFilter,
    RuleVersionResponse, RiskSummary
)
from noise_reduction import NoiseReductionEngine
from data_generator import generate_batch_data, generate_multiple_batches

router = APIRouter()

@router.post("/batch/process", response_model=ProcessingResult)
def process_batch(batch_data: BatchCreate, forms: List[InquiryFormCreate], db: Session = Depends(get_db)):
    engine = NoiseReductionEngine(db)
    engine.initialize_default_rules()
    
    active_rule = db.query(RuleVersion).filter(RuleVersion.is_active == True).first()
    
    batch = Batch(
        batch_no=batch_data.batch_no,
        operator=batch_data.operator,
        department=batch_data.department,
        rule_version_id=active_rule.id if active_rule else None,
        total_records=len(forms),
        valid_records=0,
        invalid_records=0,
        swallowed_records=0,
        status="processing",
        created_at=datetime.now()
    )
    db.add(batch)
    db.flush()
    
    valid_count = 0
    invalid_count = 0
    swallowed_count = 0
    risk_summary = {}
    
    start_time = datetime.now()
    
    for form_data in forms:
        result = engine.process_form(form_data)
        
        db_form = InquiryForm(
            batch_id=batch.id,
            **form_data.dict(),
            is_valid=result["is_valid"],
            risk_type=result["primary_risk_type"],
            risk_level=result["primary_risk_level"],
            risk_description=result["risk_description"],
            is_swallowed=result["is_swallowed"],
            swallow_reason=result["swallow_reason"],
            processing_result=result["processing_result"],
            processing_message=result["processing_message"],
            processed_at=datetime.now()
        )
        db.add(db_form)
        
        if result["is_swallowed"]:
            swallowed_count += 1
        elif result["is_valid"]:
            valid_count += 1
        else:
            invalid_count += 1
        
        if result["primary_risk_type"]:
            risk_type = result["primary_risk_type"]
            risk_summary[risk_type] = risk_summary.get(risk_type, 0) + 1
    
    batch.valid_records = valid_count
    batch.invalid_records = invalid_count
    batch.swallowed_records = swallowed_count
    batch.status = "completed"
    batch.completed_at = datetime.now()
    
    db.commit()
    
    processing_time = (datetime.now() - start_time).total_seconds()
    
    return {
        "batch_no": batch.batch_no,
        "total_processed": len(forms),
        "valid_count": valid_count,
        "invalid_count": invalid_count,
        "swallowed_count": swallowed_count,
        "risk_summary": risk_summary,
        "processing_time": processing_time
    }

@router.post("/batch/generate", response_model=ProcessingResult)
def generate_and_process_batch(
    batch_size: int = 20, 
    dirty_count: int = 3, 
    swallow_count: int = 1,
    db: Session = Depends(get_db)
):
    batch_data = generate_batch_data(batch_size, dirty_count, swallow_count)
    
    forms = [InquiryFormCreate(**f) for f in batch_data["forms"]]
    batch_create = BatchCreate(**batch_data["batch_info"])
    
    return process_batch(batch_create, forms, db)

@router.post("/records/query", response_model=QueryResponse)
def query_records(filters: QueryFilter, db: Session = Depends(get_db)):
    query = db.query(InquiryForm).join(Batch)
    
    if filters.batch_no:
        query = query.filter(Batch.batch_no == filters.batch_no)
    
    if filters.operator:
        query = query.filter(Batch.operator == filters.operator)
    
    if filters.risk_type:
        query = query.filter(InquiryForm.risk_type == filters.risk_type)
    
    if filters.department:
        query = query.filter(InquiryForm.department == filters.department)
    
    if filters.is_valid is not None:
        query = query.filter(InquiryForm.is_valid == filters.is_valid)
    
    if filters.is_swallowed is not None:
        query = query.filter(InquiryForm.is_swallowed == filters.is_swallowed)
    
    if filters.start_date:
        query = query.filter(InquiryForm.processed_at >= filters.start_date)
    
    if filters.end_date:
        query = query.filter(InquiryForm.processed_at <= filters.end_date)
    
    total = query.count()
    items = query.order_by(InquiryForm.processed_at.desc()).all()
    
    return {"total": total, "items": items}

@router.post("/batches/query", response_model=List[BatchResponse])
def query_batches(filters: BatchQueryFilter, db: Session = Depends(get_db)):
    query = db.query(Batch)
    
    if filters.batch_no:
        query = query.filter(Batch.batch_no.like(f"%{filters.batch_no}%"))
    
    if filters.operator:
        query = query.filter(Batch.operator == filters.operator)
    
    if filters.department:
        query = query.filter(Batch.department == filters.department)
    
    if filters.status:
        query = query.filter(Batch.status == filters.status)
    
    if filters.start_date:
        query = query.filter(Batch.created_at >= filters.start_date)
    
    if filters.end_date:
        query = query.filter(Batch.created_at <= filters.end_date)
    
    return query.order_by(Batch.created_at.desc()).all()

@router.get("/batch/{batch_no}", response_model=BatchWithForms)
def get_batch_detail(batch_no: str, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.batch_no == batch_no).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch

@router.get("/rules", response_model=List[RuleVersionResponse])
def get_all_rules(db: Session = Depends(get_db)):
    return db.query(RuleVersion).order_by(RuleVersion.version).all()

@router.post("/rules/{version}/activate")
def activate_rule_version(version: str, db: Session = Depends(get_db)):
    engine = NoiseReductionEngine(db)
    success = engine.set_active_rule_version(version)
    if not success:
        raise HTTPException(status_code=404, detail="规则版本不存在")
    return {"message": f"规则版本 {version} 已激活"}

@router.get("/summary/risk-types")
def get_risk_type_summary(db: Session = Depends(get_db)):
    results = db.query(
        InquiryForm.risk_type,
        InquiryForm.risk_level
    ).filter(
        InquiryForm.risk_type.isnot(None)
    ).all()
    
    summary = {}
    for risk_type, risk_level in results:
        if risk_type not in summary:
            summary[risk_type] = {"count": 0, "level": risk_level}
        summary[risk_type]["count"] += 1
    
    return [
        RiskSummary(risk_type=k, count=v["count"], level=v["level"])
        for k, v in summary.items()
    ]

@router.get("/summary/operators")
def get_operator_summary(db: Session = Depends(get_db)):
    results = db.query(
        Batch.operator,
        Batch.total_records,
        Batch.valid_records,
        Batch.invalid_records,
        Batch.swallowed_records
    ).all()
    
    summary = {}
    for operator, total, valid, invalid, swallowed in results:
        if operator not in summary:
            summary[operator] = {
                "total_batches": 0,
                "total_records": 0,
                "valid_records": 0,
                "invalid_records": 0,
                "swallowed_records": 0
            }
        summary[operator]["total_batches"] += 1
        summary[operator]["total_records"] += total
        summary[operator]["valid_records"] += valid
        summary[operator]["invalid_records"] += invalid
        summary[operator]["swallowed_records"] += swallowed
    
    return summary
