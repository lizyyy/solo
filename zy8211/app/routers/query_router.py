from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, date, timedelta
from typing import Optional, List
import json

from app.models import (
    get_db, DehydratorRun, ChemicalBatch, LabMoistureResult,
    ExceptionReview, ReviewRule, Shift
)
from app.schemas import (
    DehydratorRunResponse, ChemicalBatchResponse,
    LabMoistureResultResponse, ExceptionReviewResponse,
    ExceptionReviewResolve, ReviewRuleResponse
)

router = APIRouter(prefix="/query", tags=["查询接口"])


@router.get("/dehydrator-runs", response_model=List[DehydratorRunResponse])
def query_dehydrator_runs(
    start_date: Optional[date] = Query(None, description="开始日期"),
    end_date: Optional[date] = Query(None, description="结束日期"),
    shift: Optional[str] = Query(None, description="班次: morning/afternoon/night"),
    machine_id: Optional[str] = Query(None, description="脱水机编号"),
    batch_id: Optional[str] = Query(None, description="药剂批次ID"),
    has_exception: Optional[bool] = Query(None, description="是否有异常"),
    db: Session = Depends(get_db)
):
    query = db.query(DehydratorRun)
    
    if start_date:
        start_dt = datetime.combine(start_date, datetime.min.time())
        query = query.filter(DehydratorRun.shift_date >= start_dt)
    
    if end_date:
        end_dt = datetime.combine(end_date, datetime.max.time())
        query = query.filter(DehydratorRun.shift_date <= end_dt)
    
    if shift:
        query = query.filter(DehydratorRun.shift == shift)
    
    if machine_id:
        query = query.filter(DehydratorRun.machine_id.ilike(f"%{machine_id}%"))
    
    if batch_id:
        query = query.filter(DehydratorRun.batch_id == batch_id)
    
    if has_exception is not None:
        if has_exception:
            query = query.filter(
                DehydratorRun.reviews.any(
                    and_(
                        ExceptionReview.is_resolved == False,
                        ExceptionReview.exception_type != None
                    )
                )
            )
        else:
            query = query.filter(
                ~DehydratorRun.reviews.any(
                    and_(
                        ExceptionReview.is_resolved == False,
                        ExceptionReview.exception_type != None
                    )
                )
            )
    
    runs = query.order_by(DehydratorRun.start_time.desc()).all()
    return runs


@router.get("/dehydrator-runs/{run_id}", response_model=DehydratorRunResponse)
def get_dehydrator_run(
    run_id: str,
    db: Session = Depends(get_db)
):
    run = db.query(DehydratorRun).filter(DehydratorRun.run_id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail=f"运行记录 {run_id} 不存在")
    return run


@router.get("/chemical-batches", response_model=List[ChemicalBatchResponse])
def query_chemical_batches(
    start_date: Optional[date] = Query(None, description="开始日期"),
    end_date: Optional[date] = Query(None, description="结束日期"),
    chemical_type: Optional[str] = Query(None, description="药剂类型"),
    supplier: Optional[str] = Query(None, description="供应商"),
    is_active: Optional[bool] = Query(None, description="是否进行中"),
    db: Session = Depends(get_db)
):
    query = db.query(ChemicalBatch)
    
    if start_date:
        start_dt = datetime.combine(start_date, datetime.min.time())
        query = query.filter(ChemicalBatch.start_time >= start_dt)
    
    if end_date:
        end_dt = datetime.combine(end_date, datetime.max.time())
        query = query.filter(
            or_(
                ChemicalBatch.end_time == None,
                ChemicalBatch.end_time <= end_dt
            )
        )
    
    if chemical_type:
        query = query.filter(ChemicalBatch.chemical_type.ilike(f"%{chemical_type}%"))
    
    if supplier:
        query = query.filter(ChemicalBatch.supplier.ilike(f"%{supplier}%"))
    
    if is_active is not None:
        if is_active:
            query = query.filter(ChemicalBatch.end_time == None)
        else:
            query = query.filter(ChemicalBatch.end_time != None)
    
    batches = query.order_by(ChemicalBatch.start_time.desc()).all()
    return batches


@router.get("/chemical-batches/{batch_id}", response_model=ChemicalBatchResponse)
def get_chemical_batch(
    batch_id: str,
    db: Session = Depends(get_db)
):
    batch = db.query(ChemicalBatch).filter(ChemicalBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail=f"药剂批次 {batch_id} 不存在")
    return batch


@router.get("/lab-moisture", response_model=List[LabMoistureResultResponse])
def query_lab_moisture(
    start_date: Optional[date] = Query(None, description="开始日期"),
    end_date: Optional[date] = Query(None, description="结束日期"),
    run_id: Optional[str] = Query(None, description="运行记录ID"),
    batch_id: Optional[str] = Query(None, description="药剂批次ID"),
    moisture_above: Optional[float] = Query(None, description="含水率高于"),
    db: Session = Depends(get_db)
):
    query = db.query(LabMoistureResult)
    
    if start_date:
        start_dt = datetime.combine(start_date, datetime.min.time())
        query = query.filter(LabMoistureResult.sample_time >= start_dt)
    
    if end_date:
        end_dt = datetime.combine(end_date, datetime.max.time())
        query = query.filter(LabMoistureResult.sample_time <= end_dt)
    
    if run_id:
        query = query.filter(LabMoistureResult.run_id == run_id)
    
    if batch_id:
        query = query.filter(LabMoistureResult.batch_id == batch_id)
    
    if moisture_above is not None:
        query = query.filter(LabMoistureResult.moisture_content > moisture_above)
    
    results = query.order_by(LabMoistureResult.sample_time.desc()).all()
    return results


@router.get("/lab-moisture/{result_id}", response_model=LabMoistureResultResponse)
def get_lab_moisture(
    result_id: str,
    db: Session = Depends(get_db)
):
    result = db.query(LabMoistureResult).filter(LabMoistureResult.result_id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail=f"检测记录 {result_id} 不存在")
    return result


@router.get("/exceptions", response_model=List[ExceptionReviewResponse])
def query_exceptions(
    start_date: Optional[date] = Query(None, description="开始日期"),
    end_date: Optional[date] = Query(None, description="结束日期"),
    exception_type: Optional[str] = Query(None, description="异常类型"),
    is_resolved: Optional[bool] = Query(None, description="是否已处理"),
    run_id: Optional[str] = Query(None, description="运行记录ID"),
    db: Session = Depends(get_db)
):
    query = db.query(ExceptionReview)
    
    if start_date:
        start_dt = datetime.combine(start_date, datetime.min.time())
        query = query.filter(ExceptionReview.created_at >= start_dt)
    
    if end_date:
        end_dt = datetime.combine(end_date, datetime.max.time())
        query = query.filter(ExceptionReview.created_at <= end_dt)
    
    if exception_type:
        query = query.filter(ExceptionReview.exception_type == exception_type)
    
    if is_resolved is not None:
        query = query.filter(ExceptionReview.is_resolved == is_resolved)
    
    if run_id:
        query = query.filter(ExceptionReview.run_id == run_id)
    
    exceptions = query.order_by(ExceptionReview.created_at.desc()).all()
    return exceptions


@router.get("/exceptions/{review_id}", response_model=ExceptionReviewResponse)
def get_exception(
    review_id: str,
    db: Session = Depends(get_db)
):
    exception = db.query(ExceptionReview).filter(ExceptionReview.review_id == review_id).first()
    if not exception:
        raise HTTPException(status_code=404, detail=f"异常记录 {review_id} 不存在")
    return exception


@router.get("/review-rules", response_model=List[ReviewRuleResponse])
def query_review_rules(
    rule_type: Optional[str] = Query(None, description="规则类型"),
    is_enabled: Optional[bool] = Query(None, description="是否启用"),
    db: Session = Depends(get_db)
):
    query = db.query(ReviewRule)
    
    if rule_type:
        query = query.filter(ReviewRule.rule_type == rule_type)
    
    if is_enabled is not None:
        query = query.filter(ReviewRule.is_enabled == is_enabled)
    
    rules = query.order_by(ReviewRule.priority).all()
    return rules
