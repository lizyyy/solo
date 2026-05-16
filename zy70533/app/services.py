import hashlib
import json
from datetime import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from . import models, schemas
from .enums import FreezeStatus, ApprovalStatus, ExceptionType


def calculate_parameters_hash(parameters: Dict[str, Any]) -> str:
    sorted_params = json.dumps(parameters, sort_keys=True)
    return hashlib.sha256(sorted_params.encode('utf-8')).hexdigest()


def create_audit_log(
    db: Session,
    freeze_id: int,
    action: str,
    operator: str,
    previous_state: Optional[Dict] = None,
    new_state: Optional[Dict] = None,
    remarks: Optional[str] = None
):
    audit_log = models.AuditLog(
        freeze_id=freeze_id,
        action=action,
        previous_state=previous_state,
        new_state=new_state,
        operator=operator,
        remarks=remarks
    )
    db.add(audit_log)
    db.commit()
    return audit_log


def create_experiment_freeze(db: Session, freeze: schemas.ExperimentFreezeCreate):
    db_freeze = models.ExperimentFreeze(
        experiment_id=freeze.experiment_id,
        parameter_version=freeze.parameter_version,
        metric_window_start=freeze.metric_window_start,
        metric_window_end=freeze.metric_window_end,
        parameters=freeze.parameters,
        metrics_config=freeze.metrics_config,
        created_by=freeze.created_by,
        remarks=freeze.remarks
    )
    db.add(db_freeze)
    db.commit()
    db.refresh(db_freeze)
    
    param_hash = calculate_parameters_hash(freeze.parameters)
    snapshot = models.ParameterSnapshot(
        freeze_id=db_freeze.id,
        version=freeze.parameter_version,
        parameters=freeze.parameters,
        hash=param_hash,
        created_by=freeze.created_by
    )
    db.add(snapshot)
    db.commit()
    
    create_audit_log(
        db, db_freeze.id, "CREATE_FREEZE",
        freeze.created_by,
        new_state={"status": FreezeStatus.PENDING}
    )
    
    return db_freeze


def get_experiment_freeze(db: Session, freeze_id: int):
    return db.query(models.ExperimentFreeze).filter(models.ExperimentFreeze.id == freeze_id).first()


def get_experiment_freezes(db: Session, experiment_id: Optional[str] = None, skip: int = 0, limit: int = 100):
    query = db.query(models.ExperimentFreeze)
    if experiment_id:
        query = query.filter(models.ExperimentFreeze.experiment_id == experiment_id)
    return query.offset(skip).limit(limit).all()


def advance_freeze_status(db: Session, request: schemas.StatusAdvanceRequest):
    freeze = get_experiment_freeze(db, request.freeze_id)
    if not freeze:
        return None
    
    previous_status = freeze.status
    freeze.status = request.target_status
    freeze.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(freeze)
    
    create_audit_log(
        db, request.freeze_id, "STATUS_CHANGE",
        request.operator,
        previous_state={"status": previous_status},
        new_state={"status": request.target_status},
        remarks=request.remarks
    )
    
    return freeze


def create_change_request(db: Session, request: schemas.ChangeRequestCreate):
    freeze = get_experiment_freeze(db, request.freeze_id)
    if not freeze:
        return None
    
    param_hash = calculate_parameters_hash(freeze.parameters)
    
    if freeze.status in [FreezeStatus.CONFIRMED, FreezeStatus.BLOCKED]:
        change_request = models.ChangeRequest(
            freeze_id=request.freeze_id,
            change_type=request.change_type,
            original_parameters=freeze.parameters.copy(),
            proposed_parameters=request.proposed_parameters,
            reason=request.reason,
            requested_by=request.requested_by,
            is_blocked=True,
            block_reason=f"Experiment in {freeze.status} status, changes blocked"
        )
        db.add(change_request)
        db.commit()
        db.refresh(change_request)
        
        create_audit_log(
            db, request.freeze_id, "CHANGE_REQUEST_BLOCKED",
            request.requested_by,
            previous_state={"parameters_hash": param_hash},
            remarks=f"Blocked change: {request.reason}"
        )
        
        return change_request
    
    change_request = models.ChangeRequest(
        freeze_id=request.freeze_id,
        change_type=request.change_type,
        original_parameters=freeze.parameters.copy(),
        proposed_parameters=request.proposed_parameters,
        reason=request.reason,
        requested_by=request.requested_by
    )
    db.add(change_request)
    db.commit()
    db.refresh(change_request)
    
    create_audit_log(
        db, request.freeze_id, "CHANGE_REQUEST_CREATED",
        request.requested_by,
        new_state={"change_request_id": change_request.id}
    )
    
    return change_request


def approve_change_request(db: Session, request_id: int, approval: schemas.ChangeRequestApprove):
    change_request = db.query(models.ChangeRequest).filter(models.ChangeRequest.id == request_id).first()
    if not change_request:
        return None
    
    freeze = get_experiment_freeze(db, change_request.freeze_id)
    
    previous_state = {
        "approval_status": change_request.approval_status,
        "parameters_hash": calculate_parameters_hash(freeze.parameters) if freeze else None
    }
    
    change_request.approval_status = approval.approval_status
    change_request.approved_by = approval.approved_by
    change_request.approved_at = datetime.utcnow()
    change_request.approval_remarks = approval.approval_remarks
    
    if approval.approval_status == ApprovalStatus.APPROVED and freeze:
        old_hash = calculate_parameters_hash(freeze.parameters)
        freeze.parameters = change_request.proposed_parameters
        freeze.updated_at = datetime.utcnow()
        
        new_hash = calculate_parameters_hash(change_request.proposed_parameters)
        new_version = f"{freeze.parameter_version}_approved_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        snapshot = models.ParameterSnapshot(
            freeze_id=freeze.id,
            version=new_version,
            parameters=change_request.proposed_parameters,
            hash=new_hash,
            created_by=approval.approved_by
        )
        db.add(snapshot)
    
    db.commit()
    db.refresh(change_request)
    
    create_audit_log(
        db, change_request.freeze_id, "CHANGE_REQUEST_APPROVED",
        approval.approved_by,
        previous_state=previous_state,
        new_state={"approval_status": approval.approval_status},
        remarks=approval.approval_remarks
    )
    
    return change_request


def create_exception_record(db: Session, exception: schemas.ExceptionRecordCreate):
    db_exception = models.ExceptionRecord(
        freeze_id=exception.freeze_id,
        exception_type=exception.exception_type,
        error_code=exception.error_code,
        original_input=exception.original_input,
        processing_basis=exception.processing_basis,
        final_conclusion=exception.final_conclusion
    )
    db.add(db_exception)
    db.commit()
    db.refresh(db_exception)
    
    create_audit_log(
        db, exception.freeze_id, "EXCEPTION_OCCURRED",
        "system",
        previous_state={"exception_type": exception.exception_type},
        remarks=f"Error code: {exception.error_code}"
    )
    
    return db_exception


def resolve_exception_record(db: Session, exception_id: int, resolve: schemas.ExceptionRecordResolve):
    exception = db.query(models.ExceptionRecord).filter(models.ExceptionRecord.id == exception_id).first()
    if not exception:
        return None
    
    exception.is_resolved = True
    exception.resolved_at = datetime.utcnow()
    exception.resolved_by = resolve.resolved_by
    exception.resolution_details = resolve.resolution_details
    db.commit()
    db.refresh(exception)
    
    create_audit_log(
        db, exception.freeze_id, "EXCEPTION_RESOLVED",
        resolve.resolved_by,
        previous_state={"is_resolved": False},
        new_state={"is_resolved": True},
        remarks=resolve.resolution_details
    )
    
    return exception


def manual_correction(db: Session, correction: schemas.ManualCorrectionRequest):
    freeze = get_experiment_freeze(db, correction.freeze_id)
    if not freeze:
        return None
    
    old_hash = calculate_parameters_hash(freeze.parameters)
    previous_state = {
        "parameters": freeze.parameters,
        "parameters_hash": old_hash,
        "status": freeze.status
    }
    
    freeze.parameters = correction.corrected_parameters
    freeze.status = FreezeStatus.COMPENSATED
    freeze.updated_at = datetime.utcnow()
    
    new_hash = calculate_parameters_hash(correction.corrected_parameters)
    new_version = f"{freeze.parameter_version}_manual_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    
    snapshot = models.ParameterSnapshot(
        freeze_id=freeze.id,
        version=new_version,
        parameters=correction.corrected_parameters,
        hash=new_hash,
        created_by=correction.corrected_by
    )
    db.add(snapshot)
    db.commit()
    db.refresh(freeze)
    
    create_audit_log(
        db, correction.freeze_id, "MANUAL_CORRECTION",
        correction.corrected_by,
        previous_state=previous_state,
        new_state={
            "parameters": correction.corrected_parameters,
            "parameters_hash": new_hash,
            "status": FreezeStatus.COMPENSATED
        },
        remarks=correction.correction_reason
    )
    
    return freeze


def generate_freeze_report(db: Session, report: schemas.FreezeReportCreate):
    db_report = models.FreezeReport(
        freeze_id=report.freeze_id,
        report_type=report.report_type,
        content=report.content,
        generated_by=report.generated_by,
        file_format=report.file_format
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    
    create_audit_log(
        db, report.freeze_id, "REPORT_GENERATED",
        report.generated_by,
        new_state={"report_id": db_report.id, "report_type": report.report_type}
    )
    
    return db_report


def get_freeze_detail(db: Session, freeze_id: int):
    freeze = get_experiment_freeze(db, freeze_id)
    if not freeze:
        return None
    
    snapshots = db.query(models.ParameterSnapshot).filter(models.ParameterSnapshot.freeze_id == freeze_id).all()
    change_requests = db.query(models.ChangeRequest).filter(models.ChangeRequest.freeze_id == freeze_id).all()
    exceptions = db.query(models.ExceptionRecord).filter(models.ExceptionRecord.freeze_id == freeze_id).all()
    reports = db.query(models.FreezeReport).filter(models.FreezeReport.freeze_id == freeze_id).all()
    audit_logs = db.query(models.AuditLog).filter(models.AuditLog.freeze_id == freeze_id).all()
    
    return {
        "experiment_freeze": freeze,
        "parameter_snapshots": snapshots,
        "change_requests": change_requests,
        "exception_records": exceptions,
        "freeze_reports": reports,
        "audit_logs": audit_logs
    }
