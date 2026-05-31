from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional, Dict, Any
from datetime import datetime
import json
import hashlib

from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/api/records", tags=["数据记录"])


@router.get("/energy")
def get_energy_records(
    compressor_id: int,
    start_time: datetime,
    end_time: datetime,
    skip: int = 0,
    limit: int = 1000,
    db: Session = Depends(get_db)
):
    records = db.query(models.EnergyRecord).filter(
        and_(
            models.EnergyRecord.compressor_id == compressor_id,
            models.EnergyRecord.record_time >= start_time,
            models.EnergyRecord.record_time <= end_time,
        )
    ).order_by(models.EnergyRecord.record_time).offset(skip).limit(limit).all()

    total = db.query(models.EnergyRecord).filter(
        and_(
            models.EnergyRecord.compressor_id == compressor_id,
            models.EnergyRecord.record_time >= start_time,
            models.EnergyRecord.record_time <= end_time,
        )
    ).count()

    view_state = {
        "compressor_id": compressor_id,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "skip": skip,
        "limit": limit,
        "record_count": len(records),
        "total_count": total,
    }
    view_hash = hashlib.sha256(json.dumps(view_state, sort_keys=True).encode()).hexdigest()[:16]

    return {
        "records": [
            {
                "id": r.id,
                "record_time": r.record_time,
                "power": r.power,
                "current": r.current,
                "voltage": r.voltage,
                "pressure": r.pressure,
                "flow_rate": r.flow_rate,
                "temperature": r.temperature,
                "running_hours": r.running_hours,
                "load_rate": r.load_rate,
                "is_manual_edited": r.is_manual_edited,
                "edited_by": r.edited_by,
                "edited_at": r.edited_at,
            }
            for r in records
        ],
        "total": total,
        "view_hash": view_hash,
        "view_state": view_state,
    }


@router.get("/vibration")
def get_vibration_records(
    compressor_id: int,
    start_time: datetime,
    end_time: datetime,
    skip: int = 0,
    limit: int = 1000,
    db: Session = Depends(get_db)
):
    records = db.query(models.VibrationRecord).filter(
        and_(
            models.VibrationRecord.compressor_id == compressor_id,
            models.VibrationRecord.record_time >= start_time,
            models.VibrationRecord.record_time <= end_time,
        )
    ).order_by(models.VibrationRecord.record_time).offset(skip).limit(limit).all()

    total = db.query(models.VibrationRecord).filter(
        and_(
            models.VibrationRecord.compressor_id == compressor_id,
            models.VibrationRecord.record_time >= start_time,
            models.VibrationRecord.record_time <= end_time,
        )
    ).count()

    view_state = {
        "compressor_id": compressor_id,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "skip": skip,
        "limit": limit,
        "record_count": len(records),
        "total_count": total,
    }
    view_hash = hashlib.sha256(json.dumps(view_state, sort_keys=True).encode()).hexdigest()[:16]

    return {
        "records": [
            {
                "id": r.id,
                "record_time": r.record_time,
                "x_vibration": r.x_vibration,
                "y_vibration": r.y_vibration,
                "z_vibration": r.z_vibration,
                "overall_vibration": r.overall_vibration,
                "is_manual_edited": r.is_manual_edited,
                "edited_by": r.edited_by,
                "edited_at": r.edited_at,
            }
            for r in records
        ],
        "total": total,
        "view_hash": view_hash,
        "view_state": view_state,
    }


@router.put("/energy/{record_id}")
def update_energy_record(
    record_id: int,
    update: schemas.EnergyRecordUpdate,
    db: Session = Depends(get_db)
):
    record = db.query(models.EnergyRecord).filter(
        models.EnergyRecord.id == record_id
    ).first()

    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    update_data = update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None and key != "edited_by":
            setattr(record, key, value)

    record.is_manual_edited = True
    record.edited_by = update.edited_by or "system"
    record.edited_at = datetime.now()

    db.commit()
    db.refresh(record)

    return {
        "success": True,
        "message": "记录已更新",
        "record_id": record.id,
        "is_manual_edited": record.is_manual_edited,
    }


@router.put("/vibration/{record_id}")
def update_vibration_record(
    record_id: int,
    update: schemas.VibrationRecordUpdate,
    db: Session = Depends(get_db)
):
    record = db.query(models.VibrationRecord).filter(
        models.VibrationRecord.id == record_id
    ).first()

    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    update_data = update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None and key != "edited_by":
            setattr(record, key, value)

    record.is_manual_edited = True
    record.edited_by = update.edited_by or "system"
    record.edited_at = datetime.now()

    db.commit()
    db.refresh(record)

    return {
        "success": True,
        "message": "记录已更新",
        "record_id": record.id,
        "is_manual_edited": record.is_manual_edited,
    }


@router.get("/compressors")
def get_compressors(db: Session = Depends(get_db)):
    compressors = db.query(models.Compressor).all()
    return [
        {
            "id": c.id,
            "equipment_no": c.equipment_no,
            "name": c.name,
            "model": c.model,
            "rated_power": c.rated_power,
            "rated_pressure": c.rated_pressure,
            "location": c.location,
            "created_at": c.created_at,
        }
        for c in compressors
    ]


@router.post("/compressors", response_model=schemas.Compressor)
def create_compressor(
    compressor: schemas.CompressorCreate,
    db: Session = Depends(get_db)
):
    existing = db.query(models.Compressor).filter(
        models.Compressor.equipment_no == compressor.equipment_no
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="设备编号已存在")

    db_compressor = models.Compressor(**compressor.model_dump())
    db.add(db_compressor)
    db.commit()
    db.refresh(db_compressor)

    return db_compressor


@router.get("/history/audit")
def get_audit_history(
    compressor_id: Optional[int] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    edited_energy = db.query(models.EnergyRecord).filter(
        models.EnergyRecord.is_manual_edited == True
    )
    edited_vibration = db.query(models.VibrationRecord).filter(
        models.VibrationRecord.is_manual_edited == True
    )
    reviewed_diagnoses = db.query(models.Diagnosis).filter(
        models.Diagnosis.reviewed_at != None
    )
    corrected_diagnoses = db.query(models.Diagnosis).filter(
        models.Diagnosis.is_manual_corrected == True
    )

    if compressor_id:
        edited_energy = edited_energy.filter(models.EnergyRecord.compressor_id == compressor_id)
        edited_vibration = edited_vibration.filter(models.VibrationRecord.compressor_id == compressor_id)
        reviewed_diagnoses = reviewed_diagnoses.filter(models.Diagnosis.compressor_id == compressor_id)
        corrected_diagnoses = corrected_diagnoses.filter(models.Diagnosis.compressor_id == compressor_id)

    if start_time:
        edited_energy = edited_energy.filter(models.EnergyRecord.edited_at >= start_time)
        edited_vibration = edited_vibration.filter(models.VibrationRecord.edited_at >= start_time)
        reviewed_diagnoses = reviewed_diagnoses.filter(models.Diagnosis.reviewed_at >= start_time)
        corrected_diagnoses = corrected_diagnoses.filter(models.Diagnosis.corrected_at >= start_time)

    if end_time:
        edited_energy = edited_energy.filter(models.EnergyRecord.edited_at <= end_time)
        edited_vibration = edited_vibration.filter(models.VibrationRecord.edited_at <= end_time)
        reviewed_diagnoses = reviewed_diagnoses.filter(models.Diagnosis.reviewed_at <= end_time)
        corrected_diagnoses = corrected_diagnoses.filter(models.Diagnosis.corrected_at <= end_time)

    audit_log = []

    for r in edited_energy.order_by(models.EnergyRecord.edited_at.desc()).all():
        audit_log.append({
            "type": "energy_edit",
            "time": r.edited_at,
            "compressor_id": r.compressor_id,
            "record_id": r.id,
            "record_time": r.record_time,
            "operator": r.edited_by,
            "description": "能耗数据人工修正",
        })

    for r in edited_vibration.order_by(models.VibrationRecord.edited_at.desc()).all():
        audit_log.append({
            "type": "vibration_edit",
            "time": r.edited_at,
            "compressor_id": r.compressor_id,
            "record_id": r.id,
            "record_time": r.record_time,
            "operator": r.edited_by,
            "description": "振动数据人工修正",
        })

    for d in reviewed_diagnoses.order_by(models.Diagnosis.reviewed_at.desc()).all():
        audit_log.append({
            "type": "diagnosis_review",
            "time": d.reviewed_at,
            "compressor_id": d.compressor_id,
            "record_id": d.id,
            "record_time": d.diagnosis_time,
            "operator": d.reviewed_by,
            "description": f"诊断复核 - {d.status}",
            "comment": d.review_comment,
        })

    for d in corrected_diagnoses.order_by(models.Diagnosis.corrected_at.desc()).all():
        audit_log.append({
            "type": "diagnosis_correction",
            "time": d.corrected_at,
            "compressor_id": d.compressor_id,
            "record_id": d.id,
            "record_time": d.diagnosis_time,
            "operator": d.corrected_by,
            "description": "诊断结果人工修正",
            "comment": d.correction_note,
        })

    audit_log.sort(key=lambda x: x["time"] if x["time"] else datetime.min, reverse=True)

    return {
        "total_count": len(audit_log),
        "audit_log": audit_log,
    }
