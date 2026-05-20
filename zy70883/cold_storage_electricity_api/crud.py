from sqlalchemy.orm import Session
from sqlalchemy import func
from models import Batch, SourceMaterial, ElectricityDetail, ProcessingTrace, AuditLog
from models import BatchStatus, DataCategory, ProcessingAction
from schemas import BatchCreate, SourceMaterialCreate, ElectricityDetailCreate, ElectricityDetailUpdate
import datetime
import uuid


def generate_batch_no(billing_month: str) -> str:
    timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    return f"ELC-{billing_month}-{timestamp}"


def create_batch(db: Session, batch: BatchCreate) -> Batch:
    batch_no = generate_batch_no(batch.billing_month)
    db_batch = Batch(
        batch_no=batch_no,
        name=batch.name,
        billing_month=batch.billing_month,
        created_by=batch.created_by,
        status=BatchStatus.CREATED
    )
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch


def get_batch(db: Session, batch_id: int) -> Batch:
    return db.query(Batch).filter(Batch.id == batch_id).first()


def get_batch_by_no(db: Session, batch_no: str) -> Batch:
    return db.query(Batch).filter(Batch.batch_no == batch_no).first()


def get_batches(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Batch).order_by(Batch.created_at.desc()).offset(skip).limit(limit).all()


def update_batch_status(db: Session, batch_id: int, status: BatchStatus) -> Batch:
    db_batch = get_batch(db, batch_id)
    if db_batch:
        db_batch.status = status
        db.commit()
        db.refresh(db_batch)
    return db_batch


def create_source_material(db: Session, material: SourceMaterialCreate) -> SourceMaterial:
    db_material = SourceMaterial(**material.model_dump())
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    return db_material


def get_source_materials_by_batch(db: Session, batch_id: int):
    return db.query(SourceMaterial).filter(SourceMaterial.batch_id == batch_id).all()


def classify_electricity_detail(detail: ElectricityDetail) -> tuple[DataCategory, str]:
    reasons = []
    
    if not detail.tenant_code or not detail.tenant_name:
        return DataCategory.BLOCKED, "租户信息不完整"
    
    if not detail.temperature_zone:
        reasons.append("缺少温区信息")
    
    if detail.electricity_rate is None or detail.electricity_rate <= 0:
        reasons.append("用电倍率异常")
    
    if detail.meter_reading_start is None or detail.meter_reading_end is None:
        reasons.append("电表读数不完整")
    elif detail.meter_reading_end < detail.meter_reading_start:
        return DataCategory.BLOCKED, "电表结束读数小于开始读数"
    
    if detail.basic_electricity is None or detail.basic_electricity < 0:
        reasons.append("基础电费异常")
    
    if detail.overtime_hours and detail.overtime_hours > 0:
        if detail.overtime_electricity is None or detail.overtime_electricity < 0:
            reasons.append("加班电费异常")
    
    if reasons:
        return DataCategory.PENDING_SUPPLEMENT, "需要补充: " + "; ".join(reasons)
    
    return DataCategory.NORMAL, "数据校验通过"


def calculate_total_electricity(detail: ElectricityDetail) -> float:
    total = 0.0
    if detail.basic_electricity:
        total += detail.basic_electricity
    if detail.overtime_electricity:
        total += detail.overtime_electricity
    if detail.manual_allocation:
        total += detail.manual_allocation
    return total


def create_electricity_detail(db: Session, detail: ElectricityDetailCreate) -> ElectricityDetail:
    db_detail = ElectricityDetail(**detail.model_dump())
    category, reason = classify_electricity_detail(db_detail)
    db_detail.category = category
    db_detail.category_reason = reason
    db_detail.total_electricity = calculate_total_electricity(db_detail)
    
    db.add(db_detail)
    db.commit()
    db.refresh(db_detail)
    
    create_processing_trace(
        db,
        detail_id=db_detail.id,
        action=ProcessingAction.AUTO_CLASSIFY,
        operator="system",
        remark=reason,
        new_category=category
    )
    
    return db_detail


def get_electricity_detail(db: Session, detail_id: int) -> ElectricityDetail:
    return db.query(ElectricityDetail).filter(ElectricityDetail.id == detail_id).first()


def get_electricity_details_by_batch(db: Session, batch_id: int, category: DataCategory = None):
    query = db.query(ElectricityDetail).filter(ElectricityDetail.batch_id == batch_id)
    if category:
        query = query.filter(ElectricityDetail.category == category)
    return query.all()


def update_electricity_detail(db: Session, detail_id: int, detail_update: ElectricityDetailUpdate, modified_by: str = None):
    db_detail = get_electricity_detail(db, detail_id)
    if not db_detail:
        return None
    
    update_data = detail_update.model_dump(exclude_unset=True)
    
    for field, new_value in update_data.items():
        old_value = getattr(db_detail, field)
        if old_value != new_value:
            create_audit_log(
                db,
                detail_id=detail_id,
                field_name=field,
                old_value=str(old_value),
                new_value=str(new_value),
                modified_by=modified_by or "system",
                change_reason=update_data.get("category_reason", "更新数据")
            )
    
    for key, value in update_data.items():
        setattr(db_detail, key, value)
    
    db_detail.total_electricity = calculate_total_electricity(db_detail)
    
    if 'category' in update_data:
        create_processing_trace(
            db,
            detail_id=detail_id,
            action=ProcessingAction.MODIFY_CONCLUSION,
            operator=modified_by or "system",
            remark=update_data.get("category_reason", ""),
            previous_category=db_detail.category,
            new_category=update_data['category']
        )
    
    db.commit()
    db.refresh(db_detail)
    return db_detail


def create_processing_trace(db: Session, **kwargs):
    db_trace = ProcessingTrace(**kwargs)
    db.add(db_trace)
    db.commit()
    db.refresh(db_trace)
    return db_trace


def get_processing_traces_by_detail(db: Session, detail_id: int):
    return db.query(ProcessingTrace).filter(ProcessingTrace.detail_id == detail_id).order_by(ProcessingTrace.operated_at.desc()).all()


def create_audit_log(db: Session, **kwargs):
    db_log = AuditLog(**kwargs)
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log


def get_audit_logs_by_detail(db: Session, detail_id: int):
    return db.query(AuditLog).filter(AuditLog.detail_id == detail_id).order_by(AuditLog.modified_at.desc()).all()


def get_batch_statistics(db: Session, batch_id: int):
    statistics = db.query(
        ElectricityDetail.category,
        func.count(ElectricityDetail.id),
        func.coalesce(func.sum(ElectricityDetail.total_electricity), 0)
    ).filter(ElectricityDetail.batch_id == batch_id).group_by(ElectricityDetail.category).all()
    
    result = []
    for stat in statistics:
        result.append({
            "category": stat[0],
            "count": stat[1],
            "total_electricity": float(stat[2])
        })
    
    return result


def archive_batch(db: Session, batch_id: int, operator: str) -> Batch:
    db_batch = get_batch(db, batch_id)
    if not db_batch:
        return None
    
    db_batch.status = BatchStatus.ARCHIVED
    db_batch.archived_at = datetime.datetime.now()
    db_batch.archived_by = operator
    
    details = get_electricity_details_by_batch(db, batch_id)
    for detail in details:
        detail.is_archived = True
        detail.final_processor = operator
        create_processing_trace(
            db,
            detail_id=detail.id,
            action=ProcessingAction.ARCHIVE,
            operator=operator,
            remark="批次归档"
        )
    
    db.commit()
    db.refresh(db_batch)
    return db_batch


def bulk_import_details(db: Session, batch_id: int, details_data: list):
    created_details = []
    for detail_data in details_data:
        detail_data['batch_id'] = batch_id
        detail = ElectricityDetailCreate(**detail_data)
        db_detail = create_electricity_detail(db, detail)
        created_details.append(db_detail)
    
    return created_details
