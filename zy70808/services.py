from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, date
from typing import List, Optional, Tuple
import uuid
import models
import schemas
from models import RecordStatus, ExceptionType, ActionType


def generate_batch_number() -> str:
    return f"BATCH{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"


def generate_record_number() -> str:
    return f"REC{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"


def generate_readable_explanation(exception_types: List[str], record: models.MaintenanceRecord) -> str:
    explanations = []
    today = date.today()

    if ExceptionType.OVERDUE in exception_types:
        days_overdue = (today - record.next_inspection_date).days if record.next_inspection_date else 0
        explanations.append(
            f"【过期未检】设备编号 {record.equipment_code} 下次维保日期为 {record.next_inspection_date}，"
            f"已超期 {days_overdue} 天，需立即安排维保人员进行补检并说明延误原因。"
        )

    if ExceptionType.MULTIPLE_CONTRACTS in exception_types:
        explanations.append(
            f"【同设备多合同】设备编号 {record.equipment_code} 存在多份有效维保合同，"
            f"需确认合同覆盖范围是否重叠，避免重复付费或责任推诿。"
        )

    if ExceptionType.MISSING_PHOTO in exception_types:
        explanations.append(
            f"【照片缺失】设备编号 {record.equipment_code} 本次巡检未上传现场照片，"
            f"根据维保管理规定，所有巡检必须留存影像资料作为佐证，请补充上传。"
        )

    if ExceptionType.NO_CONTRACT in exception_types:
        explanations.append(
            f"【无有效合同】设备编号 {record.equipment_code} 当前无有效维保合同，"
            f"请立即联系供应商签署维保协议，确保设备维保工作合规进行。"
        )

    if not explanations:
        return "【正常】该设备维保记录完整，各项检查均符合要求，无异常情况。"

    return "\n".join(explanations)


def detect_exceptions(
    db: Session,
    record: models.MaintenanceRecord,
    equipment: Optional[models.Equipment]
) -> Tuple[List[str], str]:
    exception_types = []
    reasons = []
    today = date.today()

    if equipment and equipment.next_inspection_date:
        if equipment.next_inspection_date < today:
            exception_types.append(ExceptionType.OVERDUE)
            days_overdue = (today - equipment.next_inspection_date).days
            reasons.append(f"过期未检{days_overdue}天")

    if equipment:
        contracts = db.query(models.Contract).filter(
            models.Contract.equipment_code == equipment.equipment_code,
            models.Contract.status == "active",
            models.Contract.end_date >= today
        ).all()
        if len(contracts) > 1:
            exception_types.append(ExceptionType.MULTIPLE_CONTRACTS)
            reasons.append(f"存在{len(contracts)}份有效合同")
        elif len(contracts) == 0:
            exception_types.append(ExceptionType.NO_CONTRACT)
            reasons.append("无有效维保合同")

    if equipment:
        photos = db.query(models.InspectionPhoto).filter(
            models.InspectionPhoto.equipment_code == equipment.equipment_code
        ).first()
        if not photos:
            exception_types.append(ExceptionType.MISSING_PHOTO)
            reasons.append("无巡检照片")

    return exception_types, "; ".join(reasons)


def create_audit_log(
    db: Session,
    batch_id: Optional[int],
    record_id: Optional[int],
    action_type: str,
    action_by: str,
    from_status: Optional[str] = None,
    to_status: Optional[str] = None,
    reason: Optional[str] = None,
    notes: Optional[str] = None,
    ip_address: Optional[str] = None
):
    audit_log = models.AuditLog(
        batch_id=batch_id,
        record_id=record_id,
        action_type=action_type,
        action_by=action_by,
        from_status=from_status,
        to_status=to_status,
        reason=reason,
        notes=notes,
        ip_address=ip_address
    )
    db.add(audit_log)
    db.commit()
    return audit_log


def create_batch(db: Session, batch: schemas.BatchCreate) -> models.Batch:
    db_batch = models.Batch(
        batch_number=generate_batch_number(),
        name=batch.name,
        description=batch.description,
        created_by=batch.created_by
    )
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)

    create_audit_log(
        db=db,
        batch_id=db_batch.id,
        record_id=None,
        action_type=ActionType.CREATE,
        action_by=batch.created_by,
        reason="创建新批次",
        notes=batch.description
    )

    return db_batch


def create_maintenance_record(
    db: Session,
    batch_id: int,
    record_data: schemas.MaintenanceRecordBase
) -> models.MaintenanceRecord:
    equipment = db.query(models.Equipment).filter(
        models.Equipment.equipment_code == record_data.equipment_code
    ).first()

    db_record = models.MaintenanceRecord(
        record_number=generate_record_number(),
        batch_id=batch_id,
        equipment_id=equipment.id if equipment else None,
        **{
            k: v for k, v in record_data.model_dump().items()
        }
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)

    exception_types, exception_reason = detect_exceptions(db, db_record, equipment)

    if exception_types:
        db_record.has_exception = True
        db_record.exception_types = ",".join(exception_types)
        db_record.exception_reason = exception_reason
        db_record.readable_explanation = generate_readable_explanation(exception_types, db_record)

        for ex_type in exception_types:
            desc = ""
            if ex_type == ExceptionType.OVERDUE:
                desc = f"设备下次维保日期 {equipment.next_inspection_date if equipment else '未知'} 已过期"
            elif ex_type == ExceptionType.MULTIPLE_CONTRACTS:
                desc = "该设备存在多份有效维保合同"
            elif ex_type == ExceptionType.MISSING_PHOTO:
                desc = "该设备无巡检照片记录"
            elif ex_type == ExceptionType.NO_CONTRACT:
                desc = "该设备无有效维保合同"

            ex = models.RecordException(
                record_id=db_record.id,
                exception_type=ex_type,
                description=desc
            )
            db.add(ex)

        db.commit()
        db.refresh(db_record)

    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if batch:
        batch.total_records += 1
        if exception_types:
            batch.exception_count += 1
        db.commit()

    return db_record


def handle_record(
    db: Session,
    record_id: int,
    request: schemas.HandleRecordRequest
) -> Optional[models.MaintenanceRecord]:
    record = db.query(models.MaintenanceRecord).filter(
        models.MaintenanceRecord.id == record_id
    ).first()

    if not record:
        return None

    old_status = record.status
    new_status = old_status

    if request.action == "approve":
        new_status = RecordStatus.APPROVED
    elif request.action == "return":
        new_status = RecordStatus.RETURNED
    elif request.action == "request_info":
        new_status = RecordStatus.NEEDS_MORE_INFO
    elif request.action == "process":
        new_status = RecordStatus.PROCESSING

    record.status = new_status
    record.handled_by = request.handled_by
    record.handled_at = datetime.now()
    record.handler_notes = request.notes

    create_audit_log(
        db=db,
        batch_id=record.batch_id,
        record_id=record.id,
        action_type=request.action,
        action_by=request.handled_by,
        from_status=old_status,
        to_status=new_status,
        reason=request.reason,
        notes=request.notes
    )

    db.commit()
    db.refresh(record)
    return record


def query_records(
    db: Session,
    params: schemas.QueryParams
) -> Tuple[int, List[models.MaintenanceRecord]]:
    query = db.query(models.MaintenanceRecord)

    if params.floor:
        query = query.filter(models.MaintenanceRecord.floor.contains(params.floor))
    if params.area:
        query = query.filter(models.MaintenanceRecord.area.contains(params.area))
    if params.maintenance_person:
        query = query.filter(models.MaintenanceRecord.maintenance_person.contains(params.maintenance_person))
    if params.status:
        query = query.filter(models.MaintenanceRecord.status == params.status)
    if params.has_exception is not None:
        query = query.filter(models.MaintenanceRecord.has_exception == params.has_exception)
    if params.batch_id:
        query = query.filter(models.MaintenanceRecord.batch_id == params.batch_id)
    if params.rectification_deadline_start:
        query = query.filter(models.MaintenanceRecord.next_inspection_date >= params.rectification_deadline_start)
    if params.rectification_deadline_end:
        query = query.filter(models.MaintenanceRecord.next_inspection_date <= params.rectification_deadline_end)

    total = query.count()

    offset = (params.page - 1) * params.page_size
    records = query.order_by(models.MaintenanceRecord.created_at.desc())\
        .offset(offset).limit(params.page_size).all()

    return total, records


def get_record_detail(db: Session, record_id: int) -> Optional[models.MaintenanceRecord]:
    return db.query(models.MaintenanceRecord).filter(
        models.MaintenanceRecord.id == record_id
    ).first()


def get_all_records_for_export(
    db: Session,
    params: schemas.QueryParams
) -> List[models.MaintenanceRecord]:
    query = db.query(models.MaintenanceRecord)

    if params.floor:
        query = query.filter(models.MaintenanceRecord.floor.contains(params.floor))
    if params.area:
        query = query.filter(models.MaintenanceRecord.area.contains(params.area))
    if params.maintenance_person:
        query = query.filter(models.MaintenanceRecord.maintenance_person.contains(params.maintenance_person))
    if params.status:
        query = query.filter(models.MaintenanceRecord.status == params.status)
    if params.has_exception is not None:
        query = query.filter(models.MaintenanceRecord.has_exception == params.has_exception)
    if params.batch_id:
        query = query.filter(models.MaintenanceRecord.batch_id == params.batch_id)
    if params.rectification_deadline_start:
        query = query.filter(models.MaintenanceRecord.next_inspection_date >= params.rectification_deadline_start)
    if params.rectification_deadline_end:
        query = query.filter(models.MaintenanceRecord.next_inspection_date <= params.rectification_deadline_end)

    return query.order_by(models.MaintenanceRecord.created_at.desc()).all()


def get_audit_logs_by_record(db: Session, record_id: int) -> List[models.AuditLog]:
    return db.query(models.AuditLog).filter(
        models.AuditLog.record_id == record_id
    ).order_by(models.AuditLog.action_at.desc()).all()
