from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime
from typing import List, Optional
import uuid

from app import models, schemas
from app.models import ProcessStatus, ExceptionType, ObjectLevel, LeaveScope


def generate_batch_no():
    return f"BATCH-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"


def create_batch(db: Session, batch: schemas.BatchCreate):
    db_batch = models.Batch(**batch.model_dump())
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch


def get_batch(db: Session, batch_id: int):
    return db.query(models.Batch).filter(models.Batch.id == batch_id).first()


def get_batch_by_no(db: Session, batch_no: str):
    return db.query(models.Batch).filter(models.Batch.batch_no == batch_no).first()


def get_batches(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Batch).offset(skip).limit(limit).all()


def update_batch_status(db: Session, batch_id: int, update: schemas.BatchUpdate):
    db_batch = get_batch(db, batch_id)
    if db_batch:
        previous_status = db_batch.status
        for key, value in update.model_dump().items():
            setattr(db_batch, key, value)
        db_batch.processed_at = datetime.now()
        
        db_audit = models.AuditLog(
            batch_id=batch_id,
            action="批次状态更新",
            previous_status=previous_status,
            new_status=update.status,
            operator=update.processed_by,
            reason=update.process_note or "批次处理完成"
        )
        db.add(db_audit)
        db.commit()
        db.refresh(db_batch)
    return db_batch


def create_checkin_record(db: Session, checkin: schemas.CheckinRecordCreate):
    db_checkin = models.CheckinRecord(**checkin.model_dump())
    db.add(db_checkin)
    db.commit()
    db.refresh(db_checkin)
    return db_checkin


def create_checkin_records_bulk(db: Session, checkins: List[schemas.CheckinRecordCreate]):
    db_checkins = [models.CheckinRecord(**checkin.model_dump()) for checkin in checkins]
    db.bulk_save_objects(db_checkins)
    db.commit()
    return db_checkins


def get_checkin_records(db: Session, params: schemas.QueryParams, skip: int = 0, limit: int = 100):
    query = db.query(models.CheckinRecord)
    conditions = []
    
    if params.object_level:
        conditions.append(models.CheckinRecord.object_level == params.object_level)
    if params.status:
        conditions.append(models.CheckinRecord.status == params.status)
    if params.exception_type:
        conditions.append(models.CheckinRecord.exception_type == params.exception_type)
    if params.start_time:
        conditions.append(models.CheckinRecord.checkin_time >= params.start_time)
    if params.end_time:
        conditions.append(models.CheckinRecord.checkin_time <= params.end_time)
    
    if conditions:
        query = query.filter(and_(*conditions))
    
    return query.offset(skip).limit(limit).all()


def create_leave_record(db: Session, leave: schemas.LeaveRecordCreate):
    db_leave = models.LeaveRecord(**leave.model_dump())
    db.add(db_leave)
    db.commit()
    db.refresh(db_leave)
    return db_leave


def create_leave_records_bulk(db: Session, leaves: List[schemas.LeaveRecordCreate]):
    db_leaves = [models.LeaveRecord(**leave.model_dump()) for leave in leaves]
    db.bulk_save_objects(db_leaves)
    db.commit()
    return db_leaves


def get_leave_records(db: Session, params: schemas.QueryParams, skip: int = 0, limit: int = 100):
    query = db.query(models.LeaveRecord)
    conditions = []
    
    if params.object_level:
        conditions.append(models.LeaveRecord.object_level == params.object_level)
    if params.leave_scope:
        conditions.append(models.LeaveRecord.leave_scope == params.leave_scope)
    if params.status:
        conditions.append(models.LeaveRecord.status == params.status)
    if params.exception_type:
        conditions.append(models.LeaveRecord.exception_type == params.exception_type)
    if params.start_time:
        conditions.append(models.LeaveRecord.leave_start_time >= params.start_time)
    if params.end_time:
        conditions.append(models.LeaveRecord.leave_end_time <= params.end_time)
    
    if conditions:
        query = query.filter(and_(*conditions))
    
    return query.offset(skip).limit(limit).all()


def create_location_summary(db: Session, location: schemas.LocationSummaryCreate):
    db_location = models.LocationSummary(**location.model_dump())
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location


def create_location_summaries_bulk(db: Session, locations: List[schemas.LocationSummaryCreate]):
    db_locations = [models.LocationSummary(**loc.model_dump()) for loc in locations]
    db.bulk_save_objects(db_locations)
    db.commit()
    return db_locations


def get_location_summaries(db: Session, params: schemas.QueryParams, skip: int = 0, limit: int = 100):
    query = db.query(models.LocationSummary)
    conditions = []
    
    if params.object_level:
        conditions.append(models.LocationSummary.object_level == params.object_level)
    if params.status:
        conditions.append(models.LocationSummary.status == params.status)
    if params.exception_type:
        conditions.append(models.LocationSummary.exception_type == params.exception_type)
    if params.start_time:
        conditions.append(models.LocationSummary.start_time >= params.start_time)
    if params.end_time:
        conditions.append(models.LocationSummary.end_time <= params.end_time)
    
    if conditions:
        query = query.filter(and_(*conditions))
    
    return query.offset(skip).limit(limit).all()


def process_checkin_record(db: Session, record_id: int, process: schemas.ProcessRecordRequest):
    db_record = db.query(models.CheckinRecord).filter(models.CheckinRecord.id == record_id).first()
    if db_record:
        previous_status = db_record.status
        db_record.status = process.status
        db_record.processed_by = process.processed_by
        db_record.processed_at = datetime.now()
        db_record.process_note = process.process_note
        db_record.readable_explanation = process.readable_explanation
        
        db_audit = models.AuditLog(
            batch_id=db_record.batch_id,
            checkin_record_id=record_id,
            action="签到记录处理",
            previous_status=previous_status,
            new_status=process.status,
            operator=process.processed_by,
            reason=process.process_note or "签到记录处理完成"
        )
        db.add(db_audit)
        db.commit()
        db.refresh(db_record)
    return db_record


def process_leave_record(db: Session, record_id: int, process: schemas.ProcessRecordRequest):
    db_record = db.query(models.LeaveRecord).filter(models.LeaveRecord.id == record_id).first()
    if db_record:
        previous_status = db_record.status
        db_record.status = process.status
        db_record.processed_by = process.processed_by
        db_record.processed_at = datetime.now()
        db_record.process_note = process.process_note
        db_record.readable_explanation = process.readable_explanation
        
        db_audit = models.AuditLog(
            batch_id=db_record.batch_id,
            leave_record_id=record_id,
            action="请假记录处理",
            previous_status=previous_status,
            new_status=process.status,
            operator=process.processed_by,
            reason=process.process_note or "请假记录处理完成"
        )
        db.add(db_audit)
        db.commit()
        db.refresh(db_record)
    return db_record


def process_location_summary(db: Session, record_id: int, process: schemas.ProcessRecordRequest):
    db_record = db.query(models.LocationSummary).filter(models.LocationSummary.id == record_id).first()
    if db_record:
        previous_status = db_record.status
        db_record.status = process.status
        db_record.processed_by = process.processed_by
        db_record.processed_at = datetime.now()
        db_record.process_note = process.process_note
        db_record.readable_explanation = process.readable_explanation
        
        db_audit = models.AuditLog(
            batch_id=db_record.batch_id,
            location_summary_id=record_id,
            action="定位摘要处理",
            previous_status=previous_status,
            new_status=process.status,
            operator=process.processed_by,
            reason=process.process_note or "定位摘要处理完成"
        )
        db.add(db_audit)
        db.commit()
        db.refresh(db_record)
    return db_record


def mark_exception_checkin(db: Session, record_id: int, exception_type: ExceptionType, reason: str):
    db_record = db.query(models.CheckinRecord).filter(models.CheckinRecord.id == record_id).first()
    if db_record:
        db_record.exception_type = exception_type
        db_record.exception_reason = reason
        if exception_type == ExceptionType.OVERTIME:
            db_record.is_overtime = True
        db.commit()
        db.refresh(db_record)
    return db_record


def mark_exception_leave(db: Session, record_id: int, exception_type: ExceptionType, reason: str):
    db_record = db.query(models.LeaveRecord).filter(models.LeaveRecord.id == record_id).first()
    if db_record:
        db_record.exception_type = exception_type
        db_record.exception_reason = reason
        db.commit()
        db.refresh(db_record)
    return db_record


def mark_exception_location(db: Session, record_id: int, exception_type: ExceptionType, reason: str):
    db_record = db.query(models.LocationSummary).filter(models.LocationSummary.id == record_id).first()
    if db_record:
        db_record.exception_type = exception_type
        db_record.exception_reason = reason
        if exception_type == ExceptionType.TRACE_GAP:
            db_record.has_gap = True
        db.commit()
        db.refresh(db_record)
    return db_record


def get_audit_logs(db: Session, record_type: str = None, record_id: int = None, batch_id: int = None):
    query = db.query(models.AuditLog)
    if batch_id:
        query = query.filter(models.AuditLog.batch_id == batch_id)
    if record_type == "checkin" and record_id:
        query = query.filter(models.AuditLog.checkin_record_id == record_id)
    elif record_type == "leave" and record_id:
        query = query.filter(models.AuditLog.leave_record_id == record_id)
    elif record_type == "location" and record_id:
        query = query.filter(models.AuditLog.location_summary_id == record_id)
    return query.order_by(models.AuditLog.operated_at.desc()).all()
