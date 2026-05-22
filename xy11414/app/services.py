from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, date
from sqlalchemy.orm import Session
import uuid

from app.models import (
    LedgerRecord, StatusHistory, DirtyRecord, FieldChangeLog,
    AuditLog, User, RecordStatus, DirtyType
)
from app.schemas import LedgerRecordCreate, LedgerRecordUpdate


def generate_record_no() -> str:
    return f"TL{datetime.now().strftime('%Y%m%d')}{uuid.uuid4().hex[:6].upper()}"


def create_ledger_record(
    db: Session,
    record_data: LedgerRecordCreate,
    user: User
) -> LedgerRecord:
    db_record = LedgerRecord(
        record_no=generate_record_no(),
        franchise_id=record_data.franchise_id,
        franchise_name=record_data.franchise_name,
        record_date=record_data.record_date,
        material_name=record_data.material_name,
        material_code=record_data.material_code,
        quantity=record_data.quantity,
        unit=record_data.unit,
        unit_price=record_data.unit_price,
        total_amount=record_data.total_amount,
        order_quantity=record_data.order_quantity,
        order_amount=record_data.order_amount,
        loss_quantity=record_data.loss_quantity,
        loss_amount=record_data.loss_amount,
        headquarter_price=record_data.headquarter_price,
        source_order_no=record_data.source_order_no,
        source_loss_no=record_data.source_loss_no,
        change_reason=record_data.change_reason,
        remarks=record_data.remarks,
        raw_data=record_data.raw_data,
        created_by=user.id,
        status=RecordStatus.DRAFT
    )
    db.add(db_record)
    db.flush()

    status_history = StatusHistory(
        ledger_record_id=db_record.id,
        from_status=None,
        to_status=RecordStatus.DRAFT,
        changed_by=user.id,
        reason="创建记录"
    )
    db.add(status_history)

    log_audit(db, user, "create_record", "ledger_record", str(db_record.id), {
        "record_no": db_record.record_no
    })

    return db_record


def update_ledger_record(
    db: Session,
    db_record: LedgerRecord,
    update_data: LedgerRecordUpdate,
    user: User,
    change_reason: str = ""
) -> LedgerRecord:
    update_dict = update_data.model_dump(exclude_unset=True)

    if db_record.status == RecordStatus.REJECTED:
        change_record_status(db, db_record, RecordStatus.DRAFT, user, reason="修改驳回记录，转为草稿")

    for field, new_value in update_dict.items():
        old_value = getattr(db_record, field)
        if old_value != new_value:
            change_log = FieldChangeLog(
                ledger_record_id=db_record.id,
                field_name=field,
                old_value=str(old_value) if old_value is not None else None,
                new_value=str(new_value) if new_value is not None else None,
                changed_by=user.id,
                change_reason=change_reason
            )
            db.add(change_log)
            setattr(db_record, field, new_value)

    log_audit(db, user, "update_record", "ledger_record", str(db_record.id), {
        "record_no": db_record.record_no,
        "changed_fields": list(update_dict.keys())
    })

    return db_record


def change_record_status(
    db: Session,
    db_record: LedgerRecord,
    new_status: RecordStatus,
    user: User,
    reason: str = "",
    rejection_reason: str = ""
) -> LedgerRecord:
    old_status = db_record.status

    status_history = StatusHistory(
        ledger_record_id=db_record.id,
        from_status=old_status,
        to_status=new_status,
        changed_by=user.id,
        reason=reason
    )
    db.add(status_history)

    db_record.status = new_status

    if new_status == RecordStatus.SUBMITTED:
        db_record.reviewed_at = datetime.utcnow()
    elif new_status == RecordStatus.CONFIRMED:
        db_record.confirmed_by = user.id
        db_record.confirmed_at = datetime.utcnow()
    elif new_status == RecordStatus.REJECTED:
        db_record.rejection_reason = rejection_reason
        db_record.reviewed_by = user.id
        db_record.reviewed_at = datetime.utcnow()

    log_audit(db, user, "status_change", "ledger_record", str(db_record.id), {
        "record_no": db_record.record_no,
        "old_status": old_status.value if old_status else None,
        "new_status": new_status.value
    })

    return db_record


def detect_dirty_records(
    db: Session,
    db_record: LedgerRecord,
    reference_data: Optional[Dict[str, Any]] = None
) -> List[DirtyRecord]:
    dirty_records = []
    dirty_types = []

    required_fields = ["franchise_id", "record_date", "material_name", "quantity", "unit_price"]
    for field in required_fields:
        if getattr(db_record, field) is None:
            dirty_type = DirtyType.MISSING_FIELD
            if dirty_type.value not in dirty_types:
                dirty_types.append(dirty_type.value)
            dirty_records.append(DirtyRecord(
                ledger_record_id=db_record.id,
                dirty_type=dirty_type,
                field_name=field,
                description=f"必填字段缺失: {field}",
                is_resolved=False
            ))

    if db_record.record_date and db_record.record_date.date() != date.today():
        dirty_type = DirtyType.CROSS_DATE
        if dirty_type.value not in dirty_types:
            dirty_types.append(dirty_type.value)
        dirty_records.append(DirtyRecord(
            ledger_record_id=db_record.id,
            dirty_type=dirty_type,
            field_name="record_date",
            original_value=str(db_record.record_date),
            description=f"记录日期跨日: {db_record.record_date}",
            is_resolved=False
        ))

    if reference_data and "material_mapping" in reference_data:
        mapping = reference_data["material_mapping"]
        if db_record.material_name and db_record.material_name in mapping:
            expected_code = mapping[db_record.material_name]
            if db_record.material_code and db_record.material_code != expected_code:
                dirty_type = DirtyType.NAME_CHANGED
                if dirty_type.value not in dirty_types:
                    dirty_types.append(dirty_type.value)
                dirty_records.append(DirtyRecord(
                    ledger_record_id=db_record.id,
                    dirty_type=dirty_type,
                    field_name="material_code",
                    original_value=db_record.material_code,
                    expected_value=expected_code,
                    description=f"原料编码与名称不匹配: {db_record.material_name}",
                    is_resolved=False
                ))

    if db_record.quantity and db_record.unit_price and db_record.total_amount:
        calculated = db_record.quantity * db_record.unit_price
        if abs(calculated - db_record.total_amount) > 0.01:
            dirty_type = DirtyType.AMOUNT_CONFLICT
            if dirty_type.value not in dirty_types:
                dirty_types.append(dirty_type.value)
            dirty_records.append(DirtyRecord(
                ledger_record_id=db_record.id,
                dirty_type=dirty_type,
                field_name="total_amount",
                current_value=str(db_record.total_amount),
                expected_value=str(round(calculated, 2)),
                description=f"金额冲突: 计算值={calculated:.2f}, 记录值={db_record.total_amount}",
                is_resolved=False
            ))

    if db_record.order_quantity and db_record.loss_quantity and db_record.quantity:
        expected = db_record.order_quantity - db_record.loss_quantity
        if abs(expected - db_record.quantity) > 0.001:
            dirty_type = DirtyType.QUANTITY_CONFLICT
            if dirty_type.value not in dirty_types:
                dirty_types.append(dirty_type.value)
            dirty_records.append(DirtyRecord(
                ledger_record_id=db_record.id,
                dirty_type=dirty_type,
                field_name="quantity",
                current_value=str(db_record.quantity),
                expected_value=str(expected),
                description=f"数量冲突: 订货-损耗={expected}, 实际={db_record.quantity}",
                is_resolved=False
            ))

    for dr in dirty_records:
        db.add(dr)

    if dirty_types:
        db_record.is_dirty = True
        db_record.dirty_types = dirty_types

    return dirty_records


def resolve_dirty_record(
    db: Session,
    dirty_record_id: int,
    user: User,
    resolution_notes: str
) -> Optional[DirtyRecord]:
    dr = db.query(DirtyRecord).filter(DirtyRecord.id == dirty_record_id).first()
    if not dr:
        return None

    dr.is_resolved = True
    dr.resolved_by = user.id
    dr.resolved_at = datetime.utcnow()
    dr.resolution_notes = resolution_notes

    ledger_record = dr.ledger_record
    remaining = db.query(DirtyRecord).filter(
        DirtyRecord.ledger_record_id == ledger_record.id,
        DirtyRecord.is_resolved == False
    ).count()
    if remaining == 0:
        ledger_record.is_dirty = False

    log_audit(db, user, "resolve_dirty", "dirty_record", str(dr.id), {
        "ledger_record_id": ledger_record.id,
        "dirty_type": dr.dirty_type.value
    })

    return dr


def log_audit(
    db: Session,
    user: User,
    action: str,
    resource_type: str,
    resource_id: str,
    details: Optional[Dict[str, Any]] = None,
    ip_address: str = "",
    user_agent: str = ""
) -> AuditLog:
    audit_log = AuditLog(
        user_id=user.id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent
    )
    db.add(audit_log)
    return audit_log


def get_ledger_records(
    db: Session,
    user: User,
    skip: int = 0,
    limit: int = 100,
    franchise_id: Optional[str] = None,
    status: Optional[RecordStatus] = None,
    is_dirty: Optional[bool] = None
) -> Tuple[int, List[LedgerRecord]]:
    query = db.query(LedgerRecord)

    if user.role.value != "supervisor" and user.franchise_id:
        query = query.filter(LedgerRecord.franchise_id == user.franchise_id)

    if franchise_id:
        query = query.filter(LedgerRecord.franchise_id == franchise_id)
    if status:
        query = query.filter(LedgerRecord.status == status)
    if is_dirty is not None:
        query = query.filter(LedgerRecord.is_dirty == is_dirty)

    total = query.count()
    records = query.order_by(LedgerRecord.created_at.desc()).offset(skip).limit(limit).all()

    return total, records


def get_ledger_record_by_id(db: Session, record_id: int) -> Optional[LedgerRecord]:
    return db.query(LedgerRecord).filter(LedgerRecord.id == record_id).first()


def get_ledger_record_by_no(db: Session, record_no: str) -> Optional[LedgerRecord]:
    return db.query(LedgerRecord).filter(LedgerRecord.record_no == record_no).first()
