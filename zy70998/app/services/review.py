import json
from datetime import datetime
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from app.models import ReconciliationRecord, ReviewLog, RequisitionRecord


REVIEW_PENDING = "pending"
REVIEW_APPROVED = "approved"
REVIEW_REJECTED = "rejected"
REVIEW_RETURNED = "returned"


def get_reconciliation_list(
    db: Session,
    batch_no: Optional[str] = None,
    review_status: Optional[str] = None,
    anomaly_type: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> Dict:
    query = db.query(ReconciliationRecord).join(RequisitionRecord)

    if batch_no:
        query = query.filter(ReconciliationRecord.batch_no == batch_no)
    if review_status:
        query = query.filter(ReconciliationRecord.review_status == review_status)
    if anomaly_type:
        query = query.filter(ReconciliationRecord.anomaly_flags.contains(anomaly_type))

    total = query.count()
    items = (
        query.order_by(ReconciliationRecord.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    result_items = []
    for r in items:
        req = r.requisition
        result_items.append({
            "id": r.id,
            "requisition_id": r.requisition_id,
            "batch_no": r.batch_no,
            "emp_no": req.emp_no,
            "emp_name": req.emp_name,
            "department": req.department,
            "coupon_code": req.coupon_code,
            "coupon_type": req.coupon_type,
            "claim_type": req.claim_type,
            "claim_date": req.claim_date,
            "claim_amount": req.claim_amount,
            "employee_match": r.employee_match,
            "coupon_match": r.coupon_match,
            "is_resigned": r.is_resigned,
            "is_duplicate": r.is_duplicate,
            "is_proxy": r.is_proxy,
            "anomaly_flags": r.anomaly_flags,
            "review_status": r.review_status,
            "final_status": r.final_status,
            "final_amount": r.final_amount,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
        })

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": result_items,
    }


def get_reconciliation_detail(db: Session, rec_id: int) -> Optional[Dict]:
    r = db.query(ReconciliationRecord).filter_by(id=rec_id).first()
    if not r:
        return None

    req = r.requisition
    logs = [
        {
            "id": log.id,
            "action": log.action,
            "old_status": log.old_status,
            "new_status": log.new_status,
            "comment": log.comment,
            "operator": log.operator,
            "created_at": log.created_at,
        }
        for log in r.review_logs
    ]

    return {
        "id": r.id,
        "batch_no": r.batch_no,
        "requisition": {
            "id": req.id,
            "emp_no": req.emp_no,
            "emp_name": req.emp_name,
            "department": req.department,
            "coupon_code": req.coupon_code,
            "coupon_type": req.coupon_type,
            "claim_type": req.claim_type,
            "claim_date": req.claim_date,
            "claim_amount": req.claim_amount,
            "proxy_emp_no": req.proxy_emp_no,
            "proxy_name": req.proxy_name,
            "remark": req.remark,
            "raw_data": req.raw_data,
        },
        "employee_match": r.employee_match,
        "employee_mismatch_reason": r.employee_mismatch_reason,
        "coupon_match": r.coupon_match,
        "coupon_mismatch_reason": r.coupon_mismatch_reason,
        "is_resigned": r.is_resigned,
        "resigned_detail": r.resigned_detail,
        "is_duplicate": r.is_duplicate,
        "duplicate_with": r.duplicate_with,
        "is_proxy": r.is_proxy,
        "proxy_detail": r.proxy_detail,
        "anomaly_flags": r.anomaly_flags,
        "anomaly_flags_list": json.loads(r.anomaly_flags) if r.anomaly_flags else [],
        "review_status": r.review_status,
        "review_operator": r.review_operator,
        "review_comment": r.review_comment,
        "reviewed_at": r.reviewed_at,
        "final_status": r.final_status,
        "final_amount": r.final_amount,
        "final_remark": r.final_remark,
        "review_logs": logs,
        "created_at": r.created_at,
        "updated_at": r.updated_at,
    }


def review_reconciliation(
    db: Session,
    rec_id: int,
    action: str,
    comment: str,
    operator: str,
    final_amount: Optional[float] = None,
) -> Optional[Dict]:
    r = db.query(ReconciliationRecord).filter_by(id=rec_id).first()
    if not r:
        return {"success": False, "error": f"对账记录 {rec_id} 不存在"}

    if action not in ("approve", "reject", "return"):
        return {"success": False, "error": f"无效操作: {action}，仅支持 approve/reject/return"}

    old_status = r.review_status

    if action == "approve":
        new_status = REVIEW_APPROVED
        r.final_status = REVIEW_APPROVED
    elif action == "reject":
        new_status = REVIEW_REJECTED
        r.final_status = REVIEW_REJECTED
    else:
        new_status = REVIEW_RETURNED
        r.final_status = REVIEW_RETURNED

    if final_amount is not None:
        r.final_amount = final_amount

    r.review_status = new_status
    r.review_comment = comment
    r.review_operator = operator
    r.reviewed_at = datetime.now()

    if action == "approve":
        r.final_remark = comment
    elif action == "reject":
        r.final_remark = f"退回原因：{comment}"
    else:
        r.final_remark = f"补材料通知：{comment}"

    log = ReviewLog(
        reconciliation_id=r.id,
        action=action,
        old_status=old_status,
        new_status=new_status,
        comment=comment,
        operator=operator,
    )
    db.add(log)
    db.commit()

    return {
        "success": True,
        "reconciliation_id": r.id,
        "action": action,
        "old_status": old_status,
        "new_status": new_status,
        "comment": comment,
        "operator": operator,
        "created_at": log.created_at,
    }


def batch_review(
    db: Session,
    rec_ids: List[int],
    action: str,
    comment: str,
    operator: str,
) -> Dict:
    results = []
    for rec_id in rec_ids:
        result = review_reconciliation(db, rec_id, action, comment, operator)
        results.append(result)
    return {
        "batch_count": len(rec_ids),
        "results": results,
    }


def get_reconciliation_stats(db: Session, batch_no: Optional[str] = None) -> Dict:
    query = db.query(ReconciliationRecord)
    if batch_no:
        query = query.filter(ReconciliationRecord.batch_no == batch_no)

    total = query.count()
    pending = query.filter_by(review_status=REVIEW_PENDING).count()
    approved = query.filter_by(review_status=REVIEW_APPROVED).count()
    rejected = query.filter_by(review_status=REVIEW_REJECTED).count()
    returned = query.filter_by(review_status=REVIEW_RETURNED).count()

    resigned_count = query.filter_by(is_resigned=True).count()
    duplicate_count = query.filter_by(is_duplicate=True).count()
    proxy_count = query.filter_by(is_proxy=True).count()

    approved_amount = (
        db.query(ReconciliationRecord)
        .filter(ReconciliationRecord.review_status == REVIEW_APPROVED)
        .with_entities(ReconciliationRecord.final_amount)
        .all()
    )
    total_amount = sum(a[0] or 0 for a in approved_amount)

    return {
        "total": total,
        "pending": pending,
        "approved": approved,
        "rejected": rejected,
        "returned": returned,
        "resigned_count": resigned_count,
        "duplicate_count": duplicate_count,
        "proxy_count": proxy_count,
        "approved_amount": total_amount,
    }
