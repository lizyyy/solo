import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, Union
from PIL import Image

import config
from models.photo import Photo
from models.enums import PhotoType


@dataclass
class ScanResult:
    success: bool = True
    photos: List[Photo] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


class PhotoScanner:
    MODEL_ID_PATTERNS = [
        re.compile(r"([A-Z]{2,3}\d{6,10})", re.IGNORECASE),
        re.compile(r"(\d{8,12})"),
        re.compile(r"([A-Z]+\d+)"),
    ]

    PHOTO_TYPE_KEYWORDS = {
        PhotoType.OCCLUSION: ["咬合", "occlusion", "咬合关系", "咬合影", "bite"],
        PhotoType.FRONT: ["正面", "front", "模型正面", "正面观"],
        PhotoType.SIDE: ["侧面", "side", "模型侧面", "侧面观", "颊面", "buccal"],
        PhotoType.OCCLUSAL_SURFACE: ["咬合面", "occlusal", "面观", "palatal", "舌面"],
    }

    def __init__(self):
        self.allowed_extensions = config.ALLOWED_IMAGE_EXTENSIONS

    def scan_directory(
        self,
        directory: Union[str, Path],
        recursive: bool = True
    ) -> ScanResult:
        directory = Path(directory)
        result = ScanResult()

        if not directory.exists():
            result.success = False
            result.errors.append(f"目录不存在: {directory}")
            return result

        if not directory.is_dir():
            result.success = False
            result.errors.append(f"路径不是目录: {directory}")
            return result

        if recursive:
            files = list(directory.rglob("*"))
        else:
            files = list(directory.iterdir())

        for file_path in files:
            if not file_path.is_file():
                continue

            ext = file_path.suffix.lower()
            if ext not in self.allowed_extensions:
                continue

            try:
                photo = self._parse_photo(file_path)
                if photo:
                    result.photos.append(photo)
            except Exception as e:
                result.warnings.append(f"无法解析照片 {file_path.name}: {str(e)}")

        return result

    def _parse_photo(self, file_path: Path) -> Optional[Photo]:
        model_id = self._extract_model_id(file_path.name)
        if not model_id:
            model_id = self._extract_model_id(str(file_path.parent.name))

        if not model_id:
            return None

        photo_type = self._detect_photo_type(file_path.name, file_path.parent.name)
        taken_at = self._get_photo_taken_time(file_path)
        file_size = file_path.stat().st_size

        width, height = None, None
        try:
            with Image.open(file_path) as img:
                width, height = img.size
        except Exception:
            pass

        photo = Photo(
            file_path=str(file_path),
            model_id=model_id.upper(),
            photo_type=photo_type,
            taken_at=taken_at,
            file_size=file_size,
            width=width,
            height=height,
        )

        return photo

    def _extract_model_id(self, text: str) -> Optional[str]:
        for pattern in self.MODEL_ID_PATTERNS:
            match = pattern.search(text)
            if match:
                return match.group(1).upper()
        return None

    def _detect_photo_type(self, filename: str, parent_dir: str = "") -> PhotoType:
        text = f"{filename.lower()} {parent_dir.lower()}"

        for photo_type, keywords in self.PHOTO_TYPE_KEYWORDS.items():
            for keyword in keywords:
                if keyword.lower() in text:
                    return photo_type

        return PhotoType.OTHER

    def _get_photo_taken_time(self, file_path: Path) -> Optional[datetime]:
        try:
            with Image.open(file_path) as img:
                exif = img._getexif()
                if exif:
                    date_tag = 36867
                    if date_tag in exif:
                        date_str = exif[date_tag]
                        return datetime.strptime(date_str, "%Y:%m:%d %H:%M:%S")
        except Exception:
            pass

        stat = file_path.stat()
        try:
            return datetime.fromtimestamp(stat.st_birthtime)
        except AttributeError:
            try:
                return datetime.fromtimestamp(stat.st_mtime)
            except Exception:
                pass

        return None

    def group_by_model(self, photos: List[Photo]) -> Dict[str, List[Photo]]:
        grouped: Dict[str, List[Photo]] = {}
        for photo in photos:
            if photo.model_id not in grouped:
                grouped[photo.model_id] = []
            grouped[photo.model_id].append(photo)
        return grouped
