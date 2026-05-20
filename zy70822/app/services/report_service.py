import pandas as pd
from datetime import datetime
from typing import List, Dict, Any, Optional
from io import BytesIO
from sqlalchemy.orm import Session

from app.models import (
    ReconciliationRecordDB,
    AppointmentDB,
    RecordStatus,
    DiscrepancyType
)


class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def generate_summary_report(self, batch_id: Optional[str] = None) -> Dict[str, Any]:
        query = self.db.query(ReconciliationRecordDB)
        if batch_id:
            query = query.filter(ReconciliationRecordDB.reconciliation_batch_id == batch_id)
        records = query.all()

        summary = {
            "batch_id": batch_id or "all",
            "generated_at": datetime.utcnow(),
            "total_records": len(records),
            "status_breakdown": {},
            "discrepancy_breakdown": {},
            "approval_rate": 0,
            "review_progress": 0
        }

        for status in RecordStatus:
            count = sum(1 for r in records if r.status == status.value)
            summary["status_breakdown"][status.value] = count

        discrepancy_types = {}
        for record in records:
            for disc in record.discrepancies:
                disc_type = disc.get("type", "unknown")
                discrepancy_types[disc_type] = discrepancy_types.get(disc_type, 0) + 1
        summary["discrepancy_breakdown"] = discrepancy_types

        approved = (
            summary["status_breakdown"].get(RecordStatus.AUTO_APPROVED.value, 0) +
            summary["status_breakdown"].get(RecordStatus.MANUALLY_APPROVED.value, 0)
        )
        if len(records) > 0:
            summary["approval_rate"] = round(approved / len(records) * 100, 2)

        processed = sum(v for k, v in summary["status_breakdown"].items() 
                       if k not in [RecordStatus.PENDING.value, RecordStatus.NEEDS_REVIEW.value])
        if len(records) > 0:
            summary["review_progress"] = round(processed / len(records) * 100, 2)

        return summary

    def generate_detailed_records(self, batch_id: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
        query = self.db.query(ReconciliationRecordDB).join(AppointmentDB)
        if batch_id:
            query = query.filter(ReconciliationRecordDB.reconciliation_batch_id == batch_id)
        if status:
            query = query.filter(ReconciliationRecordDB.status == status)

        records = query.all()
        details = []

        for record in records:
            appt = record.appointment
            details.append({
                "record_id": record.record_id,
                "appointment_id": appt.appointment_id,
                "child_name": appt.child_name,
                "child_id_card": appt.child_id_card,
                "vaccine_name": appt.vaccine_name,
                "appointment_date": appt.appointment_date.isoformat(),
                "status": record.status,
                "discrepancies": record.discrepancies,
                "discrepancy_count": len(record.discrepancies),
                "review_notes": record.review_notes,
                "reviewed_by": record.reviewed_by,
                "reviewed_at": record.reviewed_at.isoformat() if record.reviewed_at else None,
                "final_decision": record.final_decision,
                "decision_reason": record.decision_reason,
                "is_reschedule": appt.is_reschedule,
                "reschedule_count": appt.reschedule_count
            })

        return details

    def export_to_excel(self, batch_id: Optional[str] = None) -> bytes:
        summary = self.generate_summary_report(batch_id)
        details = self.generate_detailed_records(batch_id)

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            summary_df = pd.DataFrame([
                {
                    "指标": "总记录数",
                    "数值": summary["total_records"]
                },
                {
                    "指标": "报告生成时间",
                    "数值": summary["generated_at"].strftime("%Y-%m-%d %H:%M:%S")
                },
                {
                    "指标": "通过率",
                    "数值": f"{summary['approval_rate']}%"
                },
                {
                    "指标": "复核完成率",
                    "数值": f"{summary['review_progress']}%"
                }
            ])
            for status, count in summary["status_breakdown"].items():
                summary_df = pd.concat([summary_df, pd.DataFrame([{
                    "指标": f"状态: {status}",
                    "数值": count
                }])], ignore_index=True)

            summary_df.to_excel(writer, sheet_name="汇总", index=False)

            if details:
                details_data = []
                for d in details:
                    discrepancy_descriptions = "; ".join(
                        [f"{disc.get('type', '')}: {disc.get('description', '')}" 
                         for disc in d["discrepancies"]]
                    )
                    details_data.append({
                        "记录ID": d["record_id"],
                        "预约编号": d["appointment_id"],
                        "儿童姓名": d["child_name"],
                        "疫苗名称": d["vaccine_name"],
                        "预约日期": d["appointment_date"],
                        "状态": d["status"],
                        "差异数量": d["discrepancy_count"],
                        "差异详情": discrepancy_descriptions,
                        "复核人": d["reviewed_by"] or "",
                        "复核时间": d["reviewed_at"] or "",
                        "最终决定": d["final_decision"] or "",
                        "决定原因": d["decision_reason"] or "",
                        "是否改签": "是" if d["is_reschedule"] else "否",
                        "改签次数": d["reschedule_count"]
                    })

                details_df = pd.DataFrame(details_data)
                details_df.to_excel(writer, sheet_name="明细", index=False)

                discrepancy_breakdown = []
                for d in details:
                    for disc in d["discrepancies"]:
                        discrepancy_breakdown.append({
                            "记录ID": d["record_id"],
                            "儿童姓名": d["child_name"],
                            "疫苗名称": d["vaccine_name"],
                            "差异类型": disc.get("type", ""),
                            "严重程度": disc.get("severity", ""),
                            "差异描述": disc.get("description", ""),
                            "建议处理": disc.get("suggested_action", "")
                        })

                if discrepancy_breakdown:
                    disc_df = pd.DataFrame(discrepancy_breakdown)
                    disc_df.to_excel(writer, sheet_name="差异分析", index=False)

        output.seek(0)
        return output.getvalue()

    def generate_discrepancy_report(self, batch_id: Optional[str] = None) -> Dict[str, Any]:
        details = self.generate_detailed_records(batch_id)
        
        discrepancy_report = {
            "generated_at": datetime.utcnow(),
            "total_discrepancies": 0,
            "by_type": {},
            "by_severity": {},
            "records_with_discrepancies": []
        }

        for d in details:
            if d["discrepancies"]:
                discrepancy_report["total_discrepancies"] += d["discrepancy_count"]
                discrepancy_report["records_with_discrepancies"].append({
                    "record_id": d["record_id"],
                    "child_name": d["child_name"],
                    "vaccine_name": d["vaccine_name"],
                    "discrepancies": d["discrepancies"]
                })

                for disc in d["discrepancies"]:
                    disc_type = disc.get("type", "unknown")
                    severity = disc.get("severity", "unknown")
                    discrepancy_report["by_type"][disc_type] = discrepancy_report["by_type"].get(disc_type, 0) + 1
                    discrepancy_report["by_severity"][severity] = discrepancy_report["by_severity"].get(severity, 0) + 1

        return discrepancy_report
