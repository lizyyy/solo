from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import csv

from .rules_checker import CheckIssue
from .review_store import ReviewStore


class Exporter:
    SEVERITY_ICONS = {
        "error": "🔴",
        "warning": "🟡",
        "info": "🔵"
    }

    STATUS_ICONS = {
        "pending": "⏳",
        "fixed": "✅",
        "ignored": "⏭️",
        "rework": "🔄"
    }

    def __init__(self, project_dir: Path, issues: List[CheckIssue], 
                 review_store: Optional[ReviewStore] = None):
        self.project_dir = project_dir
        self.issues = issues
        self.review_store = review_store

    def export_markdown(self, output_path: Path) -> bool:
        try:
            markdown = self._generate_markdown()
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(markdown)
            return True
        except Exception:
            return False

    def export_csv(self, output_path: Path) -> bool:
        try:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    "序号", "规则类型", "严重程度", "文件", "字幕序号",
                    "时间码", "问题描述", "上下文", "复核状态", "备注"
                ])
                for idx, issue in enumerate(self.issues, 1):
                    writer.writerow([
                        idx,
                        issue.rule_type,
                        issue.severity,
                        issue.file,
                        issue.subtitle_index,
                        issue.timecode,
                        issue.message,
                        issue.context.replace('\n', ' | '),
                        ReviewStore.STATUS_LABELS.get(issue.review_status, issue.review_status),
                        issue.review_note
                    ])
            return True
        except Exception:
            return False

    def _generate_markdown(self) -> str:
        now = datetime.now()
        timestamp = now.strftime("%Y-%m-%d %H:%M:%S")
        
        stats = self._calculate_statistics()
        
        lines = [
            "# 字幕交付质检报告",
            "",
            f"**生成时间**: {timestamp}",
            f"**项目目录**: `{self.project_dir}`",
            "",
            "---",
            "",
            "## 统计概览",
            "",
            "| 状态 | 数量 |",
            "|------|------|",
        ]
        
        for status, count in stats['by_status'].items():
            lines.append(f"| {ReviewStore.STATUS_LABELS.get(status, status)} | {count} |")
        
        lines.append("")
        lines.append("| 严重程度 | 数量 |")
        lines.append("|----------|------|")
        for severity, count in stats['by_severity'].items():
            icon = self.SEVERITY_ICONS.get(severity, "")
            lines.append(f"| {icon} {severity} | {count} |")
        
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("## 问题详情")
        lines.append("")
        
        grouped_by_file = self._group_by_file()
        
        for file_path, file_issues in grouped_by_file.items():
            file_name = Path(file_path).name if file_path else "未知文件"
            lines.append(f"### 📁 {file_name}")
            lines.append("")
            
            for issue in file_issues:
                severity_icon = self.SEVERITY_ICONS.get(issue.severity, "")
                status_icon = self.STATUS_ICONS.get(issue.review_status, "")
                status_label = ReviewStore.STATUS_LABELS.get(issue.review_status, issue.review_status)
                
                lines.append(f"#### {severity_icon} {issue.rule_type} {status_icon} ({status_label})")
                lines.append("")
                lines.append(f"- **字幕序号**: {issue.subtitle_index}")
                lines.append(f"- **时间码**: `{issue.timecode}`")
                lines.append(f"- **问题描述**: {issue.message}")
                lines.append(f"- **上下文**:")
                lines.append("```")
                for line in issue.context.split('\n'):
                    lines.append(f"  {line}")
                lines.append("```")
                
                if issue.review_note:
                    lines.append(f"- **复核备注**: {issue.review_note}")
                
                lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("## 问题分类汇总")
        lines.append("")
        
        grouped_by_rule = self._group_by_rule()
        for rule_type, rule_issues in grouped_by_rule.items():
            lines.append(f"- **{rule_type}**: {len(rule_issues)} 个问题")
        
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("*报告由字幕交付质检台自动生成*")
        
        return '\n'.join(lines)

    def _calculate_statistics(self) -> Dict:
        by_status = {status: 0 for status in ReviewStore.REVIEW_STATUSES}
        by_severity = {}
        
        for issue in self.issues:
            by_status[issue.review_status] = by_status.get(issue.review_status, 0) + 1
            by_severity[issue.severity] = by_severity.get(issue.severity, 0) + 1
        
        return {
            "total": len(self.issues),
            "by_status": by_status,
            "by_severity": by_severity
        }

    def _group_by_file(self) -> Dict[str, List[CheckIssue]]:
        groups: Dict[str, List[CheckIssue]] = {}
        for issue in self.issues:
            if issue.file not in groups:
                groups[issue.file] = []
            groups[issue.file].append(issue)
        return groups

    def _group_by_rule(self) -> Dict[str, List[CheckIssue]]:
        groups: Dict[str, List[CheckIssue]] = {}
        for issue in self.issues:
            if issue.rule_type not in groups:
                groups[issue.rule_type] = []
            groups[issue.rule_type].append(issue)
        return groups
