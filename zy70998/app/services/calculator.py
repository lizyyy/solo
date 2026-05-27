from typing import Dict, List
from sqlalchemy.orm import Session
from app.models import ReconciliationRecord, Report, ReportItem, RequisitionRecord
from app.services.review import REVIEW_APPROVED, REVIEW_REJECTED, REVIEW_RETURNED


def recalculate_summaries(db: Session, batch_nos: List[str]) -> Dict:
    """
    重新计算指定批次的汇总数据，更新所有关联报告中的汇总数字。
    复核改动后调用此函数，确保详情、汇总和导出报告中的数字同步。
    """
    recs = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.batch_no.in_(batch_nos)
    ).all()

    if not recs:
        return {"success": False, "error": f"批次 {batch_nos} 无对账记录"}

    rec_ids = [r.id for r in recs]
    total = len(recs)
    approved = sum(1 for r in recs if r.review_status == REVIEW_APPROVED)
    rejected = sum(1 for r in recs if r.review_status == REVIEW_REJECTED)
    returned = sum(1 for r in recs if r.review_status == REVIEW_RETURNED)
    pending = sum(1 for r in recs if r.review_status == "pending")

    total_amount = sum(r.final_amount or 0 for r in recs if r.review_status == REVIEW_APPROVED)
    rejected_amount = sum(r.final_amount or 0 for r in recs if r.review_status == REVIEW_REJECTED)

    updated_reports = []

    reports = db.query(Report).filter(
        Report.batch_nos.contains(",".join(batch_nos))
    ).all()

    for report in reports:
        report_items = db.query(ReportItem).filter_by(report_id=report.id).all()
        report_rec_ids = [ri.reconciliation_id for ri in report_items]

        affected_ids = set(rec_ids) & set(report_rec_ids)
        if not affected_ids:
            continue

        affected_recs = [r for r in recs if r.id in affected_ids]

        report.total_records = len(report_rec_ids)
        report.approved_count = sum(
            1 for r in affected_recs if r.review_status == REVIEW_APPROVED
        ) + (report.approved_count - sum(
            1 for rid in report_rec_ids
            if rid in affected_ids and db.query(ReconciliationRecord).filter_by(id=rid).first() and db.query(ReconciliationRecord).filter_by(id=rid).first().review_status == REVIEW_APPROVED
        ))
        report.rejected_count = sum(
            1 for r in affected_recs if r.review_status == REVIEW_REJECTED
        )
        report.returned_count = sum(
            1 for r in affected_recs if r.review_status == REVIEW_RETURNED
        )
        report.pending_count = sum(
            1 for r in affected_recs if r.review_status == "pending"
        )
        report.approved_amount = sum(
            r.final_amount or 0 for r in affected_recs if r.review_status == REVIEW_APPROVED
        )
        report.rejected_amount = sum(
            r.final_amount or 0 for r in affected_recs if r.review_status == REVIEW_REJECTED
        )

        report.total_amount = (
            report.approved_amount + report.rejected_amount
        )

        updated_reports.append({
            "report_id": report.id,
            "report_no": report.report_no,
            "total_records": report.total_records,
            "approved_count": report.approved_count,
            "rejected_count": report.rejected_count,
            "pending_count": report.pending_count,
            "returned_count": report.returned_count,
            "approved_amount": report.approved_amount,
            "rejected_amount": report.rejected_amount,
        })

    db.commit()

    return {
        "success": True,
        "batch_nos": batch_nos,
        "recalculated_count": len(recs),
        "current_summary": {
            "total": total,
            "approved": approved,
            "rejected": rejected,
            "returned": returned,
            "pending": pending,
            "approved_amount": total_amount,
            "rejected_amount": rejected_amount,
        },
        "updated_reports": updated_reports,
    }
