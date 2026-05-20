from sqlalchemy.orm import Session
from datetime import datetime, date
from database import Device, Contract, PhotoRecord, ReconciliationTask, ReconciliationRecord, ReconciliationSummary
import uuid


def calculate_overdue_days(next_date: date) -> int:
    if not next_date:
        return 0
    today = date.today()
    if next_date < today:
        return (today - next_date).days
    return 0


def create_reconciliation_task(db: Session, task_name: str) -> ReconciliationTask:
    task_code = f"RC{datetime.now().strftime('%Y%m%d')}{uuid.uuid4().hex[:4].upper()}"
    task = ReconciliationTask(
        task_code=task_code,
        task_name=task_name,
        status="processing"
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def process_device_reconciliation(db: Session, task_id: int, device: Device, today: date):
    contracts = db.query(Contract).filter(Contract.device_code == device.device_code).all()
    photos = db.query(PhotoRecord).filter(PhotoRecord.device_code == device.device_code).all()
    
    issues = []
    
    contract_count = len(contracts)
    contract_status = "normal"
    contract_end_date = None
    
    if contract_count == 0:
        contract_status = "missing"
        issues.append("无有效维保合同")
    elif contract_count > 1:
        contract_status = "multiple"
        issues.append(f"存在{contract_count}份有效合同，需确认")
    
    if contracts:
        latest_contract = max(contracts, key=lambda c: c.end_date)
        contract_end_date = latest_contract.end_date
        if contract_end_date and contract_end_date < today:
            contract_status = "expired"
            if contract_count == 1:
                issues.append("合同已过期")
    
    maintenance_status = "normal"
    overdue_days = calculate_overdue_days(device.next_maintenance_date)
    
    if overdue_days > 0:
        maintenance_status = "overdue"
        issues.append(f"维保已过期{overdue_days}天，上次维保：{device.last_maintenance_date}")
    elif not device.last_maintenance_date:
        maintenance_status = "no_record"
        issues.append("无维保记录")
    
    photo_count = len(photos)
    photo_status = "normal"
    latest_photo_date = None
    
    if photo_count == 0:
        photo_status = "missing"
        issues.append("无巡检照片")
    else:
        latest_photo_date = max(p.upload_date for p in photos if p.upload_date)
    
    if issues:
        overall_status = "issue"
    else:
        overall_status = "normal"
    
    needs_review = len(issues) > 0
    
    record = ReconciliationRecord(
        task_id=task_id,
        device_code=device.device_code,
        device_type=device.device_type,
        device_name=device.device_name,
        floor=device.floor,
        area=device.area,
        contract_status=contract_status,
        contract_end_date=contract_end_date,
        contract_count=contract_count,
        maintenance_status=maintenance_status,
        last_maintenance_date=device.last_maintenance_date,
        next_maintenance_date=device.next_maintenance_date,
        maintenance_overdue_days=overdue_days,
        photo_status=photo_status,
        photo_count=photo_count,
        latest_photo_date=latest_photo_date,
        overall_status=overall_status,
        issues="; ".join(issues),
        needs_review=needs_review
    )
    db.add(record)
    return record


def run_reconciliation(db: Session, task_id: int):
    today = date.today()
    devices = db.query(Device).all()
    
    for device in devices:
        process_device_reconciliation(db, task_id, device, today)
    
    db.commit()
    update_reconciliation_summary(db, task_id)
    
    task = db.query(ReconciliationTask).filter(ReconciliationTask.id == task_id).first()
    if task:
        task.status = "completed"
        task.total_devices = len(devices)
        db.commit()
    
    return get_reconciliation_summary(db, task_id)


def update_reconciliation_summary(db: Session, task_id: int):
    records = db.query(ReconciliationRecord).filter(ReconciliationRecord.task_id == task_id).all()
    
    total = len(records)
    normal_count = sum(1 for r in records if r.overall_status == "normal")
    maintenance_overdue = sum(1 for r in records if r.maintenance_status == "overdue")
    multiple_contracts = sum(1 for r in records if r.contract_status == "multiple")
    photo_missing = sum(1 for r in records if r.photo_status == "missing")
    contract_expired = sum(1 for r in records if r.contract_status == "expired")
    needs_review = sum(1 for r in records if r.needs_review)
    reviewed = sum(1 for r in records if r.is_reviewed)
    
    summary = db.query(ReconciliationSummary).filter(ReconciliationSummary.task_id == task_id).first()
    
    if summary:
        summary.total_devices = total
        summary.normal_count = normal_count
        summary.maintenance_overdue_count = maintenance_overdue
        summary.multiple_contracts_count = multiple_contracts
        summary.photo_missing_count = photo_missing
        summary.contract_expired_count = contract_expired
        summary.needs_review_count = needs_review
        summary.reviewed_count = reviewed
    else:
        summary = ReconciliationSummary(
            task_id=task_id,
            total_devices=total,
            normal_count=normal_count,
            maintenance_overdue_count=maintenance_overdue,
            multiple_contracts_count=multiple_contracts,
            photo_missing_count=photo_missing,
            contract_expired_count=contract_expired,
            needs_review_count=needs_review,
            reviewed_count=reviewed
        )
        db.add(summary)
    
    db.commit()
    return summary


def get_reconciliation_summary(db: Session, task_id: int):
    summary = db.query(ReconciliationSummary).filter(ReconciliationSummary.task_id == task_id).first()
    if summary:
        return {
            "task_id": task_id,
            "total": summary.total_devices,
            "normal": summary.normal_count,
            "maintenance_overdue": summary.maintenance_overdue_count,
            "multiple_contracts": summary.multiple_contracts_count,
            "photo_missing": summary.photo_missing_count,
            "contract_expired": summary.contract_expired_count,
            "needs_review": summary.needs_review_count,
            "reviewed": summary.reviewed_count
        }
    return None


def review_record(db: Session, record_id: int, review_notes: str, corrections: dict = None):
    record = db.query(ReconciliationRecord).filter(ReconciliationRecord.id == record_id).first()
    if not record:
        return None
    
    record.is_reviewed = True
    record.review_notes = review_notes
    record.reviewed_at = datetime.utcnow()
    record.needs_review = False
    
    if corrections:
        for key, value in corrections.items():
            if hasattr(record, key):
                setattr(record, key, value)
    
    db.commit()
    update_reconciliation_summary(db, record.task_id)
    return record


def recalculate_task(db: Session, task_id: int):
    today = date.today()
    task = db.query(ReconciliationTask).filter(ReconciliationTask.id == task_id).first()
    if not task:
        return None
    
    old_records = db.query(ReconciliationRecord).filter(ReconciliationRecord.task_id == task_id).all()
    
    for old_record in old_records:
        if not old_record.is_reviewed:
            db.delete(old_record)
    
    db.commit()
    
    reviewed_device_codes = [
        r.device_code for r in old_records if r.is_reviewed
    ]
    
    devices = db.query(Device).all()
    
    for device in devices:
        if device.device_code in reviewed_device_codes:
            continue
        process_device_reconciliation(db, task_id, device, today)
    
    db.commit()
    update_reconciliation_summary(db, task_id)
    
    return get_reconciliation_summary(db, task_id)


def get_reconciliation_records(db: Session, task_id: int, filter_status: str = None):
    query = db.query(ReconciliationRecord).filter(ReconciliationRecord.task_id == task_id)
    
    if filter_status == "needs_review":
        query = query.filter(ReconciliationRecord.needs_review == True)
    elif filter_status == "reviewed":
        query = query.filter(ReconciliationRecord.is_reviewed == True)
    elif filter_status == "issues":
        query = query.filter(ReconciliationRecord.overall_status == "issue")
    
    return query.order_by(ReconciliationRecord.floor, ReconciliationRecord.area).all()
