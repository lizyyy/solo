import json
from datetime import datetime
from typing import Optional, Tuple, List, Dict, Any
from sqlalchemy.orm import Session

from app.models import (
    AuditReport, SmsSignApplication, QualificationAttachment,
    ChannelReceipt, OperationLog,
    SignStatus, QualificationStatus
)
from app.services.idempotency_service import generate_request_id


def generate_audit_report(
    db: Session,
    application_id: int
) -> Tuple[Optional[AuditReport], str]:
    application = db.query(SmsSignApplication).filter(
        SmsSignApplication.id == application_id
    ).first()
    
    if not application:
        return None, "签名申请不存在"
    
    terminal_statuses = [
        SignStatus.AUDIT_APPROVED,
        SignStatus.AUDIT_REJECTED,
        SignStatus.QUALIFICATION_REJECTED,
        SignStatus.FAILED
    ]
    
    if application.status not in terminal_statuses:
        return None, f"当前状态 {application.status.value} 不是终态，无法生成报告"
    
    existing_report = db.query(AuditReport).filter(
        AuditReport.application_id == application_id
    ).first()
    
    if existing_report:
        return existing_report, "报告已存在"
    
    qualifications = db.query(QualificationAttachment).filter(
        QualificationAttachment.application_id == application_id
    ).all()
    
    receipts = db.query(ChannelReceipt).filter(
        ChannelReceipt.application_id == application_id
    ).all()
    
    logs = db.query(OperationLog).filter(
        OperationLog.application_id == application_id
    ).order_by(OperationLog.created_at.asc()).all()
    
    qualification_result = _compile_qualification_result(qualifications)
    channel_result = _compile_channel_result(receipts)
    audit_trail = _compile_audit_trail(logs)
    
    report = AuditReport(
        report_id=generate_request_id(),
        application_id=application_id,
        final_status=application.status.value,
        qualification_result=json.dumps(qualification_result, ensure_ascii=False),
        channel_result=json.dumps(channel_result, ensure_ascii=False),
        audit_trail=json.dumps(audit_trail, ensure_ascii=False)
    )
    
    db.add(report)
    db.commit()
    db.refresh(report)
    
    return report, "报告生成成功"


def _compile_qualification_result(qualifications: List[QualificationAttachment]) -> Dict[str, Any]:
    if not qualifications:
        return {"count": 0, "status": "none", "items": []}
    
    items = []
    approved_count = 0
    rejected_count = 0
    pending_count = 0
    
    for q in qualifications:
        items.append({
            "id": q.id,
            "type": q.qualification_type,
            "file_name": q.file_name,
            "status": q.status.value if q.status else None,
            "reviewer_id": q.reviewer_id,
            "review_comment": q.review_comment,
            "reviewed_at": q.reviewed_at.isoformat() if q.reviewed_at else None,
            "created_at": q.created_at.isoformat()
        })
        
        if q.status == QualificationStatus.APPROVED:
            approved_count += 1
        elif q.status == QualificationStatus.REJECTED:
            rejected_count += 1
        elif q.status == QualificationStatus.PENDING:
            pending_count += 1
    
    overall_status = "approved" if rejected_count == 0 and pending_count == 0 and approved_count > 0 else \
                     "rejected" if rejected_count > 0 else \
                     "pending" if pending_count > 0 else "none"
    
    return {
        "count": len(qualifications),
        "approved_count": approved_count,
        "rejected_count": rejected_count,
        "pending_count": pending_count,
        "overall_status": overall_status,
        "items": items
    }


def _compile_channel_result(receipts: List[ChannelReceipt]) -> Dict[str, Any]:
    if not receipts:
        return {"count": 0, "status": "none", "items": []}
    
    items = []
    success_count = 0
    failed_count = 0
    pending_count = 0
    
    for r in receipts:
        items.append({
            "id": r.id,
            "channel": r.channel,
            "channel_receipt_id": r.channel_receipt_id,
            "status": r.status.value if r.status else None,
            "parsed_result": r.parsed_result,
            "error_message": r.error_message,
            "received_at": r.received_at.isoformat(),
            "processed_at": r.processed_at.isoformat() if r.processed_at else None
        })
        
        if r.status and "success" in r.status.value.lower():
            success_count += 1
        elif r.status and "fail" in r.status.value.lower():
            failed_count += 1
        else:
            pending_count += 1
    
    return {
        "count": len(receipts),
        "success_count": success_count,
        "failed_count": failed_count,
        "pending_count": pending_count,
        "items": items
    }


def _compile_audit_trail(logs: List[OperationLog]) -> List[Dict[str, Any]]:
    trail = []
    for log in logs:
        trail.append({
            "request_id": log.request_id,
            "operation_type": log.operation_type,
            "operator_id": log.operator_id,
            "from_status": log.from_status,
            "to_status": log.to_status,
            "remark": log.remark,
            "created_at": log.created_at.isoformat()
        })
    return trail


def get_audit_report(
    db: Session,
    application_id: int
) -> Optional[AuditReport]:
    return db.query(AuditReport).filter(
        AuditReport.application_id == application_id
    ).first()


def get_application_history(
    db: Session,
    application_id: int
) -> Dict[str, Any]:
    application = db.query(SmsSignApplication).filter(
        SmsSignApplication.id == application_id
    ).first()
    
    if not application:
        return {}
    
    qualifications = db.query(QualificationAttachment).filter(
        QualificationAttachment.application_id == application_id
    ).order_by(QualificationAttachment.created_at.desc()).all()
    
    receipts = db.query(ChannelReceipt).filter(
        ChannelReceipt.application_id == application_id
    ).order_by(ChannelReceipt.received_at.desc()).all()
    
    logs = db.query(OperationLog).filter(
        OperationLog.application_id == application_id
    ).order_by(OperationLog.created_at.asc()).all()
    
    report = get_audit_report(db, application_id)
    
    return {
        "application": {
            "id": application.id,
            "request_id": application.request_id,
            "merchant_id": application.merchant_id,
            "sign_name": application.sign_name,
            "status": application.status.value if application.status else None,
            "channel_sign_id": application.channel_sign_id,
            "channel": application.channel,
            "audit_comment": application.audit_comment,
            "created_at": application.created_at.isoformat(),
            "updated_at": application.updated_at.isoformat()
        },
        "qualifications": [
            {
                "id": q.id,
                "type": q.qualification_type,
                "file_name": q.file_name,
                "status": q.status.value if q.status else None,
                "review_comment": q.review_comment
            }
            for q in qualifications
        ],
        "receipts": [
            {
                "id": r.id,
                "channel": r.channel,
                "channel_receipt_id": r.channel_receipt_id,
                "status": r.status.value if r.status else None
            }
            for r in receipts
        ],
        "operation_logs": [
            {
                "operation_type": l.operation_type,
                "from_status": l.from_status,
                "to_status": l.to_status,
                "remark": l.remark,
                "created_at": l.created_at.isoformat()
            }
            for l in logs
        ],
        "has_report": report is not None,
        "report_id": report.report_id if report else None
    }


def trace_application_by_request_id(
    db: Session,
    request_id: str
) -> Dict[str, Any]:
    log = db.query(OperationLog).filter(
        OperationLog.request_id == request_id
    ).first()
    
    if not log:
        return {"found": False, "message": f"未找到 request_id={request_id} 的操作记录"}
    
    return {
        "found": True,
        "application_id": log.application_id,
        "request_id": request_id,
        "operation_type": log.operation_type,
        "operator_id": log.operator_id,
        "from_status": log.from_status,
        "to_status": log.to_status,
        "remark": log.remark,
        "operation_time": log.created_at.isoformat(),
        "trace_hint": f"可通过 application_id={log.application_id} 查询完整链路"
    }
