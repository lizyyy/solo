from typing import Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.models import (
    TraceabilityCode, Batch, InspectionReport, CodeBatchBinding, ScanLog,
    ExceptionRecord, PendingTask, BackgroundJob, BindingStatus,
    CodeStatus, ExceptionType, TaskType, TaskStatus
)


def scan_code(db: Session, code_value: str,
              scanner_ip: Optional[str] = None,
              scanner_user_agent: Optional[str] = None) -> dict:
    code = db.query(TraceabilityCode).filter(
        TraceabilityCode.code == code_value
    ).first()

    result = {
        "code": code_value,
        "code_status": "not_found",
        "batch": None,
        "reports": [],
        "scanned_at": datetime.utcnow()
    }

    scan_result_status = "not_found"

    if code:
        result["code_status"] = code.status
        scan_result_status = code.status

        binding = db.query(CodeBatchBinding).filter(
            CodeBatchBinding.code_id == code.id,
            CodeBatchBinding.status == BindingStatus.ACTIVE
        ).first()

        if binding:
            batch = db.query(Batch).filter(Batch.id == binding.batch_id).first()
            if batch:
                result["batch"] = {
                    "id": batch.id,
                    "batch_number": batch.batch_number,
                    "cooperative_id": batch.cooperative_id,
                    "farmer_id": batch.farmer_id,
                    "product_name": batch.product_name,
                    "harvest_date": batch.harvest_date,
                    "quantity": batch.quantity,
                    "unit": batch.unit,
                    "created_at": batch.created_at
                }

                reports = db.query(InspectionReport).filter(
                    InspectionReport.batch_id == batch.id
                ).all()
                result["reports"] = [{
                    "id": r.id,
                    "report_number": r.report_number,
                    "batch_id": r.batch_id,
                    "inspector": r.inspector,
                    "inspection_date": r.inspection_date,
                    "result": r.result,
                    "details": r.details,
                    "created_at": r.created_at
                } for r in reports]

    scan_log = ScanLog(
        code_id=code.id if code else None,
        code_value=code_value,
        scanner_ip=scanner_ip,
        scanner_user_agent=scanner_user_agent,
        scan_result=scan_result_status,
        scanned_at=result["scanned_at"]
    )
    db.add(scan_log)
    db.commit()

    return result


def get_scan_logs(db: Session, skip: int = 0, limit: int = 100,
                  code_value: Optional[str] = None):
    query = db.query(ScanLog)
    if code_value:
        query = query.filter(ScanLog.code_value == code_value)
    total = query.with_entities(func.count(ScanLog.id)).scalar()
    logs = query.order_by(ScanLog.scanned_at.desc()).offset(skip).limit(limit).all()
    return logs, total


def get_exceptions(db: Session, skip: int = 0, limit: int = 100,
                   resolved: Optional[bool] = None):
    query = db.query(ExceptionRecord)
    if resolved is not None:
        query = query.filter(ExceptionRecord.resolved == resolved)
    total = query.with_entities(func.count(ExceptionRecord.id)).scalar()
    records = query.order_by(ExceptionRecord.created_at.desc()).offset(skip).limit(limit).all()
    return records, total


def resolve_exception(db: Session, exception_id: int,
                      resolved_by: str) -> Optional[ExceptionRecord]:
    record = db.query(ExceptionRecord).filter(
        ExceptionRecord.id == exception_id
    ).first()
    if record:
        record.resolved = True
        record.resolved_at = datetime.utcnow()
        record.resolved_by = resolved_by
        db.commit()
        db.refresh(record)
    return record


def get_pending_tasks(db: Session, skip: int = 0, limit: int = 100,
                      completed: bool = False):
    query = db.query(PendingTask).filter(PendingTask.completed == completed)
    total = query.with_entities(func.count(PendingTask.id)).scalar()
    tasks = query.order_by(PendingTask.created_at.desc()).offset(skip).limit(limit).all()
    return tasks, total


def complete_task(db: Session, task_id: int) -> Optional[PendingTask]:
    task = db.query(PendingTask).filter(PendingTask.id == task_id).first()
    if task:
        task.completed = True
        task.completed_at = datetime.utcnow()
        db.commit()
        db.refresh(task)
    return task


def get_background_jobs(db: Session, skip: int = 0, limit: int = 100,
                        status: Optional[str] = None):
    query = db.query(BackgroundJob)
    if status:
        query = query.filter(BackgroundJob.status == status)
    total = query.with_entities(func.count(BackgroundJob.id)).scalar()
    jobs = query.order_by(BackgroundJob.created_at.desc()).offset(skip).limit(limit).all()
    return jobs, total


def get_anticounterfeiting_report(db: Session) -> dict:
    return {
        "total_codes": db.query(func.count(TraceabilityCode.id)).scalar(),
        "available_codes": db.query(func.count(TraceabilityCode.id)).filter(
            TraceabilityCode.status == CodeStatus.AVAILABLE
        ).scalar(),
        "issued_codes": db.query(func.count(TraceabilityCode.id)).filter(
            TraceabilityCode.status == CodeStatus.ISSUED
        ).scalar(),
        "bound_codes": db.query(func.count(TraceabilityCode.id)).filter(
            TraceabilityCode.status == CodeStatus.BOUND
        ).scalar(),
        "recycled_codes": db.query(func.count(TraceabilityCode.id)).filter(
            TraceabilityCode.status == CodeStatus.RECYCLED
        ).scalar(),
        "invalid_codes": db.query(func.count(TraceabilityCode.id)).filter(
            TraceabilityCode.status == CodeStatus.INVALID
        ).scalar(),
        "total_batches": db.query(func.count(Batch.id)).scalar(),
        "total_reports": db.query(func.count(InspectionReport.id)).scalar(),
        "total_scans": db.query(func.count(ScanLog.id)).scalar(),
        "pending_tasks": db.query(func.count(PendingTask.id)).filter(
            PendingTask.completed == False
        ).scalar(),
        "unresolved_exceptions": db.query(func.count(ExceptionRecord.id)).filter(
            ExceptionRecord.resolved == False
        ).scalar(),
    }
