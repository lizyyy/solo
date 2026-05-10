from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.models import (
    Batch, TraceabilityCode, CodeBatchBinding, InspectionReport,
    CodeStatus, BindingStatus, ExceptionType
)
from app.schemas.schemas import BatchCreate, InspectionReportCreate
from app.services.common import log_exception, create_pending_task, TaskType


def create_batch(db: Session, batch_data: BatchCreate) -> Batch:
    batch = Batch(
        batch_number=batch_data.batch_number,
        cooperative_id=batch_data.cooperative_id,
        farmer_id=batch_data.farmer_id,
        product_name=batch_data.product_name,
        harvest_date=batch_data.harvest_date,
        quantity=batch_data.quantity,
        unit=batch_data.unit
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


def get_batches(db: Session, skip: int = 0, limit: int = 100,
                cooperative_id: Optional[str] = None,
                farmer_id: Optional[str] = None) -> Tuple[List[Batch], int]:
    query = db.query(Batch)
    if cooperative_id:
        query = query.filter(Batch.cooperative_id == cooperative_id)
    if farmer_id:
        query = query.filter(Batch.farmer_id == farmer_id)
    total = query.with_entities(func.count(Batch.id)).scalar()
    batches = query.order_by(Batch.created_at.desc()).offset(skip).limit(limit).all()
    return batches, total


def get_batch_by_id(db: Session, batch_id: int) -> Optional[Batch]:
    return db.query(Batch).filter(Batch.id == batch_id).first()


def get_batch_by_number(db: Session, batch_number: str) -> Optional[Batch]:
    return db.query(Batch).filter(Batch.batch_number == batch_number).first()


def bind_codes_to_batch(db: Session, codes: List[str], batch_id: int) -> Tuple[List[CodeBatchBinding], List[str]]:
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        log_exception(
            db, ExceptionType.INVALID_BATCH, "bind_codes_to_batch",
            f"Batch not found: {batch_id}",
            {"batch_id": batch_id, "codes": codes}
        )
        return [], codes

    bindings = []
    invalid = []
    for code_value in codes:
        code = db.query(TraceabilityCode).filter(
            TraceabilityCode.code == code_value
        ).first()
        if not code:
            invalid.append(code_value)
            log_exception(
                db, ExceptionType.INVALID_CODE, "bind_codes_to_batch",
                f"Code not found: {code_value}",
                {"code": code_value, "batch_id": batch_id}
            )
            continue
        if code.status not in [CodeStatus.ISSUED, CodeStatus.BOUND]:
            invalid.append(code_value)
            log_exception(
                db, ExceptionType.DATA_CONFLICT, "bind_codes_to_batch",
                f"Code {code_value} cannot be bound (status: {code.status})",
                {"code": code_value, "current_status": code.status, "batch_id": batch_id}
            )
            continue

        existing = db.query(CodeBatchBinding).filter(
            CodeBatchBinding.code_id == code.id,
            CodeBatchBinding.status == BindingStatus.ACTIVE
        ).first()
        if existing:
            if existing.batch_id == batch_id:
                continue
            else:
                existing.status = BindingStatus.UNBOUND
                existing.unbound_at = datetime.utcnow()

        binding = CodeBatchBinding(
            code_id=code.id,
            batch_id=batch.id,
            status=BindingStatus.ACTIVE
        )
        db.add(binding)
        code.status = CodeStatus.BOUND
        bindings.append(binding)

    if invalid:
        create_pending_task(
            db, TaskType.BATCH_PROCESSING,
            f"批次绑定异常处理 - {len(invalid)} 个码",
            f"批次 {batch.batch_number} 绑定失败的码：{', '.join(invalid[:10])}{'...' if len(invalid) > 10 else ''}",
            {"invalid_codes": invalid, "batch_id": batch_id, "batch_number": batch.batch_number}
        )

    db.commit()
    for binding in bindings:
        db.refresh(binding)
    return bindings, invalid


def unbind_codes_from_batch(db: Session, codes: List[str]) -> Tuple[List[CodeBatchBinding], List[str]]:
    unbound = []
    invalid = []
    for code_value in codes:
        code = db.query(TraceabilityCode).filter(
            TraceabilityCode.code == code_value
        ).first()
        if not code:
            invalid.append(code_value)
            log_exception(
                db, ExceptionType.INVALID_CODE, "unbind_codes_from_batch",
                f"Code not found: {code_value}",
                {"code": code_value}
            )
            continue

        binding = db.query(CodeBatchBinding).filter(
            CodeBatchBinding.code_id == code.id,
            CodeBatchBinding.status == BindingStatus.ACTIVE
        ).first()
        if not binding:
            invalid.append(code_value)
            log_exception(
                db, ExceptionType.DATA_CONFLICT, "unbind_codes_from_batch",
                f"Code {code_value} has no active binding",
                {"code": code_value, "current_status": code.status}
            )
            continue

        binding.status = BindingStatus.UNBOUND
        binding.unbound_at = datetime.utcnow()
        code.status = CodeStatus.ISSUED
        unbound.append(binding)

    if invalid:
        create_pending_task(
            db, TaskType.BATCH_PROCESSING,
            f"批次解绑异常处理 - {len(invalid)} 个码",
            f"以下码无法解绑：{', '.join(invalid[:10])}{'...' if len(invalid) > 10 else ''}",
            {"invalid_codes": invalid}
        )

    db.commit()
    for binding in unbound:
        db.refresh(binding)
    return unbound, invalid


def get_batch_bindings(db: Session, batch_id: int, skip: int = 0,
                       limit: int = 100) -> Tuple[List[CodeBatchBinding], int]:
    query = db.query(CodeBatchBinding).filter(CodeBatchBinding.batch_id == batch_id)
    total = query.with_entities(func.count(CodeBatchBinding.id)).scalar()
    bindings = query.order_by(CodeBatchBinding.bound_at.desc()).offset(skip).limit(limit).all()
    return bindings, total


def create_inspection_report(db: Session, report_data: InspectionReportCreate) -> InspectionReport:
    if report_data.batch_id:
        batch = db.query(Batch).filter(Batch.id == report_data.batch_id).first()
        if not batch:
            log_exception(
                db, ExceptionType.INVALID_BATCH, "create_inspection_report",
                f"Batch not found for report: {report_data.report_number}",
                {"report_number": report_data.report_number, "batch_id": report_data.batch_id}
            )
            report_data.batch_id = None

    report = InspectionReport(
        report_number=report_data.report_number,
        batch_id=report_data.batch_id,
        inspector=report_data.inspector,
        inspection_date=report_data.inspection_date,
        result=report_data.result,
        details=report_data.details
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def get_reports(db: Session, skip: int = 0, limit: int = 100,
                batch_id: Optional[int] = None) -> Tuple[List[InspectionReport], int]:
    query = db.query(InspectionReport)
    if batch_id:
        query = query.filter(InspectionReport.batch_id == batch_id)
    total = query.with_entities(func.count(InspectionReport.id)).scalar()
    reports = query.order_by(InspectionReport.created_at.desc()).offset(skip).limit(limit).all()
    return reports, total
