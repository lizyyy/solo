"""报告导出模块。

导出 Markdown 和 JSON 格式的分析报告。
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from .models import (
    AnalysisResult,
    ComparisonResult,
    Finding,
    Severity,
)


class MarkdownExporter:
    """Markdown 格式报告导出器。"""

    SEVERITY_EMOJI = {
        Severity.CRITICAL: "🔴",
        Severity.HIGH: "🟠",
        Severity.MEDIUM: "🟡",
        Severity.LOW: "🟢",
        Severity.INFO: "ℹ️",
    }

    SEVERITY_ORDER = [
        Severity.CRITICAL,
        Severity.HIGH,
        Severity.MEDIUM,
        Severity.LOW,
        Severity.INFO,
    ]

    def export_analysis(self, result: AnalysisResult) -> str:
        """导出单个分析结果为 Markdown。"""
        lines = []

        lines.append(f"# 迭代器坑点分析报告")
        lines.append("")
        lines.append(f"**分析 ID**: {result.id}")
        if result.name:
            lines.append(f"**名称**: {result.name}")
        lines.append(f"**分析时间**: {result.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("## 📊 摘要")
        lines.append("")
        summary = result.summary or {}

        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总问题数 | {summary.get('total_findings', 0)} |")
        lines.append(f"| 分析文件数 | {summary.get('files_analyzed', 0)} |")
        lines.append(f"| 流水线数 | {summary.get('pipelines_analyzed', 0)} |")
        lines.append(f"| 事件数 | {summary.get('events_found', 0)} |")
        lines.append("")

        findings_by_severity = summary.get("findings_by_severity", {})
        if findings_by_severity:
            lines.append("### 按严重程度分布")
            lines.append("")
            lines.append("| 严重程度 | 数量 |")
            lines.append("|----------|------|")
            for severity in self.SEVERITY_ORDER:
                count = findings_by_severity.get(severity.value, 0)
                emoji = self.SEVERITY_EMOJI[severity]
                lines.append(f"| {emoji} {severity.value.upper()} | {count} |")
            lines.append("")

        all_findings = self._collect_all_findings(result)
        if all_findings:
            lines.append("## 🔍 详细问题")
            lines.append("")

            for severity in self.SEVERITY_ORDER:
                severity_findings = [f for f in all_findings if f.severity == severity]
                if not severity_findings:
                    continue

                emoji = self.SEVERITY_EMOJI[severity]
                lines.append(f"### {emoji} {severity.value.upper()} ({len(severity_findings)})")
                lines.append("")

                for idx, finding in enumerate(severity_findings, 1):
                    lines.append(f"#### {idx}. {finding.title}")
                    lines.append("")

                    if finding.location:
                        location_parts = [f"**文件**: `{finding.location.file_path}`"]
                        if finding.location.line_number:
                            location_parts.append(f"**行号**: {finding.location.line_number}")
                        lines.append(" | ".join(location_parts))
                        lines.append("")

                    lines.append(f"**描述**: {finding.description}")
                    lines.append("")

                    if finding.code_snippet:
                        lines.append("**代码片段**:")
                        lines.append("")
                        lines.append("```python")
                        lines.append(finding.code_snippet)
                        lines.append("```")
                        lines.append("")

                    if finding.suggestion:
                        lines.append("**建议**:")
                        lines.append("")
                        lines.append(finding.suggestion)
                        lines.append("")

        if result.events:
            lines.append("## 📋 相关事件")
            lines.append("")
            lines.append("| 时间 | 类型 | 级别 | 消息 |")
            lines.append("|------|------|------|------|")
            for event in sorted(result.events, key=lambda e: e.timestamp):
                ts = event.timestamp.strftime("%H:%M:%S") if event.timestamp else "N/A"
                lines.append(f"| {ts} | {event.event_type} | {event.level} | {event.message} |")
            lines.append("")

        lines.append("---")
        lines.append("")
        lines.append(f"*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")

        return "\n".join(lines)

    def export_comparison(self, result: ComparisonResult) -> str:
        """导出对比结果为 Markdown。"""
        lines = []

        lines.append("# 分析对比报告")
        lines.append("")

        name1 = result.analysis_name_1 or f"分析 #{result.analysis_id_1}"
        name2 = result.analysis_name_2 or f"分析 #{result.analysis_id_2}"

        lines.append(f"**对比**: `{name1}` → `{name2}`")
        lines.append("")

        lines.append("## 📊 对比摘要")
        lines.append("")

        summary = result.summary or {}
        lines.append("| 指标 | 数量 |")
        lines.append("|------|------|")
        lines.append(f"| 🆕 新增问题 | {summary.get('new_findings_count', 0)} |")
        lines.append(f"| ✅ 已解决问题 | {summary.get('resolved_findings_count', 0)} |")
        lines.append(f"| 📉 严重程度降低 | {summary.get('improved_count', 0)} |")
        lines.append(f"| 📈 严重程度升高 | {summary.get('worsened_count', 0)} |")
        lines.append("")

        if result.resolved_findings:
            lines.append("## ✅ 已解决的问题")
            lines.append("")
            for idx, finding in enumerate(result.resolved_findings, 1):
                emoji = self.SEVERITY_EMOJI[finding.severity]
                lines.append(f"{idx}. {emoji} **{finding.title}**")
                if finding.location:
                    lines.append(f"   - 文件: `{finding.location.file_path}`")
                    if finding.location.line_number:
                        lines.append(f"   - 行号: {finding.location.line_number}")
                lines.append("")

        if result.new_findings:
            lines.append("## 🆕 新增的问题")
            lines.append("")
            for idx, finding in enumerate(result.new_findings, 1):
                emoji = self.SEVERITY_EMOJI[finding.severity]
                lines.append(f"{idx}. {emoji} **{finding.title}**")
                lines.append(f"   - 描述: {finding.description}")
                if finding.location:
                    lines.append(f"   - 文件: `{finding.location.file_path}`")
                    if finding.location.line_number:
                        lines.append(f"   - 行号: {finding.location.line_number}")
                lines.append("")

        if result.improved_findings:
            lines.append("## 📉 严重程度降低的问题")
            lines.append("")
            for idx, item in enumerate(result.improved_findings, 1):
                before = item["before"]
                after = item["after"]
                before_emoji = self.SEVERITY_EMOJI[before.severity]
                after_emoji = self.SEVERITY_EMOJI[after.severity]
                lines.append(f"{idx}. **{before.title}**")
                lines.append(f"   - {before_emoji} {before.severity.value.upper()} → {after_emoji} {after.severity.value.upper()}")
                lines.append("")

        if result.worsened_findings:
            lines.append("## 📈 严重程度升高的问题")
            lines.append("")
            for idx, item in enumerate(result.worsened_findings, 1):
                before = item["before"]
                after = item["after"]
                before_emoji = self.SEVERITY_EMOJI[before.severity]
                after_emoji = self.SEVERITY_EMOJI[after.severity]
                lines.append(f"{idx}. **{before.title}**")
                lines.append(f"   - {before_emoji} {before.severity.value.upper()} → {after_emoji} {after.severity.value.upper()}")
                lines.append("")

        lines.append("---")
        lines.append("")
        lines.append(f"*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")

        return "\n".join(lines)

    @staticmethod
    def _collect_all_findings(result: AnalysisResult) -> List[Finding]:
        """收集所有发现。"""
        findings = []
        for snippet in result.code_snippets:
            findings.extend(snippet.findings)
        return findings


class JSONExporter:
    """JSON 格式报告导出器。"""

    def export_analysis(self, result: AnalysisResult) -> str:
        """导出单个分析结果为 JSON。"""
        data = {
            "id": result.id,
            "name": result.name,
            "created_at": result.created_at.isoformat() if result.created_at else None,
            "summary": result.summary,
            "code_snippets": [
                {
                    "file_path": s.file_path,
                    "findings": [self._finding_to_dict(f) for f in s.findings],
                }
                for s in result.code_snippets
            ],
            "pipelines": [
                {
                    "name": p.name,
                    "description": p.description,
                    "risks": [
                        {
                            "risk_type": r.risk_type,
                            "stage": r.stage,
                            "description": r.description,
                            "severity": r.severity.value,
                        }
                        for r in p.risks
                    ],
                }
                for p in result.pipelines
            ],
            "events": [
                {
                    "timestamp": e.timestamp.isoformat() if e.timestamp else None,
                    "event_type": e.event_type,
                    "level": e.level,
                    "message": e.message,
                    "context": e.context,
                }
                for e in result.events
            ],
        }
        return json.dumps(data, ensure_ascii=False, indent=2)

    def export_comparison(self, result: ComparisonResult) -> str:
        """导出对比结果为 JSON。"""
        data = {
            "analysis_id_1": result.analysis_id_1,
            "analysis_id_2": result.analysis_id_2,
            "analysis_name_1": result.analysis_name_1,
            "analysis_name_2": result.analysis_name_2,
            "summary": result.summary,
            "new_findings": [self._finding_to_dict(f) for f in result.new_findings],
            "resolved_findings": [self._finding_to_dict(f) for f in result.resolved_findings],
            "improved_findings": [
                {
                    "before": self._finding_to_dict(item["before"]),
                    "after": self._finding_to_dict(item["after"]),
                    "change": item["change"],
                }
                for item in result.improved_findings
            ],
            "worsened_findings": [
                {
                    "before": self._finding_to_dict(item["before"]),
                    "after": self._finding_to_dict(item["after"]),
                    "change": item["change"],
                }
                for item in result.worsened_findings
            ],
        }
        return json.dumps(data, ensure_ascii=False, indent=2)

    @staticmethod
    def _finding_to_dict(finding: Finding) -> Dict[str, Any]:
        """将 Finding 转换为字典。"""
        return {
            "pitfall_type": finding.pitfall_type.value,
            "severity": finding.severity.value,
            "title": finding.title,
            "description": finding.description,
            "location": {
                "file_path": finding.location.file_path if finding.location else None,
                "line_number": finding.location.line_number if finding.location else None,
                "function_name": finding.location.function_name if finding.location else None,
                "class_name": finding.location.class_name if finding.location else None,
            } if finding.location else None,
            "context": finding.context,
            "suggestion": finding.suggestion,
            "code_snippet": finding.code_snippet,
        }


def export_report(
    result: Union[AnalysisResult, ComparisonResult],
    format: str,
    output_path: Optional[Path] = None,
) -> str:
    """导出报告。

    Args:
        result: 分析结果或对比结果
        format: 导出格式 ('markdown' 或 'json')
        output_path: 输出文件路径，为 None 则返回字符串

    Returns:
        报告内容字符串
    """
    if format == "markdown":
        exporter = MarkdownExporter()
        if isinstance(result, AnalysisResult):
            content = exporter.export_analysis(result)
        else:
            content = exporter.export_comparison(result)
    elif format == "json":
        exporter = JSONExporter()
        if isinstance(result, AnalysisResult):
            content = exporter.export_analysis(result)
        else:
            content = exporter.export_comparison(result)
    else:
        raise ValueError(f"不支持的导出格式: {format}")

    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)

    return content
