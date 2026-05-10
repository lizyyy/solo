from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime
from typing import List, Optional
from ..database import get_db
from ..models import Patient, OperationLog
from ..schemas import PatientCreate, PatientUpdate, PatientResponse, OperationLogResponse
from ..utils.validators import calculate_days_remaining

router = APIRouter(prefix="/api/patients", tags=["patients"])


def log_operation(db: Session, operation_type: str, patient_id: str, operator: str, 
                  action: str, result: str, old_value: str = None, new_value: str = None,
                  notes: str = None, source_file: str = None):
    log = OperationLog(
        operation_type=operation_type,
        patient_id=patient_id,
        operator=operator,
        action=action,
        old_value=old_value,
        new_value=new_value,
        source_file=source_file,
        result=result,
        notes=notes
    )
    db.add(log)
    db.commit()


@router.get("", response_model=List[PatientResponse])
def get_patients(
    ward: Optional[str] = None,
    is_discharged: Optional[bool] = None,
    keyword: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(Patient)
    
    if ward:
        query = query.filter(Patient.ward == ward)
    
    if is_discharged is not None:
        query = query.filter(Patient.is_discharged == is_discharged)
    
    if keyword:
        query = query.filter(
            or_(
                Patient.name.like(f"%{keyword}%"),
                Patient.patient_id.like(f"%{keyword}%"),
                Patient.id_card.like(f"%{keyword}%")
            )
        )
    
    return query.order_by(Patient.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient(patient_id: str, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"患者 {patient_id} 不存在")
    return patient


@router.post("", response_model=PatientResponse)
def create_patient(patient: PatientCreate, db: Session = Depends(get_db)):
    existing = db.query(Patient).filter(Patient.patient_id == patient.patient_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"患者 {patient.patient_id} 已存在")
    
    db_patient = Patient(**patient.model_dump())
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    
    log_operation(
        db=db,
        operation_type="PATIENT_REGISTER",
        patient_id=patient.patient_id,
        operator="system",
        action=f"登记患者: {patient.name}",
        result="success",
        new_value=f"病区: {patient.ward}, 床号: {patient.bed_no}"
    )
    
    return db_patient


@router.put("/{patient_id}", response_model=PatientResponse)
def update_patient(patient_id: str, patient_update: PatientUpdate, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"患者 {patient_id} 不存在")
    
    old_data = f"出院状态: {patient.is_discharged}, 病区: {patient.ward}"
    
    update_data = patient_update.model_dump(exclude_unset=True)
    
    if "discharge_date" in update_data and update_data["discharge_date"]:
        update_data["is_discharged"] = True
    
    for key, value in update_data.items():
        setattr(patient, key, value)
    
    db.commit()
    db.refresh(patient)
    
    new_data = f"出院状态: {patient.is_discharged}, 病区: {patient.ward}"
    if old_data != new_data:
        log_operation(
            db=db,
            operation_type="PATIENT_UPDATE",
            patient_id=patient_id,
            operator="system",
            action=f"更新患者信息: {patient.name}",
            result="success",
            old_value=old_data,
            new_value=new_data
        )
    
    return patient


@router.get("/{patient_id}/logs", response_model=List[OperationLogResponse])
def get_patient_logs(
    patient_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"患者 {patient_id} 不存在")
    
    logs = db.query(OperationLog).filter(
        OperationLog.patient_id == patient_id
    ).order_by(OperationLog.created_at.desc()).offset(skip).limit(limit).all()
    
    results = []
    for log in logs:
        log_dict = {
            "id": log.id,
            "operation_type": log.operation_type,
            "patient_id": log.patient_id,
            "patient_name": patient.name if patient else None,
            "certificate_id": log.certificate_id,
            "certificate_no": None,
            "operator": log.operator,
            "action": log.action,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "source_file": log.source_file,
            "result": log.result,
            "notes": log.notes,
            "created_at": log.created_at
        }
        results.append(log_dict)
    
    return results
