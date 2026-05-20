from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime
from app.models import MorningCheckRecord, ProcessingLog, Batch, MedicationAuthorization
from typing import List, Optional
import csv
from io import StringIO


FEVER_THRESHOLD = 37.5


def validate_record(db: Session, record: MorningCheckRecord, auto_log: bool = False) -> dict:
    issues = []
    
    if record.temperature >= FEVER_THRESHOLD:
        issues.append({
            "type": "fever_isolation",
            "reason": f"体温{record.temperature}℃超过阈值{FEVER_THRESHOLD}℃，需要隔离观察",
            "severity": "high"
        })
        record.need_isolation = True
    
    if record.medication_id:
        med_auth = db.query(MedicationAuthorization).filter(
            MedicationAuthorization.id == record.medication_id
        ).first()
        if med_auth and med_auth.expiration_date:
            if med_auth.expiration_date < datetime.now():
                issues.append({
                    "type": "medication_expired",
                    "reason": f"药品「{med_auth.medication_name}」已过期，有效期至{med_auth.expiration_date.strftime('%Y-%m-%d')}",
                    "severity": "high",
                    "medication_name": med_auth.medication_name
                })
    
    if not record.parent_confirmed:
        issues.append({
            "type": "parent_not_confirmed",
            "reason": "家长未确认晨检结果",
            "severity": "medium"
        })
    
    if not record.parent_signature:
        issues.append({
            "type": "missing_signature",
            "reason": "缺少家长签名",
            "severity": "medium"
        })
    
    if auto_log and issues:
        for issue in issues:
            log_action = "system_flag"
            if issue["type"] == "fever_isolation":
                log_action = "flag_fever"
            elif issue["type"] == "medication_expired":
                log_action = "flag_expired_med"
            elif issue["type"] == "parent_not_confirmed":
                log_action = "flag_no_confirm"
            elif issue["type"] == "missing_signature":
                log_action = "flag_no_signature"
            
            log = ProcessingLog(
                batch_id=record.batch_id,
                record_id=record.id,
                action=log_action,
                reason=issue["reason"],
                handler="系统自动校验",
                details=f"校验类型: {issue['type']}, 严重程度: {issue['severity']}",
                handled_at=datetime.now()
            )
            db.add(log)
        db.commit()
    
    return issues


def validate_batch_records(db: Session, batch_id: int) -> dict:
    records = db.query(MorningCheckRecord).filter(
        MorningCheckRecord.batch_id == batch_id
    ).all()
    
    results = {
        "total": len(records),
        "with_issues": 0,
        "fever_cases": 0,
        "expired_meds": 0,
        "missing_confirm": 0,
        "missing_signature": 0,
        "records_with_issues": []
    }
    
    for record in records:
        issues = validate_record(db, record, auto_log=True)
        
        if issues:
            results["with_issues"] += 1
            record_info = {
                "record_id": record.id,
                "student_name": record.student_name,
                "student_id": record.student_id,
                "issues": issues
            }
            results["records_with_issues"].append(record_info)
            
            for issue in issues:
                if issue["type"] == "fever_isolation":
                    results["fever_cases"] += 1
                elif issue["type"] == "medication_expired":
                    results["expired_meds"] += 1
                elif issue["type"] == "parent_not_confirmed":
                    results["missing_confirm"] += 1
                elif issue["type"] == "missing_signature":
                    results["missing_signature"] += 1
    
    return results


def process_record(db: Session, record_id: int, action: str, reason: str, handler: str, details: str = None):
    record = db.query(MorningCheckRecord).filter(MorningCheckRecord.id == record_id).first()
    if not record:
        return None
    
    log = ProcessingLog(
        batch_id=record.batch_id,
        record_id=record_id,
        action=action,
        reason=reason,
        handler=handler,
        details=details,
        handled_at=datetime.now()
    )
    db.add(log)
    
    if action == "approve":
        record.status = "approved"
    elif action == "reject":
        record.status = "rejected"
    elif action == "return_for_correction":
        record.status = "needs_correction"
    elif action == "isolate":
        record.status = "isolated"
        record.need_isolation = True
    
    db.commit()
    db.refresh(record)
    
    return record, log


def get_records_by_filters(
    db: Session,
    class_teacher: Optional[str] = None,
    parent_signature: Optional[str] = None,
    need_isolation: Optional[bool] = None,
    status: Optional[str] = None,
    batch_id: Optional[int] = None
) -> List[MorningCheckRecord]:
    query = db.query(MorningCheckRecord)
    
    filters = []
    if class_teacher:
        filters.append(MorningCheckRecord.class_teacher == class_teacher)
    if parent_signature:
        filters.append(MorningCheckRecord.parent_signature == parent_signature)
    if need_isolation is not None:
        filters.append(MorningCheckRecord.need_isolation == need_isolation)
    if status:
        filters.append(MorningCheckRecord.status == status)
    if batch_id:
        filters.append(MorningCheckRecord.batch_id == batch_id)
    
    if filters:
        query = query.filter(and_(*filters))
    
    return query.all()


def export_records_to_csv(records: List[MorningCheckRecord], db: Session) -> str:
    output = StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        '学号', '姓名', '班级', '班主任', '体温', '检查时间', '症状',
        '状态', '是否需要隔离', '家长确认', '家长签名', '处理原因', '处理人', '处理时间'
    ])
    
    for record in records:
        logs = db.query(ProcessingLog).filter(ProcessingLog.record_id == record.id).order_by(ProcessingLog.handled_at.desc()).first()
        
        writer.writerow([
            record.student_id,
            record.student_name,
            record.class_name,
            record.class_teacher,
            record.temperature,
            record.check_time.strftime('%Y-%m-%d %H:%M:%S') if record.check_time else '',
            record.symptoms or '',
            record.status,
            '是' if record.need_isolation else '否',
            '是' if record.parent_confirmed else '否',
            record.parent_signature or '',
            logs.reason if logs else '',
            logs.handler if logs else '',
            logs.handled_at.strftime('%Y-%m-%d %H:%M:%S') if logs and logs.handled_at else ''
        ])
    
    return output.getvalue()


def get_record_with_logs(db: Session, record_id: int):
    record = db.query(MorningCheckRecord).filter(MorningCheckRecord.id == record_id).first()
    if not record:
        return None
    
    logs = db.query(ProcessingLog).filter(ProcessingLog.record_id == record_id).order_by(ProcessingLog.handled_at.desc()).all()
    
    return record, logs
