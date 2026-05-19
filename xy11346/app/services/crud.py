from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime
from typing import List, Optional
from app.models import QualityRecord, LabMeasurement, ReworkRecord, PaperBatch, QualityThreshold
from app.schemas import QualityRecordCreate, QualityRecordUpdate, PaperBatchCreate, QualityThresholdCreate
from app.services.quality_engine import QualityCheckEngine

def create_paper_batch(db: Session, batch: PaperBatchCreate):
    db_batch = PaperBatch(**batch.dict())
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch

def get_paper_batch(db: Session, batch_number: str):
    return db.query(PaperBatch).filter(PaperBatch.batch_number == batch_number).first()

def get_paper_batches(db: Session, skip: int = 0, limit: int = 100):
    return db.query(PaperBatch).offset(skip).limit(limit).all()

def create_quality_threshold(db: Session, threshold: QualityThresholdCreate):
    db_threshold = QualityThreshold(**threshold.dict())
    db.add(db_threshold)
    db.commit()
    db.refresh(db_threshold)
    return db_threshold

def get_quality_thresholds(db: Session, product_type: Optional[str] = None):
    query = db.query(QualityThreshold).filter(QualityThreshold.is_active == True)
    if product_type:
        query = query.filter(QualityThreshold.product_type == product_type)
    return query.all()

def create_quality_record(db: Session, record: QualityRecordCreate):
    engine = QualityCheckEngine(db)
    check_result = engine.check_batch_measurements(record.lab_measurements, record.product_type)
    
    db_record = QualityRecord(
        batch_number=record.batch_number,
        product_type=record.product_type,
        paper_batch_id=record.paper_batch_id,
        inspector=record.inspector,
        status=record.status,
        overall_result=check_result["overall_result"],
        reason=check_result["reason"],
        anomaly_type=check_result["anomaly_type"],
        sample_retained=check_result["sample_retained"],
        notes=record.notes
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    
    for meas_result in check_result["measurement_results"]:
        db_measurement = LabMeasurement(
            quality_record_id=db_record.id,
            measurement_point=meas_result["measurement_point"],
            l_value=meas_result["l_value"],
            a_value=meas_result["a_value"],
            b_value=meas_result["b_value"],
            standard_l=meas_result["standard_l"],
            standard_a=meas_result["standard_a"],
            standard_b=meas_result["standard_b"],
            delta_l=meas_result["delta_l"],
            delta_a=meas_result["delta_a"],
            delta_b=meas_result["delta_b"],
            delta_e=meas_result["delta_e"],
            is_anomaly=meas_result["is_anomaly"],
            anomaly_reason=meas_result["anomaly_reason"]
        )
        db.add(db_measurement)
    
    if record.rework_records:
        for rework in record.rework_records:
            db_rework = ReworkRecord(
                quality_record_id=db_record.id,
                **rework.dict()
            )
            db.add(db_rework)
    
    db.commit()
    db.refresh(db_record)
    return db_record

def get_quality_record(db: Session, record_id: int):
    return db.query(QualityRecord).filter(QualityRecord.id == record_id).first()

def get_quality_records(
    db: Session,
    inspector: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    status: Optional[str] = None,
    anomaly_type: Optional[str] = None,
    batch_number: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
):
    query = db.query(QualityRecord)
    
    if inspector:
        query = query.filter(QualityRecord.inspector == inspector)
    if start_time:
        query = query.filter(QualityRecord.inspection_time >= start_time)
    if end_time:
        query = query.filter(QualityRecord.inspection_time <= end_time)
    if status:
        query = query.filter(QualityRecord.status == status)
    if anomaly_type:
        query = query.filter(QualityRecord.anomaly_type == anomaly_type)
    if batch_number:
        query = query.filter(QualityRecord.batch_number.contains(batch_number))
    
    total = query.count()
    records = query.order_by(QualityRecord.inspection_time.desc()).offset(skip).limit(limit).all()
    return total, records

def update_quality_record(db: Session, record_id: int, update: QualityRecordUpdate):
    db_record = db.query(QualityRecord).filter(QualityRecord.id == record_id).first()
    if db_record:
        update_data = update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_record, key, value)
        db.commit()
        db.refresh(db_record)
    return db_record

def create_rework_record(db: Session, quality_record_id: int, rework: ReworkRecord):
    db_rework = ReworkRecord(
        quality_record_id=quality_record_id,
        **rework.dict()
    )
    db.add(db_rework)
    db.commit()
    db.refresh(db_rework)
    return db_rework

def get_statistics(db: Session, start_time: Optional[datetime] = None, end_time: Optional[datetime] = None):
    query = db.query(QualityRecord)
    if start_time:
        query = query.filter(QualityRecord.inspection_time >= start_time)
    if end_time:
        query = query.filter(QualityRecord.inspection_time <= end_time)
    
    total = query.count()
    passed = query.filter(QualityRecord.overall_result == "合格").count()
    conditional = query.filter(QualityRecord.overall_result == "有条件放行").count()
    failed = query.filter(QualityRecord.overall_result == "不合格").count()
    sample_retained = query.filter(QualityRecord.sample_retained == True).count()
    
    return {
        "total_records": total,
        "passed": passed,
        "conditional_pass": conditional,
        "failed": failed,
        "sample_retained": sample_retained,
        "pass_rate": (passed + conditional) / total if total > 0 else 0
    }
