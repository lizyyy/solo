"""报告导出模块 - 导出 Markdown、CSV、JSON 格式"""

import csv
import json
from datetime import datetime
from io import StringIO
from pathlib import Path
from typing import Optional

from .models import (
    AlignmentResult,
    ChangeLog,
    FixPlan,
    Issue,
    IssueSeverity,
    IssueType,
    Language,
    Quarantine,
    ReviewAction,
    SubtitleFile,
)


class Exporter:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def export_markdown_report(
        self,
        quarantine: Quarantine,
        subtitle_files: list[SubtitleFile] = None,
        fix_plan: FixPlan = None,
        change_log: ChangeLog = None,
        alignments: list[AlignmentResult] = None,
        review_stats: dict = None,
    ) -> Path:
        lines = []
        lines.append("# 多语字幕交付校对报告")
        lines.append("")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        if review_stats:
            lines.append("## 复核统计")
            lines.append("")
            lines.append(f"- 总计问题数: **{review_stats['total']}**")
            lines.append(f"- 待处理: {review_stats['pending']}")
            lines.append(f"- 已确认: {review_stats['confirmed']}")
            lines.append(f"- 已驳回: {review_stats['dismissed']}")
            lines.append("")

            if review_stats["by_type"]:
                lines.append("### 按问题类型分布")
                lines.append("")
                lines.append("| 问题类型 | 数量 |")
                lines.append("|----------|------|")
                for issue_type, count in review_stats["by_type"].items():
                    lines.append(f"| {self._format_issue_type(issue_type)} | {count} |")
                lines.append("")

            if review_stats["by_severity"]:
                lines.append("### 按严重程度分布")
                lines.append("")
                lines.append("| 严重程度 | 数量 |")
                lines.append("|----------|------|")
                for severity, count in review_stats["by_severity"].items():
                    lines.append(f"| {self._format_severity(severity)} | {count} |")
                lines.append("")

        if quarantine.issues:
            lines.append("## 问题详情")
            lines.append("")

            critical_issues = [i for i in quarantine.issues if i.severity == IssueSeverity.CRITICAL]
            warning_issues = [i for i in quarantine.issues if i.severity == IssueSeverity.WARNING]
            info_issues = [i for i in quarantine.issues if i.severity == IssueSeverity.INFO]

            if critical_issues:
                lines.append("### 严重问题 (CRITICAL)")
                lines.append("")
                for issue in critical_issues:
                    lines.append(self._format_issue_markdown(issue))
                    lines.append("")

            if warning_issues:
                lines.append("### 警告问题 (WARNING)")
                lines.append("")
                for issue in warning_issues:
                    lines.append(self._format_issue_markdown(issue))
                    lines.append("")

            if info_issues:
                lines.append("### 信息问题 (INFO)")
                lines.append("")
                for issue in info_issues:
                    lines.append(self._format_issue_markdown(issue))
                    lines.append("")

        if fix_plan and fix_plan.items:
            lines.append("## 修复计划")
            lines.append("")

            auto_fixes = [i for i in fix_plan.items if not i.requires_manual]
            manual_fixes = [i for i in fix_plan.items if i.requires_manual]

            if auto_fixes:
                lines.append("### 可自动修复项")
                lines.append("")
                lines.append("| 操作 | 描述 | 涉及文件 |")
                lines.append("|------|------|----------|")
                for item in auto_fixes:
                    lines.append(
                        f"| {self._format_fix_action(item.action.value)} | {item.description} | {item.filename or '-'} |"
                    )
                lines.append("")

            if manual_fixes:
                lines.append("### 需要人工处理项")
                lines.append("")
                lines.append("| 描述 | 涉及文件 |")
                lines.append("|------|----------|")
                for item in manual_fixes:
                    lines.append(f"| {item.description} | {item.filename or '-'} |")
                lines.append("")

        if change_log and change_log.entries:
            lines.append("## 变更日志")
            lines.append("")
            lines.append("| 时间 | 操作 | 描述 | 变更前 | 变更后 |")
            lines.append("|------|------|------|--------|--------|")
            for entry in change_log.entries:
                lines.append(
                    f"| {entry.timestamp.strftime('%H:%M:%S') if entry.timestamp else '-'} "
                    f"| {entry.action} "
                    f"| {entry.description} "
                    f"| {entry.before or '-'} "
                    f"| {entry.after or '-'} |"
                )
            lines.append("")

        if alignments:
            lines.append("## 对齐结果")
            lines.append("")
            for alignment in alignments:
                lines.append(f"### {alignment.source_language.value} -> {alignment.target_language.value}")
                lines.append("")
                lines.append("| 置信度 | 源文本 | 目标文本 |")
                lines.append("|--------|--------|----------|")
                for pair in alignment.pairs[:10]:
                    lines.append(
                        f"| {pair.confidence:.0%} "
                        f"| {pair.source_text[:30]}{'...' if len(pair.source_text) > 30 else ''} "
                        f"| {pair.target_text[:30]}{'...' if len(pair.target_text) > 30 else ''} |"
                    )
                if len(alignment.pairs) > 10:
                    lines.append(f"| ... | (共 {len(alignment.pairs)} 对) | ... |")
                lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("*此报告由多语字幕交付校对员自动生成*")

        content = "\n".join(lines)
        output_path = self.output_dir / f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)

        return output_path

    def export_issues_csv(self, quarantine: Quarantine) -> Path:
        output_path = self.output_dir / f"issues_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "问题ID",
                "问题类型",
                "严重程度",
                "消息",
                "语言",
                "集数",
                "字幕序号",
                "文件名",
                "复核状态",
                "复核备注",
                "创建时间",
            ])

            for issue in quarantine.issues:
                writer.writerow([
                    issue.id,
                    issue.issue_type.value,
                    issue.severity.value,
                    issue.message,
                    issue.language.value if issue.language else "",
                    issue.episode or "",
                    issue.subtitle_index or "",
                    issue.filename or "",
                    issue.review_action.value,
                    issue.review_note or "",
                    issue.created_at.strftime("%Y-%m-%d %H:%M:%S") if issue.created_at else "",
                ])

        return output_path

    def export_audit_json(
        self,
        quarantine: Quarantine,
        subtitle_files: list[SubtitleFile] = None,
        fix_plan: FixPlan = None,
        change_log: ChangeLog = None,
        config: dict = None,
    ) -> Path:
        audit_data = {
            "generated_at": datetime.now().isoformat(),
            "version": "0.1.0",
            "quarantine": {
                "generated_at": quarantine.generated_at.isoformat() if quarantine.generated_at else None,
                "issues": [
                    {
                        "id": i.id,
                        "issue_type": i.issue_type.value,
                        "severity": i.severity.value,
                        "message": i.message,
                        "language": i.language.value if i.language else None,
                        "episode": i.episode,
                        "subtitle_index": i.subtitle_index,
                        "filename": i.filename,
                        "details": i.details,
                        "review_action": i.review_action.value,
                        "review_note": i.review_note,
                        "reviewed_at": i.reviewed_at.isoformat() if i.reviewed_at else None,
                        "created_at": i.created_at.isoformat() if i.created_at else None,
                    }
                    for i in quarantine.issues
                ],
            },
        }

        if subtitle_files:
            audit_data["subtitle_files"] = [
                {
                    "filename": sf.filename,
                    "language": sf.language.value,
                    "format": sf.format.value,
                    "episode": sf.episode,
                    "entry_count": len(sf.entries),
                    "sha256": sf.sha256,
                    "imported_at": sf.imported_at.isoformat() if sf.imported_at else None,
                }
                for sf in subtitle_files
            ]

        if fix_plan:
            audit_data["fix_plan"] = {
                "generated_at": fix_plan.generated_at.isoformat() if fix_plan.generated_at else None,
                "is_dry_run": fix_plan.is_dry_run,
                "items": [
                    {
                        "id": item.id,
                        "action": item.action.value,
                        "description": item.description,
                        "language": item.language.value if item.language else None,
                        "episode": item.episode,
                        "filename": item.filename,
                        "current_value": item.current_value,
                        "proposed_value": item.proposed_value,
                        "requires_manual": item.requires_manual,
                        "issue_ids": item.issue_ids,
                    }
                    for item in fix_plan.items
                ],
            }

        if change_log:
            audit_data["change_log"] = {
                "generated_at": change_log.generated_at.isoformat() if change_log.generated_at else None,
                "entries": [
                    {
                        "id": entry.id,
                        "action": entry.action,
                        "description": entry.description,
                        "language": entry.language.value if entry.language else None,
                        "episode": entry.episode,
                        "filename": entry.filename,
                        "before": entry.before,
                        "after": entry.after,
                        "timestamp": entry.timestamp.isoformat() if entry.timestamp else None,
                    }
                    for entry in change_log.entries
                ],
            }

        if config:
            audit_data["config"] = config

        output_path = self.output_dir / f"audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2)

        return output_path

    def _format_issue_type(self, issue_type: str) -> str:
        type_names = {
            "timecode_format": "时间码格式",
            "overlap": "时间重叠",
            "empty_subtitle": "空字幕",
            "sequence_gap": "序号断档",
            "missing_segment": "缺少段落",
            "reading_speed": "读速超限",
            "placeholder_missing": "占位符丢失",
            "speaker_tag_mismatch": "说话人标签不一致",
            "filename_mismatch": "文件名不匹配",
            "currency_mismatch": "金额数字不匹配",
        }
        return type_names.get(issue_type, issue_type)

    def _format_severity(self, severity: str) -> str:
        severity_names = {
            "critical": "严重",
            "warning": "警告",
            "info": "信息",
        }
        return severity_names.get(severity, severity)

    def _format_fix_action(self, action: str) -> str:
        action_names = {
            "reindex": "重排序号",
            "adjust_timecode": "调整时间码",
            "rename_file": "重命名文件",
            "add_missing": "补充缺失",
            "flag_for_translation": "标记待翻译",
        }
        return action_names.get(action, action)

    def _format_issue_markdown(self, issue: Issue) -> str:
        lines = []

        status_icon = ""
        if issue.review_action == ReviewAction.CONFIRM:
            status_icon = " ✅ [已确认]"
        elif issue.review_action == ReviewAction.DISMISS:
            status_icon = " ❌ [已驳回]"
        else:
            status_icon = " ⏳ [待处理]"

        lines.append(f"**{issue.id[:8]}...**{status_icon}")
        lines.append(f"- 类型: {self._format_issue_type(issue.issue_type.value)}")
        lines.append(f"- 严重程度: {self._format_severity(issue.severity.value)}")
        lines.append(f"- 消息: {issue.message}")

        if issue.language:
            lines.append(f"- 语言: {issue.language.value}")
        if issue.episode:
            lines.append(f"- 集数: 第 {issue.episode} 集")
        if issue.subtitle_index:
            lines.append(f"- 字幕序号: 第 {issue.subtitle_index} 条")
        if issue.filename:
            lines.append(f"- 文件: {issue.filename}")

        if issue.details:
            details_str = ", ".join(f"{k}: {v}" for k, v in issue.details.items())
            lines.append(f"- 详情: {details_str}")

        if issue.review_note:
            lines.append(f"- 复核备注: {issue.review_note}")

        return "\n".join(lines)
