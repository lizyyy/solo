import json
import csv
import io
from datetime import datetime
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from app.models import (
    Report, ReportItem, ReconciliationRecord, RequisitionRecord,
    ReviewLog, ImportBatch
)
from app.database import REPORT_DIR
from app.services.review import REVIEW_APPROVED, REVIEW_REJECTED, REVIEW_RETURNED


def _make_report_no() -> str:
    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"RPT-{ts}"


def _snapshot_reconciliation(db: Session, rec_id: int) -> Dict:
    r = db.query(ReconciliationRecord).filter_by(id=rec_id).first()
    if not r:
        return {}
    req = r.requisition
    logs = [
        {
            "action": log.action,
            "old_status": log.old_status,
            "new_status": log.new_status,
            "comment": log.comment,
            "operator": log.operator,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in r.review_logs
    ]
    anomaly_list = json.loads(r.anomaly_flags) if r.anomaly_flags else []

    explanation_parts = []
    if r.is_resigned:
        explanation_parts.append(f"【离职拦截】{r.resigned_detail or '员工已离职'}")
    if r.is_duplicate:
        explanation_parts.append(f"【重复领取】{r.duplicate_with or '与其他记录重复'}")
    if r.is_proxy:
        explanation_parts.append(f"【代领】{r.proxy_detail or '存在代领人'}")
    if r.employee_mismatch_reason:
        explanation_parts.append(f"【员工差异】{r.employee_mismatch_reason}")
    if r.coupon_mismatch_reason:
        explanation_parts.append(f"【券码差异】{r.coupon_mismatch_reason}")
    if not explanation_parts:
        explanation_parts.append("无异常")

    explanation = "；".join(explanation_parts)

    return {
        "reconciliation_id": r.id,
        "requisition_id": req.id,
        "batch_no": r.batch_no,
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
        "anomaly_flags": anomaly_list,
        "review_status": r.review_status,
        "review_operator": r.review_operator,
        "review_comment": r.review_comment,
        "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
        "final_status": r.final_status,
        "final_amount": r.final_amount,
        "final_remark": r.final_remark,
        "explanation": explanation,
        "review_logs": logs,
    }


def generate_report(
    db: Session,
    title: str,
    batch_nos: List[str],
    generated_by: str = "system",
) -> Dict:
    recs = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.batch_no.in_(batch_nos)
    ).all()

    if not recs:
        return {"success": False, "error": f"批次 {batch_nos} 无对账记录"}

    total = len(recs)
    approved = sum(1 for r in recs if r.review_status == REVIEW_APPROVED)
    rejected = sum(1 for r in recs if r.review_status == REVIEW_REJECTED)
    returned = sum(1 for r in recs if r.review_status == REVIEW_RETURNED)
    pending = sum(1 for r in recs if r.review_status == "pending")

    approved_amount = sum(r.final_amount or 0 for r in recs if r.review_status == REVIEW_APPROVED)
    rejected_amount = sum(r.final_amount or 0 for r in recs if r.review_status == REVIEW_REJECTED)
    total_amount = approved_amount + rejected_amount

    report_no = _make_report_no()

    report = Report(
        report_no=report_no,
        title=title,
        batch_nos=",".join(batch_nos),
        total_records=total,
        approved_count=approved,
        rejected_count=rejected,
        pending_count=pending,
        returned_count=returned,
        total_amount=total_amount,
        approved_amount=approved_amount,
        rejected_amount=rejected_amount,
        generated_by=generated_by,
        file_name=f"{report_no}.csv",
        status="generated",
    )
    db.add(report)
    db.flush()

    for r in recs:
        snapshot = _snapshot_reconciliation(db, r.id)
        item = ReportItem(
            report_id=report.id,
            reconciliation_id=r.id,
            snapshot=json.dumps(snapshot, ensure_ascii=False),
        )
        db.add(item)

    db.commit()

    _write_report_csv(report.id, recs, report_no)

    return {
        "success": True,
        "report_id": report.id,
        "report_no": report_no,
        "title": title,
        "total_records": total,
        "approved_count": approved,
        "rejected_count": rejected,
        "pending_count": pending,
        "returned_count": returned,
        "total_amount": total_amount,
        "approved_amount": approved_amount,
        "rejected_amount": rejected_amount,
        "file_name": report.file_name,
    }


def _write_report_csv(report_id: int, recs: List[ReconciliationRecord], report_no: str):
    path = REPORT_DIR / f"{report_no}.csv"
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "对账ID", "批次号", "工号", "姓名", "部门", "券码", "券类型",
        "领取方式", "领取日期", "原金额", "最终金额",
        "异常标记", "复核状态", "复核人", "复核说明", "最终状态", "最终备注",
        "离职", "重复领取", "代领", "差异解释",
    ])

    for r in recs:
        req = r.requisition
        anomaly_list = json.loads(r.anomaly_flags) if r.anomaly_flags else []

        explanation_parts = []
        if r.is_resigned:
            explanation_parts.append(f"离职拦截：{r.resigned_detail or '员工已离职'}")
        if r.is_duplicate:
            explanation_parts.append(f"重复领取：{r.duplicate_with or '与其他记录重复'}")
        if r.is_proxy:
            explanation_parts.append(f"代领：{r.proxy_detail or '存在代领人'}")
        if r.employee_mismatch_reason:
            explanation_parts.append(f"员工差异：{r.employee_mismatch_reason}")
        if r.coupon_mismatch_reason:
            explanation_parts.append(f"券码差异：{r.coupon_mismatch_reason}")
        explanation = "；".join(explanation_parts) if explanation_parts else "无异常"

        writer.writerow([
            r.id, r.batch_no, req.emp_no, req.emp_name, req.department or "",
            req.coupon_code or "", req.coupon_type or "", req.claim_type,
            req.claim_date or "", req.claim_amount, r.final_amount,
            "、".join(anomaly_list) if anomaly_list else "",
            r.review_status, r.review_operator or "", r.review_comment or "",
            r.final_status, r.final_remark or "",
            "是" if r.is_resigned else "否",
            "是" if r.is_duplicate else "否",
            "是" if r.is_proxy else "否",
            explanation,
        ])

    path.write_text(output.getvalue(), encoding="utf-8-sig")


def list_reports(db: Session) -> List[Dict]:
    reports = db.query(Report).order_by(Report.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "report_no": r.report_no,
            "title": r.title,
            "total_records": r.total_records,
            "approved_count": r.approved_count,
            "rejected_count": r.rejected_count,
            "pending_count": r.pending_count,
            "returned_count": r.returned_count,
            "total_amount": r.total_amount,
            "approved_amount": r.approved_amount,
            "rejected_amount": r.rejected_amount,
            "status": r.status,
            "file_name": r.file_name,
            "created_at": r.created_at,
        }
        for r in reports
    ]


def get_report_detail(db: Session, report_id: int) -> Optional[Dict]:
    report = db.query(Report).filter_by(id=report_id).first()
    if not report:
        return None

    items = db.query(ReportItem).filter_by(report_id=report_id).all()
    item_details = []
    for item in items:
        if item.snapshot:
            item_details.append(json.loads(item.snapshot))
        else:
            snap = _snapshot_reconciliation(db, item.reconciliation_id)
            item_details.append(snap)

    return {
        "report": {
            "id": report.id,
            "report_no": report.report_no,
            "title": report.title,
            "batch_nos": report.batch_nos,
            "total_records": report.total_records,
            "approved_count": report.approved_count,
            "rejected_count": report.rejected_count,
            "pending_count": report.pending_count,
            "returned_count": report.returned_count,
            "total_amount": report.total_amount,
            "approved_amount": report.approved_amount,
            "rejected_amount": report.rejected_amount,
            "generated_by": report.generated_by,
            "file_name": report.file_name,
            "status": report.status,
            "created_at": report.created_at,
        },
        "items": item_details,
    }


def get_explanation_for_record(db: Session, rec_id: int) -> Optional[Dict]:
    r = db.query(ReconciliationRecord).filter_by(id=rec_id).first()
    if not r:
        return None

    req = r.requisition
    anomaly_list = json.loads(r.anomaly_flags) if r.anomaly_flags else []

    sections = []

    if r.is_resigned:
        sections.append({
            "type": "离职拦截",
            "detail": r.resigned_detail or "员工已离职，需确认发放合规性",
            "action_taken": r.final_status,
            "action_comment": r.review_comment or r.final_remark or "",
        })

    if r.is_duplicate:
        sections.append({
            "type": "重复领取",
            "detail": f"与以下记录重复：{r.duplicate_with or '未知'}",
            "action_taken": r.final_status,
            "action_comment": r.review_comment or r.final_remark or "",
        })

    if r.is_proxy:
        sections.append({
            "type": "代领",
            "detail": r.proxy_detail or f"代领人：{req.proxy_name}（{req.proxy_emp_no}）",
            "action_taken": r.final_status,
            "action_comment": r.review_comment or r.final_remark or "",
        })

    if r.employee_mismatch_reason and not r.is_resigned:
        sections.append({
            "type": "员工信息差异",
            "detail": r.employee_mismatch_reason,
            "action_taken": r.final_status,
            "action_comment": r.review_comment or r.final_remark or "",
        })

    if r.coupon_mismatch_reason:
        sections.append({
            "type": "券码差异",
            "detail": r.coupon_mismatch_reason,
            "action_taken": r.final_status,
            "action_comment": r.review_comment or r.final_remark or "",
        })

    if not sections:
        sections.append({
            "type": "正常",
            "detail": "无异常标记",
            "action_taken": r.final_status,
            "action_comment": r.review_comment or r.final_remark or "",
        })

    return {
        "reconciliation_id": r.id,
        "emp_no": req.emp_no,
        "emp_name": req.emp_name,
        "department": req.department,
        "coupon_code": req.coupon_code,
        "claim_type": req.claim_type,
        "claim_amount": req.claim_amount,
        "final_amount": r.final_amount,
        "review_status": r.review_status,
        "review_operator": r.review_operator,
        "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
        "anomaly_flags": anomaly_list,
        "sections": sections,
        "full_explanation": "；".join([
            f"【{s['type']}】{s['detail']}（处理：{s['action_taken']} - {s['action_comment']}）"
            for s in sections
        ]),
    }


def get_report_file_path(report_no: str) -> Optional[str]:
    path = REPORT_DIR / f"{report_no}.csv"
    if path.exists():
        return str(path)
    return None
