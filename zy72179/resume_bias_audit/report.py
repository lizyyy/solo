import csv
import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional


class ReportExporter:
    def __init__(self, output_dir: Optional[str] = None):
        self.output_dir = output_dir or os.path.join(os.getcwd(), "audit_reports")

    def export_json(
        self,
        audit_result,
        alignment_result=None,
        stratification_results=None,
        diff_result=None,
        remarks: Optional[Dict[str, str]] = None,
        filename: Optional[str] = None,
    ) -> str:
        os.makedirs(self.output_dir, exist_ok=True)
        if filename is None:
            filename = f"audit_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        filepath = os.path.join(self.output_dir, filename)

        report = {
            "report_type": "简历匹配偏差审计",
            "generated_at": datetime.now().isoformat(),
            "audit_judgments": [],
            "overall_metrics": audit_result.overall_metrics,
        }

        for j in audit_result.judgments:
            report["audit_judgments"].append({
                "record_id": j.record_id,
                "judgment": j.judgment,
                "reason": j.reason,
                "evidence": j.evidence,
                "metrics": j.metrics,
            })

        if alignment_result:
            report["alignment_summary"] = {
                "total_ids": alignment_result.total_ids,
                "fully_aligned": alignment_result.fully_aligned,
                "partial_aligned": alignment_result.partial_aligned,
                "conflicts": alignment_result.conflicts,
            }

        if stratification_results:
            report["stratification"] = {}
            for dim, sr in stratification_results.items():
                report["stratification"][dim] = {
                    "dimension": sr.dimension,
                    "overall_bias_rate": sr.overall_bias_rate,
                    "strata": [s.to_dict() for s in sr.strata],
                }

        if diff_result:
            report["diff_analysis"] = {
                "metric_changes": diff_result.metric_changes,
                "sample_changes": diff_result.sample_changes,
                "new_remarks": diff_result.new_remarks,
                "explanation": diff_result.explanation,
            }

        if remarks:
            report["remarks"] = [
                {"id": rid, "remark": text} for rid, text in remarks.items()
            ]

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        return filepath

    def export_csv(
        self,
        audit_result,
        alignment_result=None,
        filename: Optional[str] = None,
    ) -> str:
        os.makedirs(self.output_dir, exist_ok=True)
        if filename is None:
            filename = f"audit_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        filepath = os.path.join(self.output_dir, filename)

        rows = []
        for j in audit_result.judgments:
            row = {
                "id": j.record_id,
                "judgment": j.judgment,
                "reason": j.reason,
                "evidence": j.evidence,
            }
            row.update(j.metrics)
            if alignment_result and j.record_id in alignment_result.records:
                aligned = alignment_result.records[j.record_id]
                row["data_sources_present"] = ",".join(aligned.data_sources_present)
                row["data_sources_missing"] = ",".join(aligned.data_sources_missing)
            rows.append(row)

        if not rows:
            return filepath

        fieldnames = list(rows[0].keys())
        for row in rows:
            for k in row:
                if k not in fieldnames:
                    fieldnames.append(k)

        with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for row in rows:
                clean_row = {}
                for k in fieldnames:
                    val = row.get(k, "")
                    if isinstance(val, (list, dict)):
                        val = json.dumps(val, ensure_ascii=False)
                    clean_row[k] = val
                writer.writerow(clean_row)

        return filepath

    def export_text_summary(
        self,
        audit_result,
        alignment_result=None,
        stratification_results=None,
        diff_result=None,
        filename: Optional[str] = None,
    ) -> str:
        os.makedirs(self.output_dir, exist_ok=True)
        if filename is None:
            filename = f"audit_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        filepath = os.path.join(self.output_dir, filename)

        lines = [
            "=" * 60,
            "简历匹配偏差审计报告",
            f"生成时间: {datetime.now().isoformat()}",
            "=" * 60,
            "",
        ]

        if alignment_result:
            lines.append(alignment_result.summary())
            lines.append("")

        lines.append(audit_result.summary())
        lines.append("")

        if stratification_results:
            for dim, sr in stratification_results.items():
                lines.append(sr.summary())
                lines.append("")

        if diff_result:
            lines.append(diff_result.summary())
            lines.append("")

        flagged = [j for j in audit_result.judgments if j.judgment != "通过"]
        if flagged:
            lines.append("=" * 60)
            lines.append("偏差记录详情（含证据回溯）")
            lines.append("=" * 60)
            for j in flagged:
                lines.append(f"\nID: {j.record_id}")
                lines.append(f"判断: {j.judgment}")
                lines.append(f"原因: {j.reason}")
                lines.append(f"证据: {j.evidence}")
                if j.metrics:
                    lines.append(f"指标: {j.metrics}")

        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        return filepath
