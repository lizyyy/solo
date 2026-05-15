from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from database import get_db
from models import (
    Batch, GatewayErrorExtract, ReplayResult, RuleVersion,
    ReplayStatus, BatchStatus, ApprovalRecord
)
from schemas import (
    BatchCreate, Batch as BatchSchema, ReplayRequest, ReplayResponse,
    QueryRequest, QueryResponse, BatchDetailResponse, ReplayResultDetail,
    RuleVersionCreate, RuleVersion as RuleVersionSchema
)
from replay_engine import ReplayEngine

router = APIRouter(tags=["事件重放"])

@router.post("/batches", response_model=BatchSchema)
def create_batch(batch_data: BatchCreate, db: Session = Depends(get_db)):
    batch = Batch(
        batch_number=batch_data.batch_number,
        created_by=batch_data.created_by
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    
    for extract_data in batch_data.error_extracts:
        extract = GatewayErrorExtract(**extract_data.dict(), batch_id=batch.id)
        db.add(extract)
    
    db.commit()
    db.refresh(batch)
    
    return batch

@router.get("/batches", response_model=List[BatchSchema])
def list_batches(
    status: str = None,
    created_by: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Batch)
    
    if status:
        query = query.filter(Batch.status == status)
    if created_by:
        query = query.filter(Batch.created_by == created_by)
    
    return query.order_by(Batch.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/batches/{batch_id}", response_model=BatchDetailResponse)
def get_batch_detail(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    rule_version = None
    if batch.rule_version_id:
        rule_version = db.query(RuleVersion).filter(RuleVersion.id == batch.rule_version_id).first()
    
    success_items = db.query(ReplayResult).filter(
        ReplayResult.batch_id == batch_id,
        ReplayResult.replay_status == ReplayStatus.SUCCESS
    ).all()
    
    failed_items = db.query(ReplayResult).filter(
        ReplayResult.batch_id == batch_id,
        ReplayResult.replay_status == ReplayStatus.FAILED
    ).all()
    
    blocked_items = db.query(ReplayResult).filter(
        ReplayResult.batch_id == batch_id,
        ReplayResult.replay_status == ReplayStatus.BLOCKED
    ).all()
    
    approval_records = db.query(ApprovalRecord).filter(
        ApprovalRecord.batch_id == batch_id
    ).all()
    
    success_items_with_detail = []
    for item in success_items:
        item.error_extract = db.query(GatewayErrorExtract).filter(
            GatewayErrorExtract.id == item.error_extract_id
        ).first()
        success_items_with_detail.append(item)
    
    failed_items_with_detail = []
    for item in failed_items:
        item.error_extract = db.query(GatewayErrorExtract).filter(
            GatewayErrorExtract.id == item.error_extract_id
        ).first()
        failed_items_with_detail.append(item)
    
    blocked_items_with_detail = []
    for item in blocked_items:
        item.error_extract = db.query(GatewayErrorExtract).filter(
            GatewayErrorExtract.id == item.error_extract_id
        ).first()
        blocked_items_with_detail.append(item)
    
    return BatchDetailResponse(
        batch=batch,
        rule_version=rule_version,
        success_items=success_items_with_detail,
        failed_items=failed_items_with_detail,
        blocked_items=blocked_items_with_detail,
        approval_records=approval_records
    )

@router.post("/replay", response_model=ReplayResponse)
def execute_replay(request: ReplayRequest, db: Session = Depends(get_db)):
    engine = ReplayEngine(db)
    try:
        batch = engine.replay_batch(request.batch_id, request.rule_version_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return ReplayResponse(
        batch_id=batch.id,
        status=batch.status,
        total_count=batch.total_count,
        success_count=batch.success_count,
        failed_count=batch.failed_count,
        blocked_count=batch.blocked_count,
        execution_time_ms=batch.execution_time_ms
    )

@router.post("/query", response_model=QueryResponse)
def query_results(request: QueryRequest, db: Session = Depends(get_db)):
    query = db.query(ReplayResult).join(GatewayErrorExtract)
    
    if request.batch_id:
        query = query.filter(ReplayResult.batch_id == request.batch_id)
    if request.status:
        query = query.filter(
            (ReplayResult.replay_status == request.status) | 
            (ReplayResult.approval_status == request.status)
        )
    if request.trace_id:
        query = query.filter(GatewayErrorExtract.trace_id == request.trace_id)
    if request.error_code:
        query = query.filter(GatewayErrorExtract.error_code == request.error_code)
    
    total = query.count()
    
    offset = (request.page - 1) * request.page_size
    results = query.offset(offset).limit(request.page_size).all()
    
    for result in results:
        result.error_extract = db.query(GatewayErrorExtract).filter(
            GatewayErrorExtract.id == result.error_extract_id
        ).first()
    
    return QueryResponse(
        total=total,
        page=request.page,
        page_size=request.page_size,
        items=results
    )

@router.get("/results/{result_id}", response_model=ReplayResultDetail)
def get_replay_result(result_id: int, db: Session = Depends(get_db)):
    result = db.query(ReplayResult).filter(ReplayResult.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="重放结果不存在")
    
    result.error_extract = db.query(GatewayErrorExtract).filter(
        GatewayErrorExtract.id == result.error_extract_id
    ).first()
    
    return result

@router.post("/rule-versions", response_model=RuleVersionSchema)
def create_rule_version(rule_data: RuleVersionCreate, db: Session = Depends(get_db)):
    existing = db.query(RuleVersion).filter(RuleVersion.version == rule_data.version).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"规则版本 {rule_data.version} 已存在")
    
    db.query(RuleVersion).filter(RuleVersion.is_active == True).update(
        {RuleVersion.is_active: False, RuleVersion.effective_to: func.now()}
    )
    
    rule_version = RuleVersion(**rule_data.dict(), is_active=True)
    db.add(rule_version)
    db.commit()
    db.refresh(rule_version)
    
    return rule_version

@router.get("/rule-versions", response_model=List[RuleVersionSchema])
def list_rule_versions(
    is_active: bool = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(RuleVersion)
    
    if is_active is not None:
        query = query.filter(RuleVersion.is_active == is_active)
    
    return query.order_by(RuleVersion.effective_from.desc()).offset(skip).limit(limit).all()
