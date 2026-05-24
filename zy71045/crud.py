from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional, Tuple
import models
import schemas
from state_machine import (
    ToppingStatus,
    InspectionStatus,
    StateTransition,
    BatchValidator,
    InspectionInterceptor,
    BarrelTracker,
    DuplicateHandler
)
from datetime import datetime
import uuid


def generate_record_code() -> str:
    return f"TOP-{uuid.uuid4().hex[:8].upper()}"


def generate_report_code() -> str:
    return f"RPT-{uuid.uuid4().hex[:8].upper()}"


def get_barrel_by_code(db: Session, barrel_code: str) -> Optional[models.OakBarrel]:
    return db.query(models.OakBarrel).filter(models.OakBarrel.barrel_code == barrel_code).first()


def get_batch_by_code(db: Session, batch_code: str) -> Optional[models.WineBatch]:
    return db.query(models.WineBatch).filter(models.WineBatch.batch_code == batch_code).first()


def create_barrel(db: Session, barrel: schemas.OakBarrelCreate) -> models.OakBarrel:
    db_barrel = models.OakBarrel(**barrel.model_dump())
    db.add(db_barrel)
    db.commit()
    db.refresh(db_barrel)
    return db_barrel


def create_batch(db: Session, batch: schemas.WineBatchCreate) -> models.WineBatch:
    db_batch = models.WineBatch(**batch.model_dump())
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch


def create_topping_record(db: Session, topping: schemas.ToppingRecordCreate) -> Tuple[bool, str, Optional[models.ToppingRecord]]:
    barrel = get_barrel_by_code(db, topping.barrel_code)
    if not barrel:
        return False, f"橡木桶 {topping.barrel_code} 不存在", None

    batch = get_batch_by_code(db, topping.source_batch_code)
    if not batch:
        return False, f"酒液批次 {topping.source_batch_code} 不存在", None

    is_duplicate, existing_record, dup_msg = DuplicateHandler.check_duplicate(
        db, barrel.id, batch.id, topping.topping_date
    )
    if is_duplicate:
        return False, dup_msg, existing_record

    valid, msg = BatchValidator.validate_barrel_batch_match(db, barrel.id, batch.id)
    if not valid:
        db_topping = models.ToppingRecord(
            record_code=generate_record_code(),
            barrel_id=barrel.id,
            source_batch_id=batch.id,
            evaporation_volume=topping.evaporation_volume,
            topping_volume=topping.topping_volume,
            topping_date=topping.topping_date,
            operator=topping.operator,
            status=ToppingStatus.BLOCKED,
            notes=f"{msg} | {topping.notes or ''}"
        )
        db.add(db_topping)
        db.commit()
        db.refresh(db_topping)
        return False, msg, db_topping

    valid, msg = BatchValidator.validate_barrel_capacity(db, barrel.id, topping.topping_volume)
    if not valid:
        return False, msg, None

    valid, msg = BatchValidator.validate_batch_volume(db, batch.id, topping.topping_volume)
    if not valid:
        return False, msg, None

    db_topping = models.ToppingRecord(
        record_code=generate_record_code(),
        barrel_id=barrel.id,
        source_batch_id=batch.id,
        evaporation_volume=topping.evaporation_volume,
        topping_volume=topping.topping_volume,
        topping_date=topping.topping_date,
        operator=topping.operator,
        status=ToppingStatus.INSPECTION_REQUIRED,
        notes=topping.notes
    )
    db.add(db_topping)
    db.commit()
    db.refresh(db_topping)
    return True, "添酒记录已创建，等待检验", db_topping


def create_inspection(db: Session, inspection: schemas.InspectionCreate) -> Tuple[bool, str, Optional[models.InspectionResult]]:
    topping = db.query(models.ToppingRecord).filter(
        models.ToppingRecord.record_code == inspection.topping_record_code
    ).first()
    if not topping:
        return False, "添酒记录不存在", None

    if topping.status != ToppingStatus.INSPECTION_REQUIRED:
        return False, f"当前状态 {topping.status} 不允许提交检验", None

    valid, msg = InspectionInterceptor.validate_inspection_score(inspection.overall_score)
    if not valid:
        return False, msg, None

    db_inspection = models.InspectionResult(
        topping_record_id=topping.id,
        inspector=inspection.inspector,
        inspection_date=inspection.inspection_date,
        appearance=inspection.appearance,
        aroma=inspection.aroma,
        taste=inspection.taste,
        overall_score=inspection.overall_score,
        passed=inspection.passed,
        comments=inspection.comments
    )
    db.add(db_inspection)

    if inspection.passed:
        topping.inspection_status = InspectionStatus.PASSED
        topping.status = ToppingStatus.APPROVED
    else:
        topping.inspection_status = InspectionStatus.FAILED
        topping.status = ToppingStatus.REJECTED

    db.commit()
    db.refresh(db_inspection)
    db.refresh(topping)
    return True, "检验结果已提交", db_inspection


def approve_topping(db: Session, record_code: str) -> Tuple[bool, str, Optional[models.ToppingRecord]]:
    topping = db.query(models.ToppingRecord).filter(
        models.ToppingRecord.record_code == record_code
    ).first()
    if not topping:
        return False, "添酒记录不存在", None

    valid, msg = InspectionInterceptor.check_inspection_before_approval(db, topping.id)
    if not valid:
        return False, msg, None

    if not StateTransition.can_transition(topping.status, ToppingStatus.COMPLETED):
        return False, f"无法从 {topping.status} 状态转换到 completed", None

    BarrelTracker.update_barrel_volume(db, topping.barrel_id, topping.topping_volume)
    BarrelTracker.update_batch_volume(db, topping.source_batch_id, -topping.topping_volume)

    topping.status = ToppingStatus.COMPLETED
    db.commit()
    db.refresh(topping)
    return True, "添酒已放行并完成", topping


def reject_topping(db: Session, record_code: str, reason: str) -> Tuple[bool, str, Optional[models.ToppingRecord]]:
    topping = db.query(models.ToppingRecord).filter(
        models.ToppingRecord.record_code == record_code
    ).first()
    if not topping:
        return False, "添酒记录不存在", None

    if not StateTransition.can_transition(topping.status, ToppingStatus.REJECTED):
        return False, f"无法从 {topping.status} 状态转换到 rejected", None

    topping.status = ToppingStatus.REJECTED
    topping.notes = f"{topping.notes or ''} | 拒绝原因: {reason}"
    db.commit()
    db.refresh(topping)
    return True, "添酒记录已拒绝", topping


def resubmit_topping(db: Session, record_code: str, new_topping: schemas.ToppingRecordCreate) -> Tuple[bool, str, Optional[models.ToppingRecord]]:
    old_topping = db.query(models.ToppingRecord).filter(
        models.ToppingRecord.record_code == record_code
    ).first()
    if not old_topping:
        return False, "原添酒记录不存在", None

    barrel = get_barrel_by_code(db, new_topping.barrel_code)
    batch = get_batch_by_code(db, new_topping.source_batch_code)

    old_topping.is_valid = False
    db.commit()

    db_topping = models.ToppingRecord(
        record_code=generate_record_code(),
        barrel_id=barrel.id,
        source_batch_id=batch.id,
        evaporation_volume=new_topping.evaporation_volume,
        topping_volume=new_topping.topping_volume,
        topping_date=new_topping.topping_date,
        operator=new_topping.operator,
        status=ToppingStatus.INSPECTION_REQUIRED,
        version=old_topping.version + 1,
        parent_id=old_topping.id,
        notes=f"补录记录，原记录: {record_code} | {new_topping.notes or ''}"
    )
    db.add(db_topping)
    db.commit()
    db.refresh(db_topping)
    return True, f"补录记录已创建，版本 {db_topping.version}", db_topping


def close_topping(db: Session, record_code: str) -> Tuple[bool, str, Optional[models.ToppingRecord]]:
    topping = db.query(models.ToppingRecord).filter(
        models.ToppingRecord.record_code == record_code
    ).first()
    if not topping:
        return False, "添酒记录不存在", None

    if not StateTransition.can_transition(topping.status, ToppingStatus.CLOSED):
        return False, f"无法从 {topping.status} 状态转换到 closed", None

    topping.status = ToppingStatus.CLOSED
    db.commit()
    db.refresh(topping)
    return True, "添酒记录已关闭", topping


def get_topping_records(db: Session, query: schemas.ToppingQuery) -> List[models.ToppingRecord]:
    q = db.query(models.ToppingRecord)

    if query.only_valid:
        q = q.filter(models.ToppingRecord.is_valid == True)

    if query.barrel_code:
        barrel = get_barrel_by_code(db, query.barrel_code)
        if barrel:
            q = q.filter(models.ToppingRecord.barrel_id == barrel.id)

    if query.batch_code:
        batch = get_batch_by_code(db, query.batch_code)
        if batch:
            q = q.filter(models.ToppingRecord.source_batch_id == batch.id)

    if query.start_date:
        q = q.filter(models.ToppingRecord.topping_date >= query.start_date)

    if query.end_date:
        q = q.filter(models.ToppingRecord.topping_date <= query.end_date)

    if query.status:
        q = q.filter(models.ToppingRecord.status == query.status)

    return q.order_by(models.ToppingRecord.topping_date.desc()).all()


def get_topping_by_code(db: Session, record_code: str) -> Optional[models.ToppingRecord]:
    return db.query(models.ToppingRecord).filter(
        models.ToppingRecord.record_code == record_code
    ).first()


def generate_cellar_report(db: Session, report: schemas.CellarReportCreate) -> models.CellarReport:
    records = db.query(models.ToppingRecord).filter(
        and_(
            models.ToppingRecord.topping_date >= report.start_date,
            models.ToppingRecord.topping_date <= report.end_date,
            models.ToppingRecord.is_valid == True
        )
    ).all()

    total_toppings = len(records)
    total_evaporation = sum(r.evaporation_volume for r in records)
    total_topping_volume = sum(r.topping_volume for r in records)

    passed_count = sum(1 for r in records if r.inspection_status == InspectionStatus.PASSED)
    pass_rate = (passed_count / total_toppings * 100) if total_toppings > 0 else 0.0

    db_report = models.CellarReport(
        report_code=generate_report_code(),
        report_type=report.report_type,
        start_date=report.start_date,
        end_date=report.end_date,
        generated_by=report.generated_by,
        total_toppings=total_toppings,
        total_evaporation=total_evaporation,
        total_topping_volume=total_topping_volume,
        pass_rate=pass_rate
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


def get_all_barrels(db: Session) -> List[models.OakBarrel]:
    return db.query(models.OakBarrel).all()


def get_all_batches(db: Session) -> List[models.WineBatch]:
    return db.query(models.WineBatch).all()
