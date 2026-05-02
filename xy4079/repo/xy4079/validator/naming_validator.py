# -*- coding: utf-8 -*-
"""
命名规范校验器 - 检查照片命名是否符合规范
"""

import re
from collections import defaultdict
from typing import List, Optional, Dict, Set

from models import (
    WorkOrder,
    Photo,
    QualityIssue,
    IssueType,
    IssueSeverity
)
from .base_validator import BaseValidator, ValidationResult


class NamingValidator(BaseValidator):
    """命名规范校验器"""
    
    validator_name = "命名校验"
    
    # 推荐的命名模式
    # 示例: 机房_20230115_143000.jpg 或 整改前_轿门_01.jpg
    RECOMMENDED_PATTERNS = [
        # 点位_日期时间
        r'^(?P<point>机房|轿厢|底坑|安全回路|ROOM|CAR|PIT|SAFETY)[_-]?\d{8}',
        # 整改前后_点位
        r'^(?P<type>整改前|整改后|before|after)[_-]?(?P<point>.+)',
        # 点位_序号
        r'^(?P<point>机房|轿厢|底坑|安全回路)[_-]\d+',
    ]
    
    # 不规范的命名特征
    BAD_PATTERNS = [
        r'^IMG_\d{4,}',  # IMG_xxxx 格式
        r'^DSC[A-Z]?_\d{4,}',  # DSC_xxxx 格式
        r'^\d{8}_\d{6}',  # 纯日期时间格式，无点位
    ]
    
    # 非法字符（会导致跨平台问题）
    ILLEGAL_CHARS = r'[<>:"/\\|?*]'
    
    def __init__(self):
        super().__init__()
    
    def validate(self, work_order: Optional[WorkOrder], photos: List[Photo]) -> ValidationResult:
        """
        校验命名规范
        
        规则：
        1. 检查文件名是否包含非法字符
        2. 检查是否使用默认相机命名（如 IMG_xxxx）
        3. 建议使用规范命名
        """
        issues: List[QualityIssue] = []
        warnings: List[str] = []
        
        # 各类问题统计
        illegal_char_photos: List[Photo] = []
        default_name_photos: List[Photo] = []
        no_point_photos: List[Photo] = []
        
        for photo in photos:
            file_name = photo.file_name
            
            # 1. 检查非法字符
            if re.search(self.ILLEGAL_CHARS, file_name):
                illegal_char_photos.append(photo)
                continue
            
            # 2. 检查是否为默认相机命名
            is_default = False
            for pattern in self.BAD_PATTERNS:
                if re.match(pattern, file_name, re.IGNORECASE):
                    default_name_photos.append(photo)
                    is_default = True
                    break
            
            if is_default:
                continue
            
            # 3. 检查是否包含点位信息
            if not photo.point_type:
                # 如果无法从文件名解析出点位，可能是命名不规范
                no_point_photos.append(photo)
        
        # 报告问题
        # 1. 非法字符（严重问题）
        if illegal_char_photos:
            issue = self._create_issue(
                issue_type=IssueType.NAMING_ERROR,
                description=(
                    f"存在{len(illegal_char_photos)}张照片文件名包含非法字符\n"
                    f"非法字符: < > : \" / \\ | ? *\n"
                    f"问题文件: {', '.join(p.file_name for p in illegal_char_photos[:5])}..."
                ),
                severity=IssueSeverity.CRITICAL,
                related_photo_ids=[p.photo_id for p in illegal_char_photos]
            )
            issues.append(issue)
        
        # 2. 默认命名（警告）
        if default_name_photos:
            issue = self._create_issue(
                issue_type=IssueType.NAMING_ERROR,
                description=(
                    f"存在{len(default_name_photos)}张照片使用默认相机命名\n"
                    f"建议命名格式: 点位_日期时间.jpg (如: 机房_20230115_143000.jpg)\n"
                    f"问题文件: {', '.join(p.file_name for p in default_name_photos[:5])}..."
                ),
                severity=IssueSeverity.WARNING,
                related_photo_ids=[p.photo_id for p in default_name_photos]
            )
            issues.append(issue)
        
        # 3. 无法识别点位（提示）
        if no_point_photos:
            issue = self._create_issue(
                issue_type=IssueType.NAMING_ERROR,
                description=(
                    f"存在{len(no_point_photos)}张照片无法识别点位信息\n"
                    f"建议在文件名中包含点位关键词: 机房、轿厢、底坑、安全回路\n"
                    f"问题文件: {', '.join(p.file_name for p in no_point_photos[:5])}..."
                ),
                severity=IssueSeverity.INFO,
                related_photo_ids=[p.photo_id for p in no_point_photos]
            )
            issues.append(issue)
        
        # 收集统计信息
        info = {
            'illegal_char_count': len(illegal_char_photos),
            'default_name_count': len(default_name_photos),
            'no_point_count': len(no_point_photos)
        }
        
        return self._create_result(
            issues=issues,
            warnings=warnings,
            info=info
        )
