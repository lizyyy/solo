"""报告导出模块"""

import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .models import (
    CalculatedMetric,
    Issue,
    IssueType,
    ReportMetric,
    ValidationResult,
)


class ReportExporter:
    """报告导出器"""
    
    ISSUE_TYPE_ICONS = {
        IssueType.TOLERANCE_EXCEEDED: "🔴",
        IssueType.ROUNDING_INCONSISTENCY: "🟡",
        IssueType.MISSING_REFUND_DEDUCTION: "🔴",
        IssueType.STORE_AGGREGATION_ERROR: "🔴",
        IssueType.MISSING_METRIC: "🟡",
        IssueType.EXTRA_METRIC: "🟡",
        IssueType.CALCULATION_ERROR: "🔴",
    }
    
    ISSUE_TYPE_CATEGORIES = {
        IssueType.TOLERANCE_EXCEEDED: "严重问题",
        IssueType.MISSING_REFUND_DEDUCTION: "严重问题",
        IssueType.STORE_AGGREGATION_ERROR: "严重问题",
        IssueType.ROUNDING_INCONSISTENCY: "警告问题",
        IssueType.MISSING_METRIC: "警告问题",
        IssueType.EXTRA_METRIC: "警告问题",
        IssueType.CALCULATION_ERROR: "严重问题",
    }
    
    @classmethod
    def export_markdown(
        cls,
        result: ValidationResult,
        output_path: Path,
        context: Optional[Dict] = None
    ) -> Path:
        """导出 Markdown 格式的差异报告"""
        content = cls._generate_markdown_report(result, context)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return output_path
    
    @classmethod
    def export_csv(
        cls,
        result: ValidationResult,
        output_path: Path,
        context: Optional[Dict] = None
    ) -> Path:
        """导出 CSV 格式的明细报告"""
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow([
                '问题类型',
                '指标名称',
                '门店ID',
                '计算值',
                '报告值',
                '差异',
                '问题描述',
                '上下文',
            ])
            
            for issue in result.issues:
                writer.writerow([
                    issue.issue_type.value,
                    issue.metric_name,
                    issue.store_id or '',
                    str(issue.expected_value) if issue.expected_value else '',
                    str(issue.reported_value) if issue.reported_value else '',
                    str(issue.difference) if issue.difference else '',
                    issue.message,
                    issue.context or '',
                ])
        
        return output_path
    
    @classmethod
    def export_metrics_csv(
        cls,
        calculated_metrics: List[CalculatedMetric],
        report_metrics: List[ReportMetric],
        output_path: Path,
    ) -> Path:
        """导出指标对比 CSV"""
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow([
                '指标名称',
                '计算值',
                '报告值',
                '差异',
                '差异百分比',
            ])
            
            calc_dict = {m.metric_name: m for m in calculated_metrics}
            report_dict = {m.metric_name: m for m in report_metrics}
            
            all_names = set(calc_dict.keys()) | set(report_dict.keys())
            
            for name in sorted(all_names):
                calc = calc_dict.get(name)
                report = report_dict.get(name)
                
                calc_value = calc.value if calc else None
                report_value = report.value if report else None
                
                if calc_value is not None and report_value is not None:
                    difference = abs(report_value - calc_value)
                    if calc_value != 0:
                        diff_pct = (difference / abs(calc_value)) * 100
                    else:
                        diff_pct = 0 if difference == 0 else 100
                else:
                    difference = None
                    diff_pct = None
                
                writer.writerow([
                    name,
                    str(calc_value) if calc_value else '',
                    str(report_value) if report_value else '',
                    str(difference) if difference else '',
                    f"{diff_pct:.2f}%" if diff_pct is not None else '',
                ])
        
        return output_path
    
    @classmethod
    def _generate_markdown_report(
        cls,
        result: ValidationResult,
        context: Optional[Dict] = None
    ) -> str:
        """生成 Markdown 报告内容"""
        lines = []
        
        lines.append("# 经营周报一致性复核报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        status_icon = "✅" if result.is_valid else "❌"
        lines.append(f"## 总体结论")
        lines.append("")
        lines.append(f"**复核状态**: {status_icon} {'通过' if result.is_valid else '存在问题'}")
        lines.append(f"- **总问题数**: {result.total_issues}")
        lines.append(f"- **严重问题**: {result.critical_issues}")
        lines.append(f"- **警告问题**: {result.warning_issues}")
        lines.append("")
        
        if result.issues:
            lines.append("## 发现的问题")
            lines.append("")
            
            critical_issues = [
                i for i in result.issues 
                if cls.ISSUE_TYPE_CATEGORIES.get(i.issue_type) == "严重问题"
            ]
            warning_issues = [
                i for i in result.issues 
                if cls.ISSUE_TYPE_CATEGORIES.get(i.issue_type) == "警告问题"
            ]
            
            if critical_issues:
                lines.append("### 🔴 严重问题")
                lines.append("")
                for issue in critical_issues:
                    lines.append(cls._format_issue_markdown(issue))
                    lines.append("")
            
            if warning_issues:
                lines.append("### 🟡 警告问题")
                lines.append("")
                for issue in warning_issues:
                    lines.append(cls._format_issue_markdown(issue))
                    lines.append("")
        
        lines.append("## 指标对比详情")
        lines.append("")
        lines.append("| 指标名称 | 计算值 | 报告值 | 状态 |")
        lines.append("|---------|-------|-------|------|")
        
        calc_dict = {m.metric_name: m for m in result.calculated_metrics}
        report_dict = {m.metric_name: m for m in result.report_metrics}
        
        all_names = set(calc_dict.keys()) | set(report_dict.keys())
        
        for name in sorted(all_names):
            calc = calc_dict.get(name)
            report = report_dict.get(name)
            
            if calc and report:
                if abs(calc.value - report.value) < 0.01:
                    status = "✅ 一致"
                else:
                    status = "❌ 不一致"
            elif calc:
                status = "⚠️ 报告缺失"
            else:
                status = "⚠️ 计算缺失"
            
            calc_value = str(calc.value) if calc else "-"
            report_value = str(report.value) if report else "-"
            display_name = calc.display_name if calc else (report.display_name if report else name)
            
            lines.append(f"| {display_name} | {calc_value} | {report_value} | {status} |")
        
        lines.append("")
        
        lines.append("## 门店明细")
        lines.append("")
        
        for metric in result.calculated_metrics:
            if metric.store_breakdown:
                lines.append(f"### {metric.display_name} 按门店分布")
                lines.append("")
                lines.append("| 门店ID | 计算值 |")
                lines.append("|-------|-------|")
                for store_id, value in sorted(metric.store_breakdown.items()):
                    lines.append(f"| {store_id} | {value} |")
                lines.append("")
        
        return "\n".join(lines)
    
    @classmethod
    def _format_issue_markdown(cls, issue: Issue) -> str:
        """格式化单个问题为 Markdown"""
        lines = []
        icon = cls.ISSUE_TYPE_ICONS.get(issue.issue_type, "⚠️")
        
        lines.append(f"#### {icon} {issue.issue_type.value}")
        lines.append("")
        lines.append(f"**指标**: {issue.metric_name}")
        
        if issue.store_id:
            lines.append(f"**门店**: {issue.store_id}")
        
        lines.append(f"**描述**: {issue.message}")
        
        if issue.expected_value is not None:
            lines.append(f"**计算值**: {issue.expected_value}")
        
        if issue.reported_value is not None:
            lines.append(f"**报告值**: {issue.reported_value}")
        
        if issue.difference is not None:
            lines.append(f"**差异**: {issue.difference}")
        
        if issue.context:
            lines.append(f"**上下文**: {issue.context}")
        
        return "\n".join(lines)
