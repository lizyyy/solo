from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from ..models import (
    CheckResult,
    RuleResult,
    RuleType,
    Severity,
    CheckSession,
)


class MarkdownExporter:
    SEVERITY_ICONS = {
        Severity.CRITICAL: "🔴",
        Severity.HIGH: "🟠",
        Severity.MEDIUM: "🟡",
        Severity.LOW: "🟢",
        Severity.INFO: "ℹ️",
    }

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

    def __init__(self):
        self.report_lines: List[str] = []

    def export(
        self,
        check_result: CheckResult,
        case_number: Optional[str] = None,
        case_name: Optional[str] = None,
        include_details: bool = True,
    ) -> str:
        self.report_lines = []

        self._add_header(check_result, case_number, case_name)
        self._add_summary(check_result)
        self._add_issues_by_severity(check_result)
        self._add_issues_by_rule_type(check_result)
        self._add_detailed_issues(check_result, include_details)
        self._add_footer()

        return "\n".join(self.report_lines)

    def _add_header(
        self,
        check_result: CheckResult,
        case_number: Optional[str],
        case_name: Optional[str],
    ) -> None:
        self.report_lines.append("# 庭审笔录证据编号校验复核单")
        self.report_lines.append("")
        self.report_lines.append(f"**校验ID**: {check_result.check_id}")
        self.report_lines.append(f"**校验时间**: {check_result.check_timestamp.strftime('%Y-%m-%d %H:%M:%S')}")

        if case_number:
            self.report_lines.append(f"**案号**: {case_number}")
        if case_name:
            self.report_lines.append(f"**案件名称**: {case_name}")

        if check_result.files_processed:
            self.report_lines.append(f"**处理文件**: {', '.join(check_result.files_processed)}")

        self.report_lines.append("")
        self.report_lines.append("---")
        self.report_lines.append("")

    def _add_summary(self, check_result: CheckResult) -> None:
        self.report_lines.append("## 校验概要")
        self.report_lines.append("")

        total_issues = check_result.issue_count
        critical_count = len(check_result.get_results_by_severity(Severity.CRITICAL))
        high_count = len(check_result.get_results_by_severity(Severity.HIGH))

        status_icon = "✅"
        status_text = "通过"
        if critical_count > 0:
            status_icon = "❌"
            status_text = "未通过（存在严重问题）"
        elif high_count > 0:
            status_icon = "⚠️"
            status_text = "需关注（存在高优先级问题）"

        self.report_lines.append(f"**总体状态**: {status_icon} {status_text}")
        self.report_lines.append("")
        self.report_lines.append(f"- **总问题数**: {total_issues}")
        self.report_lines.append(f"- **严重问题**: {critical_count}")
        self.report_lines.append(f"- **高优先级问题**: {high_count}")
        self.report_lines.append(f"- **中优先级问题**: {len(check_result.get_results_by_severity(Severity.MEDIUM))}")
        self.report_lines.append(f"- **低优先级问题**: {len(check_result.get_results_by_severity(Severity.LOW))}")
        self.report_lines.append("")
        self.report_lines.append("---")
        self.report_lines.append("")

    def _add_issues_by_severity(self, check_result: CheckResult) -> None:
        self.report_lines.append("## 按严重程度分类")
        self.report_lines.append("")

        for severity in [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW]:
            results = check_result.get_results_by_severity(severity)
            if not results:
                continue

            icon = self.SEVERITY_ICONS.get(severity, "❓")
            label = self.SEVERITY_LABELS.get(severity, severity.value)

            self.report_lines.append(f"### {icon} {label} ({len(results)} 个问题)")
            self.report_lines.append("")

            for i, result in enumerate(results, 1):
                rule_label = self.RULE_TYPE_LABELS.get(result.rule_type, result.rule_type.value)
                self.report_lines.append(f"{i}. **{rule_label}**: {result.message}")
                if result.evidence_number:
                    self.report_lines.append(f"   - 涉及证据: `{result.evidence_number}`")
                if result.source_files:
                    self.report_lines.append(f"   - 涉及文件: {', '.join(result.source_files)}")
                if result.suggestion:
                    self.report_lines.append(f"   - 建议: {result.suggestion}")
                self.report_lines.append("")

        self.report_lines.append("---")
        self.report_lines.append("")

    def _add_issues_by_rule_type(self, check_result: CheckResult) -> None:
        self.report_lines.append("## 按问题类型分类")
        self.report_lines.append("")

        for rule_type in RuleType:
            results = check_result.get_results_by_rule_type(rule_type)
            if not results:
                continue

            label = self.RULE_TYPE_LABELS.get(rule_type, rule_type.value)

            self.report_lines.append(f"### {label} ({len(results)} 个问题)")
            self.report_lines.append("")

            for i, result in enumerate(results, 1):
                sev_icon = self.SEVERITY_ICONS.get(result.severity, "❓")
                self.report_lines.append(f"{i}. {sev_icon} **{result.message}**")
                if result.evidence_number:
                    self.report_lines.append(f"   - 涉及证据: `{result.evidence_number}`")
                self.report_lines.append("")

        self.report_lines.append("---")
        self.report_lines.append("")

    def _add_detailed_issues(self, check_result: CheckResult, include_details: bool) -> None:
        if not include_details:
            return

        self.report_lines.append("## 详细问题清单")
        self.report_lines.append("")

        for i, result in enumerate(check_result.rule_results, 1):
            sev_icon = self.SEVERITY_ICONS.get(result.severity, "❓")
            sev_label = self.SEVERITY_LABELS.get(result.severity, result.severity.value)
            rule_label = self.RULE_TYPE_LABELS.get(result.rule_type, result.rule_type.value)

            self.report_lines.append(f"### 问题 {i}: {sev_icon} [{sev_label}] {rule_label}")
            self.report_lines.append("")
            self.report_lines.append(f"**描述**: {result.message}")
            self.report_lines.append("")

            if result.evidence_number:
                self.report_lines.append(f"**涉及证据**: `{result.evidence_number}`")

            if result.source_files:
                self.report_lines.append(f"**涉及文件**: {', '.join(result.source_files)}")

            if result.line_numbers:
                self.report_lines.append(f"**行号**: {', '.join(map(str, result.line_numbers))}")

            if result.suggestion:
                self.report_lines.append("")
                self.report_lines.append("**处理建议**:")
                self.report_lines.append(f"> {result.suggestion}")

            if result.context:
                self.report_lines.append("")
                self.report_lines.append("**上下文信息**:")
                self.report_lines.append("```json")
                import json
                self.report_lines.append(json.dumps(result.context, ensure_ascii=False, indent=2))
                self.report_lines.append("```")

            self.report_lines.append("")
            self.report_lines.append("---")
            self.report_lines.append("")

    def _add_footer(self) -> None:
        self.report_lines.append("## 备注")
        self.report_lines.append("")
        self.report_lines.append("此复核单由「庭审笔录证据编号校验员」自动生成。")
        self.report_lines.append("")
        self.report_lines.append("### 图标说明")
        self.report_lines.append("")
        self.report_lines.append("- 🔴 **严重**: 必须立即处理的问题")
        self.report_lines.append("- 🟠 **高**: 需要优先处理的问题")
        self.report_lines.append("- 🟡 **中**: 需要关注的问题")
        self.report_lines.append("- 🟢 **低**: 建议优化的问题")
        self.report_lines.append("- ℹ️ **信息**: 仅供参考的提示")
        self.report_lines.append("")
        self.report_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


def export_markdown_report(
    check_result: CheckResult,
    output_path: Path,
    case_number: Optional[str] = None,
    case_name: Optional[str] = None,
    include_details: bool = True,
) -> Path:
    exporter = MarkdownExporter()
    content = exporter.export(
        check_result=check_result,
        case_number=case_number,
        case_name=case_name,
        include_details=include_details,
    )

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)

    return output_path
