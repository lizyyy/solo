#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
报告导出模块
导出 Markdown 证据目录、CSV 时间线和 JSON 审计清单
"""

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .config import (
    CaseConfig,
    EvidenceRecord,
    EvidenceType,
    TimelineEvent,
    TimeTrustLevel,
    ValidationIssue,
)


class Reporter:
    """报告导出器"""

    def __init__(self, config: CaseConfig):
        self.config = config

    def export_evidence_markdown(
        self,
        evidence_records: List[EvidenceRecord],
        output_path: str,
        title: str = None,
    ) -> None:
        """
        导出 Markdown 证据目录

        Args:
            evidence_records: 证据记录列表
            output_path: 输出文件路径
            title: 报告标题（可选）
        """
        title = title or f"证据目录 - {self.config.case_name}"

        lines = [
            f"# {title}",
            "",
            f"> 案件编号: {self.config.case_id}",
            f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"> 时区: {self.config.timezone}",
            "",
            "---",
            "",
            f"## 摘要",
            "",
            f"- **总证据数**: {len(evidence_records)}",
            "",
        ]

        type_counts = {}
        for record in evidence_records:
            ev_type = record.evidence_type.value
            type_counts[ev_type] = type_counts.get(ev_type, 0) + 1

        lines.append(f"- **证据类型分布**:")
        for ev_type, count in type_counts.items():
            lines.append(f"  - {ev_type}: {count} 个")
        lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("## 证据列表")
        lines.append("")

        for idx, record in enumerate(evidence_records, 1):
            lines.extend([
                f"### {idx}. {record.original_filename}",
                "",
                f"- **证据编号**: `{record.evidence_id}`",
                f"- **证据类型**: {record.evidence_type.value}",
                f"- **文件大小**: {self._format_size(record.file_size)}",
                f"- **SHA256**: `{record.sha256_hash}`",
                f"- **导入时间**: {record.imported_at.strftime('%Y-%m-%d %H:%M:%S')}",
                f"- **存储路径**: `{record.stored_filename}`",
                f"- **来源目录**: `{record.source_directory}`",
            ])

            if record.metadata:
                lines.append(f"- **元数据**:")
                for key, value in record.metadata.items():
                    if isinstance(value, dict):
                        lines.append(f"  - {key}: {json.dumps(value, ensure_ascii=False)[:200]}")
                    else:
                        lines.append(f"  - {key}: {str(value)[:200]}")

            if record.notes:
                lines.append(f"- **备注**: {record.notes}")

            lines.append("")

        lines.extend([
            "---",
            "",
            "## 附录",
            "",
            "### 证据类型说明",
            "",
            "| 类型 | 说明 |",
            "|------|------|",
            "| html_page | HTML 页面 |",
            "| mhtml_archive | MHTML 归档 |",
            "| har_log | HAR 网络日志 |",
            "| screenshot | 截图 |",
            "| pdf_document | PDF 文档 |",
            "| chat_log | 聊天记录 |",
            "| attachment | 附件 |",
            "",
            "---",
            "",
            f"*此报告由网页证据包整理员生成于 {datetime.now().isoformat()}*",
        ])

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

    def export_timeline_csv(
        self,
        timeline_events: List[TimelineEvent],
        output_path: str,
    ) -> None:
        """
        导出 CSV 时间线

        Args:
            timeline_events: 时间线事件列表
            output_path: 输出文件路径
        """
        sorted_events = sorted(timeline_events, key=lambda e: e.timestamp)

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)

            writer.writerow([
                "事件ID",
                "时间戳",
                "时区",
                "可信度",
                "来源",
                "来源文件",
                "事件类型",
                "摘要",
                "证据编号",
                "详细信息",
            ])

            for event in sorted_events:
                trust_display = {
                    TimeTrustLevel.HIGH: "高",
                    TimeTrustLevel.MEDIUM: "中",
                    TimeTrustLevel.LOW: "低",
                    TimeTrustLevel.UNTRUSTED: "不可信",
                }.get(event.trust_level, event.trust_level.value)

                writer.writerow([
                    event.event_id,
                    event.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                    event.timezone,
                    trust_display,
                    event.source,
                    event.source_file,
                    event.event_type,
                    event.summary,
                    event.evidence_id or "",
                    json.dumps(event.details, ensure_ascii=False)[:500],
                ])

    def export_audit_json(
        self,
        evidence_records: List[EvidenceRecord],
        timeline_events: List[TimelineEvent] = None,
        validation_issues: List[ValidationIssue] = None,
        output_path: str = None,
    ) -> Dict:
        """
        导出 JSON 审计清单

        Args:
            evidence_records: 证据记录列表
            timeline_events: 时间线事件列表（可选）
            validation_issues: 校验问题列表（可选）
            output_path: 输出文件路径（可选）

        Returns:
            审计清单数据
        """
        audit_data = {
            "generated_at": datetime.now().isoformat(),
            "case_info": {
                "case_id": self.config.case_id,
                "case_name": self.config.case_name,
                "created_at": self.config.created_at.isoformat(),
                "timezone": self.config.timezone,
            },
            "evidence_summary": {
                "total_count": len(evidence_records),
                "by_type": self._count_by_type(evidence_records),
            },
            "evidence_records": [
                {
                    "evidence_id": r.evidence_id,
                    "original_filename": r.original_filename,
                    "stored_filename": r.stored_filename,
                    "file_path": r.file_path,
                    "file_size": r.file_size,
                    "sha256_hash": r.sha256_hash,
                    "evidence_type": r.evidence_type.value,
                    "imported_at": r.imported_at.isoformat(),
                    "source_directory": r.source_directory,
                    "metadata": r.metadata,
                }
                for r in evidence_records
            ],
        }

        if timeline_events:
            sorted_events = sorted(timeline_events, key=lambda e: e.timestamp)
            audit_data["timeline"] = {
                "total_events": len(sorted_events),
                "events": [
                    {
                        "event_id": e.event_id,
                        "source": e.source,
                        "source_file": e.source_file,
                        "timestamp": e.timestamp.isoformat(),
                        "timezone": e.timezone,
                        "trust_level": e.trust_level.value,
                        "event_type": e.event_type,
                        "summary": e.summary,
                        "details": e.details,
                        "evidence_id": e.evidence_id,
                    }
                    for e in sorted_events
                ],
            }

        if validation_issues:
            audit_data["validation"] = {
                "total_issues": len(validation_issues),
                "by_severity": self._count_by_severity(validation_issues),
                "issues": [
                    {
                        "issue_id": i.issue_id,
                        "issue_type": i.issue_type,
                        "severity": i.severity,
                        "description": i.description,
                        "evidence_id": i.evidence_id,
                        "file_path": i.file_path,
                        "details": i.details,
                        "suggested_action": i.suggested_action,
                    }
                    for i in validation_issues
                ],
            }

        if output_path:
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(audit_data, f, ensure_ascii=False, indent=2, default=str)

        return audit_data

    def _format_size(self, size_bytes: int) -> str:
        """格式化文件大小"""
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.2f} KB"
        elif size_bytes < 1024 * 1024 * 1024:
            return f"{size_bytes / (1024 * 1024):.2f} MB"
        else:
            return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"

    def _count_by_type(self, records: List[EvidenceRecord]) -> Dict[str, int]:
        """按类型统计"""
        counts = {}
        for record in records:
            ev_type = record.evidence_type.value
            counts[ev_type] = counts.get(ev_type, 0) + 1
        return counts

    def _count_by_severity(self, issues: List[ValidationIssue]) -> Dict[str, int]:
        """按严重程度统计"""
        counts = {}
        for issue in issues:
            counts[issue.severity] = counts.get(issue.severity, 0) + 1
        return counts

    def export_all_reports(
        self,
        evidence_records: List[EvidenceRecord],
        timeline_events: List[TimelineEvent] = None,
        validation_issues: List[ValidationIssue] = None,
        output_dir: str = None,
        report_prefix: str = "",
    ) -> Dict[str, str]:
        """
        导出所有报告

        Args:
            evidence_records: 证据记录列表
            timeline_events: 时间线事件列表（可选）
            validation_issues: 校验问题列表（可选）
            output_dir: 输出目录（可选，默认使用配置中的输出目录）
            report_prefix: 报告文件名前缀（可选）

        Returns:
            报告文件路径字典
        """
        output_dir = Path(output_dir or self.config.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        prefix = report_prefix + "_" if report_prefix else ""

        report_paths = {}

        md_path = output_dir / f"{prefix}evidence_catalog.md"
        self.export_evidence_markdown(evidence_records, str(md_path))
        report_paths["markdown_evidence_catalog"] = str(md_path.absolute())

        if timeline_events:
            csv_path = output_dir / f"{prefix}timeline.csv"
            self.export_timeline_csv(timeline_events, str(csv_path))
            report_paths["csv_timeline"] = str(csv_path.absolute())

        json_path = output_dir / f"{prefix}audit_manifest.json"
        self.export_audit_json(
            evidence_records,
            timeline_events,
            validation_issues,
            str(json_path),
        )
        report_paths["json_audit_manifest"] = str(json_path.absolute())

        return report_paths
