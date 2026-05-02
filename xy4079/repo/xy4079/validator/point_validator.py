# -*- coding: utf-8 -*-
"""
点位校验器 - 检查必拍点位是否漏拍
"""

from collections import defaultdict
from typing import List, Optional, Dict, Set

from models import (
    WorkOrder,
    Photo,
    QualityIssue,
    IssueType,
    IssueSeverity,
    InspectionPoint
)
from .base_validator import BaseValidator, ValidationResult


class PointValidator(BaseValidator):
    """点位校验器"""
    
    validator_name = "点位校验"
    
    def __init__(self):
        super().__init__()
        self._default_points = InspectionPoint.get_default_points()
        self._point_map: Dict[str, InspectionPoint] = {
            p.point_name: p for p in self._default_points
        }
    
    def validate(self, work_order: Optional[WorkOrder], photos: List[Photo]) -> ValidationResult:
        """
        校验必拍点位
        
        规则：
        1. 检查工单指定的必拍点位是否都有照片
        2. 检查每个点位的照片数量是否符合要求
        3. 检查是否有无法识别点位的照片
        """
        issues: List[QualityIssue] = []
        warnings: List[str] = []
        
        # 获取需要检查的点位列表
        required_points = self._get_required_points(work_order)
        
        # 统计各点位的照片数量
        point_photos: Dict[str, List[Photo]] = defaultdict(list)
        unknown_photos: List[Photo] = []
        
        for photo in photos:
            if photo.point_type:
                point_photos[photo.point_type].append(photo)
            else:
                unknown_photos.append(photo)
        
        # 1. 检查必拍点位是否漏拍
        for point_name in required_points:
            point_info = self._point_map.get(point_name)
            min_count = point_info.photo_count_min if point_info else 1
            
            photo_list = point_photos.get(point_name, [])
            actual_count = len(photo_list)
            
            if actual_count < min_count:
                # 点位漏拍
                issue = self._create_issue(
                    issue_type=IssueType.MISSING_POINT,
                    description=f"点位'{point_name}'照片数量不足: 最少需要{min_count}张, 实际{actual_count}张",
                    severity=IssueSeverity.CRITICAL,
                    related_work_order_id=work_order.order_id if work_order else None
                )
                issues.append(issue)
        
        # 2. 检查无法识别点位的照片
        if unknown_photos:
            issue = self._create_issue(
                issue_type=IssueType.NAMING_ERROR,
                description=f"存在{len(unknown_photos)}张无法识别点位的照片",
                severity=IssueSeverity.WARNING,
                related_photo_ids=[p.photo_id for p in unknown_photos]
            )
            issues.append(issue)
            warnings.append(f"无法识别点位的照片: {', '.join(p.file_name for p in unknown_photos[:5])}...")
        
        # 3. 检查是否有多余的点位（非必拍但有照片）
        extra_points = set(point_photos.keys()) - set(required_points)
        if extra_points:
            warnings.append(f"发现非必拍点位的照片: {', '.join(extra_points)}")
        
        # 收集统计信息
        info = {
            'required_points': required_points,
            'point_counts': {p: len(photos) for p, photos in point_photos.items()},
            'unknown_count': len(unknown_photos),
            'extra_points': list(extra_points)
        }
        
        return self._create_result(
            issues=issues,
            warnings=warnings,
            info=info
        )
    
    def _get_required_points(self, work_order: Optional[WorkOrder]) -> List[str]:
        """获取必拍点位列表"""
        if work_order and work_order.required_points:
            return work_order.required_points
        
        # 默认点位
        return [p.point_name for p in self._default_points]
