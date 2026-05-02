#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
JSON导出模块 - 导出审计包
"""

import json
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import asdict

from persistence.data_store import ProjectData, ManualAnnotation, ReviewRecord


class JSONExporter:
    """
    JSON导出器
    导出完整的审计数据包
    """
    
    def __init__(self):
        """初始化JSON导出器"""
        self.generated_at = datetime.now().isoformat()
    
    def export(self, project: ProjectData, output_path: str) -> bool:
        """
        导出项目为JSON审计包
        
        Args:
            project: 项目数据
            output_path: 输出文件路径
            
        Returns:
            是否导出成功
        """
        try:
            data = self._generate_audit_package(project)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            return True
            
        except Exception as e:
            print(f"导出JSON审计包失败: {e}")
            return False
    
    def _generate_audit_package(self, project: ProjectData) -> Dict[str, Any]:
        """
        生成完整的审计数据包
        
        Args:
            project: 项目数据
            
        Returns:
            审计数据包字典
        """
        package = {
            "audit_info": {
                "version": "1.0.0",
                "generated_at": self.generated_at,
                "tool_name": "修复前后影像比对台"
            },
            "project": self._project_to_dict(project),
            "statistics": self._calculate_statistics(project),
            "issues": self._format_issues(project.issues),
            "review_records": self._format_review_records(project.review_records),
            "manual_annotations": self._format_manual_annotations(project.manual_annotations),
            "data_sources": self._format_data_sources(project)
        }
        
        return package
    
    def _project_to_dict(self, project: ProjectData) -> Dict[str, Any]:
        """
        将项目数据转换为字典
        
        Args:
            project: 项目数据
            
        Returns:
            字典表示
        """
        return {
            "project_id": project.project_id,
            "project_name": project.project_name,
            "description": project.description,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
            "page_numbers": project.page_numbers,
            "before_image_paths": {str(k): v for k, v in project.before_image_paths.items()},
            "after_image_paths": {str(k): v for k, v in project.after_image_paths.items()},
            "defect_csv_path": project.defect_csv_path,
            "material_csv_path": project.material_csv_path,
            "analysis_results": project.analysis_results,
            "metadata": project.metadata
        }
    
    def _calculate_statistics(self, project: ProjectData) -> Dict[str, Any]:
        """
        计算统计信息
        
        Args:
            project: 项目数据
            
        Returns:
            统计信息字典
        """
        # 问题类型统计
        type_counts = {}
        severity_counts = {}
        
        for issue in project.issues:
            issue_type = issue.get("type", "unknown")
            severity = issue.get("severity", "low")
            
            type_counts[issue_type] = type_counts.get(issue_type, 0) + 1
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
        
        # 复核状态统计
        review_status_counts = {}
        for record in project.review_records.values():
            status = record.review_status or "未开始"
            review_status_counts[status] = review_status_counts.get(status, 0) + 1
        
        # 标注统计
        total_annotations = sum(len(anns) for anns in project.manual_annotations.values())
        annotation_type_counts = {}
        for annotations in project.manual_annotations.values():
            for ann in annotations:
                ann_type = ann.annotation_type
                annotation_type_counts[ann_type] = annotation_type_counts.get(ann_type, 0) + 1
        
        return {
            "pages": {
                "total": len(project.page_numbers),
                "min_page": min(project.page_numbers) if project.page_numbers else None,
                "max_page": max(project.page_numbers) if project.page_numbers else None
            },
            "issues": {
                "total": len(project.issues),
                "by_type": type_counts,
                "by_severity": severity_counts
            },
            "reviews": {
                "total_records": len(project.review_records),
                "by_status": review_status_counts
            },
            "annotations": {
                "total": total_annotations,
                "by_type": annotation_type_counts
            },
            "images": {
                "before_count": len(project.before_image_paths),
                "after_count": len(project.after_image_paths)
            }
        }
    
    def _format_issues(self, issues: List[Dict]) -> List[Dict[str, Any]]:
        """
        格式化问题列表
        
        Args:
            issues: 问题列表
            
        Returns:
            格式化后的问题列表
        """
        formatted = []
        
        for i, issue in enumerate(issues, 1):
            formatted.append({
                "id": issue.get("id", f"issue_{i}"),
                "sequence": i,
                "type": issue.get("type", "unknown"),
                "type_name": self._get_type_name(issue.get("type", "unknown")),
                "severity": issue.get("severity", "low"),
                "severity_name": self._get_severity_name(issue.get("severity", "low")),
                "page_number": issue.get("page_number"),
                "message": issue.get("message", ""),
                "timestamp": issue.get("timestamp"),
                "reviewed": issue.get("reviewed", False),
                "details": issue.get("details", {})
            })
        
        return formatted
    
    def _format_review_records(self, review_records: Dict[int, ReviewRecord]) -> Dict[str, Any]:
        """
        格式化复核记录
        
        Args:
            review_records: 复核记录字典
            
        Returns:
            格式化后的复核记录
        """
        formatted = {}
        
        for page_num, record in review_records.items():
            formatted[str(page_num)] = {
                "id": record.id,
                "page_number": record.page_number,
                "review_status": record.review_status,
                "reviewer_name": record.reviewer_name,
                "review_date": record.review_date,
                "review_notes": record.review_notes,
                "issues_found": record.issues_found,
                "manual_annotations_count": len(record.manual_annotations) if record.manual_annotations else 0,
                "metadata": record.metadata
            }
        
        return formatted
    
    def _format_manual_annotations(self, annotations: Dict[int, List[ManualAnnotation]]) -> Dict[str, Any]:
        """
        格式化人工标注
        
        Args:
            annotations: 人工标注字典
            
        Returns:
            格式化后的人工标注
        """
        formatted = {}
        
        for page_num, ann_list in annotations.items():
            formatted_anns = []
            
            for ann in ann_list:
                formatted_anns.append({
                    "id": ann.id,
                    "page_number": ann.page_number,
                    "annotation_type": ann.annotation_type,
                    "annotation_type_name": self._get_annotation_type_name(ann.annotation_type),
                    "coordinates": ann.coordinates,
                    "width": ann.width,
                    "height": ann.height,
                    "area": ann.area,
                    "label": ann.label,
                    "description": ann.description,
                    "created_at": ann.created_at,
                    "updated_at": ann.updated_at,
                    "metadata": ann.metadata
                })
            
            formatted[str(page_num)] = formatted_anns
        
        return formatted
    
    def _format_data_sources(self, project: ProjectData) -> Dict[str, Any]:
        """
        格式化数据来源信息
        
        Args:
            project: 项目数据
            
        Returns:
            数据来源信息字典
        """
        return {
            "images": {
                "before": [
                    {
                        "page_number": page_num,
                        "filename": path.split('/')[-1] if '/' in path else path,
                        "full_path": path
                    }
                    for page_num, path in sorted(project.before_image_paths.items())
                ],
                "after": [
                    {
                        "page_number": page_num,
                        "filename": path.split('/')[-1] if '/' in path else path,
                        "full_path": path
                    }
                    for page_num, path in sorted(project.after_image_paths.items())
                ]
            },
            "csv_files": {
                "defect": {
                    "path": project.defect_csv_path,
                    "filename": project.defect_csv_path.split('/')[-1] if project.defect_csv_path and '/' in project.defect_csv_path else project.defect_csv_path
                } if project.defect_csv_path else None,
                "material": {
                    "path": project.material_csv_path,
                    "filename": project.material_csv_path.split('/')[-1] if project.material_csv_path and '/' in project.material_csv_path else project.material_csv_path
                } if project.material_csv_path else None
            }
        }
    
    def export_summary(self, project: ProjectData, output_path: str) -> bool:
        """
        导出简化的摘要信息（用于快速查看）
        
        Args:
            project: 项目数据
            output_path: 输出文件路径
            
        Returns:
            是否导出成功
        """
        try:
            summary = {
                "project_name": project.project_name,
                "project_id": project.project_id,
                "generated_at": self.generated_at,
                "summary": {
                    "total_pages": len(project.page_numbers),
                    "total_issues": len(project.issues),
                    "high_severity": sum(1 for i in project.issues if i.get("severity") == "high"),
                    "medium_severity": sum(1 for i in project.issues if i.get("severity") == "medium"),
                    "review_records_count": len(project.review_records),
                    "manual_annotations_count": sum(len(anns) for anns in project.manual_annotations.values())
                },
                "top_issues": self._get_top_issues(project.issues, 10),
                "export_status": "success"
            }
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(summary, f, ensure_ascii=False, indent=2)
            
            return True
            
        except Exception as e:
            print(f"导出JSON摘要失败: {e}")
            return False
    
    def _get_top_issues(self, issues: List[Dict], count: int = 10) -> List[Dict]:
        """
        获取最重要的问题（按严重程度排序）
        
        Args:
            issues: 问题列表
            count: 返回数量
            
        Returns:
            最重要的问题列表
        """
        # 按严重程度排序
        severity_order = {"high": 0, "medium": 1, "low": 2, "warning": 3}
        
        sorted_issues = sorted(
            issues,
            key=lambda x: severity_order.get(x.get("severity", "low"), 3)
        )
        
        # 取前N个
        return sorted_issues[:count]
    
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
