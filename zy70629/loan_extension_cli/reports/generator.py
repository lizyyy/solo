from datetime import datetime, date
from pathlib import Path
from typing import Any
import json
import csv

from loan_extension_cli.rules import RuleResult
from loan_extension_cli.tracking import TrackingResult


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj: Any) -> Any:
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(obj)


class ReportGenerator:
    def __init__(
        self,
        rule_results: list[RuleResult],
        tracking_result: TrackingResult,
        output_dir: str = "./output",
    ):
        self.rule_results = rule_results
        self.tracking_result = tracking_result
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_all_reports(self) -> dict[str, str]:
        reports: dict[str, str] = {}

        reports["summary"] = self._generate_summary_report()
        reports["violations_detail"] = self._generate_violations_detail_report()
        reports["source_tracking"] = self._generate_source_tracking_report()
        reports["json_export"] = self._generate_json_export()

        return reports

    def _generate_summary_report(self) -> str:
        timestamp = self.tracking_result.run_id
        filename = self.output_dir / f"check_summary_{timestamp}.md"

        total_errors = 0
        total_warnings = 0
        failed_rules = 0

        for result in self.rule_results:
            for violation in result.violations:
                if violation.severity == "error":
                    total_errors += 1
                elif violation.severity == "warning":
                    total_warnings += 1
            if not result.is_passed:
                failed_rules += 1

        summary = self.tracking_result.summary

        content = f"""# 借款展期还款计划排查报告

## 执行概要

| 项目 | 数值 |
|------|------|
| 执行时间 | {self.tracking_result.run_timestamp.strftime('%Y-%m-%d %H:%M:%S')} |
| 运行ID | {self.tracking_result.run_id} |
| 稳定标识 | {self.tracking_result.generate_stable_id()} |
| 输入文件数 | {summary['input_files_count']} |
| 总记录数 | {summary['total_records']} |
| 有效记录数 | {summary['valid_records']} |
| 无效记录数 | {summary['invalid_records']} |
| 解析错误数 | {summary['parse_errors_count']} |

## 规则检查结果

| 规则代码 | 规则名称 | 检查结果 | 错误数 | 警告数 |
|----------|----------|----------|--------|--------|
"""

        for result in sorted(self.rule_results, key=lambda r: r.rule_code):
            errors = sum(1 for v in result.violations if v.severity == "error")
            warnings = sum(1 for v in result.violations if v.severity == "warning")
            status = "✅ 通过" if result.is_passed else "❌ 未通过"
            content += f"| {result.rule_code} | {result.rule_name} | {status} | {errors} | {warnings} |\n"

        content += f"""
## 问题汇总

| 问题类型 | 数量 |
|----------|------|
| 严重错误 | {total_errors} |
| 警告 | {total_warnings} |
| 未通过规则 | {failed_rules} |

## 按记录类型统计

"""

        for record_type, stats in sorted(summary["records_by_type"].items()):
            content += f"""### {record_type}
- 总计: {stats['total']}
- 有效: {stats['valid']}
- 无效: {stats['invalid']}

"""

        content += f"""
## 输入文件列表

"""
        for i, file_path in enumerate(self.tracking_result.input_files, 1):
            content += f"{i}. {file_path}\n"

        with open(filename, "w", encoding="utf-8") as f:
            f.write(content)

        return str(filename)

    def _generate_violations_detail_report(self) -> str:
        timestamp = self.tracking_result.run_id
        filename = self.output_dir / f"violations_detail_{timestamp}.csv"

        rows = []
        for result in self.rule_results:
            for violation in result.violations:
                related_sources = "; ".join(
                    [r.get("source", "") for r in violation.related_records]
                )
                rows.append(
                    {
                        "rule_code": violation.rule_code,
                        "rule_name": violation.rule_name,
                        "severity": violation.severity,
                        "message": violation.message,
                        "related_sources": related_sources,
                        "suggestion": violation.suggestion,
                    }
                )

        with open(filename, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=[
                    "rule_code",
                    "rule_name",
                    "severity",
                    "message",
                    "related_sources",
                    "suggestion",
                ],
            )
            writer.writeheader()
            writer.writerows(rows)

        return str(filename)

    def _generate_source_tracking_report(self) -> str:
        timestamp = self.tracking_result.run_id
        filename = self.output_dir / f"source_tracking_{timestamp}.csv"

        rows = []
        for record in sorted(
            self.tracking_result.tracked_records, key=lambda r: (r.record_type, r.record_id)
        ):
            rows.append(
                {
                    "record_id": record.record_id,
                    "record_type": record.record_type,
                    "source_file": record.source_file,
                    "source_location": record.source_location,
                    "is_valid": "是" if record.is_valid else "否",
                    "validation_errors": "; ".join(record.validation_errors),
                    "raw_content": record.raw_content,
                }
            )

        with open(filename, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=[
                    "record_id",
                    "record_type",
                    "source_file",
                    "source_location",
                    "is_valid",
                    "validation_errors",
                    "raw_content",
                ],
            )
            writer.writeheader()
            writer.writerows(rows)

        return str(filename)

    def _generate_json_export(self) -> str:
        timestamp = self.tracking_result.run_id
        filename = self.output_dir / f"full_export_{timestamp}.json"

        export_data: dict[str, Any] = {
            "metadata": {
                "run_id": self.tracking_result.run_id,
                "run_timestamp": self.tracking_result.run_timestamp.isoformat(),
                "stable_id": self.tracking_result.generate_stable_id(),
            },
            "summary": self.tracking_result.summary,
            "input_files": self.tracking_result.input_files,
            "rule_results": [],
            "tracked_records": [],
            "parse_errors": self.tracking_result.parse_errors,
        }

        for result in self.rule_results:
            export_data["rule_results"].append(
                {
                    "rule_code": result.rule_code,
                    "rule_name": result.rule_name,
                    "is_passed": result.is_passed,
                    "details": result.details,
                    "violations": [
                        {
                            "rule_code": v.rule_code,
                            "rule_name": v.rule_name,
                            "severity": v.severity,
                            "message": v.message,
                            "related_records": v.related_records,
                            "suggestion": v.suggestion,
                        }
                        for v in result.violations
                    ],
                }
            )

        for record in self.tracking_result.tracked_records:
            export_data["tracked_records"].append(
                {
                    "record_id": record.record_id,
                    "record_type": record.record_type,
                    "source_file": record.source_file,
                    "source_location": record.source_location,
                    "raw_content": record.raw_content,
                    "parsed_data": record.parsed_data,
                    "is_valid": record.is_valid,
                    "validation_errors": record.validation_errors,
                }
            )

        with open(filename, "w", encoding="utf-8") as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2, cls=DateTimeEncoder)

        return str(filename)
