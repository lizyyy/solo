from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models import LossLedger, DataSource, StatusChangeHistory, LossItem, FailedRecord, User
from app.schemas import LossLedgerCreate, LossLedgerUpdate, StatusChangeRequest
from app.models.enums import LedgerStatus, DataSourceType, UserRole, RecordStatus
import hashlib
import json


class LedgerStateMachine:
    ALLOWED_TRANSITIONS = {
        LedgerStatus.DRAFT: [LedgerStatus.SUBMITTED],
        LedgerStatus.SUBMITTED: [LedgerStatus.REJECTED, LedgerStatus.SECONDARY_CONFIRMED, LedgerStatus.AUDIT_ONLY],
        LedgerStatus.REJECTED: [LedgerStatus.SUBMITTED],
        LedgerStatus.SECONDARY_CONFIRMED: [LedgerStatus.AUDIT_ONLY],
        LedgerStatus.AUDIT_ONLY: [],
    }

    ROLE_PERMISSIONS = {
        LedgerStatus.DRAFT: [UserRole.SORTER, UserRole.SUPERVISOR, UserRole.ADMIN],
        LedgerStatus.SUBMITTED: [UserRole.SUPERVISOR, UserRole.PROCUREMENT_MANAGER, UserRole.ADMIN],
        LedgerStatus.REJECTED: [UserRole.SORTER, UserRole.SUPERVISOR, UserRole.ADMIN],
        LedgerStatus.SECONDARY_CONFIRMED: [UserRole.PROCUREMENT_MANAGER, UserRole.ADMIN],
        LedgerStatus.AUDIT_ONLY: [UserRole.AUDITOR, UserRole.ADMIN],
    }

    @classmethod
    def can_transition(cls, from_status: LedgerStatus, to_status: LedgerStatus) -> bool:
        return to_status in cls.ALLOWED_TRANSITIONS.get(from_status, [])

    @classmethod
    def has_permission(cls, status: LedgerStatus, user_role: UserRole) -> bool:
        return user_role in cls.ROLE_PERMISSIONS.get(status, [])


def generate_ledger_no() -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"LL-{timestamp}"


def generate_deduplication_key(item: dict) -> str:
    key_string = f"{item.get('item_no')}-{item.get('product_name')}-{item.get('weight')}-{item.get('loss_reason')}"
    return hashlib.md5(key_string.encode()).hexdigest()


def validate_loss_item(db: Session, item_data: dict, ledger_id: Optional[int] = None) -> Tuple[bool, List[str]]:
    errors = []
    
    if not item_data.get("item_no"):
        errors.append("损耗项编号不能为空")
    
    if item_data.get("weight", 0) <= 0:
        errors.append("损耗重量必须大于0")
    
    dedup_key = item_data.get("deduplication_key")
    if dedup_key:
        query = db.query(LossItem).filter(LossItem.deduplication_key == dedup_key)
        if ledger_id:
            query = query.filter(LossItem.ledger_id != ledger_id)
        
        if query.first():
            errors.append(f"检测到重复记录: {item_data.get('item_no')}")
    
    return len(errors) == 0, errors


def validate_data_source(source_data: dict) -> Tuple[bool, Optional[str]]:
    required_fields = {
        DataSourceType.SUPPLIER_DELIVERY: ["delivery_no", "supplier_id", "delivery_date"],
        DataSourceType.WEIGHING_RECORD: ["weighing_no", "weighing_time", "operator"],
        DataSourceType.BASKET_RETURN_PHOTO: ["photo_no", "upload_time", "uploader"],
        DataSourceType.SECONDARY_CONFIRMATION: ["confirmation_no", "confirmer", "confirmation_time"],
    }
    
    source_type = source_data.get("source_type")
    if source_type not in required_fields:
        return False, "未知的数据源类型"
    
    try:
        source_json = json.loads(source_data.get("source_data", "{}"))
    except json.JSONDecodeError:
        return False, "数据源JSON格式错误"
    
    for field in required_fields[source_type]:
        if field not in source_json:
            return False, f"缺少必填字段: {field}"
    
    return True, None


def save_failed_record(db: Session, batch_no: str, source_type: DataSourceType, 
                       source_data: str, error_type: str, error_message: str):
    failed_record = FailedRecord(
        batch_no=batch_no,
        source_type=source_type,
        source_data=source_data,
        error_type=error_type,
        error_message=error_message
    )
    db.add(failed_record)
    db.commit()


def create_ledger(db: Session, ledger_data: LossLedgerCreate, user_id: int) -> LossLedger:
    ledger_no = generate_ledger_no()
    
    if ledger_data.total_weight <= 0:
        raise HTTPException(status_code=400, detail="总重量必须大于0")
    if ledger_data.loss_weight < 0:
        raise HTTPException(status_code=400, detail="损耗重量不能为负数")
    if ledger_data.loss_weight > ledger_data.total_weight:
        raise HTTPException(status_code=400, detail="损耗重量不能大于总重量")
    
    loss_rate = (ledger_data.loss_weight / ledger_data.total_weight * 100) if ledger_data.total_weight > 0 else 0
    
    ledger = LossLedger(
        ledger_no=ledger_no,
        supplier_id=ledger_data.supplier_id,
        supplier_name=ledger_data.supplier_name,
        batch_no=ledger_data.batch_no,
        product_name=ledger_data.product_name,
        total_weight=ledger_data.total_weight,
        loss_weight=ledger_data.loss_weight,
        loss_rate=loss_rate,
        loss_type=ledger_data.loss_type,
        status=LedgerStatus.DRAFT,
        remark=ledger_data.remark,
        created_by=user_id
    )
    db.add(ledger)
    db.flush()
    
    for source_data in ledger_data.data_sources:
        is_valid, validation_msg = validate_data_source(source_data.model_dump())
        data_source = DataSource(
            ledger_id=ledger.id,
            source_type=source_data.source_type,
            source_no=source_data.source_no,
            source_data=source_data.source_data,
            file_url=source_data.file_url,
            is_valid=is_valid,
            validation_message=validation_msg
        )
        db.add(data_source)
    
    processed_weight = 0
    seen_keys = set()
    
    for item_data in ledger_data.loss_items:
        item_dict = item_data.model_dump()
        dedup_key = item_data.deduplication_key
        
        is_valid, errors = validate_loss_item(db, item_dict)
        
        if dedup_key in seen_keys:
            is_valid = False
            errors.append(f"批次内检测到重复记录: {item_data.item_no}")
        else:
            seen_keys.add(dedup_key)
        
        record_status = RecordStatus.VALID if is_valid else RecordStatus.INVALID
        
        loss_item = LossItem(
            ledger_id=ledger.id,
            item_no=item_data.item_no,
            product_name=item_data.product_name,
            weight=item_data.weight,
            loss_reason=item_data.loss_reason,
            record_status=record_status,
            validation_errors="; ".join(errors) if errors else None,
            deduplication_key=dedup_key,
            source_type=item_data.source_type
        )
        db.add(loss_item)
        
        if is_valid:
            processed_weight += item_data.weight
    
    if ledger_data.loss_items and processed_weight != ledger.loss_weight:
        raise HTTPException(
            status_code=400, 
            detail=f"有效损耗项总重量({processed_weight})与台账损耗重量({ledger.loss_weight})不一致"
        )
    
    status_history = StatusChangeHistory(
        ledger_id=ledger.id,
        from_status=None,
        to_status=LedgerStatus.DRAFT,
        operator_id=user_id,
        change_reason="创建台账"
    )
    db.add(status_history)
    
    db.commit()
    db.refresh(ledger)
    return ledger


def update_ledger_status(db: Session, ledger_id: int, new_status: LedgerStatus, 
                         request: StatusChangeRequest, operator: User) -> LossLedger:
    ledger = db.query(LossLedger).filter(LossLedger.id == ledger_id).first()
    if not ledger:
        raise HTTPException(status_code=404, detail="台账不存在")
    
    if not LedgerStateMachine.can_transition(ledger.status, new_status):
        raise HTTPException(
            status_code=400, 
            detail=f"无法从 {ledger.status.value} 状态转换到 {new_status.value} 状态"
        )
    
    if not LedgerStateMachine.has_permission(ledger.status, operator.role):
        raise HTTPException(
            status_code=403, 
            detail=f"角色 {operator.role.value} 无权在 {ledger.status.value} 状态下执行此操作"
        )
    
    old_status = ledger.status
    ledger.status = new_status
    
    status_history = StatusChangeHistory(
        ledger_id=ledger.id,
        from_status=old_status,
        to_status=new_status,
        operator_id=operator.id,
        change_reason=request.change_reason
    )
    db.add(status_history)
    db.commit()
    db.refresh(ledger)
    return ledger


def get_ledger_by_id(db: Session, ledger_id: int, user: User) -> LossLedger:
    ledger = db.query(LossLedger).filter(LossLedger.id == ledger_id).first()
    if not ledger:
        raise HTTPException(status_code=404, detail="台账不存在")
    return ledger


def get_ledger_list(db: Session, skip: int = 0, limit: int = 100, 
                    status: Optional[LedgerStatus] = None,
                    supplier_id: Optional[str] = None) -> Tuple[int, List[LossLedger]]:
    query = db.query(LossLedger).filter(LossLedger.is_latest == True)
    
    if status:
        query = query.filter(LossLedger.status == status)
    if supplier_id:
        query = query.filter(LossLedger.supplier_id == supplier_id)
    
    total = query.count()
    items = query.order_by(LossLedger.created_at.desc()).offset(skip).limit(limit).all()
    return total, items


def update_ledger(db: Session, ledger_id: int, update_data: LossLedgerUpdate, 
                  operator_id: int) -> LossLedger:
    ledger = db.query(LossLedger).filter(LossLedger.id == ledger_id).first()
    if not ledger:
        raise HTTPException(status_code=404, detail="台账不存在")
    
    if ledger.status != LedgerStatus.DRAFT and ledger.status != LedgerStatus.REJECTED:
        raise HTTPException(status_code=400, detail="只能在草稿或已驳回状态下修改台账")
    
    new_version = ledger.current_version + 1
    ledger.is_latest = False
    db.flush()
    
    new_ledger = LossLedger(
        ledger_no=ledger.ledger_no,
        supplier_id=ledger.supplier_id,
        supplier_name=update_data.supplier_name or ledger.supplier_name,
        batch_no=ledger.batch_no,
        product_name=update_data.product_name or ledger.product_name,
        total_weight=update_data.total_weight or ledger.total_weight,
        loss_weight=update_data.loss_weight or ledger.loss_weight,
        loss_rate=(update_data.loss_weight or ledger.loss_weight) / (update_data.total_weight or ledger.total_weight) * 100,
        loss_type=update_data.loss_type or ledger.loss_type,
        status=ledger.status,
        current_version=new_version,
        is_latest=True,
        parent_ledger_id=ledger.id,
        remark=update_data.remark or ledger.remark,
        created_by=ledger.created_by
    )
    db.add(new_ledger)
    db.flush()
    
    if update_data.data_sources:
        for source_data in update_data.data_sources:
            is_valid, validation_msg = validate_data_source(source_data.model_dump())
            data_source = DataSource(
                ledger_id=new_ledger.id,
                source_type=source_data.source_type,
                source_no=source_data.source_no,
                source_data=source_data.source_data,
                file_url=source_data.file_url,
                is_valid=is_valid,
                validation_message=validation_msg
            )
            db.add(data_source)
    else:
        for source in ledger.data_sources:
            new_source = DataSource(
                ledger_id=new_ledger.id,
                source_type=source.source_type,
                source_no=source.source_no,
                source_data=source.source_data,
                file_url=source.file_url,
                is_valid=source.is_valid,
                validation_message=source.validation_message
            )
            db.add(new_source)
    
    if update_data.loss_items:
        for item_data in update_data.loss_items:
            item_dict = item_data.model_dump()
            is_valid, errors = validate_loss_item(db, item_dict, new_ledger.id)
            record_status = RecordStatus.VALID if is_valid else RecordStatus.INVALID
            
            loss_item = LossItem(
                ledger_id=new_ledger.id,
                item_no=item_data.item_no,
                product_name=item_data.product_name,
                weight=item_data.weight,
                loss_reason=item_data.loss_reason,
                record_status=record_status,
                validation_errors="; ".join(errors) if errors else None,
                deduplication_key=generate_deduplication_key(item_dict),
                source_type=item_data.source_type
            )
            db.add(loss_item)
    
    status_history = StatusChangeHistory(
        ledger_id=new_ledger.id,
        from_status=ledger.status,
        to_status=ledger.status,
        operator_id=operator_id,
        change_reason=f"修改台账，版本从 {ledger.current_version} 更新到 {new_version}"
    )
    db.add(status_history)
    
    db.commit()
    db.refresh(new_ledger)
    return new_ledger


def get_failed_records(db: Session, skip: int = 0, limit: int = 100) -> Tuple[int, List[FailedRecord]]:
    query = db.query(FailedRecord)
    total = query.count()
    items = query.order_by(FailedRecord.created_at.desc()).offset(skip).limit(limit).all()
    return total, items


def get_ledger_versions(db: Session, ledger_no: str) -> List[LossLedger]:
    return db.query(LossLedger).filter(LossLedger.ledger_no == ledger_no).order_by(LossLedger.current_version).all()
