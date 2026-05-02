# -*- coding: utf-8 -*-
"""
报告导出器 - 导出Markdown质检报告和CSV问题清单
"""

import csv
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from collections import defaultdict

from models import (
    WorkOrder,
    Photo,
    QualityIssue,
    QualityReport,
    IssueType,
    IssueSeverity
)
from validator import FullValidationResult


@dataclass
class ExportResult:
    """导出结果"""
    success: bool = True
    markdown_path: Optional[Path] = None
    csv_path: Optional[Path] = None
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


class ReportExporter:
    """报告导出器"""
    
    def __init__(self):
        self._encoding = 'utf-8-sig'  # 使用BOM确保Excel能正确识别中文
    
    def export_markdown(
        self,
        quality_report: QualityReport,
        output_path: Path,
        photos: List[Photo] = None,
        work_order: WorkOrder = None
    ) -> ExportResult:
        """
        导出Markdown质检报告
        
        Args:
            quality_report: 质检报告对象
            output_path: 输出文件路径
            photos: 照片列表（可选，用于详细统计）
            work_order: 工单信息（可选）
            
        Returns:
            ExportResult: 导出结果
        """
        result = ExportResult()
        
        try:
            # 确保父目录存在
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # 生成Markdown内容
            markdown_content = self._generate_markdown_report(
                quality_report, photos, work_order
            )
            
            # 写入文件
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(markdown_content)
            
            result.markdown_path = output_path
            result.success = True
            
        except Exception as e:
            result.success = False
            result.errors.append(f"导出Markdown报告失败: {str(e)}")
        
        return result
    
    def export_csv(
        self,
        issues: List[QualityIssue],
        output_path: Path,
        include_resolved: bool = False
    ) -> ExportResult:
        """
        导出CSV问题清单
        
        Args:
            issues: 质检问题列表
            output_path: 输出文件路径
            include_resolved: 是否包含已解决的问题
            
        Returns:
            ExportResult: 导出结果
        """
        result = ExportResult()
        
        try:
            # 确保父目录存在
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # 过滤问题
            if not include_resolved:
                issues = [i for i in issues if not i.resolved]
            
            # 写入CSV
            with open(output_path, 'w', encoding=self._encoding, newline='') as f:
                writer = csv.writer(f)
                
                # 写入表头
                writer.writerow([
                    '问题ID', '问题类型', '严重程度', '问题描述',
                    '关联工单', '关联照片', '是否确认', '确认备注',
                    '是否解决', '创建时间'
                ])
                
                # 写入数据
                for issue in issues:
                    writer.writerow([
                        issue.issue_id,
                        issue.issue_type.value,
                        issue.severity.value,
                        issue.description.replace('\n', ' '),
                        issue.related_work_order_id or '',
                        ', '.join(issue.related_photo_ids[:3]) + ('...' if len(issue.related_photo_ids) > 3 else ''),
                        '是' if issue.confirmed else '否',
                        issue.confirmation_note,
                        '是' if issue.resolved else '否',
                        issue.created_at.strftime('%Y-%m-%d %H:%M:%S')
                    ])
            
            result.csv_path = output_path
            result.success = True
            
        except Exception as e:
            result.success = False
            result.errors.append(f"导出CSV问题清单失败: {str(e)}")
        
        return result
    
    def export_all(
        self,
        quality_report: QualityReport,
        issues: List[QualityIssue],
        output_dir: Path,
        base_filename: str = None,
        photos: List[Photo] = None,
        work_order: WorkOrder = None
    ) -> ExportResult:
        """
        同时导出Markdown报告和CSV问题清单
        
        Args:
            quality_report: 质检报告
            issues: 问题列表
            output_dir: 输出目录
            base_filename: 基础文件名（不含扩展名）
            photos: 照片列表
            work_order: 工单信息
            
        Returns:
            ExportResult: 导出结果
        """
        result = ExportResult()
        
        if base_filename is None:
            base_filename = f"质检报告_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # 导出Markdown
        markdown_path = output_dir / f"{base_filename}.md"
        md_result = self.export_markdown(
            quality_report, markdown_path, photos, work_order
        )
        
        if md_result.success:
            result.markdown_path = markdown_path
        else:
            result.errors.extend(md_result.errors)
        
        # 导出CSV
        csv_path = output_dir / f"{base_filename}_问题清单.csv"
        csv_result = self.export_csv(issues, csv_path)
        
        if csv_result.success:
            result.csv_path = csv_path
        else:
            result.errors.extend(csv_result.errors)
        
        result.success = md_result.success and csv_result.success
        result.warnings = md_result.warnings + csv_result.warnings
        
        return result
    
    def _generate_markdown_report(
        self,
        report: QualityReport,
        photos: List[Photo] = None,
        work_order: WorkOrder = None
    ) -> str:
        """生成Markdown报告内容"""
        lines = []
        
        # 标题
        lines.append("# 电梯维保照片质检报告")
        lines.append("")
        lines.append(f"> 报告编号: {report.report_id}")
        lines.append(f"> 生成时间: {report.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 工单信息
        if work_order:
            lines.append("## 工单信息")
            lines.append("")
            lines.append("| 字段 | 值 |")
            lines.append("|------|-----|")
            lines.append(f"| 工单号 | {work_order.order_id} |")
            lines.append(f"| 电梯编号 | {work_order.elevator_no} |")
            lines.append(f"| 位置 | {work_order.location} |")
            lines.append(f"| 维保日期 | {work_order.maintenance_date.strftime('%Y-%m-%d')} |")
            lines.append(f"| 维保人员 | {work_order.technician} |")
            lines.append(f"| 必拍点位 | {', '.join(work_order.required_points)} |")
            if work_order.has_rectification:
                lines.append(f"| 整改项 | {', '.join(work_order.rectification_items) if work_order.rectification_items else '有'} |")
            lines.append("")
        
        # 质检概览
        lines.append("## 质检概览")
        lines.append("")
        
        # 结论
        status_icon = "✅" if report.passed else "❌"
        status_text = "通过" if report.passed else "不通过"
        lines.append(f"### 质检结论: {status_icon} {status_text}")
        lines.append("")
        
        # 统计数据
        lines.append("| 统计项 | 数量 |")
        lines.append("|--------|------|")
        lines.append(f"| 照片总数 | {report.photos_count} |")
        lines.append(f"| 问题总数 | {report.issues_count} |")
        lines.append(f"| 🔴 严重问题 | {report.critical_issues_count} |")
        lines.append(f"| 🟡 警告问题 | {report.warning_issues_count} |")
        lines.append(f"| 🔵 提示问题 | {report.info_issues_count} |")
        lines.append("")
        
        # 按类型统计问题
        if report.issues:
            lines.append("## 问题详情")
            lines.append("")
            
            # 按严重程度分组
            critical_issues = [i for i in report.issues if i.severity == IssueSeverity.CRITICAL]
            warning_issues = [i for i in report.issues if i.severity == IssueSeverity.WARNING]
            info_issues = [i for i in report.issues if i.severity == IssueSeverity.INFO]
            
            # 严重问题
            if critical_issues:
                lines.append("### 🔴 严重问题")
                lines.append("")
                for idx, issue in enumerate(critical_issues, 1):
                    status = "✅ 已解决" if issue.resolved else "🔔 待处理"
                    confirmed = "✅ 已确认" if issue.confirmed else "❓ 待确认"
                    
                    lines.append(f"**{idx}. {issue.issue_type.value}** ({status}, {confirmed})")
                    lines.append("")
                    desc = issue.description.replace('\n', '  \n> ')
                    lines.append(f"> {desc}")
                    lines.append("")
                    if issue.related_photo_ids:
                        lines.append(f"关联照片: {', '.join(issue.related_photo_ids[:5])}")
                        lines.append("")
            
            # 警告问题
            if warning_issues:
                lines.append("### 🟡 警告问题")
                lines.append("")
                for idx, issue in enumerate(warning_issues, 1):
                    status = "✅ 已解决" if issue.resolved else "🔔 待处理"
                    confirmed = "✅ 已确认" if issue.confirmed else "❓ 待确认"
                    
                    lines.append(f"**{idx}. {issue.issue_type.value}** ({status}, {confirmed})")
                    lines.append("")
                    desc = issue.description.replace('\n', '  \n> ')
                    lines.append(f"> {desc}")
                    lines.append("")
                    if issue.related_photo_ids:
                        lines.append(f"关联照片: {', '.join(issue.related_photo_ids[:5])}")
                        lines.append("")
            
            # 提示问题
            if info_issues:
                lines.append("### 🔵 提示问题")
                lines.append("")
                for idx, issue in enumerate(info_issues, 1):
                    status = "✅ 已解决" if issue.resolved else "🔔 待处理"
                    lines.append(f"**{idx}. {issue.issue_type.value}** ({status})")
                    lines.append("")
                    desc = issue.description.replace('\n', '  \n> ')
                    lines.append(f"> {desc}")
                    lines.append("")
        
        # 点位统计
        if photos:
            lines.append("## 照片统计")
            lines.append("")
            
            # 按点位统计
            point_stats = defaultdict(int)
            for photo in photos:
                point_type = photo.point_type or "未分类"
                point_stats[point_type] += 1
            
            lines.append("### 按点位分布")
            lines.append("")
            lines.append("| 点位 | 照片数量 |")
            lines.append("|------|----------|")
            for point, count in sorted(point_stats.items()):
                lines.append(f"| {point} | {count} |")
            lines.append("")
            
            # 整改照片统计
            before_count = sum(1 for p in photos if p.is_before_rectification is True)
            after_count = sum(1 for p in photos if p.is_before_rectification is False)
            
            if before_count > 0 or after_count > 0:
                lines.append("### 整改照片统计")
                lines.append("")
                lines.append("| 类型 | 数量 |")
                lines.append("|------|------|")
                lines.append(f"| 整改前 | {before_count} |")
                lines.append(f"| 整改后 | {after_count} |")
                lines.append("")
        
        # 页脚
        lines.append("---")
        lines.append("")
        lines.append("*此报告由维保照片归档质检台自动生成*")
        
        return "\n".join(lines)
