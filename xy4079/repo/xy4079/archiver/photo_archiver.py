# -*- coding: utf-8 -*-
"""
照片归档器 - 批量重命名和文件归档
"""

import shutil
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from pathlib import Path
from typing import List, Optional, Dict, Any, Callable
from collections import defaultdict

from models import (
    WorkOrder,
    Photo,
    PhotoArchive,
    IssueSeverity
)


class RenameRule(Enum):
    """重命名规则枚举"""
    KEEP_ORIGINAL = "保持原名"
    BY_POINT_AND_TIME = "按点位_时间"
    BY_POINT_AND_SEQUENCE = "按点位_序号"
    BY_WORK_ORDER = "按工单号_点位_序号"
    CUSTOM = "自定义规则"


@dataclass
class ArchiveResult:
    """归档结果"""
    success: bool = True
    archive_info: Optional[PhotoArchive] = None
    total_count: int = 0
    success_count: int = 0
    failed_count: int = 0
    skipped_count: int = 0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    renamed_files: List[Dict] = field(default_factory=list)  # {original: str, new: str, photo_id: str}


class PhotoArchiver:
    """照片归档器"""
    
    def __init__(
        self,
        rename_rule: RenameRule = RenameRule.BY_POINT_AND_SEQUENCE,
        create_subdirectories: bool = True,
        copy_instead_of_move: bool = False,
        custom_rename_func: Callable = None
    ):
        self.rename_rule = rename_rule
        self.create_subdirectories = create_subdirectories
        self.copy_instead_of_move = copy_instead_of_move
        self.custom_rename_func = custom_rename_func
        
        # 点位目录映射
        self.point_directories = {
            '机房': '01_机房',
            '轿厢': '02_轿厢', 
            '底坑': '03_底坑',
            '安全回路': '04_安全回路',
            '整改前': '05_整改前',
            '整改后': '06_整改后',
            '其他': '07_其他'
        }
    
    def archive(
        self,
        photos: List[Photo],
        target_directory: Path,
        work_order: Optional[WorkOrder] = None,
        skip_issues: bool = True,
        issue_severity_threshold: IssueSeverity = IssueSeverity.WARNING
    ) -> ArchiveResult:
        """
        归档照片
        
        Args:
            photos: 要归档的照片列表
            target_directory: 目标目录
            work_order: 关联的工单（用于命名）
            skip_issues: 是否跳过有问题的照片
            issue_severity_threshold: 问题严重程度阈值
            
        Returns:
            ArchiveResult: 归档结果
        """
        result = ArchiveResult()
        result.total_count = len(photos)
        
        # 确保目标目录存在
        try:
            target_directory.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            result.success = False
            result.errors.append(f"无法创建目标目录: {str(e)}")
            return result
        
        # 创建归档信息
        archive_info = PhotoArchive(
            archive_id=PhotoArchive.generate_id(),
            work_order_id=work_order.order_id if work_order else "",
            target_directory=target_directory
        )
        
        # 按点位分组（用于生成序号）
        point_sequences: Dict[str, int] = defaultdict(int)
        
        # 处理每张照片
        for photo in photos:
            # 检查是否需要跳过
            if skip_issues and photo.issues:
                has_severe_issue = any(
                    issue.severity.value >= issue_severity_threshold.value
                    for issue in photo.issues
                    if not issue.confirmed or not issue.resolved
                )
                if has_severe_issue:
                    result.skipped_count += 1
                    result.warnings.append(
                        f"跳过有未解决问题的照片: {photo.file_name}"
                    )
                    continue
            
            # 确定目标子目录
            subdir_name = self._get_subdirectory_name(photo)
            
            # 生成新文件名
            new_filename = self._generate_filename(
                photo, work_order, point_sequences
            )
            
            # 构建完整目标路径
            if self.create_subdirectories and subdir_name:
                target_subdir = target_directory / subdir_name
                target_subdir.mkdir(parents=True, exist_ok=True)
                target_path = target_subdir / new_filename
            else:
                target_path = target_directory / new_filename
            
            # 处理文件名冲突
            target_path = self._resolve_conflict(target_path)
            
            # 执行复制/移动
            try:
                if self.copy_instead_of_move:
                    shutil.copy2(photo.file_path, target_path)
                else:
                    shutil.move(str(photo.file_path), str(target_path))
                
                # 更新照片信息
                photo.archived = True
                photo.archive_path = target_path
                
                # 记录归档信息
                archive_info.archived_photos.append({
                    'original_path': str(photo.file_path),
                    'new_path': str(target_path),
                    'photo_id': photo.photo_id,
                    'file_name': new_filename
                })
                
                result.renamed_files.append({
                    'original': photo.file_name,
                    'new': new_filename,
                    'photo_id': photo.photo_id
                })
                
                result.success_count += 1
                
            except Exception as e:
                result.failed_count += 1
                result.errors.append(
                    f"归档照片 '{photo.file_name}' 失败: {str(e)}"
                )
        
        # 完成归档信息
        archive_info.total_count = result.total_count
        archive_info.success_count = result.success_count
        archive_info.failed_count = result.failed_count
        archive_info.errors = result.errors
        
        result.archive_info = archive_info
        
        # 检查是否完全成功
        result.success = result.failed_count == 0
        
        return result
    
    def batch_rename(
        self,
        photos: List[Photo],
        work_order: Optional[WorkOrder] = None,
        in_place: bool = True
    ) -> ArchiveResult:
        """
        仅批量重命名（不移动文件）
        
        Args:
            photos: 要重命名的照片列表
            work_order: 关联的工单
            in_place: 是否原地重命名（True）或复制到新目录（False）
            
        Returns:
            ArchiveResult: 重命名结果
        """
        result = ArchiveResult()
        result.total_count = len(photos)
        
        # 按点位分组（用于生成序号）
        point_sequences: Dict[str, int] = defaultdict(int)
        
        for photo in photos:
            # 生成新文件名
            new_filename = self._generate_filename(
                photo, work_order, point_sequences
            )
            
            # 如果文件名不变，跳过
            if new_filename == photo.file_name:
                result.skipped_count += 1
                continue
            
            # 构建目标路径
            if in_place:
                target_path = photo.file_path.parent / new_filename
            else:
                # 需要指定目录，这里简化处理
                target_path = Path(new_filename)
            
            # 处理文件名冲突
            target_path = self._resolve_conflict(target_path)
            
            try:
                # 重命名文件
                photo.file_path.rename(target_path)
                
                # 更新照片信息
                photo.file_path = target_path
                photo.file_name = new_filename
                
                result.renamed_files.append({
                    'original': photo.file_name,
                    'new': new_filename,
                    'photo_id': photo.photo_id
                })
                
                result.success_count += 1
                
            except Exception as e:
                result.failed_count += 1
                result.errors.append(
                    f"重命名照片 '{photo.file_name}' 失败: {str(e)}"
                )
        
        result.success = result.failed_count == 0
        return result
    
    def _get_subdirectory_name(self, photo: Photo) -> str:
        """获取子目录名称"""
        # 首先检查是否为整改照片
        if photo.is_before_rectification is True:
            return self.point_directories.get('整改前', '05_整改前')
        if photo.is_before_rectification is False:
            return self.point_directories.get('整改后', '06_整改后')
        
        # 然后检查点位类型
        if photo.point_type:
            return self.point_directories.get(
                photo.point_type, 
                self.point_directories['其他']
            )
        
        return self.point_directories['其他']
    
    def _generate_filename(
        self,
        photo: Photo,
        work_order: Optional[WorkOrder],
        point_sequences: Dict[str, int]
    ) -> str:
        """根据规则生成新文件名"""
        original_ext = photo.file_path.suffix
        
        # 获取基础信息
        point_type = photo.point_type or "未知"
        sequence_key = point_type
        
        # 整改照片使用不同的序列
        if photo.is_before_rectification is True:
            sequence_key = "整改前_" + point_type
        elif photo.is_before_rectification is False:
            sequence_key = "整改后_" + point_type
        
        # 增加序号
        point_sequences[sequence_key] += 1
        sequence = point_sequences[sequence_key]
        
        # 格式化时间
        time_str = ""
        if photo.capture_time:
            time_str = photo.capture_time.strftime("%Y%m%d_%H%M%S")
        
        # 获取工单号
        order_id = work_order.order_id if work_order else ""
        
        # 根据规则生成文件名
        if self.rename_rule == RenameRule.KEEP_ORIGINAL:
            return photo.file_name
        
        elif self.rename_rule == RenameRule.BY_POINT_AND_TIME:
            if time_str:
                return f"{point_type}_{time_str}{original_ext}"
            else:
                return f"{point_type}_{sequence:03d}{original_ext}"
        
        elif self.rename_rule == RenameRule.BY_POINT_AND_SEQUENCE:
            return f"{point_type}_{sequence:03d}{original_ext}"
        
        elif self.rename_rule == RenameRule.BY_WORK_ORDER:
            if order_id:
                return f"{order_id}_{point_type}_{sequence:03d}{original_ext}"
            else:
                return f"{point_type}_{sequence:03d}{original_ext}"
        
        elif self.rename_rule == RenameRule.CUSTOM and self.custom_rename_func:
            try:
                custom_name = self.custom_rename_func(
                    photo=photo,
                    work_order=work_order,
                    sequence=sequence,
                    original_ext=original_ext
                )
                if custom_name:
                    return custom_name
            except Exception:
                pass
        
        # 默认返回原名
        return photo.file_name
    
    def _resolve_conflict(self, target_path: Path) -> Path:
        """处理文件名冲突"""
        if not target_path.exists():
            return target_path
        
        # 添加序号直到找到不冲突的文件名
        parent = target_path.parent
        stem = target_path.stem
        suffix = target_path.suffix
        
        counter = 1
        while True:
            new_name = f"{stem}_{counter:03d}{suffix}"
            new_path = parent / new_name
            if not new_path.exists():
                return new_path
            counter += 1
    
    def suggest_rename_preview(
        self,
        photos: List[Photo],
        work_order: Optional[WorkOrder] = None
    ) -> List[Dict]:
        """
        预览重命名结果（不实际执行）
        
        Returns:
            列表，每个元素包含:
            - original: 原文件名
            - suggested: 建议的新文件名
            - photo_id: 照片ID
        """
        preview_list = []
        
        # 临时序列计数器
        point_sequences: Dict[str, int] = defaultdict(int)
        
        for photo in photos:
            suggested_name = self._generate_filename(
                photo, work_order, point_sequences
            )
            
            preview_list.append({
                'original': photo.file_name,
                'suggested': suggested_name,
                'photo_id': photo.photo_id,
                'changed': suggested_name != photo.file_name
            })
        
        return preview_list
