"""
报告生成器 - 生成Markdown差错报告和CSV修订清单
"""

import csv
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

from ..rules.validation_rules import (
    ValidationError,
    ErrorType,
    EvidenceAnchor,
    EvidenceCatalogEntry,
    TranscriptSegment
)
from ..indexer.local_index import LocalIndex, CheckResult


class MarkdownReportGenerator:
    def __init__(self, index: LocalIndex):
        self.index = index

    def generate_report(self, errors: List[ValidationError], result: CheckResult) -> str:
        lines = []

        lines.append("# 庭审笔录证据锚点核对报告")
        lines.append("")
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("## 检查概览")
        lines.append("")
        lines.append(f"| 项目 | 数量 |")
        lines.append(f"|------|------|")
        lines.append(f"| 错误总数 | **{result.total_errors}** |")
        lines.append(f"| 警告总数 | {result.total_warnings} |")
        lines.append(f"| 证据总数 | {len(self.index.evidence_catalog)} |")
        lines.append(f"| 笔录段落数 | {len(self.index.transcript_segments)} |")
        lines.append(f"| 锚定次数 | {len(self.index.get_all_anchors())} |")
        lines.append("")

        if result.error_summary:
            lines.append("## 错误类型统计")
            lines.append("")
            lines.append("| 错误类型 | 数量 |")
            lines.append("|----------|------|")
            for error_type, count in sorted(result.error_summary.items(), key=lambda x: -x[1]):
                lines.append(f"| {error_type} | {count} |")
            lines.append("")

        lines.append("## 详细错误列表")
        lines.append("")

        if not errors:
            lines.append("✅ **未发现错误，所有锚点均符合规范！**")
            lines.append("")
        else:
            error_groups: Dict[ErrorType, List[ValidationError]] = {}
            for error in errors:
                if error.error_type not in error_groups:
                    error_groups[error.error_type] = []
                error_groups[error.error_type].append(error)

            for error_type in ErrorType:
                if error_type not in error_groups:
                    continue

                type_errors = error_groups[error_type]
                lines.append(f"### {error_type.value} ({len(type_errors)}处)")
                lines.append("")

                for i, error in enumerate(type_errors, 1):
                    lines.append(f"**{i}. 位置: {error.location}**")
                    lines.append("")
                    lines.append(f"> 问题: {error.message}")
                    lines.append("")
                    if error.suggestion:
                        lines.append(f"> 💡 建议: {error.suggestion}")
                        lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("## 附录")
        lines.append("")

        if self.index.evidence_catalog:
            lines.append("### 证据目录清单")
            lines.append("")
            lines.append("| 证据编号 | 证据名称 | 页数 | 提交方 | 证据类型 |")
            lines.append("|----------|----------|------|--------|----------|")
            for entry in self.index.evidence_catalog:
                lines.append(f"| {entry.evidence_number} | {entry.evidence_name} | {entry.page_count} | {entry.submission_party} | {entry.category} |")
            lines.append("")

        lines.append("### 检查规则说明")
        lines.append("")
        lines.append("#### 证据编号规则")
        lines.append("- 支持格式: `证1`、`1`、`1-1`")
        lines.append("- 需与证据目录中的编号一致")
        lines.append("")
        lines.append("#### 页码规则")
        lines.append("- 支持格式: `第3页`、`第1-5页`")
        lines.append("- 页码范围不能超出该证据的总页数")
        lines.append("")
        lines.append("#### 时间码规则")
        lines.append("- 格式: `HH:MM:SS`，如 `01:30:45`")
        lines.append("- 需与时间码CSV文件中记录的时间码一致")
        lines.append("")
        lines.append("#### 重复锚定规则")
        lines.append("- 同一发言人同一段落中，同一证据编号只能出现一次")
        lines.append("")

        return '\n'.join(lines)

    def save_report(self, errors: List[ValidationError], result: CheckResult, file_path: str) -> None:
        content = self.generate_report(errors, result)
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)


class CSVRevisionGenerator:
    def __init__(self, index: LocalIndex):
        self.index = index

    def generate_revision_list(self, errors: List[ValidationError]) -> List[Dict[str, Any]]:
        revisions = []

        for error in errors:
            revision = {
                "序号": len(revisions) + 1,
                "错误类型": error.error_type.value,
                "位置": error.location,
                "问题描述": error.message,
                "严重程度": error.severity,
                "修改建议": error.suggestion or "",
                "状态": "待处理"
            }
            revisions.append(revision)

        return revisions

    def generate_anchor_summary(self) -> List[Dict[str, Any]]:
        anchors = self.index.get_all_anchors()
        summary = []

        for anchor in anchors:
            evidence = self.index.get_evidence_by_number(anchor.evidence_number)
            item = {
                "序号": len(summary) + 1,
                "证据编号": anchor.evidence_number,
                "证据名称": evidence.evidence_name if evidence else "",
                "引用页码": ",".join(anchor.page_numbers) if anchor.page_numbers else "无",
                "发言人": anchor.speaker,
                "时间码": anchor.timestamp,
                "所在行": anchor.transcript_line,
                "原始文本": anchor.raw_text
            }
            summary.append(item)

        return summary

    def save_revision_list(self, errors: List[ValidationError], file_path: str) -> None:
        revisions = self.generate_revision_list(errors)
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        if not revisions:
            with open(path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(["说明"])
                writer.writerow(["未发现错误，无需修改"])
            return

        fieldnames = [
            "序号", "错误类型", "位置", "问题描述",
            "严重程度", "修改建议", "状态"
        ]

        with open(path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for rev in revisions:
                writer.writerow(rev)

    def save_anchor_summary(self, file_path: str) -> None:
        summary = self.generate_anchor_summary()
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        if not summary:
            with open(path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(["说明"])
                writer.writerow(["未检测到任何证据锚点"])
            return

        fieldnames = [
            "序号", "证据编号", "证据名称", "引用页码",
            "发言人", "时间码", "所在行", "原始文本"
        ]

        with open(path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for item in summary:
                writer.writerow(item)
