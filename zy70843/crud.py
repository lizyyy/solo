from sqlalchemy.orm import Session
from sqlalchemy import func
from models import BoothCertificate, MaterialStatus
from schemas import BoothCertificateCreate, StatisticsResponse, ExportQuery
from services import MaterialValidator, MaterialClassifier, DuplicateHandler
from datetime import date
import json


def create_booth_certificate(db: Session, data: BoothCertificateCreate):
    duplicate_handler = DuplicateHandler(db)
    
    existing = duplicate_handler.check_duplicate(data)
    if existing:
        duplicate = duplicate_handler.create_duplicate_record(data, existing, data.processor)
        return duplicate, True, []
    
    validator = MaterialValidator(db)
    is_valid, errors = validator.validate(data)
    
    status, follow_up_action, reject_reason = MaterialClassifier.classify(errors, data)
    
    error_details = json.dumps([{"field": e.field, "message": e.message, "original_position": e.original_position} for e in errors])
    
    db_certificate = BoothCertificate(
        batch_number=data.batch_number,
        booth_number=data.booth_number,
        mall_name=data.mall_name,
        certificate_version=data.certificate_version,
        schedule_start_date=data.schedule_start_date,
        schedule_end_date=data.schedule_end_date,
        entry_time=data.entry_time,
        business_license=data.business_license,
        fire_safety_material=data.fire_safety_material,
        certificate_expiry_date=data.certificate_expiry_date,
        deposit_status=data.deposit_status,
        status=status,
        follow_up_action=follow_up_action,
        reject_reason=reject_reason,
        error_details=error_details if errors else None,
        processor=data.processor
    )
    
    db.add(db_certificate)
    db.commit()
    db.refresh(db_certificate)
    
    return db_certificate, False, errors


def get_booth_certificate(db: Session, certificate_id: int):
    return db.query(BoothCertificate).filter(BoothCertificate.id == certificate_id).first()


def get_booth_certificates(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    mall_name: str = None,
    status: MaterialStatus = None,
    batch_number: str = None
):
    query = db.query(BoothCertificate).filter(BoothCertificate.is_duplicate == False)
    
    if mall_name:
        query = query.filter(BoothCertificate.mall_name == mall_name)
    if status:
        query = query.filter(BoothCertificate.status == status)
    if batch_number:
        query = query.filter(BoothCertificate.batch_number == batch_number)
    
    return query.offset(skip).limit(limit).all()


def get_statistics(db: Session) -> StatisticsResponse:
    total = db.query(func.count(BoothCertificate.id)).filter(BoothCertificate.is_duplicate == False).scalar()
    normal = db.query(func.count(BoothCertificate.id)).filter(
        BoothCertificate.status == MaterialStatus.NORMAL,
        BoothCertificate.is_duplicate == False
    ).scalar()
    pending = db.query(func.count(BoothCertificate.id)).filter(
        BoothCertificate.status == MaterialStatus.PENDING_SUPPLEMENT,
        BoothCertificate.is_duplicate == False
    ).scalar()
    blocked = db.query(func.count(BoothCertificate.id)).filter(
        BoothCertificate.status == MaterialStatus.BLOCKED,
        BoothCertificate.is_duplicate == False
    ).scalar()
    duplicate = db.query(func.count(BoothCertificate.id)).filter(BoothCertificate.is_duplicate == True).scalar()
    
    return StatisticsResponse(
        total=total or 0,
        normal=normal or 0,
        pending_supplement=pending or 0,
        blocked=blocked or 0,
        duplicate=duplicate or 0
    )


def get_certificates_for_export(db: Session, query_params: ExportQuery):
    query = db.query(BoothCertificate).filter(BoothCertificate.is_duplicate == False)
    
    if query_params.start_date:
        query = query.filter(BoothCertificate.created_at >= query_params.start_date)
    if query_params.end_date:
        query = query.filter(BoothCertificate.created_at <= query_params.end_date)
    if query_params.mall_name:
        query = query.filter(BoothCertificate.mall_name == query_params.mall_name)
    if query_params.status:
        query = query.filter(BoothCertificate.status == query_params.status)
    
    return query.all()


def update_deposit_status(db: Session, certificate_id: int, deposit_status: str):
    certificate = get_booth_certificate(db, certificate_id)
    if certificate:
        certificate.deposit_status = deposit_status
        db.commit()
        db.refresh(certificate)
    return certificate
