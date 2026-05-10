from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import date, datetime
from typing import List, Optional
from ..database import get_db
from ..models import Patient, Caregiver, CareCertificate, OperationLog, WardRule
from ..schemas import CaregiverCreate, CaregiverResponse, CareCertificateCreate, CareCertificateResponse, OperationLogResponse
from ..utils.validators import validate_certificate_creation, calculate_days_remaining, check_certificate_expiry, update_expired_certificates

router = APIRouter(prefix="/api/certificates", tags=["certificates"])


def generate_certificate_no() -> str:
    today = date.today().strftime("%Y%m%d")
    timestamp = datetime.now().strftime("%H%M%S%f")[:8]
    return f"PHZ-{today}-{timestamp}"


def log_operation(db: Session, operation_type: str, operator: str, action: str, result: str,
                  patient_id: str = None, certificate_id: int = None,
                  old_value: str = None, new_value: str = None,
                  notes: str = None, source_file: str = None):
    log = OperationLog(
        operation_type=operation_type,
        patient_id=patient_id,
        certificate_id=certificate_id,
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


def get_or_create_caregiver(db: Session, caregiver_data: dict) -> Caregiver:
    caregiver = db.query(Caregiver).filter(Caregiver.id_card == caregiver_data["id_card"]).first()
    if caregiver:
        return caregiver
    
    new_caregiver = Caregiver(**caregiver_data)
    db.add(new_caregiver)
    db.commit()
    db.refresh(new_caregiver)
    return new_caregiver


@router.post("/caregivers", response_model=CaregiverResponse)
def create_caregiver(caregiver: CaregiverCreate, db: Session = Depends(get_db)):
    existing = db.query(Caregiver).filter(Caregiver.id_card == caregiver.id_card).first()
    if existing:
        return existing
    
    db_caregiver = Caregiver(**caregiver.model_dump())
    db.add(db_caregiver)
    db.commit()
    db.refresh(db_caregiver)
    return db_caregiver


@router.get("/caregivers", response_model=List[CaregiverResponse])
def get_caregivers(
    keyword: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(Caregiver)
    
    if keyword:
        query = query.filter(
            or_(
                Caregiver.name.like(f"%{keyword}%"),
                Caregiver.id_card.like(f"%{keyword}%"),
                Caregiver.caregiver_id.like(f"%{keyword}%")
            )
        )
    
    return query.order_by(Caregiver.created_at.desc()).offset(skip).limit(limit).all()


@router.post("", response_model=CareCertificateResponse)
def create_certificate(cert_data: CareCertificateCreate, db: Session = Depends(get_db)):
    update_expired_certificates(db)
    
    patient = db.query(Patient).filter(Patient.patient_id == cert_data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"患者 {cert_data.patient_id} 不存在")
    
    caregiver = db.query(Caregiver).filter(Caregiver.caregiver_id == cert_data.caregiver_id).first()
    if not caregiver:
        raise HTTPException(status_code=404, detail=f"陪护人 {cert_data.caregiver_id} 不存在")
    
    validation = validate_certificate_creation(
        db=db,
        patient_id=cert_data.patient_id,
        issue_date=cert_data.issue_date,
        expiry_date=cert_data.expiry_date
    )
    
    if not validation["valid"]:
        log_operation(
            db=db,
            operation_type="CERTIFICATE_ISSUE",
            operator=cert_data.operator,
            action=f"尝试为患者 {patient.name} 办理陪护证",
            result="failed",
            patient_id=cert_data.patient_id,
            notes=f"{validation['message']}: {validation.get('details', '')}",
            source_file=cert_data.source_file
        )
        raise HTTPException(status_code=400, detail={
            "error_code": validation["error_code"],
            "message": validation["message"],
            "details": validation.get("details")
        })
    
    certificate_no = generate_certificate_no()
    
    certificate = CareCertificate(
        certificate_no=certificate_no,
        patient_id=cert_data.patient_id,
        caregiver_id=cert_data.caregiver_id,
        issue_date=cert_data.issue_date,
        expiry_date=cert_data.expiry_date,
        status="active",
        notes=cert_data.notes,
        source_file=cert_data.source_file
    )
    
    db.add(certificate)
    db.commit()
    db.refresh(certificate)
    
    log_operation(
        db=db,
        operation_type="CERTIFICATE_ISSUE",
        operator=cert_data.operator,
        action=f"为患者 {patient.name} 办理陪护证",
        result="success",
        patient_id=cert_data.patient_id,
        certificate_id=certificate.id,
        new_value=f"证件号: {certificate_no}, 陪护人: {caregiver.name}, 有效期至: {cert_data.expiry_date}",
        source_file=cert_data.source_file
    )
    
    days_remaining = calculate_days_remaining(certificate.expiry_date)
    
    return {
        "id": certificate.id,
        "certificate_no": certificate.certificate_no,
        "patient_id": certificate.patient_id,
        "caregiver_id": certificate.caregiver_id,
        "caregiver_name": caregiver.name,
        "issue_date": certificate.issue_date,
        "expiry_date": certificate.expiry_date,
        "status": certificate.status,
        "notes": certificate.notes,
        "source_file": certificate.source_file,
        "days_remaining": days_remaining,
        "created_at": certificate.created_at,
        "updated_at": certificate.updated_at
    }


@router.get("", response_model=List[CareCertificateResponse])
def get_certificates(
    patient_id: Optional[str] = None,
    status: Optional[str] = None,
    ward: Optional[str] = None,
    expiring_soon: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    update_expired_certificates(db)
    
    today = date.today()
    
    query = db.query(CareCertificate)
    
    if patient_id:
        query = query.filter(CareCertificate.patient_id == patient_id)
    
    if ward:
        query = query.join(Patient, CareCertificate.patient_id == Patient.patient_id).filter(Patient.ward == ward)
    
    if status:
        query = query.filter(CareCertificate.status == status)
    
    if expiring_soon:
        from datetime import timedelta
        three_days_later = today + timedelta(days=3)
        query = query.filter(
            CareCertificate.status == "active",
            CareCertificate.expiry_date >= today,
            CareCertificate.expiry_date <= three_days_later
        )
    
    certificates = query.order_by(CareCertificate.created_at.desc()).offset(skip).limit(limit).all()
    
    results = []
    for cert in certificates:
        caregiver = db.query(Caregiver).filter(Caregiver.caregiver_id == cert.caregiver_id).first()
        days_remaining = calculate_days_remaining(cert.expiry_date)
        
        status_display = cert.status
        if cert.status == "active":
            if days_remaining < 0:
                status_display = "expired"
            elif days_remaining <= 3:
                status_display = "expiring_soon"
        
        results.append({
            "id": cert.id,
            "certificate_no": cert.certificate_no,
            "patient_id": cert.patient_id,
            "caregiver_id": cert.caregiver_id,
            "caregiver_name": caregiver.name if caregiver else None,
            "issue_date": cert.issue_date,
            "expiry_date": cert.expiry_date,
            "status": status_display,
            "notes": cert.notes,
            "source_file": cert.source_file,
            "days_remaining": days_remaining,
            "created_at": cert.created_at,
            "updated_at": cert.updated_at
        })
    
    return results


@router.get("/{certificate_id}", response_model=CareCertificateResponse)
def get_certificate(certificate_id: int, db: Session = Depends(get_db)):
    update_expired_certificates(db)
    
    certificate = db.query(CareCertificate).filter(CareCertificate.id == certificate_id).first()
    if not certificate:
        raise HTTPException(status_code=404, detail="陪护证不存在")
    
    caregiver = db.query(Caregiver).filter(Caregiver.caregiver_id == certificate.caregiver_id).first()
    days_remaining = calculate_days_remaining(certificate.expiry_date)
    
    status_display = certificate.status
    if certificate.status == "active":
        if days_remaining < 0:
            status_display = "expired"
        elif days_remaining <= 3:
            status_display = "expiring_soon"
    
    return {
        "id": certificate.id,
        "certificate_no": certificate.certificate_no,
        "patient_id": certificate.patient_id,
        "caregiver_id": certificate.caregiver_id,
        "caregiver_name": caregiver.name if caregiver else None,
        "issue_date": certificate.issue_date,
        "expiry_date": certificate.expiry_date,
        "status": status_display,
        "notes": certificate.notes,
        "source_file": certificate.source_file,
        "days_remaining": days_remaining,
        "created_at": certificate.created_at,
        "updated_at": certificate.updated_at
    }


@router.post("/{certificate_id}/renew")
def renew_certificate(certificate_id: int, new_expiry_date: date, operator: str, db: Session = Depends(get_db)):
    update_expired_certificates(db)
    
    certificate = db.query(CareCertificate).filter(CareCertificate.id == certificate_id).first()
    if not certificate:
        raise HTTPException(status_code=404, detail="陪护证不存在")
    
    if new_expiry_date <= certificate.expiry_date:
        raise HTTPException(status_code=400, detail="新的过期日期必须晚于当前过期日期")
    
    old_expiry = certificate.expiry_date
    certificate.expiry_date = new_expiry_date
    certificate.status = "active"
    
    db.commit()
    db.refresh(certificate)
    
    patient = db.query(Patient).filter(Patient.patient_id == certificate.patient_id).first()
    
    log_operation(
        db=db,
        operation_type="CERTIFICATE_RENEW",
        operator=operator,
        action=f"续期陪护证 {certificate.certificate_no}",
        result="success",
        patient_id=certificate.patient_id,
        certificate_id=certificate.id,
        old_value=f"过期日期: {old_expiry}",
        new_value=f"过期日期: {new_expiry_date}"
    )
    
    return {"message": "续期成功", "certificate_no": certificate.certificate_no, "new_expiry_date": new_expiry_date}


@router.post("/{certificate_id}/cancel")
def cancel_certificate(certificate_id: int, operator: str, reason: str = None, db: Session = Depends(get_db)):
    certificate = db.query(CareCertificate).filter(CareCertificate.id == certificate_id).first()
    if not certificate:
        raise HTTPException(status_code=404, detail="陪护证不存在")
    
    old_status = certificate.status
    certificate.status = "cancelled"
    
    db.commit()
    db.refresh(certificate)
    
    patient = db.query(Patient).filter(Patient.patient_id == certificate.patient_id).first()
    
    log_operation(
        db=db,
        operation_type="CERTIFICATE_CANCEL",
        operator=operator,
        action=f"注销陪护证 {certificate.certificate_no}",
        result="success",
        patient_id=certificate.patient_id,
        certificate_id=certificate.id,
        old_value=f"状态: {old_status}",
        new_value="状态: cancelled",
        notes=reason
    )
    
    return {"message": "注销成功", "certificate_no": certificate.certificate_no}


@router.get("/{certificate_id}/logs", response_model=List[OperationLogResponse])
def get_certificate_logs(
    certificate_id: int,
    db: Session = Depends(get_db)
):
    certificate = db.query(CareCertificate).filter(CareCertificate.id == certificate_id).first()
    if not certificate:
        raise HTTPException(status_code=404, detail="陪护证不存在")
    
    patient = db.query(Patient).filter(Patient.patient_id == certificate.patient_id).first()
    
    logs = db.query(OperationLog).filter(
        or_(
            OperationLog.certificate_id == certificate_id,
            and_(
                OperationLog.patient_id == certificate.patient_id,
                OperationLog.operation_type.in_(["CERTIFICATE_ISSUE", "CERTIFICATE_RENEW", "CERTIFICATE_CANCEL", "REPLACEMENT_APPROVE"])
            )
        )
    ).order_by(OperationLog.created_at.desc()).all()
    
    results = []
    for log in logs:
        results.append({
            "id": log.id,
            "operation_type": log.operation_type,
            "patient_id": log.patient_id,
            "patient_name": patient.name if patient else None,
            "certificate_id": log.certificate_id,
            "certificate_no": certificate.certificate_no if log.certificate_id == certificate_id else None,
            "operator": log.operator,
            "action": log.action,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "source_file": log.source_file,
            "result": log.result,
            "notes": log.notes,
            "created_at": log.created_at
        })
    
    return results
