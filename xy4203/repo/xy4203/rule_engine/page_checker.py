#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
页码检查模块 - 检测页码串错、缺失等问题
"""

import re
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass


@dataclass
class PageIssue:
    """页码问题数据结构"""
    issue_type: str  # "missing", "duplicate", "out_of_order", "gap", "inconsistent"
    severity: str  # "high", "medium", "low", "warning"
    page_number: Optional[int] = None
    pages: Optional[List[int]] = None
    message: str = ""
    details: Dict[str, Any] = None


class PageChecker:
    """
    页码检查器
    检测页码串错、缺失、重复、顺序错误等问题
    """
    
    def __init__(self):
        """初始化页码检查器"""
        # 配置参数
        self.expected_start_page = 1
        self.allow_page_gaps = False
        self.max_gap_size = 2  # 允许的最大间隔（连续缺失的页数）
        
    def check_page_sequence(self, page_numbers: List[int], 
                            expected_start: int = None) -> List[PageIssue]:
        """
        检查页码序列的完整性和连续性
        
        Args:
            page_numbers: 页码列表
            expected_start: 期望的起始页码（默认为1）
            
        Returns:
            页码问题列表
        """
        issues = []
        
        if not page_numbers:
            return [PageIssue(
                issue_type="missing",
                severity="high",
                message="没有检测到任何页码"
            )]
        
        # 去重并排序
        unique_pages = sorted(set(page_numbers))
        start_page = expected_start if expected_start is not None else self.expected_start_page
        
        # 检查重复页码
        duplicate_pages = self._find_duplicates(page_numbers)
        for page in duplicate_pages:
            issues.append(PageIssue(
                issue_type="duplicate",
                severity="high",
                page_number=page,
                message=f"页码 {page} 出现重复"
            ))
        
        # 检查起始页码
        if unique_pages[0] != start_page:
            issues.append(PageIssue(
                issue_type="inconsistent",
                severity="medium",
                page_number=unique_pages[0],
                message=f"起始页码不一致，期望 {start_page}，实际 {unique_pages[0]}"
            ))
        
        # 检查页码连续性
        for i in range(len(unique_pages) - 1):
            current = unique_pages[i]
            next_page = unique_pages[i + 1]
            expected_next = current + 1
            
            if next_page != expected_next:
                missing_pages = list(range(expected_next, next_page))
                
                # 根据缺失页数判断严重程度
                if len(missing_pages) > self.max_gap_size:
                    severity = "high"
                elif len(missing_pages) > 0:
                    severity = "medium"
                else:
                    severity = "low"
                
                issues.append(PageIssue(
                    issue_type="gap",
                    severity=severity,
                    pages=missing_pages,
                    message=f"页码 {current} 和 {next_page} 之间缺失页码: {missing_pages}",
                    details={"missing_count": len(missing_pages)}
                ))
        
        # 检查是否有逆序（在原始列表中）
        out_of_order = self._find_out_of_order(page_numbers)
        for i, (current, next_page) in enumerate(out_of_order):
            issues.append(PageIssue(
                issue_type="out_of_order",
                severity="high",
                pages=[current, next_page],
                message=f"页码顺序错误：{current} 出现在 {next_page} 之前",
                details={"position": i}
            ))
        
        return issues
    
    def _find_duplicates(self, numbers: List[int]) -> List[int]:
        """
        查找重复的数字
        
        Args:
            numbers: 数字列表
            
        Returns:
            重复的数字列表
        """
        seen = set()
        duplicates = set()
        
        for num in numbers:
            if num in seen:
                duplicates.add(num)
            seen.add(num)
        
        return sorted(duplicates)
    
    def _find_out_of_order(self, numbers: List[int]) -> List[Tuple[int, int]]:
        """
        查找逆序的页码对
        
        Args:
            numbers: 页码列表（按出现顺序）
            
        Returns:
            逆序的页码对列表
        """
        out_of_order = []
        
        for i in range(len(numbers) - 1):
            if numbers[i] > numbers[i + 1]:
                out_of_order.append((numbers[i], numbers[i + 1]))
        
        return out_of_order
    
    def check_image_page_correlation(self, image_pages: List[int], 
                                      annotation_pages: List[int],
                                      material_pages: List[int]) -> List[PageIssue]:
        """
        检查图像、标注、材料记录之间的页码一致性
        
        Args:
            image_pages: 图像文件中的页码
            annotation_pages: 标注文件中的页码
            material_pages: 材料记录中的页码
            
        Returns:
            页码不一致问题列表
        """
        issues = []
        
        image_set = set(image_pages)
        annotation_set = set(annotation_pages)
        material_set = set(material_pages)
        
        # 检查只有图像但没有标注的页码
        image_only = image_set - annotation_set
        if image_only:
            issues.append(PageIssue(
                issue_type="inconsistent",
                severity="medium",
                pages=sorted(image_only),
                message=f"以下页码有图像但缺少病害标注: {sorted(image_only)}"
            ))
        
        # 检查只有标注但没有图像的页码
        annotation_only = annotation_set - image_set
        if annotation_only:
            issues.append(PageIssue(
                issue_type="inconsistent",
                severity="medium",
                pages=sorted(annotation_only),
                message=f"以下页码有病害标注但缺少图像: {sorted(annotation_only)}"
            ))
        
        # 检查材料记录与其他数据的一致性
        all_pages = image_set.union(annotation_set)
        material_only = material_set - all_pages
        if material_only:
            issues.append(PageIssue(
                issue_type="inconsistent",
                severity="warning",
                pages=sorted(material_only),
                message=f"以下页码有材料记录但缺少对应图像/标注: {sorted(material_only)}"
            ))
        
        # 检查有图像/标注但没有材料记录的页码（可能是正常的，标记为警告）
        pages_without_material = all_pages - material_set
        if pages_without_material:
            issues.append(PageIssue(
                issue_type="inconsistent",
                severity="warning",
                pages=sorted(pages_without_material),
                message=f"以下页码有图像/标注但缺少材料记录: {sorted(pages_without_material)}"
            ))
        
        return issues
    
    def extract_page_number_from_filename(self, filename: str) -> Optional[int]:
        """
        从文件名中提取页码
        
        Args:
            filename: 文件名（可能包含路径）
            
        Returns:
            提取的页码（提取失败返回None）
        """
        # 常见的页码命名模式
        patterns = [
            r'[_-]?(\d+)[_\-\.]',    # 下划线、横线或点包围的数字
            r'page[_-]?(\d+)',        # page开头的模式
            r'第(\d+)页',             # 中文"第X页"模式
            r'页[_-]?(\d+)',          # 中文页开头的模式
            r'(\d{1,})',              # 任意连续数字（最后尝试）
        ]
        
        # 去除扩展名
        name = filename.split('.')[0] if '.' in filename else filename
        
        for pattern in patterns:
            match = re.search(pattern, name, re.IGNORECASE)
            if match:
                try:
                    page_num = int(match.group(1))
                    if page_num > 0:
                        return page_num
                except (ValueError, IndexError):
                    continue
        
        return None
    
    def validate_page_range(self, page_numbers: List[int], 
                            min_page: int = 1, 
                            max_page: int = 1000) -> List[PageIssue]:
        """
        验证页码是否在合理范围内
        
        Args:
            page_numbers: 页码列表
            min_page: 最小允许页码
            max_page: 最大允许页码
            
        Returns:
            范围异常问题列表
        """
        issues = []
        
        for page in page_numbers:
            if page < min_page:
                issues.append(PageIssue(
                    issue_type="inconsistent",
                    severity="high",
                    page_number=page,
                    message=f"页码 {page} 小于最小允许值 {min_page}"
                ))
            elif page > max_page:
                issues.append(PageIssue(
                    issue_type="inconsistent",
                    severity="high",
                    page_number=page,
                    message=f"页码 {page} 大于最大允许值 {max_page}"
                ))
        
        return issues
    
    def get_page_statistics(self, page_numbers: List[int]) -> Dict:
        """
        获取页码统计信息
        
        Args:
            page_numbers: 页码列表
            
        Returns:
            统计信息字典
        """
        if not page_numbers:
            return {
                "total_count": 0,
                "unique_count": 0,
                "min_page": None,
                "max_page": None,
                "duplicate_count": 0,
                "missing_count": 0
            }
        
        unique_pages = sorted(set(page_numbers))
        min_page = unique_pages[0]
        max_page = unique_pages[-1]
        
        # 计算理论上应该有的页码数
        expected_count = max_page - min_page + 1
        actual_unique_count = len(unique_pages)
        
        # 计算重复数
        duplicate_count = len(page_numbers) - actual_unique_count
        
        # 计算缺失数
        missing_count = expected_count - actual_unique_count
        
        return {
            "total_count": len(page_numbers),
            "unique_count": actual_unique_count,
            "min_page": min_page,
            "max_page": max_page,
            "expected_count": expected_count,
            "duplicate_count": duplicate_count,
            "missing_count": missing_count,
            "unique_pages": unique_pages
        }
