from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..schemas import (
    RollbackCandidateCreate, RollbackCandidateResponse,
    RollbackApproval, RollbackExecuteRequest, RollbackExecutionResponse,
    NightlyInspectionCreate, NightlyInspectionResponse,
    FinancialCloseCreate, FinancialCloseResponse,
    FinancialConfirmRequest, RollbackComparisonResponse
)
from ..services import (
    BusinessRuleError,
    create_rollback_candidate, approve_rollback_candidate,
    execute_rollback, get_rollback_comparison,
    filter_rollback_candidates, cleanup_pending_candidates,
    create_nightly_inspection, get_grayscale_inspections,
    create_financial_close, manually_confirm_financial_close,
    approve_financial_close
)
from ..models import RollbackCandidate, RollbackExecution, FinancialCloseApproval

router = APIRouter(prefix="/api/rollback", tags=["配置回滚审批"])


@router.post("/candidates", response_model=RollbackCandidateResponse, status_code=201)
def create_candidate(data: RollbackCandidateCreate, db: Session = Depends(get_db)):
    candidate = create_rollback_candidate(db, data.dict(exclude_none=True))
    return candidate


@router.get("/candidates", response_model=List[RollbackCandidateResponse])
def list_candidates(
    candidate_type: Optional[str] = None,
    status: Optional[str] = None,
    summary_keyword: Optional[str] = None,
    is_urgent: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    return filter_rollback_candidates(db, candidate_type, status, summary_keyword, is_urgent)


@router.get("/candidates/{candidate_id}", response_model=RollbackCandidateResponse)
def get_candidate(candidate_id: int, db: Session = Depends(get_db)):
    candidate = db.query(RollbackCandidate).filter(
        RollbackCandidate.id == candidate_id
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="回滚候选不存在")
    return candidate


@router.post("/candidates/{candidate_id}/approve", response_model=RollbackCandidateResponse)
def approve_candidate(candidate_id: int, data: RollbackApproval, db: Session = Depends(get_db)):
    try:
        return approve_rollback_candidate(
            db, candidate_id, data.approver,
            data.approval_remark, data.is_approved
        )
    except BusinessRuleError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/candidates/{candidate_id}/execute", response_model=RollbackExecutionResponse)
def execute_candidate(candidate_id: int, data: RollbackExecuteRequest, db: Session = Depends(get_db)):
    try:
        return execute_rollback(db, candidate_id, data.executor)
    except BusinessRuleError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.get("/candidates/{candidate_id}/comparison", response_model=RollbackComparisonResponse)
def get_comparison(candidate_id: int, db: Session = Depends(get_db)):
    try:
        return get_rollback_comparison(db, candidate_id)
    except BusinessRuleError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/candidates/cleanup")
def cleanup_candidates(older_than_days: int = 7, db: Session = Depends(get_db)):
    count = cleanup_pending_candidates(db, older_than_days)
    return {
        "message": f"已清理 {count} 个过期的待审批回滚候选",
        "cleaned_count": count
    }


@router.get("/executions", response_model=List[RollbackExecutionResponse])
def list_executions(candidate_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(RollbackExecution)
    if candidate_id:
        query = query.filter(RollbackExecution.candidate_id == candidate_id)
    return query.order_by(RollbackExecution.created_at.desc()).all()


@router.post("/nightly-inspections", response_model=NightlyInspectionResponse, status_code=201)
def create_inspection(data: NightlyInspectionCreate, db: Session = Depends(get_db)):
    return create_nightly_inspection(db, data.dict(exclude_none=True))


@router.get("/nightly-inspections/grayscale", response_model=List[NightlyInspectionResponse])
def list_grayscale_inspections(region: Optional[str] = None, db: Session = Depends(get_db)):
    return get_grayscale_inspections(db, region)


@router.get("/nightly-inspections/{inspection_id}", response_model=NightlyInspectionResponse)
def get_inspection(inspection_id: int, db: Session = Depends(get_db)):
    from ..models import NightlyInspection
    inspection = db.query(NightlyInspection).filter(
        NightlyInspection.id == inspection_id
    ).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="夜间巡检不存在")
    return inspection


@router.post("/financial-close", response_model=FinancialCloseResponse, status_code=201)
def create_financial_close_record(data: FinancialCloseCreate, db: Session = Depends(get_db)):
    return create_financial_close(db, data.dict(exclude_none=True))


@router.get("/financial-close", response_model=List[FinancialCloseResponse])
def list_financial_close(
    close_period: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(FinancialCloseApproval)
    if close_period:
        query = query.filter(FinancialCloseApproval.close_period == close_period)
    if status:
        query = query.filter(FinancialCloseApproval.status == status)
    return query.order_by(FinancialCloseApproval.created_at.desc()).all()


@router.post("/financial-close/{close_id}/approve", response_model=FinancialCloseResponse)
def approve_financial_close_record(close_id: int, data: RollbackApproval, db: Session = Depends(get_db)):
    try:
        return approve_financial_close(
            db, close_id, data.approver,
            data.approval_remark, data.is_approved
        )
    except BusinessRuleError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/financial-close/{close_id}/confirm", response_model=FinancialCloseResponse)
def confirm_financial_close(close_id: int, data: FinancialConfirmRequest, db: Session = Depends(get_db)):
    try:
        return manually_confirm_financial_close(
            db, close_id, data.confirmed_by, data.confirm_remark
        )
    except BusinessRuleError as e:
        raise HTTPException(status_code=400, detail=e.message)
