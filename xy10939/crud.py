from sqlalchemy.orm import Session
from sqlalchemy import func
import models
import schemas
from datetime import datetime
import json
import uuid


def generate_no(prefix: str) -> str:
    return f"{prefix}{datetime.now().strftime('%Y%m%d%H%M%S')}{str(uuid.uuid4())[:4].upper()}"


def create_donation_batch(db: Session, batch: schemas.DonationBatchCreate):
    batch_no = batch.batch_no or generate_no("BATCH")
    db_batch = models.DonationBatch(
        batch_no=batch_no,
        donor_name=batch.donor_name,
        donor_phone=batch.donor_phone,
        donor_address=batch.donor_address,
        total_count=batch.total_count,
        remark=batch.remark,
        status=models.BatchStatus.CREATED
    )
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch


def get_donation_batch(db: Session, batch_id: int):
    return db.query(models.DonationBatch).filter(models.DonationBatch.id == batch_id).first()


def get_donation_batch_by_no(db: Session, batch_no: str):
    return db.query(models.DonationBatch).filter(models.DonationBatch.batch_no == batch_no).first()


def get_donation_batches(db: Session, skip: int = 0, limit: int = 100, status: str = None):
    query = db.query(models.DonationBatch)
    if status:
        query = query.filter(models.DonationBatch.status == status)
    return query.order_by(models.DonationBatch.created_at.desc()).offset(skip).limit(limit).all()


def update_batch_status(db: Session, batch_id: int, target_status: str, operator: str = None, reason: str = None):
    db_batch = get_donation_batch(db, batch_id)
    if not db_batch:
        return None
    
    old_status = db_batch.status
    db_batch.status = target_status
    db.commit()
    db.refresh(db_batch)
    return db_batch


def create_clothing_item(db: Session, item: schemas.ClothingItemCreate):
    item_no = item.item_no or generate_no("ITEM")
    db_item = models.ClothingItem(
        batch_id=item.batch_id,
        item_no=item_no,
        category_id=item.category_id,
        name=item.name,
        brand=item.brand,
        color=item.color,
        size=item.size,
        material=item.material,
        quality_level=item.quality_level,
        estimated_value=item.estimated_value,
        remark=item.remark,
        status=models.ClothingStatus.PENDING if not item.category_id else models.ClothingStatus.SORTED
    )
    db.add(db_item)
    db.flush()
    
    if item.category_id:
        db_history = models.StatusHistory(
            clothing_item_id=db_item.id,
            from_status=models.ClothingStatus.PENDING,
            to_status=models.ClothingStatus.SORTED,
            operator=None,
            reason="创建时已分类"
        )
        db.add(db_history)
    
    db.commit()
    db.refresh(db_item)
    return db_item


def get_clothing_item(db: Session, item_id: int):
    return db.query(models.ClothingItem).filter(models.ClothingItem.id == item_id).first()


def get_clothing_item_by_no(db: Session, item_no: str):
    return db.query(models.ClothingItem).filter(models.ClothingItem.item_no == item_no).first()


def get_clothing_items(db: Session, skip: int = 0, limit: int = 100, batch_id: int = None, status: str = None):
    query = db.query(models.ClothingItem)
    if batch_id:
        query = query.filter(models.ClothingItem.batch_id == batch_id)
    if status:
        query = query.filter(models.ClothingItem.status == status)
    return query.order_by(models.ClothingItem.created_at.desc()).offset(skip).limit(limit).all()


def update_clothing_item(db: Session, item_id: int, item_update: schemas.ClothingItemUpdate):
    db_item = get_clothing_item(db, item_id)
    if not db_item:
        return None
    
    update_data = item_update.model_dump(exclude_unset=True, exclude={"operator"})
    for field, value in update_data.items():
        setattr(db_item, field, value)
    
    db.commit()
    db.refresh(db_item)
    return db_item


def transition_clothing_status(db: Session, item_id: int, target_status: str, operator: str = None, reason: str = None):
    db_item = get_clothing_item(db, item_id)
    if not db_item:
        return None
    
    old_status = db_item.status
    
    db_history = models.StatusHistory(
        clothing_item_id=item_id,
        from_status=old_status,
        to_status=target_status,
        operator=operator,
        reason=reason
    )
    db.add(db_history)
    
    db_item.status = target_status
    db.commit()
    db.refresh(db_item)
    return db_item


def create_sterilization_record(db: Session, record: schemas.SterilizationRecordCreate):
    record_no = generate_no("STER")
    db_record = models.SterilizationRecord(
        clothing_item_id=record.clothing_item_id,
        record_no=record_no,
        method=record.method,
        temperature=record.temperature,
        duration=record.duration,
        operator=record.operator,
        result=record.result,
        remark=record.remark
    )
    db.add(db_record)
    
    if record.result == "合格":
        transition_clothing_status(db, record.clothing_item_id, models.ClothingStatus.STERILIZED, record.operator, "消毒合格")
    
    db.commit()
    db.refresh(db_record)
    return db_record


def create_donation_record(db: Session, record: schemas.DonationRecordCreate):
    record_no = generate_no("DON")
    db_record = models.DonationRecord(
        clothing_item_id=record.clothing_item_id,
        organization_id=record.organization_id,
        record_no=record_no,
        operator=record.operator,
        receiver=record.receiver,
        remark=record.remark
    )
    db.add(db_record)
    
    transition_clothing_status(db, record.clothing_item_id, models.ClothingStatus.DONATED, record.operator, "完成转赠")
    
    db.commit()
    db.refresh(db_record)
    return db_record


def create_rejection_record(db: Session, record: schemas.RejectionRecordCreate):
    record_no = generate_no("REJ")
    db_record = models.RejectionRecord(
        clothing_item_id=record.clothing_item_id,
        reason_id=record.reason_id,
        record_no=record_no,
        operator=record.operator,
        remark=record.remark
    )
    db.add(db_record)
    
    transition_clothing_status(db, record.clothing_item_id, models.ClothingStatus.REJECTED, record.operator, "衣物淘汰")
    
    db.commit()
    db.refresh(db_record)
    return db_record


def create_processing_exception(db: Session, exception: schemas.ProcessingExceptionCreate):
    exception_no = generate_no("EXC")
    db_exception = models.ProcessingException(
        exception_no=exception_no,
        batch_id=exception.batch_id,
        clothing_item_id=exception.clothing_item_id,
        original_input=exception.original_input,
        error_message=exception.error_message,
        processing_step=exception.processing_step,
        conclusion=exception.conclusion,
        operator=exception.operator
    )
    db.add(db_exception)
    db.commit()
    db.refresh(db_exception)
    return db_exception


def resolve_processing_exception(db: Session, exception_id: int, resolve_data: schemas.ProcessingExceptionResolve):
    db_exception = db.query(models.ProcessingException).filter(models.ProcessingException.id == exception_id).first()
    if not db_exception:
        return None
    
    db_exception.conclusion = resolve_data.conclusion
    db_exception.resolution_note = resolve_data.resolution_note
    db_exception.operator = resolve_data.operator or db_exception.operator
    db_exception.resolved = 1
    db_exception.resolved_at = datetime.now()
    
    db.commit()
    db.refresh(db_exception)
    return db_exception


def get_processing_exceptions(db: Session, skip: int = 0, limit: int = 100, resolved: int = None):
    query = db.query(models.ProcessingException)
    if resolved is not None:
        query = query.filter(models.ProcessingException.resolved == resolved)
    return query.order_by(models.ProcessingException.created_at.desc()).offset(skip).limit(limit).all()


def generate_sorting_report(db: Session, batch_id: int, operator: str = None, summary: str = None):
    db_batch = get_donation_batch(db, batch_id)
    if not db_batch:
        return None
    
    items = get_clothing_items(db, batch_id=batch_id)
    
    total_count = len(items)
    sorted_count = sum(1 for i in items if i.status != models.ClothingStatus.PENDING)
    sterilized_count = sum(1 for i in items if i.status in [models.ClothingStatus.STERILIZED, models.ClothingStatus.READY, models.ClothingStatus.DONATED])
    donated_count = sum(1 for i in items if i.status == models.ClothingStatus.DONATED)
    rejected_count = sum(1 for i in items if i.status == models.ClothingStatus.REJECTED)
    pending_count = sum(1 for i in items if i.status == models.ClothingStatus.PENDING)
    
    report_no = generate_no("RPT")
    db_report = models.SortingReport(
        batch_id=batch_id,
        report_no=report_no,
        total_count=total_count,
        sorted_count=sorted_count,
        sterilized_count=sterilized_count,
        donated_count=donated_count,
        rejected_count=rejected_count,
        pending_count=pending_count,
        summary=summary,
        operator=operator
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


def get_sorting_reports(db: Session, skip: int = 0, limit: int = 100, batch_id: int = None):
    query = db.query(models.SortingReport)
    if batch_id:
        query = query.filter(models.SortingReport.batch_id == batch_id)
    return query.order_by(models.SortingReport.created_at.desc()).offset(skip).limit(limit).all()


def get_batch_statistics(db: Session, batch_id: int):
    items = get_clothing_items(db, batch_id=batch_id)
    return {
        "total": len(items),
        "pending": sum(1 for i in items if i.status == models.ClothingStatus.PENDING),
        "sorted": sum(1 for i in items if i.status == models.ClothingStatus.SORTED),
        "sterilizing": sum(1 for i in items if i.status == models.ClothingStatus.STERILIZING),
        "sterilized": sum(1 for i in items if i.status == models.ClothingStatus.STERILIZED),
        "ready": sum(1 for i in items if i.status == models.ClothingStatus.READY),
        "donated": sum(1 for i in items if i.status == models.ClothingStatus.DONATED),
        "rejected": sum(1 for i in items if i.status == models.ClothingStatus.REJECTED),
    }


def create_clothing_category(db: Session, category: schemas.ClothingCategoryCreate):
    db_category = models.ClothingCategory(
        code=category.code,
        name=category.name,
        description=category.description,
        sort_order=category.sort_order
    )
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


def get_clothing_categories(db: Session):
    return db.query(models.ClothingCategory).filter(models.ClothingCategory.is_active == 1).order_by(models.ClothingCategory.sort_order).all()


def create_donation_organization(db: Session, org: schemas.DonationOrganizationCreate):
    db_org = models.DonationOrganization(
        code=org.code,
        name=org.name,
        contact_person=org.contact_person,
        contact_phone=org.contact_phone,
        address=org.address,
        description=org.description
    )
    db.add(db_org)
    db.commit()
    db.refresh(db_org)
    return db_org


def get_donation_organizations(db: Session):
    return db.query(models.DonationOrganization).filter(models.DonationOrganization.is_active == 1).all()


def create_rejection_reason(db: Session, reason: schemas.RejectionReasonCreate):
    db_reason = models.RejectionReason(
        code=reason.code,
        name=reason.name,
        description=reason.description,
        sort_order=reason.sort_order
    )
    db.add(db_reason)
    db.commit()
    db.refresh(db_reason)
    return db_reason


def get_rejection_reasons(db: Session):
    return db.query(models.RejectionReason).filter(models.RejectionReason.is_active == 1).order_by(models.RejectionReason.sort_order).all()


def export_batch_data(db: Session, batch_id: int):
    db_batch = get_donation_batch(db, batch_id)
    if not db_batch:
        return None
    
    items = get_clothing_items(db, batch_id=batch_id)
    reports = get_sorting_reports(db, batch_id=batch_id)
    exceptions = db.query(models.ProcessingException).filter(models.ProcessingException.batch_id == batch_id).all()
    
    export_data = {
        "batch": {
            "id": db_batch.id,
            "batch_no": db_batch.batch_no,
            "donor_name": db_batch.donor_name,
            "donor_phone": db_batch.donor_phone,
            "status": db_batch.status,
            "total_count": db_batch.total_count,
            "received_at": db_batch.received_at.isoformat() if db_batch.received_at else None,
        },
        "statistics": get_batch_statistics(db, batch_id),
        "clothing_items": [],
        "reports": [{"report_no": r.report_no, "generated_at": r.generated_at.isoformat()} for r in reports],
        "exceptions": [{"exception_no": e.exception_no, "resolved": e.resolved} for e in exceptions]
    }
    
    for item in items:
        item_data = {
            "id": item.id,
            "item_no": item.item_no,
            "name": item.name,
            "status": item.status,
            "category": item.category.name if item.category else None,
            "status_history": [{"from": h.from_status, "to": h.to_status, "at": h.created_at.isoformat()} for h in item.status_history],
            "sterilization": [{"record_no": s.record_no, "result": s.result} for s in item.sterilization_records],
            "donation": [{"record_no": d.record_no, "org": d.organization.name} for d in item.donation_records],
            "rejection": [{"record_no": r.record_no, "reason": r.reason.name} for r in item.rejection_records],
        }
        export_data["clothing_items"].append(item_data)
    
    return export_data
