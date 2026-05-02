"""文件/照片元数据解析模块"""

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional

try:
    from PIL import Image
    from PIL.ExifTags import TAGS
    HAS_PIL = True
except ImportError:
    HAS_PIL = False


@dataclass
class PhotoMetadata:
    """照片元数据类"""
    
    filename: str
    file_path: str
    file_size: int
    file_hash: str
    capture_time: Optional[datetime] = None
    camera_model: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    exif_data: dict = field(default_factory=dict)
    parse_time: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "filename": self.filename,
            "file_path": self.file_path,
            "file_size": self.file_size,
            "file_hash": self.file_hash,
            "capture_time": self.capture_time.isoformat() if self.capture_time else None,
            "camera_model": self.camera_model,
            "width": self.width,
            "height": self.height,
            "exif_data": self.exif_data,
            "parse_time": self.parse_time.isoformat(),
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "PhotoMetadata":
        """从字典创建实例"""
        capture_time = None
        if data.get("capture_time"):
            try:
                capture_time = datetime.fromisoformat(data["capture_time"])
            except (ValueError, TypeError):
                pass
        
        parse_time = datetime.now()
        if data.get("parse_time"):
            try:
                parse_time = datetime.fromisoformat(data["parse_time"])
            except (ValueError, TypeError):
                pass
        
        return cls(
            filename=data["filename"],
            file_path=data["file_path"],
            file_size=data["file_size"],
            file_hash=data["file_hash"],
            capture_time=capture_time,
            camera_model=data.get("camera_model"),
            width=data.get("width"),
            height=data.get("height"),
            exif_data=data.get("exif_data", {}),
            parse_time=parse_time,
        )


class MetadataParser:
    """元数据解析器"""
    
    IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".tif"}
    
    def __init__(self):
        self._processed_count = 0
    
    def calculate_file_hash(self, file_path: Path, algorithm: str = "sha256") -> str:
        """计算文件哈希值
        
        Args:
            file_path: 文件路径
            algorithm: 哈希算法，支持 md5、sha1、sha256、sha512
        
        Returns:
            十六进制哈希字符串
        """
        hash_func = hashlib.new(algorithm)
        
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                hash_func.update(chunk)
        
        return hash_func.hexdigest()
    
    def parse_photo_file(self, file_path: Path) -> PhotoMetadata:
        """解析单个照片文件
        
        Args:
            file_path: 照片文件路径
        
        Returns:
            PhotoMetadata 对象
        """
        file_stat = file_path.stat()
        file_hash = self.calculate_file_hash(file_path)
        
        metadata = PhotoMetadata(
            filename=file_path.name,
            file_path=str(file_path.absolute()),
            file_size=file_stat.st_size,
            file_hash=file_hash,
        )
        
        if HAS_PIL:
            try:
                with Image.open(file_path) as img:
                    metadata.width, metadata.height = img.size
                    
                    if hasattr(img, "_getexif") and img._getexif():
                        exif_data = img._getexif()
                        if exif_data:
                            for tag_id, value in exif_data.items():
                                tag = TAGS.get(tag_id, tag_id)
                                metadata.exif_data[tag] = value
                                
                                if tag == "DateTimeOriginal":
                                    try:
                                        metadata.capture_time = datetime.strptime(
                                            value, "%Y:%m:%d %H:%M:%S"
                                        )
                                    except ValueError:
                                        pass
                                elif tag == "DateTime":
                                    try:
                                        if not metadata.capture_time:
                                            metadata.capture_time = datetime.strptime(
                                                value, "%Y:%m:%d %H:%M:%S"
                                            )
                                    except ValueError:
                                        pass
                                elif tag == "Model":
                                    metadata.camera_model = value
            except Exception:
                pass
        
        if not metadata.capture_time:
            metadata.capture_time = datetime.fromtimestamp(file_stat.st_mtime)
        
        self._processed_count += 1
        return metadata
    
    def parse_photos(self, directory: Path) -> List[PhotoMetadata]:
        """解析目录中的所有照片文件
        
        Args:
            directory: 照片目录路径
        
        Returns:
            PhotoMetadata 对象列表
        """
        photos = []
        
        if not directory.exists():
            return photos
        
        for file_path in directory.iterdir():
            if file_path.is_file() and file_path.suffix.lower() in self.IMAGE_EXTENSIONS:
                try:
                    photo = self.parse_photo_file(file_path)
                    photos.append(photo)
                except Exception:
                    continue
        
        photos.sort(key=lambda x: x.capture_time or datetime.min)
        return photos
    
    def save_metadata(
        self, metadata_list: List[PhotoMetadata], output_path: Path
    ) -> None:
        """保存元数据到 JSON 文件
        
        Args:
            metadata_list: PhotoMetadata 对象列表
            output_path: 输出文件路径
        """
        data = [m.to_dict() for m in metadata_list]
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    
    def load_metadata(self, input_path: Path) -> List[PhotoMetadata]:
        """从 JSON 文件加载元数据
        
        Args:
            input_path: 输入文件路径
        
        Returns:
            PhotoMetadata 对象列表
        """
        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        return [PhotoMetadata.from_dict(item) for item in data]
