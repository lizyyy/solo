#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSV导出模块 - 导出问题清单
"""

import csv
from typing import Dict, List, Any, Optional

from persistence.data_store import ProjectData


class CSVExporter:
    """
    CSV导出器
    导出问题清单和其他数据到CSV文件
    """
    
    def __init__(self):
        """初始化CSV导出器"""
        pass
    
    def export_issues(self, project: ProjectData, output_path: str) -> bool:
        """
        导出问题清单到CSV
        
        Args:
            project: 项目数据
            output_path: 输出文件路径
            
        Returns:
            是否导出成功
        """
        try:
            rows = self._generate_issue_rows(project)
            
            with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                
                # 写入表头
                headers = ["序号", "问题类型", "严重程度", "页码", "描述", "检测时间", "已复核"]
                writer.writerow(headers)
                
                # 写入数据行
                for row in rows:
                    writer.writerow(row)
            
            return True
            
        except Exception as e:
            print(f"导出CSV问题清单失败: {e}")
            return False
    
    def _generate_issue_rows(self, project: ProjectData) -> List[List]:
        """
        生成问题清单的行数据
        
        Args:
            project: 项目数据
            
        Returns:
            行数据列表
        """
        rows = []
        
        for i, issue in enumerate(project.issues, 1):
            row = [
                i,
                self._get_type_name(issue.get("type", "unknown")),
                self._get_severity_name(issue.get("severity", "low")),
                issue.get("page_number", "-") or "-",
                issue.get("message", ""),
                issue.get("timestamp", "-"),
                "是" if issue.get("reviewed", False) else "否"
            ]
            rows.append(row)
        
        return rows
    
    def export_annotations(self, project: ProjectData, output_path: str) -> bool:
        """
        导出人工标注到CSV
        
        Args:
            project: 项目数据
            output_path: 输出文件路径
            
        Returns:
            是否导出成功
        """
        try:
            rows = []
            
            # 表头
            headers = ["页码", "标注ID", "标注类型", "标签", "面积(px²)", "宽度", "高度", "坐标数", "描述", "创建时间", "更新时间"]
            rows.append(headers)
            
            # 数据
            for page_num, annotations in sorted(project.manual_annotations.items()):
                for ann in annotations:
                    row = [
                        page_num,
                        ann.id,
                        self._get_annotation_type_name(ann.annotation_type),
                        ann.label,
                        f"{ann.area:.0f}",
                        f"{ann.width:.0f}",
                        f"{ann.height:.0f}",
                        len(ann.coordinates) if ann.coordinates else 0,
                        ann.description or "",
                        ann.created_at or "-",
                        ann.updated_at or "-"
                    ]
                    rows.append(row)
            
            # 写入文件
            with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                writer.writerows(rows)
            
            return True
            
        except Exception as e:
            print(f"导出CSV标注失败: {e}")
            return False
    
    def export_review_records(self, project: ProjectData, output_path: str) -> bool:
        """
        导出复核记录到CSV
        
        Args:
            project: 项目数据
            output_path: 输出文件路径
            
        Returns:
            是否导出成功
        """
        try:
            rows = []
            
            # 表头
            headers = ["页码", "复核状态", "复核人", "复核日期", "复核备注", "问题数", "标注数"]
            rows.append(headers)
            
            # 数据
            for page_num, record in sorted(project.review_records.items()):
                row = [
                    page_num,
                    record.review_status or "未开始",
                    record.reviewer_name or "-",
                    record.review_date or "-",
                    record.review_notes or "",
                    len(record.issues_found) if record.issues_found else 0,
                    len(record.manual_annotations) if record.manual_annotations else 0
                ]
                rows.append(row)
            
            # 写入文件
            with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                writer.writerows(rows)
            
            return True
            
        except Exception as e:
            print(f"导出CSV复核记录失败: {e}")
            return False
    
    def export_statistics(self, project: ProjectData, output_path: str) -> bool:
        """
        导出统计信息到CSV
        
        Args:
            project: 项目数据
            output_path: 输出文件路径
            
        Returns:
            是否导出成功
        """
        try:
            rows = []
            
            # 基本信息
            rows.append(["项目基本信息"])
            rows.append(["项目名称", project.project_name])
            rows.append(["项目ID", project.project_id])
            rows.append(["创建时间", project.created_at or "-"])
            rows.append(["描述", project.description or "-"])
            rows.append([])
            
            # 统计信息
            rows.append(["统计信息"])
            rows.append(["总页数", len(project.page_numbers)])
            rows.append(["总问题数", len(project.issues)])
            rows.append([])
            
            # 问题类型统计
            type_counts = {}
            for issue in project.issues:
                issue_type = issue.get("type", "unknown")
                type_counts[issue_type] = type_counts.get(issue_type, 0) + 1
            
            rows.append(["问题类型统计"])
            rows.append(["类型", "数量"])
            for issue_type, count in type_counts.items():
                rows.append([self._get_type_name(issue_type), count])
            rows.append([])
            
            # 严重程度统计
            severity_counts = {}
            for issue in project.issues:
                severity = issue.get("severity", "low")
                severity_counts[severity] = severity_counts.get(severity, 0) + 1
            
            rows.append(["严重程度统计"])
            rows.append(["严重程度", "数量"])
            for severity, count in severity_counts.items():
                rows.append([self._get_severity_name(severity), count])
            
            # 写入文件
            with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                writer.writerows(rows)
            
            return True
            
        except Exception as e:
            print(f"导出CSV统计信息失败: {e}")
            return False
    
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
