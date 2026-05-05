"""导出模块 - 导出 Markdown 移交单和 JSON 审计明细。"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .models import CheckResult, Issue, IssueSeverity, IssueType, RoomStatistics


class Exporter:
    """导出器。"""

    @classmethod
    def export_markdown(
        cls,
        result: CheckResult,
        output_path: str,
    ) -> None:
        """
        导出 Markdown 移交单。

        Args:
            result: 检查结果
            output_path: 输出文件路径
        """
        markdown = cls._generate_markdown(result)

        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, "w", encoding="utf-8") as f:
            f.write(markdown)

    @classmethod
    def _generate_markdown(cls, result: CheckResult) -> str:
        """生成 Markdown 内容。"""
        lines: List[str] = []

        lines.append("# 答题卡回收核查移交单")
        lines.append("")
        lines.append(f"> 生成时间: {result.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("## 基本信息")
        lines.append("")
        lines.append("| 项目 | 内容 |")
        lines.append("|------|------|")
        lines.append(f"| 批次号 | {result.grading_batch.batch_id} |")
        lines.append(f"| 考试名称 | {result.grading_batch.exam_name} |")
        lines.append(f"| 考试日期 | {result.grading_batch.exam_date} |")
        lines.append(f"| 课程代码 | {result.grading_batch.course_code} |")
        lines.append(f"| 课程名称 | {result.grading_batch.course_name} |")
        lines.append(f"| 参考人数 | {result.grading_batch.total_students} |")
        lines.append(f"| 涉及考场 | {', '.join(result.grading_batch.rooms)} |")
        lines.append("")

        lines.append("## 核查统计")
        lines.append("")
        lines.append("### 按考场统计")
        lines.append("")
        lines.append("| 考场 | 总人数 | 实考 | 缺考 | 已扫描 | 漏扫 | 重复 | 问题数 |")
        lines.append("|------|--------|------|------|--------|------|------|--------|")

        for room, stats in result.statistics.items():
            lines.append(
                f"| {room} | {stats.total_students} | {stats.present_students} | "
                f"{stats.absent_students} | {stats.scanned_sheets} | {stats.missing_sheets} | "
                f"{stats.duplicate_count} | {len(stats.issues)} |"
            )

        lines.append("")

        lines.append("### 问题汇总")
        lines.append("")

        issue_summary = cls._summarize_issues(result.all_issues)
        for issue_type, count in issue_summary.items():
            lines.append(f"- **{issue_type}**: {count} 处")

        lines.append("")
        lines.append("---")
        lines.append("")

        critical_issues = [i for i in result.all_issues if i.severity == IssueSeverity.CRITICAL]
        major_issues = [i for i in result.all_issues if i.severity == IssueSeverity.MAJOR]
        minor_issues = [i for i in result.all_issues if i.severity == IssueSeverity.MINOR]

        if critical_issues:
            lines.append("## 🔴 严重问题")
            lines.append("")
            cls._render_issues_section(critical_issues, lines)
            lines.append("")

        if major_issues:
            lines.append("## 🟠 重要问题")
            lines.append("")
            cls._render_issues_section(major_issues, lines)
            lines.append("")

        if minor_issues:
            lines.append("## 🟡 轻微问题")
            lines.append("")
            cls._render_issues_section(minor_issues, lines)
            lines.append("")

        lines.append("---")
        lines.append("")

        lines.append("## 人工备注")
        lines.append("")

        if result.remark_store:
            for key, remark in result.remark_store.items():
                lines.append(f"### {key}")
                lines.append("")
                lines.append(f"> {remark}")
                lines.append("")
        else:
            lines.append("*暂无人工备注*")
            lines.append("")

        lines.append("---")
        lines.append("")

        lines.append("## 移交确认")
        lines.append("")
        lines.append("| 角色 | 签字 | 日期 |")
        lines.append("|------|------|------|")
        lines.append("| 扫描经办人 | ________ | ________ |")
        lines.append("| 复核人员 | ________ | ________ |")
        lines.append("| 接收人员 | ________ | ________ |")
        lines.append("")

        return "\n".join(lines)

    @staticmethod
    def _render_issues_section(issues: List[Issue], lines: List[str]) -> None:
        """渲染问题列表。"""
        for idx, issue in enumerate(issues, 1):
            lines.append(f"### {idx}. [{issue.issue_type.value}]")
            lines.append("")
            lines.append(f"**描述**: {issue.description}")
            lines.append("")
            if issue.affected_files:
                lines.append(f"**涉及文件**: {', '.join(issue.affected_files)}")
                lines.append("")
            if issue.recommendation:
                lines.append(f"**建议处理**: {issue.recommendation}")
                lines.append("")
            lines.append("---")
            lines.append("")

    @staticmethod
    def _summarize_issues(issues: List[Issue]) -> Dict[str, int]:
        """按类型统计问题。"""
        summary: Dict[str, int] = {}
        for issue in issues:
            issue_type = issue.issue_type.value
            summary[issue_type] = summary.get(issue_type, 0) + 1
        return summary

    @classmethod
    def export_json(
        cls,
        result: CheckResult,
        output_path: str,
    ) -> None:
        """
        导出 JSON 审计明细。

        Args:
            result: 检查结果
            output_path: 输出文件路径
        """
        json_data = cls._generate_json(result)

        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, "w", encoding="utf-8") as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)

    @classmethod
    def _generate_json(cls, result: CheckResult) -> Dict[str, Any]:
        """生成 JSON 数据。"""
        return {
            "batch_info": {
                "batch_id": result.grading_batch.batch_id,
                "exam_name": result.grading_batch.exam_name,
                "exam_date": result.grading_batch.exam_date,
                "course_code": result.grading_batch.course_code,
                "course_name": result.grading_batch.course_name,
                "total_students": result.grading_batch.total_students,
                "rooms": result.grading_batch.rooms,
            },
            "generated_at": result.generated_at.isoformat(),
            "statistics": {
                room: cls._stats_to_dict(stats)
                for room, stats in result.statistics.items()
            },
            "issues": {
                "critical": [cls._issue_to_dict(i) for i in result.all_issues if i.severity == IssueSeverity.CRITICAL],
                "major": [cls._issue_to_dict(i) for i in result.all_issues if i.severity == IssueSeverity.MAJOR],
                "minor": [cls._issue_to_dict(i) for i in result.all_issues if i.severity == IssueSeverity.MINOR],
            },
            "student_roster": {
                sid: student.to_dict() for sid, student in result.student_roster.items()
            },
            "absent_records": {
                sid: record.to_dict() for sid, record in result.absent_records.items()
            },
            "remarks": result.remark_store,
        }

    @staticmethod
    def _stats_to_dict(stats: RoomStatistics) -> Dict[str, Any]:
        """统计信息转字典。"""
        return {
            "room_number": stats.room_number,
            "total_students": stats.total_students,
            "present_students": stats.present_students,
            "absent_students": stats.absent_students,
            "scanned_sheets": stats.scanned_sheets,
            "missing_sheets": stats.missing_sheets,
            "duplicate_count": stats.duplicate_count,
            "issues_count": len(stats.issues),
        }

    @staticmethod
    def _issue_to_dict(issue: Issue) -> Dict[str, Any]:
        """问题转字典。"""
        return {
            "issue_type": issue.issue_type.value,
            "severity": issue.severity.value,
            "description": issue.description,
            "affected_barcodes": issue.affected_barcodes,
            "affected_files": issue.affected_files,
            "room_number": issue.room_number,
            "recommendation": issue.recommendation,
            "notes": issue.notes,
        }

    @classmethod
    def export_result(
        cls,
        result: CheckResult,
        output_dir: str,
        base_name: Optional[str] = None,
    ) -> tuple[str, str]:
        """
        同时导出 Markdown 和 JSON。

        Args:
            result: 检查结果
            output_dir: 输出目录
            base_name: 基础文件名（不含扩展名）

        Returns:
            (markdown_path, json_path) 元组
        """
        if base_name is None:
            base_name = f"check_result_{result.grading_batch.batch_id}"

        md_path = Path(output_dir) / f"{base_name}.md"
        json_path = Path(output_dir) / f"{base_name}.json"

        cls.export_markdown(result, str(md_path))
        cls.export_json(result, str(json_path))

        return str(md_path), str(json_path)
