from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models import ProcessingDetail, AuditLog, Trajectory, RawMaterial
from app.schemas import ReviewRequest


def apply_review(db: Session, detail_id: int, req: ReviewRequest) -> ProcessingDetail:
    detail = db.query(ProcessingDetail).filter(ProcessingDetail.id == detail_id).first()
    if not detail:
        raise ValueError(f"detail {detail_id} not found")

    if req.review_result == "approve":
        old_status = detail.review_status
        detail.review_status = "approved"
        detail.reviewed_by = req.operator
        detail.reviewed_at = datetime.utcnow()
        db.add(AuditLog(
            detail_id=detail.id,
            field_name="review_status",
            old_value=old_status,
            new_value="approved",
            changed_by=req.operator,
            reason=req.reason,
        ))
        db.add(Trajectory(
            detail_id=detail.id,
            stage="review",
            action="approve",
            operator=req.operator,
            old_value={"review_status": old_status},
            new_value={"review_status": "approved"},
            comment=req.reason,
        ))

    elif req.review_result == "reject":
        old_status = detail.review_status
        detail.review_status = "rejected"
        detail.reviewed_by = req.operator
        detail.reviewed_at = datetime.utcnow()
        db.add(AuditLog(
            detail_id=detail.id,
            field_name="review_status",
            old_value=old_status,
            new_value="rejected",
            changed_by=req.operator,
            reason=req.reason,
        ))
        db.add(Trajectory(
            detail_id=detail.id,
            stage="review",
            action="reject",
            operator=req.operator,
            old_value={"review_status": old_status},
            new_value={"review_status": "rejected"},
            comment=req.reason,
        ))

    elif req.review_result == "change":
        if not req.change_target:
            raise ValueError("change_target 不能为空")
        allowed = {"category", "reason_code", "reason_detail", "next_action", "review_status"}
        if req.change_target not in allowed:
            raise ValueError(f"不允许修改字段: {req.change_target}")
        old_val = getattr(detail, req.change_target)
        new_val = req.change_value
        if req.change_target == "category" and new_val not in {"normal", "pending", "intercepted"}:
            raise ValueError("category 取值无效")
        setattr(detail, req.change_target, new_val)
        detail.reviewed_by = req.operator
        detail.reviewed_at = datetime.utcnow()
        detail.review_status = "changed"

        db.add(AuditLog(
            detail_id=detail.id,
            field_name=req.change_target,
            old_value=old_val,
            new_value=new_val,
            changed_by=req.operator,
            reason=req.reason,
        ))
        db.add(Trajectory(
            detail_id=detail.id,
            stage="review",
            action="change",
            operator=req.operator,
            old_value={req.change_target: old_val},
            new_value={req.change_target: new_val},
            comment=req.reason,
        ))

    db.commit()
    db.refresh(detail)
    return detail


def list_audit_logs(db: Session, detail_id: int) -> List[Dict[str, Any]]:
    logs = db.query(AuditLog).filter(AuditLog.detail_id == detail_id).order_by(AuditLog.changed_at.asc()).all()
    return [
        {
            "id": log.id,
            "field_name": log.field_name,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "changed_by": log.changed_by,
            "reason": log.reason,
            "changed_at": log.changed_at.isoformat() if log.changed_at else None,
        }
        for log in logs
    ]


def trace_key_fields(db: Session, detail_id: int) -> List[Dict[str, Any]]:
    detail = db.query(ProcessingDetail).filter(ProcessingDetail.id == detail_id).first()
    if not detail:
        return []
    material = db.query(RawMaterial).filter(RawMaterial.id == detail.raw_material_id).first()
    if not material:
        return []

    key_fields = [
        "artifact_no", "artifact_name", "borrower", "lender",
        "loan_start", "loan_end", "insurance_value", "insurance_type",
        "condition", "location",
    ]

    report = detail.report_snapshot or {}
    transforms_log = db.query(AuditLog).filter(AuditLog.detail_id == detail_id).order_by(AuditLog.changed_at.asc()).all()

    result = []
    for f in key_fields:
        raw_val = getattr(material, f, None)
        proc_val = raw_val
        report_val = report.get(f, report.get(f + "_raw"))

        transforms = []
        for log in transforms_log:
            if log.field_name == f:
                transforms.append({
                    "changed_by": log.changed_by,
                    "old_value": log.old_value,
                    "new_value": log.new_value,
                    "reason": log.reason,
                    "at": log.changed_at.isoformat() if log.changed_at else None,
                })

        result.append({
            "field_name": f,
            "raw_value": raw_val,
            "processed_value": proc_val,
            "report_value": report_val,
            "transforms": transforms,
        })

    return result
