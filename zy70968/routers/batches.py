from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from database import get_db
import models
import schemas
from parsers import parse_job_csv, parse_chemical_json, parse_weather_json
from validators import validate_batch, get_readable_violation_summary
from audit import log_audit, get_audit_trail, format_audit_trail, get_decision_explanation
from schemas import BatchStatus, AuditAction

router = APIRouter(prefix="/batches", tags=["batches"])


@router.post("/jobs/import", response_model=List[schemas.Job])
def import_jobs(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = file.file.read().decode("utf-8")
    jobs_data = parse_job_csv(content)
    created = []
    for data in jobs_data:
        job = models.Job(**data, csv_data=content)
        existing = db.query(models.Job).filter(models.Job.job_no == data["job_no"]).first()
        if existing:
            continue
        db.add(job)
        db.commit()
        db.refresh(job)
        created.append(job)
    return created


@router.post("/chemicals/import", response_model=List[schemas.Chemical])
def import_chemicals(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = file.file.read().decode("utf-8")
    chemicals_data = parse_chemical_json(content)
    created = []
    for data in chemicals_data:
        existing = db.query(models.Chemical).filter(
            models.Chemical.batch_no == data["batch_no"]
        ).first()
        if existing:
            continue
        chem = models.Chemical(**data)
        db.add(chem)
        db.commit()
        db.refresh(chem)
        created.append(chem)
    return created


@router.post("/weather/import", response_model=List[schemas.WeatherRecord])
def import_weather(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = file.file.read().decode("utf-8")
    weather_data = parse_weather_json(content)
    created = []
    for data in weather_data:
        record = models.WeatherRecord(**data)
        db.add(record)
        db.commit()
        db.refresh(record)
        created.append(record)
    return created


@router.post("/", response_model=schemas.BatchWithAudit)
def create_batch(batch: schemas.BatchCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Batch).filter(
        models.Batch.batch_no == batch.batch_no
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"批次号 {batch.batch_no} 已存在")

    chemical = db.query(models.Chemical).filter(
        models.Chemical.id == batch.chemical_id
    ).first()
    if not chemical:
        raise HTTPException(status_code=404, detail="药剂不存在")

    job = db.query(models.Job).filter(models.Job.id == batch.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="作业不存在")

    weather = db.query(models.WeatherRecord).filter(
        models.WeatherRecord.id == batch.weather_id
    ).first()
    if not weather:
        raise HTTPException(status_code=404, detail="天气记录不存在")

    db_batch = models.Batch(
        **batch.model_dump(),
        status=BatchStatus.PENDING,
    )
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)

    validation = validate_batch(db, db_batch)
    if not validation.passed:
        db_batch.status = BatchStatus.RETURNED
        db.commit()

        log_audit(
            db,
            batch_id=db_batch.id,
            action=AuditAction.CREATE,
            reason="; ".join(validation.get_violation_messages()),
            handler=batch.operator or "系统",
            old_status=None,
            new_status=BatchStatus.RETURNED,
            details=validation.get_summary(),
        )
    else:
        log_audit(
            db,
            batch_id=db_batch.id,
            action=AuditAction.CREATE,
            reason=validation.get_summary() if validation.warnings else "创建成功",
            handler=batch.operator or "系统",
            old_status=None,
            new_status=BatchStatus.PENDING,
            details="; ".join(validation.get_warning_messages()) if validation.warnings else None,
        )

    return schemas.BatchWithAudit(
        id=db_batch.id,
        batch_no=db_batch.batch_no,
        spray_area=db_batch.spray_area,
        chemical_id=db_batch.chemical_id,
        job_id=db_batch.job_id,
        weather_id=db_batch.weather_id,
        dosage=db_batch.dosage,
        planned_date=db_batch.planned_date,
        operator=db_batch.operator,
        status=db_batch.status,
        created_at=db_batch.created_at,
        updated_at=db_batch.updated_at,
        chemical=schemas.Chemical.model_validate(chemical),
        job=schemas.Job.model_validate(job),
        weather=schemas.WeatherRecord.model_validate(weather),
        audit_logs=format_audit_trail(get_audit_trail(db, db_batch.id)),
    )


@router.post("/{batch_id}/process", response_model=schemas.BatchWithAudit)
def mark_processed(
    batch_id: int,
    handler: str = Query(..., description="处理人姓名"),
    db: Session = Depends(get_db),
):
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    if batch.status == BatchStatus.PROCESSED:
        raise HTTPException(status_code=400, detail="该批次已处理完成")

    validation = validate_batch(db, batch)
    old_status = batch.status

    if validation.passed:
        batch.status = BatchStatus.PROCESSED
        reason = "所有检查项通过，正常放行"
        action = AuditAction.APPROVE
    else:
        batch.status = BatchStatus.SUPPLEMENT_NEEDED
        reason = "; ".join(validation.get_violation_messages())
        action = AuditAction.SUPPLEMENT

    db.commit()
    db.refresh(batch)

    log_audit(
        db,
        batch_id=batch.id,
        action=action,
        reason=reason,
        handler=handler,
        old_status=old_status,
        new_status=batch.status,
        details=validation.get_summary(),
    )

    return _build_batch_response(db, batch)


@router.post("/{batch_id}/return", response_model=schemas.BatchWithAudit)
def return_batch(
    batch_id: int,
    reason: str = Query(..., description="退回原因"),
    handler: str = Query(..., description="退回操作人"),
    db: Session = Depends(get_db),
):
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    old_status = batch.status
    batch.status = BatchStatus.RETURNED
    db.commit()
    db.refresh(batch)

    log_audit(
        db,
        batch_id=batch.id,
        action=AuditAction.RETURN,
        reason=reason,
        handler=handler,
        old_status=old_status,
        new_status=BatchStatus.RETURNED,
    )

    return _build_batch_response(db, batch)


@router.put("/{batch_id}", response_model=schemas.BatchWithAudit)
def update_batch(
    batch_id: int,
    update: schemas.BatchUpdate,
    handler: str = Query(..., description="修改操作人"),
    db: Session = Depends(get_db),
):
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    old_status = batch.status
    update_data = update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(batch, key, value)

    validation = validate_batch(db, batch)
    if validation.passed:
        batch.status = BatchStatus.PENDING
    else:
        batch.status = BatchStatus.RETURNED

    db.commit()
    db.refresh(batch)

    log_audit(
        db,
        batch_id=batch.id,
        action=AuditAction.UPDATE,
        reason=validation.get_summary() if not validation.passed else "修改后检查通过",
        handler=handler,
        old_status=old_status,
        new_status=batch.status,
        details=validation.get_summary(),
    )

    return _build_batch_response(db, batch)


@router.get("/", response_model=List[schemas.BatchDetail])
def query_batches(
    spray_area: Optional[str] = None,
    chemical_batch_no: Optional[str] = None,
    weather_window_start: Optional[datetime] = None,
    weather_window_end: Optional[datetime] = None,
    status: Optional[BatchStatus] = None,
    batch_no: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Batch)

    if batch_no:
        query = query.filter(models.Batch.batch_no.contains(batch_no))
    if spray_area:
        query = query.filter(models.Batch.spray_area.contains(spray_area))
    if chemical_batch_no:
        query = query.join(models.Chemical).filter(
            models.Chemical.batch_no.contains(chemical_batch_no)
        )
    if weather_window_start or weather_window_end:
        query = query.join(models.WeatherRecord)
        if weather_window_start:
            query = query.filter(
                models.WeatherRecord.weather_window_start >= weather_window_start
            )
        if weather_window_end:
            query = query.filter(
                models.WeatherRecord.weather_window_end <= weather_window_end
            )
    if status:
        query = query.filter(models.Batch.status == status)

    batches = query.order_by(models.Batch.created_at.desc()).all()
    return batches


@router.get("/{batch_id}", response_model=schemas.BatchWithAudit)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return _build_batch_response(db, batch)


@router.get("/{batch_id}/explanation")
def get_explanation(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    validation = validate_batch(db, batch)
    decision = get_decision_explanation(db, batch_id)
    return {
        "validation_summary": get_readable_violation_summary(batch, validation),
        "decision_explanation": decision,
    }


def _build_batch_response(db: Session, batch: models.Batch) -> schemas.BatchWithAudit:
    chemical = db.query(models.Chemical).filter(
        models.Chemical.id == batch.chemical_id
    ).first()
    job = db.query(models.Job).filter(models.Job.id == batch.job_id).first()
    weather = db.query(models.WeatherRecord).filter(
        models.WeatherRecord.id == batch.weather_id
    ).first()

    return schemas.BatchWithAudit(
        id=batch.id,
        batch_no=batch.batch_no,
        spray_area=batch.spray_area,
        chemical_id=batch.chemical_id,
        job_id=batch.job_id,
        weather_id=batch.weather_id,
        dosage=batch.dosage,
        planned_date=batch.planned_date,
        operator=batch.operator,
        status=batch.status,
        created_at=batch.created_at,
        updated_at=batch.updated_at,
        chemical=schemas.Chemical.model_validate(chemical) if chemical else None,
        job=schemas.Job.model_validate(job) if job else None,
        weather=schemas.WeatherRecord.model_validate(weather) if weather else None,
        audit_logs=format_audit_trail(get_audit_trail(db, batch.id)),
    )
