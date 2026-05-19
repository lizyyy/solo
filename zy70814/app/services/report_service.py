from datetime import datetime
from typing import List, Dict, Any
from pathlib import Path
from sqlalchemy.orm import Session
import pandas as pd
import io

from app.models import (
    ReconciliationBatch,
    ReconciliationRecord,
    DiscrepancyLog,
    ReviewHistory,
)
from app.core.config import settings


class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def generate_summary_report(self, batch_id: str) -> Dict[str, Any]:
        batch = self.db.query(ReconciliationBatch).filter(ReconciliationBatch.batch_id == batch_id).first()
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")

        records = self.db.query(ReconciliationRecord).filter(ReconciliationRecord.batch_id == batch_id).all()
        discrepancies = self.db.query(DiscrepancyLog).filter(DiscrepancyLog.batch_id == batch_id).all()

        discrepancy_by_type = {}
        for disc in discrepancies:
            dtype = disc.discrepancy_type
            if dtype not in discrepancy_by_type:
                discrepancy_by_type[dtype] = {"count": 0, "error": 0, "warning": 0}
            discrepancy_by_type[dtype]["count"] += 1
            if disc.severity == "error":
                discrepancy_by_type[dtype]["error"] += 1
            else:
                discrepancy_by_type[dtype]["warning"] += 1

        return {
            "batch_id": batch.batch_id,
            "batch_name": batch.name,
            "generated_at": datetime.now().isoformat(),
            "statistics": {
                "total_records": batch.total_records,
                "passed_records": batch.passed_records,
                "failed_records": batch.failed_records,
                "warning_records": batch.warning_records,
                "pass_rate": (
                    f"{(batch.passed_records / batch.total_records * 100):.1f}%" if batch.total_records > 0 else "0%"
                ),
            },
            "discrepancy_summary": discrepancy_by_type,
            "status_summary": self._get_status_summary(records),
            "review_status": {
                "reviewed_count": sum(1 for r in records if r.is_reviewed),
                "pending_review_count": sum(1 for r in records if not r.is_reviewed),
            },
        }

    def _get_status_summary(self, records: List[ReconciliationRecord]) -> Dict[str, int]:
        status_count = {}
        for record in records:
            status = record.status
            status_count[status] = status_count.get(status, 0) + 1
        return status_count

    def generate_detailed_report(self, batch_id: str) -> Dict[str, Any]:
        summary = self.generate_summary_report(batch_id)

        records = (
            self.db.query(ReconciliationRecord)
            .filter(ReconciliationRecord.batch_id == batch_id)
            .order_by(ReconciliationRecord.arrival_time)
            .all()
        )

        detailed_records = []
        for record in records:
            discrepancies = (
                self.db.query(DiscrepancyLog)
                .filter(DiscrepancyLog.record_id == record.id)
                .order_by(DiscrepancyLog.severity)
                .all()
            )
            review_history = (
                self.db.query(ReviewHistory)
                .filter(ReviewHistory.record_id == record.id)
                .order_by(ReviewHistory.created_at.desc())
                .all()
            )

            detailed_records.append(
                {
                    "record_id": record.id,
                    "vessel_name": record.vessel_name,
                    "vessel_imo": record.vessel_imo,
                    "voyage_number": record.voyage_number,
                    "berth_number": record.berth_number,
                    "draft": record.draft,
                    "available_depth": record.available_depth,
                    "depth_margin": record.depth_margin,
                    "arrival_time": record.arrival_time.isoformat() if record.arrival_time else None,
                    "departure_time": record.departure_time.isoformat() if record.departure_time else None,
                    "status": record.status,
                    "has_discrepancy": record.has_discrepancy,
                    "discrepancy_count": record.discrepancy_count,
                    "is_reviewed": record.is_reviewed,
                    "reviewed_by": record.reviewed_by,
                    "reviewed_at": record.reviewed_at.isoformat() if record.reviewed_at else None,
                    "review_notes": record.review_notes,
                    "override_reason": record.override_reason,
                    "discrepancies": [
                        {
                            "type": d.discrepancy_type,
                            "severity": d.severity,
                            "description": d.description,
                            "explanation": d.explanation,
                            "is_resolved": d.is_resolved,
                            "resolution_notes": d.resolution_notes,
                        }
                        for d in discrepancies
                    ],
                    "review_history": [
                        {
                            "action": h.action,
                            "previous_status": h.previous_status,
                            "new_status": h.new_status,
                            "reviewer": h.reviewer,
                            "review_notes": h.review_notes,
                            "timestamp": h.created_at.isoformat(),
                        }
                        for h in review_history
                    ],
                }
            )

        return {"summary": summary, "records": detailed_records}

    def export_to_csv(self, batch_id: str, output_path: str = None) -> str:
        report = self.generate_detailed_report(batch_id)
        filename = f"reconciliation_report_{batch_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

        if output_path:
            filepath = Path(output_path) / filename
        else:
            filepath = settings.EXPORT_DIR / filename

        rows = []
        for record in report["records"]:
            base_row = {
                "船舶名称": record["vessel_name"],
                "IMO编号": record["vessel_imo"],
                "航次": record["voyage_number"],
                "泊位": record["berth_number"],
                "吃水(m)": record["draft"],
                "可用水深(m)": record["available_depth"],
                "水深余量(m)": record["depth_margin"],
                "预计到港时间": record["arrival_time"],
                "预计离港时间": record["departure_time"],
                "状态": record["status"],
                "差异数量": record["discrepancy_count"],
                "是否已复核": "是" if record["is_reviewed"] else "否",
                "复核人": record["reviewed_by"],
                "复核时间": record["reviewed_at"],
                "复核备注": record["review_notes"],
                "强制放行原因": record["override_reason"],
            }

            if record["discrepancies"]:
                for i, disc in enumerate(record["discrepancies"], 1):
                    row = base_row.copy()
                    row.update(
                        {
                            "差异序号": i,
                            "差异类型": disc["type"],
                            "严重程度": disc["severity"],
                            "差异描述": disc["description"],
                            "差异说明": disc["explanation"],
                            "是否已解决": "是" if disc["is_resolved"] else "否",
                            "解决备注": disc["resolution_notes"],
                        }
                    )
                    rows.append(row)
            else:
                base_row["差异序号"] = None
                base_row["差异类型"] = None
                base_row["严重程度"] = None
                base_row["差异描述"] = "无差异"
                base_row["差异说明"] = None
                base_row["是否已解决"] = None
                base_row["解决备注"] = None
                rows.append(base_row)

        df = pd.DataFrame(rows)
        df.to_csv(filepath, index=False, encoding="utf-8-sig")
        return str(filepath)

    def export_to_excel(self, batch_id: str, output_path: str = None) -> str:
        report = self.generate_detailed_report(batch_id)
        filename = f"reconciliation_report_{batch_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

        if output_path:
            filepath = Path(output_path) / filename
        else:
            filepath = settings.EXPORT_DIR / filename

        summary_data = [
            {"项目": "批次ID", "值": report["summary"]["batch_id"]},
            {"项目": "批次名称", "值": report["summary"]["batch_name"]},
            {"项目": "生成时间", "值": report["summary"]["generated_at"]},
            {"项目": "总记录数", "值": report["summary"]["statistics"]["total_records"]},
            {"项目": "通过数", "值": report["summary"]["statistics"]["passed_records"]},
            {"项目": "拒绝数", "值": report["summary"]["statistics"]["failed_records"]},
            {"项目": "警告数", "值": report["summary"]["statistics"]["warning_records"]},
            {"项目": "通过率", "值": report["summary"]["statistics"]["pass_rate"]},
        ]
        df_summary = pd.DataFrame(summary_data)

        detail_rows = []
        for record in report["records"]:
            detail_rows.append(
                {
                    "船舶名称": record["vessel_name"],
                    "IMO编号": record["vessel_imo"],
                    "航次": record["voyage_number"],
                    "泊位": record["berth_number"],
                    "吃水(m)": record["draft"],
                    "可用水深(m)": record["available_depth"],
                    "水深余量(m)": record["depth_margin"],
                    "预计到港时间": record["arrival_time"],
                    "预计离港时间": record["departure_time"],
                    "状态": record["status"],
                    "差异数量": record["discrepancy_count"],
                    "是否已复核": "是" if record["is_reviewed"] else "否",
                    "复核人": record["reviewed_by"],
                    "差异摘要": "; ".join(
                        [f"{d['type']}({d['severity']})" for d in record["discrepancies"]]
                    )
                    if record["discrepancies"]
                    else "无",
                }
            )
        df_details = pd.DataFrame(detail_rows)

        discrepancy_rows = []
        for record in report["records"]:
            for disc in record["discrepancies"]:
                discrepancy_rows.append(
                    {
                        "船舶名称": record["vessel_name"],
                        "泊位": record["berth_number"],
                        "差异类型": disc["type"],
                        "严重程度": disc["severity"],
                        "差异描述": disc["description"],
                        "差异说明": disc["explanation"],
                        "是否已解决": "是" if disc["is_resolved"] else "否",
                        "解决备注": disc["resolution_notes"],
                    }
                )
        df_discrepancies = pd.DataFrame(discrepancy_rows)

        with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
            df_summary.to_excel(writer, sheet_name="汇总", index=False)
            df_details.to_excel(writer, sheet_name="明细", index=False)
            df_discrepancies.to_excel(writer, sheet_name="差异详情", index=False)

        return str(filepath)

    def get_export_history(self) -> List[Dict[str, Any]]:
        exports = []
        if settings.EXPORT_DIR.exists():
            for file in sorted(settings.EXPORT_DIR.glob("reconciliation_report_*"), key=lambda x: x.stat().st_mtime, reverse=True):
                exports.append(
                    {
                        "filename": file.name,
                        "filepath": str(file),
                        "size": file.stat().st_size,
                        "created_at": datetime.fromtimestamp(file.stat().st_mtime).isoformat(),
                    }
                )
        return exports
