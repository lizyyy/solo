from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.lock_audit import LockStatus, ExecutionPhase, ReleaseReason
from app.schemas.lock_audit import (
    LockAuditCreate, LockAuditResponse, LockAuditDetailResponse,
    RenewHistoryResponse, PhaseHistoryResponse, FailureRecordResponse,
    ManualCorrectionResponse, RenewRequest, PhaseUpdateRequest,
    FailureRecordRequest, ManualCorrectionRequest, LockReleaseRequest,
    LockAuditQuery, ExportRequest, SelfCheckResponse, SelfCheckResult,
    PaginatedResponse
)
from app.crud.lock_audit import (
    create_lock_audit, get_lock_audit, get_lock_audit_by_lock_key,
    list_lock_audits, renew_lock, update_phase, record_failure,
    manual_correction, release_lock, get_renew_history, get_phase_history,
    get_failure_records, get_manual_corrections, export_audits,
    run_self_check, check_timeout_locks
)
import csv
from io import StringIO
from fastapi.responses import StreamingResponse, JSONResponse

router = APIRouter(prefix="/api/lock-audit", tags=["锁续约审计"])


@router.post("/", response_model=LockAuditResponse, status_code=status.HTTP_201_CREATED)
def create_audit(audit_in: LockAuditCreate, db: Session = Depends(get_db)):
    existing = get_lock_audit_by_lock_key(db, audit_in.lock_key)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"锁 {audit_in.lock_key} 已有活跃的审计记录"
        )
    return create_lock_audit(db, audit_in)


@router.get("/{audit_id}", response_model=LockAuditDetailResponse)
def get_audit(audit_id: int, db: Session = Depends(get_db)):
    audit = get_lock_audit(db, audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail="审计记录不存在")
    
    renew_count = len(get_renew_history(db, audit_id))
    phase_count = len(get_phase_history(db, audit_id))
    failure_count = len(get_failure_records(db, audit_id))
    
    return {
        **audit.__dict__,
        "renew_history_count": renew_count,
        "phase_history_count": phase_count,
        "failure_record_count": failure_count
    }


@router.post("/query", response_model=PaginatedResponse)
def query_audits(query: LockAuditQuery, db: Session = Depends(get_db)):
    items, total = list_lock_audits(db, query)
    return {
        "total": total,
        "page": query.page,
        "page_size": query.page_size,
        "items": items
    }


@router.post("/{audit_id}/renew", response_model=LockAuditResponse)
def renew_lock_audit(audit_id: int, renew_in: RenewRequest, db: Session = Depends(get_db)):
    audit, success, message = renew_lock(db, audit_id, renew_in)
    if not audit:
        raise HTTPException(status_code=404, detail="审计记录不存在")
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return audit


@router.post("/{audit_id}/phase", response_model=LockAuditResponse)
def update_execution_phase(audit_id: int, phase_in: PhaseUpdateRequest, db: Session = Depends(get_db)):
    audit = update_phase(db, audit_id, phase_in)
    if not audit:
        raise HTTPException(status_code=404, detail="审计记录不存在")
    return audit


@router.post("/{audit_id}/failure", response_model=FailureRecordResponse)
def record_failure_event(audit_id: int, failure_in: FailureRecordRequest, db: Session = Depends(get_db)):
    failure = record_failure(db, audit_id, failure_in)
    if not failure:
        raise HTTPException(status_code=404, detail="审计记录不存在")
    return failure


@router.post("/{audit_id}/correct", response_model=LockAuditResponse)
def manual_correct(audit_id: int, correction_in: ManualCorrectionRequest, db: Session = Depends(get_db)):
    audit = manual_correction(db, audit_id, correction_in)
    if not audit:
        raise HTTPException(status_code=404, detail="审计记录不存在")
    return audit


@router.post("/{audit_id}/release", response_model=LockAuditResponse)
def release_lock_audit(audit_id: int, release_in: LockReleaseRequest, db: Session = Depends(get_db)):
    audit = release_lock(db, audit_id, release_in)
    if not audit:
        raise HTTPException(status_code=404, detail="审计记录不存在")
    return audit


@router.get("/{audit_id}/renew-history", response_model=List[RenewHistoryResponse])
def get_renew_history_list(audit_id: int, db: Session = Depends(get_db)):
    audit = get_lock_audit(db, audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail="审计记录不存在")
    return get_renew_history(db, audit_id)


@router.get("/{audit_id}/phase-history", response_model=List[PhaseHistoryResponse])
def get_phase_history_list(audit_id: int, db: Session = Depends(get_db)):
    audit = get_lock_audit(db, audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail="审计记录不存在")
    return get_phase_history(db, audit_id)


@router.get("/{audit_id}/failures", response_model=List[FailureRecordResponse])
def get_failure_records_list(audit_id: int, db: Session = Depends(get_db)):
    audit = get_lock_audit(db, audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail="审计记录不存在")
    return get_failure_records(db, audit_id)


@router.get("/{audit_id}/corrections", response_model=List[ManualCorrectionResponse])
def get_manual_corrections_list(audit_id: int, db: Session = Depends(get_db)):
    audit = get_lock_audit(db, audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail="审计记录不存在")
    return get_manual_corrections(db, audit_id)


@router.post("/export")
def export_audit_data(export_in: ExportRequest, db: Session = Depends(get_db)):
    data = export_audits(db, export_in)
    
    if export_in.export_format == "csv":
        if not data:
            return StreamingResponse(StringIO(""), media_type="text/csv", 
                                     headers={"Content-Disposition": "attachment; filename=lock_audits.csv"})
        
        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=lock_audits.csv"}
        )
    else:
        return JSONResponse(content=data)


@router.get("/self-check/run", response_model=SelfCheckResponse)
def run_system_check(db: Session = Depends(get_db)):
    check_results = run_self_check(db)
    checks = [SelfCheckResult(**result) for result in check_results]
    all_passed = all(check.passed for check in checks)
    
    return SelfCheckResponse(
        overall_passed=all_passed,
        checks=checks,
        checked_at=datetime.now()
    )


@router.post("/maintenance/clean-timeout")
def cleanup_timeout_locks(db: Session = Depends(get_db)):
    cleaned = check_timeout_locks(db)
    return {"cleaned_count": cleaned, "message": f"已清理 {cleaned} 个超时锁"}


@router.get("/lock-key/{lock_key}", response_model=LockAuditResponse)
def get_audit_by_lock_key(lock_key: str, db: Session = Depends(get_db)):
    audit = get_lock_audit_by_lock_key(db, lock_key)
    if not audit:
        raise HTTPException(status_code=404, detail="未找到该锁的活跃审计记录")
    return audit


@router.get("/enums/status")
def get_status_enum():
    return {s.name: s.value for s in LockStatus}


@router.get("/enums/phase")
def get_phase_enum():
    return {p.name: p.value for p in ExecutionPhase}


@router.get("/enums/release-reason")
def get_release_reason_enum():
    return {r.name: r.value for r in ReleaseReason}
