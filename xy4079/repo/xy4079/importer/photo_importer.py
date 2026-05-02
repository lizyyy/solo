# -*- coding: utf-8 -*-
"""
照片导入器
"""

import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Set
from collections import defaultdict

from models import Photo


@dataclass
class ImportResult:
    """导入结果"""
    photos: List[Photo] = field(default_factory=list)
    success: bool = True
    total_count: int = 0
    imported_count: int = 0
    skipped_count: int = 0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    duplicates_by_hash: Dict[str, List[Photo]] = field(default_factory=lambda: defaultdict(list))


class PhotoImporter:
    """照片导入器"""
    
    # 支持的图片格式
    SUPPORTED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff', '.webp'}
    
    # 点位关键词映射
    POINT_KEYWORDS = {
        '机房': ['机房', 'ROOM', 'room', 'jifang', 'machine_room'],
        '轿厢': ['轿厢', 'CAR', 'car', 'xiaoxiang', 'car_car'],
        '底坑': ['底坑', 'PIT', 'pit', 'dikeng', 'pit_pit'],
        '安全回路': ['安全回路', 'SAFETY', 'safety', 'anquan', '安全'],
    }
    
    # 整改前后关键词
    BEFORE_KEYWORDS = ['前', 'before', 'BEFORE', '整改前', 'before_', 'before-', '_before', '-before']
    AFTER_KEYWORDS = ['后', 'after', 'AFTER', '整改后', 'after_', 'after-', '_after', '-after']
    
    def __init__(self):
        self.recursive = True  # 是否递归扫描子目录
        self.parse_from_filename = True  # 是否从文件名解析信息
        self.parse_from_exif = True  # 是否从EXIF解析拍摄时间
        
    def import_from_directory(self, directory: Path) -> ImportResult:
        """
        从目录导入照片
        
        Args:
            directory: 照片目录路径
            
        Returns:
            ImportResult: 导入结果
        """
        result = ImportResult()
        
        if not directory.exists():
            result.success = False
            result.errors.append(f"目录不存在: {directory}")
            return result
        
        if not directory.is_dir():
            result.success = False
            result.errors.append(f"路径不是目录: {directory}")
            return result
        
        # 查找所有图片文件
        image_files = self._find_image_files(directory)
        result.total_count = len(image_files)
        
        if not image_files:
            result.warnings.append(f"目录中没有找到图片文件: {directory}")
            return result
        
        # 导入每张照片
        for file_path in image_files:
            photo = self._import_single_photo(file_path, result)
            if photo:
                result.photos.append(photo)
                result.imported_count += 1
                
                # 按哈希分组（用于检测重复）
                result.duplicates_by_hash[photo.photo_hash].append(photo)
        
        # 检测重复
        self._detect_duplicates(result)
        
        return result
    
    def _find_image_files(self, directory: Path) -> List[Path]:
        """查找目录下的所有图片文件"""
        image_files = []
        
        if self.recursive:
            for ext in self.SUPPORTED_EXTENSIONS:
                image_files.extend(directory.rglob(f"*{ext}"))
                image_files.extend(directory.rglob(f"*{ext.upper()}"))
        else:
            for ext in self.SUPPORTED_EXTENSIONS:
                image_files.extend(directory.glob(f"*{ext}"))
                image_files.extend(directory.glob(f"*{ext.upper()}"))
        
        # 去重并排序
        image_files = sorted(set(image_files))
        
        return image_files
    
    def _import_single_photo(self, file_path: Path, result: ImportResult) -> Optional[Photo]:
        """导入单张照片"""
        try:
            file_stat = file_path.stat()
            file_size = file_stat.st_size
            file_name = file_path.name
            
            # 计算哈希
            photo_hash = Photo.calculate_hash(file_path)
            
            # 创建照片对象
            photo = Photo(
                file_path=file_path,
                file_name=file_name,
                file_size=file_size,
                photo_hash=photo_hash,
            )
            
            # 从文件名解析信息
            if self.parse_from_filename:
                self._parse_from_filename(photo, file_name)
            
            # 从EXIF解析拍摄时间
            if self.parse_from_exif:
                exif_time = self._parse_exif_time(file_path)
                if exif_time:
                    photo.capture_time = exif_time
            
            # 如果没有EXIF时间，尝试从文件名解析时间
            if not photo.capture_time and self.parse_from_filename:
                filename_time = self._parse_time_from_filename(file_name)
                if filename_time:
                    photo.capture_time = filename_time
            
            # 如果都没有，使用文件修改时间
            if not photo.capture_time:
                mtime = file_stat.st_mtime
                photo.capture_time = datetime.fromtimestamp(mtime)
            
            return photo
            
        except Exception as e:
            result.skipped_count += 1
            result.warnings.append(f"跳过文件 {file_path.name}: {str(e)}")
            return None
    
    def _parse_from_filename(self, photo: Photo, file_name: str) -> None:
        """从文件名解析点位类型和整改前后"""
        name_lower = file_name.lower()
        name = file_name
        
        # 解析点位类型
        for point_type, keywords in self.POINT_KEYWORDS.items():
            for keyword in keywords:
                if keyword.lower() in name_lower or keyword in name:
                    photo.point_type = point_type
                    break
            if photo.point_type:
                break
        
        # 解析整改前后
        for keyword in self.BEFORE_KEYWORDS:
            if keyword.lower() in name_lower or keyword in name:
                photo.is_before_rectification = True
            break
        
        for keyword in self.AFTER_KEYWORDS:
            if keyword.lower() in name_lower or keyword in name:
                photo.is_before_rectification = False
            break
    
    def _parse_exif_time(self, file_path: Path) -> Optional[datetime]:
        """从EXIF解析拍摄时间"""
        try:
            from PIL import Image
            from PIL.ExifTags import TAGS
            
            # 打开图片
            with Image.open(file_path) as img:
                # 获取EXIF数据
                exif_data = img._getexif()
                if not exif_data:
                    return None
                
                # 查找日期时间标签
                # 36867 = DateTimeOriginal
                # 36868 = DateTimeDigitized  
                # 306 = DateTime
                date_tags = [36867, 36868, 306]
                
                for tag in date_tags:
                    if tag in exif_data:
                        date_str = exif_data[tag]
                        if isinstance(date_str, bytes):
                            date_str = date_str.decode('utf-8', errors='ignore')
                        
                        # EXIF日期格式: "2023:01:15 14:30:00"
                        try:
                            return datetime.strptime(date_str, '%Y:%m:%d %H:%M:%S')
                        except ValueError:
                            # 尝试其他格式
                            try:
                                return datetime.strptime(date_str.split('.')[0], '%Y:%m:%d %H:%M:%S')
                            except ValueError:
                                continue
                
                return None
                
        except (ImportError, Exception):
            return None
    
    def _parse_time_from_filename(self, file_name: str) -> Optional[datetime]:
        """从文件名解析时间"""
        # 常见的时间格式模式
        patterns = [
            # 20230115_143000 或 2023-01-15_14-30-00
            (r'(\d{4})[-_]?(\d{2})[-_]?(\d{2})[-_T]?(\d{2})[-_:.]?(\d{2})[-_:.]?(\d{2})',
             '%Y%m%d%H%M%S'),
            # 20230115
            (r'(\d{4})(\d{2})(\d{2})', '%Y%m%d'),
            # IMG_20230115_143000
            (r'IMG[_-]?(\d{4})(\d{2})(\d{2})[_-]?(\d{2})(\d{2})(\d{2})?', '%Y%m%d%H%M%S'),
        ]
        
        for pattern, fmt in patterns:
            match = re.search(pattern, file_name)
            if match:
                try:
                    # 提取数字部分
                    digits = ''.join(match.groups())
                    # 根据格式长度截取
                    if len(fmt) == '%Y%m%d':
                        if len(digits) >= 8:
                            date_part = digits[:8]
                            return datetime.strptime(date_part, '%Y%m%d')
                    else:
                        if len(digits) >= 14:
                            datetime_part = digits[:14]
                            return datetime.strptime(datetime_part, '%Y%m%d%H%M%S')
                        elif len(digits) >= 8:
                            date_part = digits[:8]
                            return datetime.strptime(date_part, '%Y%m%d')
                except ValueError:
                    continue
        
        return None
    
    def _detect_duplicates(self, result: ImportResult) -> None:
        """检测重复照片"""
        for photo_hash, photos in result.duplicates_by_hash.items():
            if len(photos) > 1:
                result.warnings.append(
                    f"发现重复照片 (哈希: {photo_hash[:16]}...，共{len(photos)}张"
                )
