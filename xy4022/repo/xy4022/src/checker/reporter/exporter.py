"""报告导出器"""

import csv
import json
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from checker.config.models import Config, ScanResult, CheckIssue, IssueLevel, IssueType


@dataclass
class ReportStats:
    """报告统计信息"""
    total_files: int
    markdown_files: int
    total_references: int
    errors_count: int
    warnings_count: int
    scan_time: datetime


class ReportExporter(ABC):
    """报告导出器基类"""
    
    def __init__(self, config: Config):
        self.config = config
    
    @abstractmethod
    def export(self, scan_result: ScanResult, output_path: str) -> str:
        """导出报告"""
        pass
    
    def _get_stats(self, scan_result: ScanResult) -> ReportStats:
        """获取统计信息"""
        errors = scan_result.get_errors()
        warnings = scan_result.get_warnings()
        
        return ReportStats(
            total_files=scan_result.total_files,
            markdown_files=scan_result.markdown_files,
            total_references=len(scan_result.references),
            errors_count=len(errors),
            warnings_count=len(warnings),
            scan_time=scan_result.scan_time
        )
    
    def _group_issues_by_type(self, issues: List[CheckIssue]) -> Dict[IssueType, List[CheckIssue]]:
        """按类型分组问题"""
        groups: Dict[IssueType, List[CheckIssue]] = {}
        for issue in issues:
            if issue.issue_type not in groups:
                groups[issue.issue_type] = []
            groups[issue.issue_type].append(issue)
        return groups
    
    def _group_issues_by_file(self, issues: List[CheckIssue]) -> Dict[str, List[CheckIssue]]:
        """按文件分组问题"""
        groups: Dict[str, List[CheckIssue]] = {}
        for issue in issues:
            file_key = issue.source_file or "(无关联文件)"
            if file_key not in groups:
                groups[file_key] = []
            groups[file_key].append(issue)
        return groups


class MarkdownReportExporter(ReportExporter):
    """Markdown报告导出器"""
    
    def export(self, scan_result: ScanResult, output_path: str) -> str:
        """导出Markdown格式报告"""
        stats = self._get_stats(scan_result)
        errors = scan_result.get_errors()
        warnings = scan_result.get_warnings()
        
        lines = [
            "# 资料包交付巡检报告",
            "",
            f"**生成时间**: {stats.scan_time.strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "## 概览",
            "",
            "| 指标 | 数值 |",
            "|------|------|",
            f"| 总文件数 | {stats.total_files} |",
            f"| Markdown文件数 | {stats.markdown_files} |",
            f"| 引用数量 | {stats.total_references} |",
            f"| **错误数** | {stats.errors_count} |",
            f"| **警告数** | {stats.warnings_count} |",
            "",
        ]
        
        # 错误详情
        if errors:
            lines.extend([
                "## 错误详情",
                "",
                f"共发现 **{len(errors)}** 个必须修复的问题：",
                "",
            ])
            
            errors_by_type = self._group_issues_by_type(errors)
            for issue_type, issues in errors_by_type.items():
                lines.extend([
                    f"### {self._get_issue_type_name(issue_type)}",
                    "",
                ])
                for i, issue in enumerate(issues, 1):
                    lines.extend(self._format_issue_markdown(i, issue))
                lines.append("")
        
        # 警告详情
        if warnings:
            lines.extend([
                "## 警告详情",
                "",
                f"共发现 **{len(warnings)}** 个建议修复的问题：",
                "",
            ])
            
            warnings_by_type = self._group_issues_by_type(warnings)
            for issue_type, issues in warnings_by_type.items():
                lines.extend([
                    f"### {self._get_issue_type_name(issue_type)}",
                    "",
                ])
                for i, issue in enumerate(issues, 1):
                    lines.extend(self._format_issue_markdown(i, issue))
                lines.append("")
        
        # 如果没有问题
        if not errors and not warnings:
            lines.extend([
                "## 检查结果",
                "",
                "✅ **所有检查通过！** 没有发现任何错误或警告。",
                "",
            ])
        
        # 统计摘要
        lines.extend([
            "## 摘要",
            "",
        ])
        
        if stats.errors_count > 0:
            lines.append(f"❌ **存在 {stats.errors_count} 个错误**，必须修复后才能打包。")
        if stats.warnings_count > 0:
            lines.append(f"⚠️ **存在 {stats.warnings_count} 个警告**，建议检查后再打包。")
        if stats.errors_count == 0 and stats.warnings_count == 0:
            lines.append("✅ **全部通过！** 资料包可以安全打包。")
        
        lines.append("")
        
        # 确保输出目录存在
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        return str(output)
    
    def _get_issue_type_name(self, issue_type: IssueType) -> str:
        """获取问题类型的中文名称"""
        names = {
            IssueType.MISSING_FILE: "缺失文件",
            IssueType.CASE_MISMATCH: "路径大小写不一致",
            IssueType.PATH_TRAVERSAL: "路径遍历安全风险",
            IssueType.DUPLICATE_FILE: "同名文件冲突",
            IssueType.UNUSED_LARGE_FILE: "未引用的大文件",
            IssueType.HEADING_LEVEL_JUMP: "标题层级跳跃",
            IssueType.INVALID_ANCHOR: "无效的锚点引用",
        }
        return names.get(issue_type, issue_type.value)
    
    def _format_issue_markdown(self, index: int, issue: CheckIssue) -> List[str]:
        """格式化单个问题为Markdown"""
        lines = []
        
        location = ""
        if issue.source_file:
            location = f"文件: `{issue.source_file}`"
            if issue.line_number:
                location += f", 第 {issue.line_number} 行"
        
        lines.append(f"**{index}. {issue.message}**")
        if location:
            lines.append(f"   - 位置: {location}")
        
        if issue.details:
            for key, value in issue.details.items():
                if isinstance(value, list) and len(value) > 0:
                    if len(value) > 5:
                        value_str = ", ".join(str(v) for v in value[:5]) + f"... (共{len(value)}项)"
                    else:
                        value_str = ", ".join(str(v) for v in value)
                    lines.append(f"   - {key}: {value_str}")
                else:
                    lines.append(f"   - {key}: `{value}`")
        
        lines.append("")
        return lines


class CSVReportExporter(ReportExporter):
    """CSV报告导出器"""
    
    def export(self, scan_result: ScanResult, output_path: str) -> str:
        """导出CSV格式报告"""
        # 确保输出目录存在
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            # 写入表头
            writer.writerow([
                "序号",
                "严重程度",
                "问题类型",
                "消息",
                "源文件",
                "行号",
                "详情",
            ])
            
            # 写入所有问题（先错误后警告）
            errors = scan_result.get_errors()
            warnings = scan_result.get_warnings()
            
            all_issues = errors + warnings
            
            for i, issue in enumerate(all_issues, 1):
                details_str = json.dumps(issue.details, ensure_ascii=False) if issue.details else ""
                writer.writerow([
                    i,
                    issue.level.value,
                    issue.issue_type.value,
                    issue.message,
                    issue.source_file or "",
                    issue.line_number or "",
                    details_str,
                ])
            
            # 如果没有问题，写入空行提示
            if not all_issues:
                writer.writerow([
                    1,
                    "info",
                    "check_passed",
                    "所有检查通过，未发现任何问题",
                    "",
                    "",
                    "",
                ])
        
        return str(output)


def export_markdown_report(
    config: Config,
    scan_result: ScanResult,
    output_path: str
) -> str:
    """便捷函数：导出Markdown报告"""
    exporter = MarkdownReportExporter(config)
    return exporter.export(scan_result, output_path)


def export_csv_report(
    config: Config,
    scan_result: ScanResult,
    output_path: str
) -> str:
    """便捷函数：导出CSV报告"""
    exporter = CSVReportExporter(config)
    return exporter.export(scan_result, output_path)
