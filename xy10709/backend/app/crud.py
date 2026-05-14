from sqlalchemy.orm import Session
from datetime import datetime
import hashlib
import uuid
import json
import os
from typing import List, Optional

from . import models, schemas

UPLOAD_DIR = "../uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def calculate_file_hashes(file_content: bytes):
    md5_hash = hashlib.md5(file_content).hexdigest()
    sha256_hash = hashlib.sha256(file_content).hexdigest()
    return md5_hash, sha256_hash


def generate_task_id():
    return f"TSK-{uuid.uuid4().hex[:12].upper()}"


def generate_log_id():
    return f"LOG-{uuid.uuid4().hex[:12].upper()}"


def simulate_scan_engine(file_content: bytes, filename: str) -> dict:
    malicious_patterns = [
        b"malware",
        b"virus",
        b"trojan",
        b"ransomware",
        b"exploit",
        b"<script>alert",
        b"exec(\"",
        b"system("
    ]
    
    threats_found = []
    content_lower = file_content.lower()
    
    for pattern in malicious_patterns:
        if pattern.lower() in content_lower:
            threats_found.append({
                "type": "pattern_match",
                "pattern": pattern.decode('utf-8', errors='ignore'),
                "description": f"Detected malicious pattern: {pattern.decode('utf-8', errors='ignore')}"
            })
    
    if filename.endswith(".exe") or filename.endswith(".bat") or filename.endswith(".cmd"):
        threats_found.append({
            "type": "file_type",
            "pattern": filename.split(".")[-1],
            "description": f"Suspicious executable file type: {filename.split('.')[-1]}"
        })
    
    threat_level = "safe"
    if len(threats_found) >= 3:
        threat_level = "critical"
    elif len(threats_found) >= 1:
        threat_level = "warning"
    
    return {
        "engine": "MockScan-v1.0",
        "threats_found": threats_found,
        "threat_count": len(threats_found),
        "threat_level": threat_level,
        "scan_time": datetime.utcnow().isoformat()
    }


def create_upload_task(db: Session, file_content: bytes, filename: str, 
                      organization_id: Optional[int] = None, uploaded_by: str = "system"):
    file_size = len(file_content)
    file_type = filename.split(".")[-1].lower() if "." in filename else "unknown"
    stored_filename = f"{uuid.uuid4().hex}_{filename}"
    file_path = os.path.join(UPLOAD_DIR, stored_filename)
    
    with open(file_path, "wb") as f:
        f.write(file_content)
    
    md5_hash, sha256_hash = calculate_file_hashes(file_content)
    
    raw_input = json.dumps({
        "original_filename": filename,
        "file_size": file_size,
        "file_type": file_type,
        "uploaded_by": uploaded_by,
        "upload_timestamp": datetime.utcnow().isoformat()
    })
    
    db_task = models.UploadTask(
        task_id=generate_task_id(),
        filename=stored_filename,
        original_filename=filename,
        file_size=file_size,
        file_type=file_type,
        file_path=file_path,
        file_hash_md5=md5_hash,
        file_hash_sha256=sha256_hash,
        status="pending",
        isolation_status="none",
        organization_id=organization_id,
        uploaded_by=uploaded_by,
        raw_input=raw_input
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    return db_task


def scan_upload_task(db: Session, task_id: int):
    task = db.query(models.UploadTask).filter(models.UploadTask.id == task_id).first()
    if not task:
        return None
    
    try:
        with open(task.file_path, "rb") as f:
            file_content = f.read()
    except:
        task.status = "error"
        task.notes = "File not found or unreadable"
        db.commit()
        return task
    
    scan_result = simulate_scan_engine(file_content, task.original_filename)
    
    task.scan_engine = scan_result["engine"]
    task.scan_result = json.dumps(scan_result)
    task.threat_level = scan_result["threat_level"]
    task.scanned_at = datetime.utcnow()
    
    if scan_result["threat_level"] in ["warning", "critical"]:
        task.isolation_status = "isolated"
        task.status = "quarantined"
        
        create_security_log(
            db,
            upload_task_id=task.id,
            event_type="THREAT_DETECTED",
            severity=scan_result["threat_level"],
            message=f"File '{task.original_filename}' detected as {scan_result['threat_level']}",
            details=json.dumps(scan_result)
        )
    else:
        task.status = "scanned"
        task.isolation_status = "allowed"
        
        processed_result = json.dumps({
            "action": "allowed",
            "reason": "No threats detected",
            "timestamp": datetime.utcnow().isoformat()
        })
        task.processed_result = processed_result
        task.processed_at = datetime.utcnow()
        
        create_security_log(
            db,
            upload_task_id=task.id,
            event_type="FILE_SCANNED",
            severity="info",
            message=f"File '{task.original_filename}' scanned and allowed",
            details=json.dumps(scan_result)
        )
    
    db.commit()
    db.refresh(task)
    return task


def release_from_isolation(db: Session, task_id: int, released_by: str, reason: str):
    task = db.query(models.UploadTask).filter(models.UploadTask.id == task_id).first()
    if not task:
        return None
    
    task.isolation_status = "released"
    task.status = "released"
    task.processed_at = datetime.utcnow()
    
    processed_result = json.dumps({
        "action": "manual_release",
        "released_by": released_by,
        "reason": reason,
        "timestamp": datetime.utcnow().isoformat()
    })
    task.processed_result = processed_result
    
    create_security_log(
        db,
        upload_task_id=task.id,
        event_type="MANUAL_RELEASE",
        severity="warning",
        message=f"File '{task.original_filename}' manually released by {released_by}",
        details=json.dumps({"reason": reason})
    )
    
    db.commit()
    db.refresh(task)
    return task


def rollback_task(db: Session, task_id: int, rolled_back_by: str, reason: str):
    task = db.query(models.UploadTask).filter(models.UploadTask.id == task_id).first()
    if not task:
        return None
    
    task.status = "rolled_back"
    task.isolation_status = "isolated"
    
    create_security_log(
        db,
        upload_task_id=task.id,
        event_type="ROLLBACK",
        severity="warning",
        message=f"File '{task.original_filename}' rolled back to isolation by {rolled_back_by}",
        details=json.dumps({"reason": reason})
    )
    
    db.commit()
    db.refresh(task)
    return task


def create_security_log(db: Session, upload_task_id: int, event_type: str, 
                        severity: str, message: str, source_ip: str = "127.0.0.1",
                        user_agent: str = "API Client", details: str = None):
    db_log = models.SecurityLog(
        log_id=generate_log_id(),
        upload_task_id=upload_task_id,
        event_type=event_type,
        severity=severity,
        message=message,
        source_ip=source_ip,
        user_agent=user_agent,
        details=details
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log


def get_upload_task(db: Session, task_id: int):
    return db.query(models.UploadTask).filter(models.UploadTask.id == task_id).first()


def get_upload_task_by_task_id(db: Session, task_id: str):
    return db.query(models.UploadTask).filter(models.UploadTask.task_id == task_id).first()


def get_upload_tasks(db: Session, skip: int = 0, limit: int = 100, 
                     status: str = None, organization_id: int = None):
    query = db.query(models.UploadTask)
    if status:
        query = query.filter(models.UploadTask.status == status)
    if organization_id:
        query = query.filter(models.UploadTask.organization_id == organization_id)
    return query.order_by(models.UploadTask.uploaded_at.desc()).offset(skip).limit(limit).all()


def get_security_logs(db: Session, skip: int = 0, limit: int = 100, 
                      severity: str = None, upload_task_id: int = None):
    query = db.query(models.SecurityLog)
    if severity:
        query = query.filter(models.SecurityLog.severity == severity)
    if upload_task_id:
        query = query.filter(models.SecurityLog.upload_task_id == upload_task_id)
    return query.order_by(models.SecurityLog.created_at.desc()).offset(skip).limit(limit).all()


def get_security_log(db: Session, log_id: int):
    return db.query(models.SecurityLog).filter(models.SecurityLog.id == log_id).first()


def resolve_security_log(db: Session, log_id: int, resolved_by: str):
    log = get_security_log(db, log_id)
    if not log:
        return None
    log.resolved = True
    log.resolved_by = resolved_by
    log.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(log)
    return log


def create_organization(db: Session, org: schemas.OrganizationCreate):
    db_org = models.Organization(
        name=org.name,
        code=org.code,
        description=org.description
    )
    db.add(db_org)
    db.commit()
    db.refresh(db_org)
    return db_org


def get_organizations(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Organization).offset(skip).limit(limit).all()


def get_organization(db: Session, org_id: int):
    return db.query(models.Organization).filter(models.Organization.id == org_id).first()


def batch_import_organizations(db: Session, orgs: List[schemas.OrganizationCreate]):
    results = []
    for org in orgs:
        try:
            db_org = create_organization(db, org)
            results.append({"code": org.code, "status": "success", "id": db_org.id})
        except Exception as e:
            results.append({"code": org.code, "status": "failed", "error": str(e)})
    return results


def create_scan_rule(db: Session, rule: schemas.ScanRuleCreate):
    db_rule = models.ScanRule(
        name=rule.name,
        rule_type=rule.rule_type,
        pattern=rule.pattern,
        description=rule.description,
        severity=rule.severity,
        action=rule.action
    )
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


def get_scan_rules(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.ScanRule).filter(models.ScanRule.is_active == True).offset(skip).limit(limit).all()
