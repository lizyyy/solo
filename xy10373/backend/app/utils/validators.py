from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from ..models import Patient, WardRule, CareCertificate, ReplacementRequest
from fastapi import HTTPException
from typing import Optional


def get_ward_rule(db: Session, ward_name: str) -> Optional[WardRule]:
    return db.query(WardRule).filter(
        WardRule.ward_name == ward_name,
        WardRule.is_active == True
    ).first()


def check_patient_discharged(db: Session, patient_id: str) -> bool:
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"患者 {patient_id} 不存在")
    return patient.is_discharged


def get_active_certificate_count(db: Session, patient_id: str) -> int:
    today = date.today()
    return db.query(CareCertificate).filter(
        CareCertificate.patient_id == patient_id,
        CareCertificate.status == "active",
        CareCertificate.expiry_date >= today
    ).count()


def check_caregiver_limit(db: Session, patient_id: str) -> dict:
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"患者 {patient_id} 不存在")
    
    if patient.is_discharged:
        return {
            "valid": False,
            "error_code": "PATIENT_DISCHARGED",
            "message": f"患者 {patient.name} 已出院，无法办理陪护证",
            "details": f"出院日期: {patient.discharge_date}"
        }
    
    ward_rule = get_ward_rule(db, patient.ward)
    max_caregivers = ward_rule.max_caregivers if ward_rule else 1
    
    active_count = get_active_certificate_count(db, patient_id)
    
    if active_count >= max_caregivers:
        return {
            "valid": False,
            "error_code": "MAX_CAREGIVERS_EXCEEDED",
            "message": f"已达到陪护人数上限",
            "details": f"病区 {patient.ward} 最多允许 {max_caregivers} 名陪护人，当前有效证件: {active_count}"
        }
    
    return {
        "valid": True,
        "max_caregivers": max_caregivers,
        "current_count": active_count
    }


def check_certificate_expiry(db: Session, certificate_id: int) -> dict:
    certificate = db.query(CareCertificate).filter(CareCertificate.id == certificate_id).first()
    if not certificate:
        raise HTTPException(status_code=404, detail=f"陪护证不存在")
    
    today = date.today()
    
    if certificate.status != "active":
        return {
            "valid": False,
            "error_code": "CERTIFICATE_INACTIVE",
            "message": "陪护证非激活状态",
            "details": f"当前状态: {certificate.status}"
        }
    
    if certificate.expiry_date < today:
        return {
            "valid": False,
            "error_code": "CERTIFICATE_EXPIRED",
            "message": "陪护证已过期",
            "details": f"过期日期: {certificate.expiry_date}"
        }
    
    days_remaining = (certificate.expiry_date - today).days
    
    return {
        "valid": True,
        "days_remaining": days_remaining,
        "expiry_date": certificate.expiry_date
    }


def check_pending_replacement(db: Session, certificate_id: int) -> dict:
    pending = db.query(ReplacementRequest).filter(
        ReplacementRequest.certificate_id == certificate_id,
        ReplacementRequest.status == "pending"
    ).first()
    
    if pending:
        return {
            "valid": False,
            "error_code": "PENDING_REPLACEMENT",
            "message": "存在未审批的换人申请",
            "details": f"申请单号: {pending.request_no}, 申请日期: {pending.request_date}"
        }
    
    return {"valid": True}


def validate_certificate_creation(db: Session, patient_id: str, issue_date: date, expiry_date: date) -> dict:
    if issue_date > expiry_date:
        return {
            "valid": False,
            "error_code": "INVALID_DATE_RANGE",
            "message": "发证日期不能晚于过期日期",
            "details": f"发证日期: {issue_date}, 过期日期: {expiry_date}"
        }
    
    limit_check = check_caregiver_limit(db, patient_id)
    if not limit_check["valid"]:
        return limit_check
    
    return {"valid": True}


def validate_replacement_request(db: Session, certificate_id: int) -> dict:
    certificate = db.query(CareCertificate).filter(CareCertificate.id == certificate_id).first()
    if not certificate:
        raise HTTPException(status_code=404, detail=f"陪护证不存在")
    
    expiry_check = check_certificate_expiry(db, certificate_id)
    if not expiry_check["valid"]:
        return expiry_check
    
    pending_check = check_pending_replacement(db, certificate_id)
    if not pending_check["valid"]:
        return pending_check
    
    return {"valid": True}


def calculate_days_remaining(expiry_date: date) -> int:
    today = date.today()
    return (expiry_date - today).days


def get_certificate_status_with_days(db: Session, certificate: CareCertificate) -> str:
    if certificate.status != "active":
        return certificate.status
    
    days_remaining = calculate_days_remaining(certificate.expiry_date)
    
    if days_remaining < 0:
        return "expired"
    elif days_remaining <= 3:
        return "expiring_soon"
    else:
        return "active"


def update_expired_certificates(db: Session) -> int:
    today = date.today()
    expired_count = db.query(CareCertificate).filter(
        CareCertificate.status == "active",
        CareCertificate.expiry_date < today
    ).update({"status": "expired"}, synchronize_session=False)
    db.commit()
    return expired_count
