import hashlib
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import desc
import models
import schemas


def get_lockfile_audit(db: Session, audit_id: int):
    return db.query(models.LockfileAudit).filter(models.LockfileAudit.id == audit_id).first()


def get_lockfile_audits(db: Session, skip: int = 0, limit: int = 100, status: Optional[models.AuditStatus] = None):
    query = db.query(models.LockfileAudit)
    if status:
        query = query.filter(models.LockfileAudit.status == status)
    total = query.count()
    items = query.order_by(desc(models.LockfileAudit.created_at)).offset(skip).limit(limit).all()
    return total, items


def create_lockfile_audit(db: Session, audit: schemas.LockfileAuditCreate):
    content_hash = hashlib.sha256(audit.content.encode()).hexdigest()
    db_audit = models.LockfileAudit(
        name=audit.name,
        lockfile_type=audit.lockfile_type,
        content_hash=content_hash,
        created_by=audit.created_by,
        notes=audit.notes,
        status=models.AuditStatus.PENDING
    )
    db.add(db_audit)
    db.commit()
    db.refresh(db_audit)
    return db_audit, content_hash


def update_lockfile_audit_status(db: Session, audit_id: int, status: models.AuditStatus, notes: Optional[str] = None):
    db_audit = get_lockfile_audit(db, audit_id)
    if db_audit:
        db_audit.status = status
        if notes:
            db_audit.notes = notes
        db.commit()
        db.refresh(db_audit)
    return db_audit


def create_package_audit(db: Session, package: schemas.PackageAuditCreate, lockfile_audit_id: int):
    db_package = models.PackageAudit(
        **package.model_dump(),
        lockfile_audit_id=lockfile_audit_id
    )
    db.add(db_package)
    db.commit()
    db.refresh(db_package)
    return db_package


def get_package_audit(db: Session, package_id: int):
    return db.query(models.PackageAudit).filter(models.PackageAudit.id == package_id).first()


def get_packages_by_audit(db: Session, lockfile_audit_id: int):
    return db.query(models.PackageAudit).filter(models.PackageAudit.lockfile_audit_id == lockfile_audit_id).all()


def update_package_audit_status(db: Session, package_id: int, status: models.PackageStatus):
    db_package = get_package_audit(db, package_id)
    if db_package:
        db_package.status = status
        db.commit()
        db.refresh(db_package)
    return db_package


def create_source_report(db: Session, report: schemas.SourceReportCreate, package_audit_id: int):
    db_report = models.SourceReport(
        **report.model_dump(),
        package_audit_id=package_audit_id
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


def create_audit_exception(db: Session, exception: schemas.AuditExceptionCreate, lockfile_audit_id: int):
    db_exception = models.AuditException(
        **exception.model_dump(),
        lockfile_audit_id=lockfile_audit_id
    )
    db.add(db_exception)
    db.commit()
    db.refresh(db_exception)
    return db_exception


def get_audit_exception(db: Session, exception_id: int):
    return db.query(models.AuditException).filter(models.AuditException.id == exception_id).first()


def get_exceptions_by_audit(db: Session, lockfile_audit_id: int):
    return db.query(models.AuditException).filter(models.AuditException.lockfile_audit_id == lockfile_audit_id).all()


def update_audit_exception(db: Session, exception_id: int, update: schemas.AuditExceptionUpdate):
    db_exception = get_audit_exception(db, exception_id)
    if db_exception:
        update_data = update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_exception, key, value)
        db.commit()
        db.refresh(db_exception)
    return db_exception


def manual_correct_package(db: Session, lockfile_audit_id: int, correction: schemas.ManualCorrection):
    db_package = db.query(models.PackageAudit).filter(
        models.PackageAudit.lockfile_audit_id == lockfile_audit_id,
        models.PackageAudit.package_name == correction.package_name,
        models.PackageAudit.version == correction.version
    ).first()

    if db_package:
        db_package.registry = correction.correct_registry
        if correction.correct_hash:
            db_package.integrity_hash = correction.correct_hash
        db_package.status = models.PackageStatus.NORMAL
        db.commit()
        db.refresh(db_package)

    db_exception = models.AuditException(
        lockfile_audit_id=lockfile_audit_id,
        package_name=correction.package_name,
        original_input=f"Manual correction: registry={correction.correct_registry}, hash={correction.correct_hash}",
        handler=correction.handler,
        conclusion=correction.reason,
        resolved=True
    )
    db.add(db_exception)
    db.commit()
    db.refresh(db_exception)
    return db_package, db_exception
