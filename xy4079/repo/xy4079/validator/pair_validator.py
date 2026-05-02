# -*- coding: utf-8 -*-
"""
整改配对校验器 - 检查整改前后照片是否配对
"""

import re
from collections import defaultdict
from typing import List, Optional, Dict, Tuple

from models import (
    WorkOrder,
    Photo,
    QualityIssue,
    IssueType,
    IssueSeverity
)
from .base_validator import BaseValidator, ValidationResult


class PairValidator(BaseValidator):
    """整改配对校验器"""
    
    validator_name = "整改配对校验"
    
    # 整改前后关键词
    BEFORE_KEYWORDS = ['前', 'before', '整改前', 'before_', '_before']
    AFTER_KEYWORDS = ['后', 'after', '整改后', 'after_', '_after']
    
    def __init__(self):
        super().__init__()
    
    def validate(self, work_order: Optional[WorkOrder], photos: List[Photo]) -> ValidationResult:
        """
        校验整改配对
        
        规则：
        1. 如果工单有整改任务，检查整改前后照片是否配对
        2. 检查整改前照片是否有对应的整改后照片
        3. 检查整改后照片是否有对应的整改前照片
        """
        issues: List[QualityIssue] = []
        warnings: List[str] = []
        
        # 获取整改项列表
        rectification_items = []
        if work_order and work_order.has_rectification:
            rectification_items = work_order.rectification_items
        
        # 分组整理整改照片
        before_photos: List[Photo] = []
        after_photos: List[Photo] = []
        unknown_rectification_photos: List[Photo] = []
        
        for photo in photos:
            if photo.is_before_rectification is True:
                before_photos.append(photo)
            elif photo.is_before_rectification is False:
                after_photos.append(photo)
            elif self._looks_like_rectification(photo):
                # 看起来是整改照片但无法确定前后
                unknown_rectification_photos.append(photo)
        
        # 如果没有工单整改信息，但有整改照片，也需要检查
        has_rectification_photos = len(before_photos) > 0 or len(after_photos) > 0
        
        if not has_rectification_photos and not rectification_items:
            # 没有整改相关内容，跳过
            return self._create_result(
                issues=issues,
                warnings=warnings,
                info={'has_rectification': False}
            )
        
        # 尝试配对整改前后照片
        pairs = self._attempt_pairing(before_photos, after_photos)
        
        # 统计配对情况
        matched_before = set()
        matched_after = set()
        
        for before_p, after_p in pairs:
            matched_before.add(before_p.photo_id)
            matched_after.add(after_p.photo_id)
        
        unmatched_before = [p for p in before_photos if p.photo_id not in matched_before]
        unmatched_after = [p for p in after_photos if p.photo_id not in matched_after]
        
        # 报告问题
        # 1. 工单有整改项但缺少整改照片
        if rectification_items and len(before_photos) == 0 and len(after_photos) == 0:
            issue = self._create_issue(
                issue_type=IssueType.PAIR_MISMATCH,
                description=(
                    f"工单包含{len(rectification_items)}项整改任务，但未找到整改前后对比照片\n"
                    f"整改项: {', '.join(rectification_items[:5])}{'...' if len(rectification_items) > 5 else ''}"
                ),
                severity=IssueSeverity.CRITICAL,
                related_work_order_id=work_order.order_id if work_order else None
            )
            issues.append(issue)
        
        # 2. 整改前照片没有配对
        if unmatched_before:
            issue = self._create_issue(
                issue_type=IssueType.PAIR_MISMATCH,
                description=(
                    f"存在{len(unmatched_before)}张整改前照片未找到对应的整改后照片\n"
                    f"未配对照片: {', '.join(p.file_name for p in unmatched_before[:5])}..."
                ),
                severity=IssueSeverity.WARNING,
                related_photo_ids=[p.photo_id for p in unmatched_before]
            )
            issues.append(issue)
        
        # 3. 整改后照片没有配对
        if unmatched_after:
            issue = self._create_issue(
                issue_type=IssueType.PAIR_MISMATCH,
                description=(
                    f"存在{len(unmatched_after)}张整改后照片未找到对应的整改前照片\n"
                    f"未配对照片: {', '.join(p.file_name for p in unmatched_after[:5])}..."
                ),
                severity=IssueSeverity.WARNING,
                related_photo_ids=[p.photo_id for p in unmatched_after]
            )
            issues.append(issue)
        
        # 4. 无法确定整改前后的照片
        if unknown_rectification_photos:
            issue = self._create_issue(
                issue_type=IssueType.PAIR_MISMATCH,
                description=(
                    f"存在{len(unknown_rectification_photos)}张照片无法确定是整改前还是整改后\n"
                    f"建议文件名包含'整改前'/'整改后'或'before'/'after'关键词\n"
                    f"问题照片: {', '.join(p.file_name for p in unknown_rectification_photos[:5])}..."
                ),
                severity=IssueSeverity.INFO,
                related_photo_ids=[p.photo_id for p in unknown_rectification_photos]
            )
            issues.append(issue)
        
        # 收集统计信息
        info = {
            'has_rectification': has_rectification_photos,
            'rectification_items_count': len(rectification_items),
            'before_count': len(before_photos),
            'after_count': len(after_photos),
            'matched_pairs': len(pairs),
            'unmatched_before': len(unmatched_before),
            'unmatched_after': len(unmatched_after)
        }
        
        return self._create_result(
            issues=issues,
            warnings=warnings,
            info=info
        )
    
    def _looks_like_rectification(self, photo: Photo) -> bool:
        """判断照片是否看起来是整改相关的"""
        name_lower = photo.file_name.lower()
        
        # 检查是否包含整改相关关键词
        rect_keywords = ['整改', 'rectify', '整改项', 'repair', '问题']
        for keyword in rect_keywords:
            if keyword in name_lower or keyword in photo.file_name:
                # 但不包含前后关键词
                has_before = any(kw.lower() in name_lower for kw in self.BEFORE_KEYWORDS)
                has_after = any(kw.lower() in name_lower for kw in self.AFTER_KEYWORDS)
                if not has_before and not has_after:
                    return True
        
        return False
    
    def _attempt_pairing(self, before_photos: List[Photo], after_photos: List[Photo]) -> List[Tuple[Photo, Photo]]:
        """尝试配对整改前后照片"""
        pairs: List[Tuple[Photo, Photo]] = []
        
        # 策略1: 基于文件名相似度配对
        # 提取文件名中的共同部分（排除前后关键词）
        before_normalized = {}
        for p in before_photos:
            normalized = self._normalize_filename(p.file_name)
            before_normalized[p] = normalized
        
        after_normalized = {}
        for p in after_photos:
            normalized = self._normalize_filename(p.file_name)
            after_normalized[p] = normalized
        
        # 尝试精确匹配
        matched_before = set()
        matched_after = set()
        
        for before_p, before_norm in before_normalized.items():
            for after_p, after_norm in after_normalized.items():
                if after_p in matched_after:
                    continue
                if before_norm == after_norm:
                    pairs.append((before_p, after_p))
                    matched_before.add(before_p)
                    matched_after.add(after_p)
                    break
        
        # 策略2: 基于相同点位和序号配对（更简单的策略）
        # 暂时返回已配对的，剩余的留待人工确认
        
        return pairs
    
    def _normalize_filename(self, filename: str) -> str:
        """标准化文件名用于配对比较"""
        # 移除扩展名
        name = filename.rsplit('.', 1)[0]
        
        # 移除整改前后关键词
        keywords_to_remove = (
            self.BEFORE_KEYWORDS + self.AFTER_KEYWORDS + 
            ['整改', 'rectify', 'before', 'after']
        )
        
        for kw in keywords_to_remove:
            # 尝试多种变体
            patterns = [kw, kw.lower(), kw.upper(), kw.capitalize()]
            for pattern in patterns:
                name = name.replace(pattern, '')
        
        # 移除特殊字符和分隔符
        name = re.sub(r'[_\-\s\.]+', '', name)
        
        # 转为小写
        return name.lower()
