# -*- coding: utf-8 -*-
"""
重复校验器 - 检测重复照片（基于哈希）
"""

from collections import defaultdict
from typing import List, Optional, Dict

from models import (
    WorkOrder,
    Photo,
    QualityIssue,
    IssueType,
    IssueSeverity
)
from .base_validator import BaseValidator, ValidationResult


class DuplicateValidator(BaseValidator):
    """重复校验器"""
    
    validator_name = "重复校验"
    
    def __init__(self):
        super().__init__()
    
    def validate(self, work_order: Optional[WorkOrder], photos: List[Photo]) -> ValidationResult:
        """
        校验重复照片
        
        规则：
        1. 基于SHA256哈希检测完全相同的照片
        2. 报告重复的照片组
        """
        issues: List[QualityIssue] = []
        warnings: List[str] = []
        
        # 按哈希分组
        hash_groups: Dict[str, List[Photo]] = defaultdict(list)
        for photo in photos:
            hash_groups[photo.photo_hash].append(photo)
        
        # 查找重复组（哈希出现多次）
        duplicate_groups: List[List[Photo]] = []
        for photo_hash, photo_group in hash_groups.items():
            if len(photo_group) > 1:
                duplicate_groups.append(photo_group)
        
        # 报告重复
        if duplicate_groups:
            for idx, photo_group in enumerate(duplicate_groups, 1):
                photo_names = [p.file_name for p in photo_group]
                photo_hash = photo_group[0].photo_hash[:16]  # 显示部分哈希
                
                issue = self._create_issue(
                    issue_type=IssueType.DUPLICATE,
                    description=(
                        f"发现重复照片组 #{idx}:\n"
                        f"哈希前缀: {photo_hash}\n"
                        f"重复照片({len(photo_group)}张): {', '.join(photo_names)}"
                    ),
                    severity=IssueSeverity.WARNING,
                    related_photo_ids=[p.photo_id for p in photo_group],
                    related_work_order_id=work_order.order_id if work_order else None
                )
                issues.append(issue)
                
                warnings.append(
                    f"重复组 #{idx}: {len(photo_group)}张照片 ({', '.join(photo_names[:3])}...)"
                )
        
        # 收集统计信息
        info = {
            'total_photos': len(photos),
            'unique_hashes': len(hash_groups),
            'duplicate_groups': len(duplicate_groups),
            'duplicate_photos': sum(len(g) - 1 for g in duplicate_groups)
        }
        
        return self._create_result(
            issues=issues,
            warnings=warnings,
            info=info
        )
