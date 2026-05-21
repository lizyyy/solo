from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
from . import models, schemas, auth
from .auth import generate_api_key, generate_api_secret, get_password_hash, verify_password


ALLOWED_SCOPES = ["users:read", "users:write", "orders:read", "orders:write", "products:read", "products:write"]


def create_applicant(db: Session, applicant: schemas.ApplicantCreate) -> models.Applicant:
    db_applicant = db.query(models.Applicant).filter(models.Applicant.email == applicant.email).first()
    if db_applicant:
        return db_applicant
    db_applicant = models.Applicant(**applicant.dict())
    db.add(db_applicant)
    db.commit()
    db.refresh(db_applicant)
    return db_applicant


def create_application(db: Session, application: schemas.ApplicationCreate) -> models.Application:
    applicant_data = {
        "name": application.applicant_name,
        "email": application.applicant_email,
        "company": application.applicant_company
    }
    applicant = create_applicant(db, schemas.ApplicantCreate(**applicant_data))
    
    existing_app = db.query(models.Application).filter(
        models.Application.applicant_id == applicant.id,
        models.Application.api_scopes == application.api_scopes,
        models.Application.status == "pending"
    ).first()
    
    if existing_app:
        return existing_app
    
    db_application = models.Application(
        applicant_id=applicant.id,
        api_scopes=application.api_scopes,
        validity_days=application.validity_days,
        reason=application.reason
    )
    db.add(db_application)
    db.commit()
    db.refresh(db_application)
    return db_application


def get_pending_applications(db: Session) -> List[models.Application]:
    return db.query(models.Application).filter(models.Application.status == "pending").all()


def process_approval(db: Session, approval: schemas.ApprovalRequest) -> Optional[models.Credential]:
    application = db.query(models.Application).filter(models.Application.id == approval.application_id).first()
    if not application:
        return None
    
    application.status = "approved" if approval.approved else "rejected"
    application.reviewer_comment = approval.reviewer_comment
    application.reviewed_at = datetime.utcnow()
    db.commit()
    
    if not approval.approved:
        return None
    
    requested_scopes = application.api_scopes.split(",")
    valid_scopes = [s for s in requested_scopes if s.strip() in ALLOWED_SCOPES]
    
    if len(valid_scopes) != len(requested_scopes):
        application.status = "rejected"
        application.reviewer_comment = "申请包含无效的API范围，已自动拒绝"
        db.commit()
        return None
    
    api_key = generate_api_key()
    api_secret = generate_api_secret()
    api_secret_hash = get_password_hash(api_secret)
    
    expires_at = datetime.utcnow() + timedelta(days=application.validity_days)
    
    credential = models.Credential(
        application_id=application.id,
        api_key=api_key,
        api_secret_hash=api_secret_hash,
        scopes=",".join(valid_scopes),
        expires_at=expires_at
    )
    db.add(credential)
    db.commit()
    db.refresh(credential)
    
    create_audit_log(db, schemas.AuditLogCreate(
        credential_id=credential.id,
        action="credential_issued",
        status="success"
    ))
    
    credential.api_secret = api_secret
    return credential


def get_active_credentials(db: Session) -> List[models.Credential]:
    now = datetime.utcnow()
    return db.query(models.Credential).filter(
        models.Credential.status == "active",
        models.Credential.expires_at > now
    ).all()


def get_expiring_soon_credentials(db: Session, days: int = 3) -> List[models.Credential]:
    now = datetime.utcnow()
    threshold = now + timedelta(days=days)
    return db.query(models.Credential).filter(
        models.Credential.status == "active",
        models.Credential.expires_at > now,
        models.Credential.expires_at <= threshold
    ).all()


def revoke_credential(db: Session, revoke: schemas.RevokeRequest) -> Optional[models.Credential]:
    credential = db.query(models.Credential).filter(models.Credential.id == revoke.credential_id).first()
    if not credential or credential.status != "active":
        return None
    
    credential.status = "revoked"
    credential.revoked_at = datetime.utcnow()
    credential.revoked_reason = revoke.reason
    db.commit()
    
    create_audit_log(db, schemas.AuditLogCreate(
        credential_id=credential.id,
        action="credential_revoked",
        status="success",
        error_message=revoke.reason
    ))
    
    return credential


def expire_credentials(db: Session) -> int:
    now = datetime.utcnow()
    expired = db.query(models.Credential).filter(
        models.Credential.status == "active",
        models.Credential.expires_at <= now
    ).all()
    
    count = 0
    for cred in expired:
        cred.status = "expired"
        count += 1
        create_audit_log(db, schemas.AuditLogCreate(
            credential_id=cred.id,
            action="credential_expired",
            status="success"
        ))
    
    db.commit()
    return count


def verify_access(db: Session, access: schemas.AccessRequest, ip: str = None, user_agent: str = None) -> dict:
    credential = db.query(models.Credential).filter(models.Credential.api_key == access.api_key).first()
    
    if not credential:
        log_access_attempt(db, None, "access_denied", access, "invalid_credential", ip, user_agent)
        return {"granted": False, "reason": "无效的凭证"}
    
    if credential.status != "active":
        log_access_attempt(db, credential.id, "access_denied", access, f"credential_{credential.status}", ip, user_agent)
        return {"granted": False, "reason": f"凭证状态: {credential.status}"}
    
    if datetime.utcnow() > credential.expires_at:
        credential.status = "expired"
        db.commit()
        log_access_attempt(db, credential.id, "access_denied", access, "credential_expired", ip, user_agent)
        return {"granted": False, "reason": "凭证已过期"}
    
    if not verify_password(access.api_secret, credential.api_secret_hash):
        log_access_attempt(db, credential.id, "access_denied", access, "invalid_secret", ip, user_agent)
        return {"granted": False, "reason": "密钥验证失败"}
    
    scopes = credential.scopes.split(",") if credential.scopes else []
    required_scope = get_required_scope(access.endpoint, access.method)
    if required_scope and required_scope not in scopes:
        log_access_attempt(db, credential.id, "access_denied", access, "scope_mismatch", ip, user_agent)
        return {"granted": False, "reason": f"缺少权限: {required_scope}"}
    
    create_audit_log(db, schemas.AuditLogCreate(
        credential_id=credential.id,
        action="api_access",
        endpoint=access.endpoint,
        method=access.method,
        status="success",
        ip_address=ip,
        user_agent=user_agent
    ))
    
    return {"granted": True, "scopes": scopes}


def get_required_scope(endpoint: str, method: str) -> Optional[str]:
    scope_mapping = {
        ("/api/users", "GET"): "users:read",
        ("/api/users", "POST"): "users:write",
        ("/api/orders", "GET"): "orders:read",
        ("/api/orders", "POST"): "orders:write",
        ("/api/products", "GET"): "products:read",
        ("/api/products", "POST"): "products:write",
    }
    return scope_mapping.get((endpoint, method.upper()))


def log_access_attempt(db: Session, credential_id: Optional[int], action: str, access: schemas.AccessRequest, 
                       reason: str, ip: str = None, user_agent: str = None):
    if credential_id:
        create_audit_log(db, schemas.AuditLogCreate(
            credential_id=credential_id,
            action=action,
            endpoint=access.endpoint,
            method=access.method,
            status="failed",
            ip_address=ip,
            user_agent=user_agent,
            error_message=reason
        ))


def create_audit_log(db: Session, audit_log: schemas.AuditLogCreate) -> models.AuditLog:
    db_audit = models.AuditLog(**audit_log.dict())
    db.add(db_audit)
    db.commit()
    db.refresh(db_audit)
    return db_audit


def get_audit_logs(db: Session, credential_id: int = None, limit: int = 100) -> List[models.AuditLog]:
    query = db.query(models.AuditLog)
    if credential_id:
        query = query.filter(models.AuditLog.credential_id == credential_id)
    return query.order_by(models.AuditLog.timestamp.desc()).limit(limit).all()


def get_credential_audit_chain(db: Session, credential_id: int) -> dict:
    credential = db.query(models.Credential).filter(models.Credential.id == credential_id).first()
    if not credential:
        return None
    
    application = db.query(models.Application).filter(models.Application.id == credential.application_id).first()
    applicant = db.query(models.Applicant).filter(models.Applicant.id == application.applicant_id).first()
    audit_logs = get_audit_logs(db, credential_id=credential_id)
    
    return {
        "applicant": applicant,
        "application": application,
        "credential": credential,
        "audit_logs": audit_logs
    }


def get_revoked_credentials(db: Session) -> List[models.Credential]:
    return db.query(models.Credential).filter(models.Credential.status.in_(["revoked", "expired"])).all()


def create_expired_credential_demo(db: Session, application: schemas.ApplicationCreate) -> models.Credential:
    applicant_data = {
        "name": application.applicant_name,
        "email": application.applicant_email,
        "company": application.applicant_company
    }
    applicant = create_applicant(db, schemas.ApplicantCreate(**applicant_data))
    
    db_application = models.Application(
        applicant_id=applicant.id,
        api_scopes=application.api_scopes,
        validity_days=application.validity_days,
        reason=application.reason,
        status="approved",
        reviewer_comment="演示数据：已过期凭证",
        reviewed_at=datetime.utcnow()
    )
    db.add(db_application)
    db.commit()
    db.refresh(db_application)
    
    api_key = generate_api_key()
    api_secret = generate_api_secret()
    api_secret_hash = get_password_hash(api_secret)
    
    expires_at = datetime.utcnow() - timedelta(days=1)
    issued_at = expires_at - timedelta(days=application.validity_days)
    
    credential = models.Credential(
        application_id=db_application.id,
        api_key=api_key,
        api_secret_hash=api_secret_hash,
        scopes=application.api_scopes,
        status="expired",
        issued_at=issued_at,
        expires_at=expires_at
    )
    db.add(credential)
    db.commit()
    db.refresh(credential)
    
    create_audit_log(db, schemas.AuditLogCreate(
        credential_id=credential.id,
        action="credential_issued",
        status="success"
    ))
    
    create_audit_log(db, schemas.AuditLogCreate(
        credential_id=credential.id,
        action="credential_expired",
        status="success"
    ))
    
    credential.api_secret = api_secret
    return credential
