import json
import csv
from datetime import datetime
from typing import Dict, Any, List
from pathlib import Path
from ..models import AuditConclusion, ParseResult, ValidationStatus
from ..tracker import SourceTracker


class ReportGenerator:
    def __init__(self, conclusion: AuditConclusion, parse_result: ParseResult):
        self.conclusion = conclusion
        self.parse_result = parse_result
        self.source_tracker = SourceTracker()
        self.source_tracker.track_parse_result(parse_result)
        self.source_tracker.track_audit_conclusion(conclusion)

    def generate_json_report(self, output_path: str, pretty: bool = True) -> None:
        report_data = self._build_report_data()
        indent = 2 if pretty else None
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, ensure_ascii=False, indent=indent, default=str)

    def generate_csv_report(self, output_path: str) -> None:
        rows = self._build_csv_rows()
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

    def generate_text_report(self, output_path: str) -> None:
        report_text = self._build_text_report()
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(report_text)

    def _build_report_data(self) -> Dict[str, Any]:
        return {
            "audit_info": {
                "audit_id": self.conclusion.audit_id,
                "generated_at": self.conclusion.generated_at.isoformat(),
                "total_records": self.conclusion.total_records,
                "pass_count": self.conclusion.pass_count,
                "warn_count": self.conclusion.warn_count,
                "fail_count": self.conclusion.fail_count,
                "skip_count": self.conclusion.skip_count,
            },
            "summary": self.conclusion.summary,
            "source_tracking": self.source_tracker.get_source_summary(),
            "bad_records_with_locations": self.source_tracker.get_bad_records_with_locations(),
            "parse_errors": self.parse_result.parse_errors,
            "audit_records": self._serialize_audit_records(),
        }

    def _serialize_audit_records(self) -> List[Dict[str, Any]]:
        records = []
        for record in sorted(self.conclusion.records, key=lambda r: r.record_id):
            validations = []
            for v in record.validations:
                validations.append(
                    {
                        "rule_id": v.rule_id,
                        "rule_name": v.rule_name,
                        "status": v.status,
                        "level": v.level,
                        "message": v.message,
                        "details": v.details,
                    }
                )

            records.append(
                {
                    "record_id": record.record_id,
                    "record_type": record.record_type,
                    "overall_status": record.overall_status,
                    "repository_name": record.repository_name,
                    "branch_pattern": record.branch_pattern,
                    "applicant": record.applicant,
                    "approver": record.approver,
                    "window_start": record.window_start.isoformat()
                    if record.window_start
                    else None,
                    "window_end": record.window_end.isoformat() if record.window_end else None,
                    "actual_end": record.actual_end.isoformat()
                    if record.actual_end
                    else None,
                    "recovered_by": record.recovered_by,
                    "recovered_at": record.recovered_at.isoformat()
                    if record.recovered_at
                    else None,
                    "validations": validations,
                }
            )
        return records

    def _build_csv_rows(self) -> List[Dict[str, Any]]:
        rows = []
        for record in sorted(self.conclusion.records, key=lambda r: r.record_id):
            for validation in record.validations:
                rows.append(
                    {
                        "审计ID": self.conclusion.audit_id,
                        "生成时间": self.conclusion.generated_at.strftime("%Y-%m-%d %H:%M:%S"),
                        "记录ID": record.record_id,
                        "记录类型": record.record_type,
                        "整体状态": record.overall_status,
                        "仓库名称": record.repository_name,
                        "分支模式": record.branch_pattern,
                        "申请人": record.applicant or "",
                        "审批人": record.approver or "",
                        "窗口开始": record.window_start.strftime("%Y-%m-%d %H:%M:%S")
                        if record.window_start
                        else "",
                        "窗口结束": record.window_end.strftime("%Y-%m-%d %H:%M:%S")
                        if record.window_end
                        else "",
                        "实际结束": record.actual_end.strftime("%Y-%m-%d %H:%M:%S")
                        if record.actual_end
                        else "",
                        "恢复人": record.recovered_by or "",
                        "恢复时间": record.recovered_at.strftime("%Y-%m-%d %H:%M:%S")
                        if record.recovered_at
                        else "",
                        "规则ID": validation.rule_id,
                        "规则名称": validation.rule_name,
                        "验证状态": validation.status,
                        "严重级别": validation.level,
                        "验证消息": validation.message,
                        "源位置": validation.details.get("source_location", ""),
                    }
                )
        return rows

    def _build_text_report(self) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("分支保护例外恢复审计排查报告")
        lines.append("=" * 80)
        lines.append(f"审计ID: {self.conclusion.audit_id}")
        lines.append(f"生成时间: {self.conclusion.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("-" * 80)
        lines.append("审计概览")
        lines.append("-" * 80)
        for key, value in self.conclusion.summary.items():
            lines.append(f"{key}: {value}")
        lines.append("")

        lines.append("-" * 80)
        lines.append("问题来源追踪")
        lines.append("-" * 80)
        source_summary = self.source_tracker.get_source_summary()
        lines.append(f"总问题记录数: {source_summary['总问题记录数']}")
        lines.append(f"涉及文件数: {source_summary['涉及文件数']}")
        if source_summary["问题文件列表"]:
            lines.append("问题文件:")
            for file in source_summary["问题文件列表"]:
                lines.append(f"  - {file}")
        lines.append("")

        bad_records = self.source_tracker.get_bad_records_with_locations()
        if bad_records:
            lines.append("-" * 80)
            lines.append("问题记录详情 (含原文件位置)")
            lines.append("-" * 80)
            for record in bad_records:
                lines.append(f"\n记录ID: {record['record_id']}")
                lines.append(f"记录类型: {record['record_type']}")
                if record["source_locations"]:
                    lines.append("源位置:")
                    for loc in record["source_locations"]:
                        lines.append(f"  - {loc['location_string']}")
                lines.append("问题:")
                for issue in record["issues"]:
                    lines.append(
                        f"  [{issue['status']}] {issue['rule_name']}: {issue['message']}"
                    )

        if self.parse_result.parse_errors:
            lines.append("")
            lines.append("-" * 80)
            lines.append("解析错误")
            lines.append("-" * 80)
            for error in self.parse_result.parse_errors:
                lines.append(f"  - {error.get('message', '未知错误')}")
                if error.get("location"):
                    lines.append(f"    位置: {error['location']}")

        lines.append("")
        lines.append("=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)

        return "\n".join(lines)
