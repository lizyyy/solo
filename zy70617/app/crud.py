from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from datetime import date, datetime, timedelta
import uuid
import json
from typing import List, Optional

from app import models, schemas
from app.models import CertificateStatus, RetakeStatus, RenewalStatus


def log_exception(db: Session, operation_type: str, original_input: dict, handler: str = None, conclusion: str = None, error_message: str = None):
    exception_log = models.ExceptionLog(
        operation_type=operation_type,
        original_input=json.dumps(original_input, ensure_ascii=False, default=str),
        handler=handler,
        conclusion=conclusion,
        error_message=error_message
    )
    db.add(exception_log)
    db.commit()


def generate_renewal_code() -> str:
    return f"R{datetime.now().strftime('%Y%m%d')}{uuid.uuid4().hex[:8].upper()}"


def get_certificate_status(expiry_date: Optional[date]) -> str:
    if not expiry_date:
        return CertificateStatus.VALID
    today = date.today()
    days_until_expiry = (expiry_date - today).days
    if days_until_expiry < 0:
        return CertificateStatus.EXPIRED
    elif days_until_expiry <= 90:
        return CertificateStatus.EXPIRING_SOON
    return CertificateStatus.VALID


def create_employee(db: Session, employee: schemas.EmployeeCreate):
    db_employee = models.Employee(**employee.model_dump())
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    return db_employee


def get_employee(db: Session, employee_id: int):
    return db.query(models.Employee).filter(models.Employee.id == employee_id).first()


def get_employee_by_employee_id(db: Session, employee_id: str):
    return db.query(models.Employee).filter(models.Employee.employee_id == employee_id).first()


def get_employees(db: Session, skip: int = 0, limit: int = 100, department: str = None):
    query = db.query(models.Employee)
    if department:
        query = query.filter(models.Employee.department == department)
    return query.offset(skip).limit(limit).all()


def update_employee(db: Session, employee_id: int, employee_update: schemas.EmployeeUpdate):
    db_employee = get_employee(db, employee_id)
    if not db_employee:
        return None
    for key, value in employee_update.model_dump(exclude_unset=True).items():
        setattr(db_employee, key, value)
    db.commit()
    db.refresh(db_employee)
    return db_employee


def create_certificate_type(db: Session, cert_type: schemas.CertificateTypeCreate):
    db_cert_type = models.CertificateType(**cert_type.model_dump())
    db.add(db_cert_type)
    db.commit()
    db.refresh(db_cert_type)
    return db_cert_type


def get_certificate_type(db: Session, type_id: int):
    return db.query(models.CertificateType).filter(models.CertificateType.id == type_id).first()


def get_certificate_type_by_code(db: Session, type_code: str):
    return db.query(models.CertificateType).filter(models.CertificateType.type_code == type_code).first()


def get_certificate_types(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.CertificateType).offset(skip).limit(limit).all()


def create_employee_certificate(db: Session, cert: schemas.EmployeeCertificateCreate):
    cert_type = get_certificate_type(db, cert.certificate_type_id)
    is_passed = cert.score >= cert_type.required_score if cert_type and cert.score else True
    
    db_cert = models.EmployeeCertificate(
        **cert.model_dump(),
        is_valid=is_passed
    )
    db.add(db_cert)
    db.commit()
    db.refresh(db_cert)
    return db_cert


def get_employee_certificate(db: Session, cert_id: int):
    return db.query(models.EmployeeCertificate).filter(models.EmployeeCertificate.id == cert_id).first()


def get_employee_certificates(db: Session, employee_id: int = None, skip: int = 0, limit: int = 100):
    query = db.query(models.EmployeeCertificate)
    if employee_id:
        query = query.filter(models.EmployeeCertificate.employee_id == employee_id)
    return query.offset(skip).limit(limit).all()


def update_employee_certificate(db: Session, cert_id: int, cert_update: schemas.EmployeeCertificateUpdate):
    db_cert = get_employee_certificate(db, cert_id)
    if not db_cert:
        return None
    for key, value in cert_update.model_dump(exclude_unset=True).items():
        setattr(db_cert, key, value)
    db.commit()
    db.refresh(db_cert)
    return db_cert


def create_course_score(db: Session, score: schemas.CourseScoreCreate):
    cert_type = get_certificate_type(db, score.certificate_type_id)
    is_passed = score.score >= cert_type.required_score if cert_type else score.score >= 60
    
    db_score = models.CourseScore(
        **score.model_dump(),
        is_passed=is_passed
    )
    db.add(db_score)
    db.commit()
    db.refresh(db_score)
    
    if not is_passed:
        retake = models.RetakeRecord(
            employee_id=score.employee_id,
            course_score_id=db_score.id,
            status=RetakeStatus.NOT_STARTED
        )
        db.add(retake)
        db.commit()
    
    return db_score


def get_course_score(db: Session, score_id: int):
    return db.query(models.CourseScore).filter(models.CourseScore.id == score_id).first()


def get_course_scores(db: Session, employee_id: int = None, skip: int = 0, limit: int = 100):
    query = db.query(models.CourseScore)
    if employee_id:
        query = query.filter(models.CourseScore.employee_id == employee_id)
    return query.offset(skip).limit(limit).all()


def create_retake_record(db: Session, retake: schemas.RetakeRecordCreate):
    db_retake = models.RetakeRecord(**retake.model_dump())
    db.add(db_retake)
    db.commit()
    db.refresh(db_retake)
    return db_retake


def get_retake_record(db: Session, retake_id: int):
    return db.query(models.RetakeRecord).filter(models.RetakeRecord.id == retake_id).first()


def get_retake_records(db: Session, employee_id: int = None, status: str = None, skip: int = 0, limit: int = 100):
    query = db.query(models.RetakeRecord)
    if employee_id:
        query = query.filter(models.RetakeRecord.employee_id == employee_id)
    if status:
        query = query.filter(models.RetakeRecord.status == status)
    return query.offset(skip).limit(limit).all()


def update_retake_record(db: Session, retake_id: int, retake_update: schemas.RetakeRecordUpdate):
    db_retake = get_retake_record(db, retake_id)
    if not db_retake:
        return None
    
    update_data = retake_update.model_dump(exclude_unset=True)
    
    if retake_update.retake_score is not None:
        course_score = db.query(models.CourseScore).filter(models.CourseScore.id == db_retake.course_score_id).first()
        if course_score:
            cert_type = get_certificate_type(db, course_score.certificate_type_id)
            required_score = cert_type.required_score if cert_type else 60.0
            update_data["is_passed"] = retake_update.retake_score >= required_score
            update_data["status"] = RetakeStatus.PASSED if update_data["is_passed"] else RetakeStatus.FAILED
    
    for key, value in update_data.items():
        setattr(db_retake, key, value)
    
    db.commit()
    db.refresh(db_retake)
    return db_retake


def create_position_requirement(db: Session, req: schemas.PositionRequirementCreate):
    db_req = models.PositionRequirement(**req.model_dump())
    db.add(db_req)
    db.commit()
    db.refresh(db_req)
    return db_req


def get_position_requirements(db: Session, position_name: str = None, skip: int = 0, limit: int = 100):
    query = db.query(models.PositionRequirement)
    if position_name:
        query = query.filter(models.PositionRequirement.position_name == position_name)
    return query.offset(skip).limit(limit).all()


def create_position_qualification(db: Session, qual: schemas.PositionQualificationCreate):
    db_qual = models.PositionQualification(**qual.model_dump())
    db.add(db_qual)
    db.commit()
    db.refresh(db_qual)
    return db_qual


def get_position_qualifications(db: Session, employee_id: int = None, position_name: str = None, skip: int = 0, limit: int = 100):
    query = db.query(models.PositionQualification)
    if employee_id:
        query = query.filter(models.PositionQualification.employee_id == employee_id)
    if position_name:
        query = query.filter(models.PositionQualification.position_name == position_name)
    return query.offset(skip).limit(limit).all()


def check_employee_qualification(db: Session, employee_id: int, position_name: str):
    employee = get_employee(db, employee_id)
    if not employee:
        return []
    
    requirements = get_position_requirements(db, position_name=position_name)
    results = []
    
    for req in requirements:
        cert_type = get_certificate_type(db, req.certificate_type_id)
        
        cert = db.query(models.EmployeeCertificate).filter(
            and_(
                models.EmployeeCertificate.employee_id == employee_id,
                models.EmployeeCertificate.certificate_type_id == req.certificate_type_id,
                models.EmployeeCertificate.is_valid == True
            )
        ).first()
        
        has_certificate = cert is not None
        is_certificate_valid = False
        cert_status = None
        
        if cert:
            cert_status = get_certificate_status(cert.expiry_date)
            is_certificate_valid = cert_status != CertificateStatus.EXPIRED
        
        course_scores = db.query(models.CourseScore).filter(
            and_(
                models.CourseScore.employee_id == employee_id,
                models.CourseScore.certificate_type_id == req.certificate_type_id,
                models.CourseScore.is_passed == True
            )
        ).first()
        has_required_score = course_scores is not None
        
        is_qualified = has_certificate and is_certificate_valid and (has_required_score or not req.is_required)
        
        remarks = []
        if not has_certificate:
            remarks.append("无对应证书")
        elif not is_certificate_valid:
            remarks.append("证书已过期")
        if not has_required_score and req.is_required:
            remarks.append("未达到要求分数")
        if is_qualified:
            remarks.append("符合要求")
        
        results.append(schemas.QualificationCheckResult(
            employee_id=employee.employee_id,
            employee_name=employee.name,
            position_name=position_name,
            certificate_type=cert_type.name if cert_type else "未知",
            has_certificate=has_certificate,
            is_certificate_valid=is_certificate_valid,
            certificate_status=cert_status,
            has_required_score=has_required_score,
            is_qualified=is_qualified,
            remarks="; ".join(remarks)
        ))
    
    return results


def create_renewal_item(db: Session, renewal: schemas.RenewalItemCreate):
    existing = db.query(models.RenewalItem).filter(
        and_(
            models.RenewalItem.employee_id == renewal.employee_id,
            models.RenewalItem.certificate_type_id == renewal.certificate_type_id,
            models.RenewalItem.status.in_([RenewalStatus.PENDING, RenewalStatus.IN_PROGRESS])
        )
    ).first()
    
    if existing:
        return existing
    
    renewal_code = generate_renewal_code()
    db_renewal = models.RenewalItem(
        **renewal.model_dump(),
        renewal_code=renewal_code
    )
    db.add(db_renewal)
    db.commit()
    db.refresh(db_renewal)
    return db_renewal


def get_renewal_item(db: Session, renewal_id: int):
    return db.query(models.RenewalItem).filter(models.RenewalItem.id == renewal_id).first()


def get_renewal_item_by_code(db: Session, renewal_code: str):
    return db.query(models.RenewalItem).filter(models.RenewalItem.renewal_code == renewal_code).first()


def get_renewal_items(db: Session, employee_id: int = None, status: str = None, skip: int = 0, limit: int = 100):
    query = db.query(models.RenewalItem)
    if employee_id:
        query = query.filter(models.RenewalItem.employee_id == employee_id)
    if status:
        query = query.filter(models.RenewalItem.status == status)
    return query.order_by(models.RenewalItem.priority.desc(), models.RenewalItem.created_at.desc()).offset(skip).limit(limit).all()


def update_renewal_item(db: Session, renewal_id: int, renewal_update: schemas.RenewalItemUpdate):
    db_renewal = get_renewal_item(db, renewal_id)
    if not db_renewal:
        return None
    for key, value in renewal_update.model_dump(exclude_unset=True).items():
        setattr(db_renewal, key, value)
    db.commit()
    db.refresh(db_renewal)
    return db_renewal


def manual_correct_renewal(db: Session, renewal_id: int, correction: schemas.ManualCorrection):
    db_renewal = get_renewal_item(db, renewal_id)
    if not db_renewal:
        return None
    
    original_data = {
        "renewal_id": renewal_id,
        "current_status": db_renewal.status,
        "handler": correction.handler,
        "conclusion": correction.conclusion,
        "new_status": correction.new_status,
        "remarks": correction.remarks
    }
    
    if correction.new_status:
        db_renewal.status = correction.new_status
    if correction.remarks:
        db_renewal.remarks = (db_renewal.remarks or "") + f"\n[人工修正][{correction.handler}]: {correction.conclusion} - {correction.remarks}"
    
    db.commit()
    db.refresh(db_renewal)
    
    log_exception(
        db,
        operation_type="人工修正",
        original_input=original_data,
        handler=correction.handler,
        conclusion=correction.conclusion
    )
    
    return db_renewal


def cancel_renewal(db: Session, renewal_id: int, handler: str, reason: str):
    db_renewal = get_renewal_item(db, renewal_id)
    if not db_renewal:
        return None
    
    original_data = {
        "renewal_id": renewal_id,
        "current_status": db_renewal.status,
        "handler": handler,
        "reason": reason
    }
    
    db_renewal.status = RenewalStatus.CANCELLED
    db_renewal.remarks = (db_renewal.remarks or "") + f"\n[取消][{handler}]: {reason}"
    
    db.commit()
    db.refresh(db_renewal)
    
    log_exception(
        db,
        operation_type="取消续期",
        original_input=original_data,
        handler=handler,
        conclusion=f"已取消: {reason}"
    )
    
    return db_renewal


def close_renewal(db: Session, renewal_id: int, handler: str, conclusion: str):
    db_renewal = get_renewal_item(db, renewal_id)
    if not db_renewal:
        return None
    
    original_data = {
        "renewal_id": renewal_id,
        "current_status": db_renewal.status,
        "handler": handler,
        "conclusion": conclusion
    }
    
    db_renewal.status = RenewalStatus.CLOSED
    db_renewal.remarks = (db_renewal.remarks or "") + f"\n[关闭][{handler}]: {conclusion}"
    
    db.commit()
    db.refresh(db_renewal)
    
    log_exception(
        db,
        operation_type="关闭续期",
        original_input=original_data,
        handler=handler,
        conclusion=conclusion
    )
    
    return db_renewal


def get_renewal_statistics(db: Session):
    total = db.query(models.RenewalItem).count()
    pending = db.query(models.RenewalItem).filter(models.RenewalItem.status == RenewalStatus.PENDING).count()
    in_progress = db.query(models.RenewalItem).filter(models.RenewalItem.status == RenewalStatus.IN_PROGRESS).count()
    completed = db.query(models.RenewalItem).filter(models.RenewalItem.status == RenewalStatus.COMPLETED).count()
    cancelled = db.query(models.RenewalItem).filter(models.RenewalItem.status == RenewalStatus.CANCELLED).count()
    closed = db.query(models.RenewalItem).filter(models.RenewalItem.status == RenewalStatus.CLOSED).count()
    
    return schemas.RenewalStatistics(
        total=total,
        pending=pending,
        in_progress=in_progress,
        completed=completed,
        cancelled=cancelled,
        closed=closed
    )


def get_certificate_expiry_alerts(db: Session, days_threshold: int = 90):
    today = date.today()
    alerts = []
    
    certificates = db.query(models.EmployeeCertificate).filter(
        models.EmployeeCertificate.is_valid == True
    ).all()
    
    for cert in certificates:
        if not cert.expiry_date:
            continue
        
        days_until_expiry = (cert.expiry_date - today).days
        if days_until_expiry <= days_threshold:
            employee = get_employee(db, cert.employee_id)
            cert_type = get_certificate_type(db, cert.certificate_type_id)
            status = get_certificate_status(cert.expiry_date)
            
            alerts.append(schemas.CertificateExpiryAlert(
                employee_id=employee.employee_id if employee else "未知",
                employee_name=employee.name if employee else "未知",
                certificate_type=cert_type.name if cert_type else "未知",
                certificate_number=cert.certificate_number,
                expiry_date=cert.expiry_date,
                days_until_expiry=days_until_expiry,
                status=status
            ))
    
    return sorted(alerts, key=lambda x: x.days_until_expiry if x.days_until_expiry is not None else 999)


def get_exception_logs(db: Session, operation_type: str = None, skip: int = 0, limit: int = 100):
    query = db.query(models.ExceptionLog)
    if operation_type:
        query = query.filter(models.ExceptionLog.operation_type == operation_type)
    return query.order_by(models.ExceptionLog.created_at.desc()).offset(skip).limit(limit).all()
