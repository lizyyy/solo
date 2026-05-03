import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from ..models import (
    CheckResult,
    RuleResult,
    RuleType,
    Severity,
)


class CSVExporter:
    SEVERITY_LABELS = {
        Severity.CRITICAL: "严重",
        Severity.HIGH: "高",
        Severity.MEDIUM: "中",
        Severity.LOW: "低",
        Severity.INFO: "信息",
    }

    RULE_TYPE_LABELS = {
        RuleType.MISSING_REFERENCE: "漏引",
        RuleType.DUPLICATE_REFERENCE: "重复引用",
        RuleType.CONFLICTING_REFERENCE: "冲突引用",
        RuleType.DATE_CONFLICT: "日期矛盾",
        RuleType.UNHANDLED_OBJECTION: "未处理异议",
        RuleType.INCONSISTENT_ALIAS: "别名不一致",
        RuleType.OTHER: "其他",
    }

    DEFAULT_COLUMNS = [
        "序号",
        "问题类型",
        "严重程度",
        "描述",
        "涉及证据",
        "涉及文件",
        "行号",
        "处理建议",
        "规则ID",
    ]

    def __init__(self):
        pass

    def export(
        self,
        check_result: CheckResult,
        output_path: Path,
        columns: Optional[List[str]] = None,
        encoding: str = "utf-8-sig",
    ) -> Path:
        columns = columns or self.DEFAULT_COLUMNS

        rows = self._prepare_rows(check_result, columns)

        with open(output_path, "w", newline="", encoding=encoding) as f:
            writer = csv.DictWriter(f, fieldnames=columns)
            writer.writeheader()
            writer.writerows(rows)

        return output_path

    def _prepare_rows(
        self,
        check_result: CheckResult,
        columns: List[str],
    ) -> List[Dict]:
        rows = []

        for i, result in enumerate(check_result.rule_results, 1):
            row = {}

            if "序号" in columns:
                row["序号"] = i

            if "问题类型" in columns:
                row["问题类型"] = self.RULE_TYPE_LABELS.get(result.rule_type, result.rule_type.value)

            if "严重程度" in columns:
                row["严重程度"] = self.SEVERITY_LABELS.get(result.severity, result.severity.value)

            if "描述" in columns:
                row["描述"] = result.message

            if "涉及证据" in columns:
                row["涉及证据"] = result.evidence_number or ""

            if "涉及文件" in columns:
                row["涉及文件"] = ", ".join(result.source_files) if result.source_files else ""

            if "行号" in columns:
                row["行号"] = ", ".join(map(str, result.line_numbers)) if result.line_numbers else ""

            if "处理建议" in columns:
                row["处理建议"] = result.suggestion or ""

            if "规则ID" in columns:
                row["规则ID"] = result.rule_id or ""

            if "上下文信息" in columns:
                import json
                row["上下文信息"] = json.dumps(result.context, ensure_ascii=False) if result.context else ""

            rows.append(row)

        return rows

    def export_summary(
        self,
        check_result: CheckResult,
        output_path: Path,
        encoding: str = "utf-8-sig",
    ) -> Path:
        summary_data = [
            {"统计项": "总问题数", "数量": check_result.issue_count},
        ]

        for severity in [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW]:
            count = len(check_result.get_results_by_severity(severity))
            label = self.SEVERITY_LABELS.get(severity, severity.value)
            summary_data.append({
                "统计项": f"{label}问题",
                "数量": count,
            })

        for rule_type in RuleType:
            count = len(check_result.get_results_by_rule_type(rule_type))
            if count > 0:
                label = self.RULE_TYPE_LABELS.get(rule_type, rule_type.value)
                summary_data.append({
                    "统计项": f"{label}问题",
                    "数量": count,
                })

        with open(output_path, "w", newline="", encoding=encoding) as f:
            writer = csv.DictWriter(f, fieldnames=["统计项", "数量"])
            writer.writeheader()
            writer.writerows(summary_data)

        return output_path


def export_csv_issues(
    check_result: CheckResult,
    output_path: Path,
    columns: Optional[List[str]] = None,
    encoding: str = "utf-8-sig",
) -> Path:
    exporter = CSVExporter()
    return exporter.export(
        check_result=check_result,
        output_path=output_path,
        columns=columns,
        encoding=encoding,
    )
