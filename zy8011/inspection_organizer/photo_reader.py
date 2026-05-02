"""
照片读取和EXIF解析模块
"""
import hashlib
import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from PIL import Image
from PIL.ExifTags import TAGS

from .config import PhotoMetadata


class PhotoReader:
    """照片读取器"""
    
    SUPPORTED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.heic', '.webp'}
    
    def __init__(self, photo_dir: str):
        self.photo_dir = Path(photo_dir)
        if not self.photo_dir.exists():
            raise ValueError(f"照片目录不存在: {photo_dir}")
    
    def get_all_photos(self) -> List[Path]:
        """获取目录下所有支持的照片文件"""
        photos = []
        for ext in self.SUPPORTED_EXTENSIONS:
            photos.extend(self.photo_dir.rglob(f"*{ext}"))
            photos.extend(self.photo_dir.rglob(f"*{ext.upper()}"))
        return sorted(photos)
    
    def read_photo_metadata(self, photo_path: Path) -> PhotoMetadata:
        """读取照片元数据"""
        metadata = PhotoMetadata(
            original_path=str(photo_path),
            filename=photo_path.name,
            size=photo_path.stat().st_size,
        )
        
        # 计算文件哈希
        metadata.file_hash = self._calculate_file_hash(photo_path)
        
        # 读取EXIF
        exif_data = self._read_exif(photo_path)
        if exif_data:
            metadata.exif_time = self._extract_time_from_exif(exif_data)
            metadata.store_code_from_exif = self._extract_store_from_exif(exif_data)
        
        return metadata
    
    def _read_exif(self, photo_path: Path) -> Optional[dict]:
        """读取EXIF数据"""
        try:
            with Image.open(photo_path) as img:
                exif_data = img._getexif()
                if exif_data:
                    # 将EXIF标签ID转换为可读名称
                    readable_exif = {}
                    for tag_id, value in exif_data.items():
                        tag = TAGS.get(tag_id, tag_id)
                        readable_exif[tag] = value
                    return readable_exif
        except (IOError, OSError, SyntaxError):
            pass
        return None
    
    def _extract_time_from_exif(self, exif_data: dict) -> Optional[str]:
        """从EXIF中提取时间"""
        time_tags = ['DateTimeOriginal', 'DateTimeDigitized', 'DateTime']
        for tag in time_tags:
            if tag in exif_data:
                time_str = str(exif_data[tag])
                try:
                    # EXIF时间格式: "2023:05:01 14:30:00"
                    dt = datetime.strptime(time_str, "%Y:%m:%d %H:%M:%S")
                    return dt.strftime("%Y-%m-%d %H:%M:%S")
                except ValueError:
                    pass
        return None
    
    def _extract_store_from_exif(self, exif_data: dict) -> Optional[str]:
        """从EXIF中提取门店编码（通常在ImageDescription或用户注释中）"""
        store_tags = ['ImageDescription', 'UserComment', 'XPComment', 'Make', 'Model']
        for tag in store_tags:
            if tag in exif_data:
                value = str(exif_data[tag])
                # 尝试匹配门店编码模式（如 SH001, BJ023 等）
                import re
                match = re.search(r'\b([A-Z]{2}\d{3,4})\b', value, re.IGNORECASE)
                if match:
                    return match.group(1).upper()
                # 也尝试纯数字门店编码
                match = re.search(r'\b(\d{4,6})\b', value)
                if match:
                    return match.group(1)
        return None
    
    def _calculate_file_hash(self, file_path: Path, chunk_size: int = 8192) -> str:
        """计算文件哈希（用于检测重复）"""
        hasher = hashlib.md5()
        with open(file_path, 'rb') as f:
            # 先读取文件大小和前几个KB用于快速比较
            file_size = file_path.stat().st_size
            hasher.update(str(file_size).encode())
            
            # 读取文件开头
            chunk = f.read(chunk_size)
            hasher.update(chunk)
            
            # 如果文件较大，读取中间部分和结尾
            if file_size > chunk_size * 2:
                f.seek(-chunk_size, os.SEEK_END)
                chunk = f.read(chunk_size)
                hasher.update(chunk)
                
                # 中间位置
                f.seek(file_size // 2)
                chunk = f.read(chunk_size // 2)
                hasher.update(chunk)
        
        return hasher.hexdigest()
