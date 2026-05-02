#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Markdown导出模块 - 导出复核单
"""

import os
from datetime import datetime
from typing import Dict, List, Any, Optional

from persistence.data_store import ProjectData, ManualAnnotation, ReviewRecord


class MarkdownExporter:
    """
    Markdown导出器
    导出详细的复核单文档
    """
    
    def __init__(self):
        """初始化Markdown导出器"""
        self.generated_at = datetime.now().isoformat()
    
    def export(self, project: ProjectData, output_path: str) -> bool:
        """
        导出项目为Markdown复核单
        
        Args:
            project: 项目数据
            output_path: 输出文件路径
            
        Returns:
            是否导出成功
        """
        try:
            content = self._generate_markdown(project)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            return True
            
        except Exception as e:
            print(f"导出Markdown失败: {e}")
            return False
    
    def _generate_markdown(self, project: ProjectData) -> str:
        """
        生成Markdown内容
        
        Args:
            project: 项目数据
            
        Returns:
            Markdown字符串
        """
        lines = []
        
        # 标题
        lines.append("# 古籍修复影像复核单")
        lines.append("")
        lines.append(f"**项目名称**: {project.project_name}")
        lines.append(f"**复核时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**项目ID**: {project.project_id}")
        lines.append("")
        
        # 项目概述
        lines.append("## 1. 项目概述")
        lines.append("")
        
        if project.description:
            lines.append(f"**项目描述**: {project.description}")
            lines.append("")
        
        lines.append(f"- **总页数**: {len(project.page_numbers)}")
        lines.append(f"- **检测到的问题数**: {len(project.issues)}")
        lines.append(f"- **创建时间**: {project.created_at}")
        lines.append("")
        
        # 统计信息
        lines.append("## 2. 分析统计")
        lines.append("")
        
        stats = self._calculate_statistics(project)
        
        lines.append("### 2.1 问题统计")
        lines.append("")
        lines.append("| 问题类型 | 数量 | 严重程度分布 |")
        lines.append("|---------|------|-------------|")
        
        type_counts = stats["type_counts"]
        severity_counts = stats["severity_counts"]
        
        for issue_type, count in type_counts.items():
            type_name = self._get_type_name(issue_type)
            lines.append(f"| {type_name} | {count} | - |")
        
        lines.append("")
        lines.append("**严重程度分布**:")
        lines.append(f"- 高严重度: {severity_counts.get('high', 0)}")
        lines.append(f"- 中严重度: {severity_counts.get('medium', 0)}")
        lines.append(f"- 低严重度: {severity_counts.get('low', 0)}")
        lines.append(f"- 警告: {severity_counts.get('warning', 0)}")
        lines.append("")
        
        # 问题详情
        lines.append("## 3. 问题详情")
        lines.append("")
        
        if project.issues:
            for i, issue in enumerate(project.issues, 1):
                severity_name = self._get_severity_name(issue.get("severity", "low"))
                type_name = self._get_type_name(issue.get("type", "unknown"))
                
                lines.append(f"### 3.{i} {type_name}问题 #{i}")
                lines.append("")
                lines.append(f"- **严重程度**: {severity_name}")
                lines.append(f"- **页码**: {issue.get('page_number', '-') or '-'}")
                lines.append(f"- **描述**: {issue.get('message', '')}")
                lines.append(f"- **检测时间**: {issue.get('timestamp', '-')}")
                lines.append("")
        else:
            lines.append("*未检测到问题*")
            lines.append("")
        
        # 复核记录
        lines.append("## 4. 复核记录")
        lines.append("")
        
        if project.review_records:
            for page_num, record in sorted(project.review_records.items()):
                lines.append(f"### 4.1 第 {page_num} 页")
                lines.append("")
                lines.append(f"- **复核状态**: {record.review_status or '未开始'}")
                lines.append(f"- **复核人**: {record.reviewer_name or '-'}")
                lines.append(f"- **复核日期**: {record.review_date or '-'}")
                lines.append(f"- **复核备注**: {record.review_notes or '无'}")
                lines.append("")
                
                # 人工标注
                if record.manual_annotations:
                    lines.append("**人工圈选标注**:")
                    lines.append("")
                    for j, ann in enumerate(record.manual_annotations, 1):
                        lines.append(f"- **标注 {j}**: {ann.label}")
                        lines.append(f"  - 类型: {self._get_annotation_type_name(ann.annotation_type)}")
                        lines.append(f"  - 面积: {ann.area:.0f} px²")
                        lines.append(f"  - 描述: {ann.description or '无'}")
                    lines.append("")
        else:
            lines.append("*暂无复核记录*")
            lines.append("")
        
        # 数据来源
        lines.append("## 5. 数据来源")
        lines.append("")
        lines.append("### 5.1 图像文件")
        lines.append("")
        
        if project.before_image_paths:
            lines.append("**修复前图像**:")
            for page_num, path in sorted(project.before_image_paths.items()):
                lines.append(f"- 第 {page_num} 页: {os.path.basename(path)}")
            lines.append("")
        
        if project.after_image_paths:
            lines.append("**修复后图像**:")
            for page_num, path in sorted(project.after_image_paths.items()):
                lines.append(f"- 第 {page_num} 页: {os.path.basename(path)}")
            lines.append("")
        
        lines.append("### 5.2 CSV文件")
        lines.append("")
        if project.defect_csv_path:
            lines.append(f"- **病害标注CSV**: {os.path.basename(project.defect_csv_path)}")
        if project.material_csv_path:
            lines.append(f"- **材料记录CSV**: {os.path.basename(project.material_csv_path)}")
        lines.append("")
        
        # 汇总和建议
        lines.append("## 6. 复核建议")
        lines.append("")
        
        recommendations = self._generate_recommendations(project)
        if recommendations:
            for rec in recommendations:
                lines.append(f"- {rec}")
        else:
            lines.append("*建议根据实际情况进行人工复核*")
        lines.append("")
        
        # 页脚
        lines.append("---")
        lines.append("")
        lines.append(f"*此复核单由「修复前后影像比对台」自动生成于 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
        
        return "\n".join(lines)
    
    def _calculate_statistics(self, project: ProjectData) -> Dict:
        """
        计算统计信息
        
        Args:
            project: 项目数据
            
        Returns:
            统计信息字典
        """
        type_counts = {}
        severity_counts = {}
        
        for issue in project.issues:
            issue_type = issue.get("type", "unknown")
            severity = issue.get("severity", "low")
            
            type_counts[issue_type] = type_counts.get(issue_type, 0) + 1
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
        
        return {
            "type_counts": type_counts,
            "severity_counts": severity_counts
        }
    
    def _get_type_name(self, issue_type: str) -> str:
        """获取问题类型的中文名称"""
        names = {
            "page": "页码",
            "area": "面积",
            "color": "颜色",
            "material": "材料",
            "unknown": "未知"
        }
        return names.get(issue_type, issue_type)
    
    def _get_severity_name(self, severity: str) -> str:
        """获取严重程度的中文名称"""
        names = {
            "high": "高",
            "medium": "中",
            "low": "低",
            "warning": "警告"
        }
        return names.get(severity, severity)
    
    def _get_annotation_type_name(self, ann_type: str) -> str:
        """获取标注类型的中文名称"""
        names = {
            "rectangle": "矩形",
            "ellipse": "椭圆",
            "polygon": "多边形",
            "freehand": "自由绘制"
        }
        return names.get(ann_type, ann_type)
    
    def _generate_recommendations(self, project: ProjectData) -> List[str]:
        """
        生成复核建议
        
        Args:
            project: 项目数据
            
        Returns:
            建议列表
        """
        recommendations = []
        
        # 根据问题类型生成建议
        high_issues = [i for i in project.issues if i.get("severity") == "high"]
        medium_issues = [i for i in project.issues if i.get("severity") == "medium"]
        
        if high_issues:
            recommendations.append(f"⚠️ **高优先级**: 存在 {len(high_issues)} 个高严重度问题，建议优先处理")
        
        if medium_issues:
            recommendations.append(f"📋 **中优先级**: 存在 {len(medium_issues)} 个中严重度问题，建议进行复核")
        
        # 检查特定类型问题
        page_issues = [i for i in project.issues if i.get("type") == "page"]
        area_issues = [i for i in project.issues if i.get("type") == "area"]
        color_issues = [i for i in project.issues if i.get("type") == "color"]
        
        if page_issues:
            recommendations.append(f"📑 页码问题: 检测到 {len(page_issues)} 个页码相关问题，建议检查页码序列和图像对应关系")
        
        if area_issues:
            recommendations.append(f"📐 面积问题: 检测到 {len(area_issues)} 个面积相关问题，建议检查补纸面积记录和标注覆盖率")
        
        if color_issues:
            recommendations.append(f"🎨 颜色问题: 检测到 {len(color_issues)} 个颜色相关问题，建议检查修复材料颜色匹配度")
        
        # 如果没有问题
        if not recommendations:
            recommendations.append("✅ 未检测到严重问题，建议进行人工抽样复核确认")
        
        return recommendations
