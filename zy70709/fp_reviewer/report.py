import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .models import ProcessedData, ReviewStatus


class ReportGenerator:
    def __init__(self, output_dir: str = "./reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_all(
        self,
        processed_data: ProcessedData,
        batch_id: Optional[str] = None,
    ) -> Dict[str, str]:
        if batch_id is None:
            batch_id = datetime.now().strftime("%Y%m%d_%H%M%S")

        reports = {}

        reports["summary"] = self._generate_summary(processed_data, batch_id)
        reports["risk"] = self._generate_risk_export(processed_data, batch_id)
        reports["bad_rows"] = self._generate_bad_rows_report(processed_data, batch_id)
        reports["json"] = self._generate_json_export(processed_data, batch_id)

        return reports

    def _generate_summary(
        self, processed_data: ProcessedData, batch_id: str
    ) -> str:
        file_path = self.output_dir / f"summary_{batch_id}.md"

        total_rules = len(processed_data.valid_rules)
        status_counts = self._get_status_counts(processed_data)
        expired_count = status_counts.get(ReviewStatus.EXPIRED, 0)
        needs_review_count = status_counts.get(ReviewStatus.NEEDS_REVIEW, 0)
        bad_rows_count = len(processed_data.bad_rows)

        content = f"""# 误报压制复核报告

## 概览

| 指标 | 数值 |
|------|------|
| 处理时间 | {processed_data.processing_timestamp.strftime('%Y-%m-%d %H:%M:%S')} |
| 有效规则数 | {total_rules} |
| 已过期规则 | {expired_count} |
| 需立即复核 | {needs_review_count} |
| 坏行记录数 | {bad_rows_count} |

## 状态分布

"""
        for status, count in sorted(status_counts.items()):
            content += f"- **{status}**: {count}\n"

        content += "\n## 复核结果\n\n"

        if processed_data.review_results:
            content += "| 规则ID | 原状态 | 新状态 | 风险标识 |\n"
            content += "|--------|--------|--------|----------|\n"
            for result in sorted(processed_data.review_results, key=lambda r: r.rule_id):
                flags = ", ".join(result.risk_flags) if result.risk_flags else "-"
                content += f"| {result.rule_id} | {result.original_status} | {result.new_status} | {flags} |\n"
        else:
            content += "无状态变更记录。\n"

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

        return str(file_path)

    def _generate_risk_export(
        self, processed_data: ProcessedData, batch_id: str
    ) -> str:
        file_path = self.output_dir / f"risk_export_{batch_id}.csv"

        with open(file_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "rule_id",
                "scan_rule_id",
                "review_status",
                "days_until_expiry",
                "is_expired",
                "has_samples",
                "risk_flags",
                "reviewer",
                "created_by",
                "source_file",
                "source_line",
            ])

            sorted_rules = sorted(processed_data.valid_rules, key=lambda r: r.rule_id)

            for rule in sorted_rules:
                days = rule.days_until_expiry()
                has_samples = len(rule.samples) > 0
                risk_flags = self._get_risk_flags_for_rule(rule)
                source_file = rule.source.file_path if rule.source else ""
                source_line = rule.source.line_number if rule.source else ""

                writer.writerow([
                    rule.rule_id,
                    rule.scan_rule_id,
                    rule.review_status,
                    days,
                    rule.is_expired(),
                    has_samples,
                    ",".join(risk_flags),
                    rule.reviewer or "",
                    rule.created_by,
                    source_file,
                    source_line,
                ])

        return str(file_path)

    def _generate_bad_rows_report(
        self, processed_data: ProcessedData, batch_id: str
    ) -> str:
        file_path = self.output_dir / f"bad_rows_{batch_id}.json"

        bad_rows_data = []
        for bad_row in sorted(processed_data.bad_rows, key=lambda r: (r.file_path, r.row_number)):
            bad_rows_data.append({
                "file_path": bad_row.file_path,
                "row_number": bad_row.row_number,
                "error_message": bad_row.error_message,
                "raw_content": bad_row.raw_content,
            })

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(bad_rows_data, f, ensure_ascii=False, indent=2)

        return str(file_path)

    def _generate_json_export(
        self, processed_data: ProcessedData, batch_id: str
    ) -> str:
        file_path = self.output_dir / f"full_export_{batch_id}.json"

        data = {
            "processing_timestamp": processed_data.processing_timestamp.isoformat(),
            "summary": {
                "total_rules": len(processed_data.valid_rules),
                "bad_rows_count": len(processed_data.bad_rows),
                "review_results_count": len(processed_data.review_results),
                "status_distribution": {
                    str(k): v for k, v in self._get_status_counts(processed_data).items()
                },
            },
            "rules": [
                {
                    "rule_id": r.rule_id,
                    "scan_rule_id": r.scan_rule_id,
                    "reason": r.reason,
                    "created_at": r.created_at.isoformat(),
                    "expires_at": r.expires_at.isoformat(),
                    "created_by": r.created_by,
                    "reviewer": r.reviewer,
                    "review_status": str(r.review_status),
                    "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
                    "is_expired": r.is_expired(),
                    "days_until_expiry": r.days_until_expiry(),
                    "samples_count": len(r.samples),
                    "source": {
                        "file_path": r.source.file_path,
                        "line_number": r.source.line_number,
                    } if r.source else None,
                }
                for r in sorted(processed_data.valid_rules, key=lambda r: r.rule_id)
            ],
            "bad_rows": [
                {
                    "file_path": br.file_path,
                    "row_number": br.row_number,
                    "error_message": br.error_message,
                }
                for br in sorted(processed_data.bad_rows, key=lambda r: (r.file_path, r.row_number))
            ],
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return str(file_path)

    def _get_status_counts(self, processed_data: ProcessedData) -> Dict[ReviewStatus, int]:
        counts: Dict[ReviewStatus, int] = {}
        for rule in processed_data.valid_rules:
            status = rule.review_status
            counts[status] = counts.get(status, 0) + 1
        return counts

    def _get_risk_flags_for_rule(self, rule) -> List[str]:
        flags = []
        if rule.is_expired():
            flags.append("已过期")
        elif rule.days_until_expiry() <= 3:
            flags.append("即将过期")
        elif rule.days_until_expiry() <= 7:
            flags.append("临近过期")

        if not rule.reviewer and rule.review_status == ReviewStatus.PENDING:
            flags.append("未分配复核人")

        if len(rule.samples) == 0:
            flags.append("无证据样本")

        if len(rule.reason) < 10:
            flags.append("压制理由过短")

        return flags
