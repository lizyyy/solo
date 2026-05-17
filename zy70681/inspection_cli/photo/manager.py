import hashlib
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from PIL import Image

from ..models.base import PhotoEvidence, InspectionSession
from ..utils.helpers import stable_hash


@dataclass
class PhotoValidationResult:
    photo_id: str
    file_path: str
    exists: bool
    is_valid_image: bool
    file_size: Optional[int]
    file_hash: Optional[str]
    dimensions: Optional[Tuple[int, int]]
    errors: List[str]


class PhotoManager:
    def __init__(self, base_path: Optional[str] = None):
        self.base_path = Path(base_path) if base_path else Path.cwd()
        self.supported_formats = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}

    def validate_photo(self, photo: PhotoEvidence) -> PhotoValidationResult:
        file_path = Path(photo.file_path)
        if not file_path.is_absolute():
            file_path = self.base_path / file_path

        result = PhotoValidationResult(
            photo_id=photo.photo_id,
            file_path=str(file_path),
            exists=False,
            is_valid_image=False,
            file_size=None,
            file_hash=None,
            dimensions=None,
            errors=[]
        )

        if not file_path.exists():
            result.errors.append(f"文件不存在: {file_path}")
            return result

        result.exists = True
        result.file_size = file_path.stat().st_size

        if file_path.suffix.lower() not in self.supported_formats:
            result.errors.append(f"不支持的文件格式: {file_path.suffix}")
            return result

        try:
            with Image.open(file_path) as img:
                result.dimensions = img.size
                result.is_valid_image = True
        except Exception as e:
            result.errors.append(f"图片验证失败: {str(e)}")
            return result

        result.file_hash = self._calculate_file_hash(file_path)
        return result

    def validate_all_photos(self, session: InspectionSession) -> Dict[str, PhotoValidationResult]:
        results: Dict[str, PhotoValidationResult] = {}

        for photo_id, photo in session.photos.items():
            results[photo_id] = self.validate_photo(photo)

        return dict(sorted(results.items()))

    def _calculate_file_hash(self, file_path: Path, chunk_size: int = 8192) -> str:
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            while chunk := f.read(chunk_size):
                sha256.update(chunk)
        return sha256.hexdigest()[:16]

    def get_photo_usage(self, session: InspectionSession) -> Dict[str, List[str]]:
        usage: Dict[str, List[str]] = {}

        for item_id, item in session.items.items():
            for photo in item.photos:
                if photo.photo_id not in usage:
                    usage[photo.photo_id] = []
                usage[photo.photo_id].append(f"巡检项:{item_id}")

        for task_id, task in session.tasks.items():
            for photo in task.photos:
                if photo.photo_id not in usage:
                    usage[photo.photo_id] = []
                usage[photo.photo_id].append(f"整改任务:{task_id}")

        for recheck_id, recheck in session.rechecks.items():
            for photo in recheck.photos:
                if photo.photo_id not in usage:
                    usage[photo.photo_id] = []
                usage[photo.photo_id].append(f"复查:{recheck_id}")

        return dict(sorted(usage.items()))

    def find_duplicate_photos(self, session: InspectionSession) -> Dict[str, List[str]]:
        hash_to_ids: Dict[str, List[str]] = {}

        for photo_id, photo in session.photos.items():
            if photo.file_hash:
                file_hash = photo.file_hash
            else:
                file_path = Path(photo.file_path)
                if not file_path.is_absolute():
                    file_path = self.base_path / file_path
                if file_path.exists():
                    file_hash = self._calculate_file_hash(file_path)
                else:
                    file_hash = stable_hash(photo.file_path)

            if file_hash not in hash_to_ids:
                hash_to_ids[file_hash] = []
            hash_to_ids[file_hash].append(photo_id)

        duplicates = {
            h: ids for h, ids in hash_to_ids.items()
            if len(ids) > 1
        }

        return dict(sorted(duplicates.items()))

    def get_photos_by_type(self, session: InspectionSession) -> Dict[str, List[PhotoEvidence]]:
        by_type: Dict[str, List[PhotoEvidence]] = {}

        for photo in session.photos.values():
            photo_type = photo.photo_type or "未分类"
            if photo_type not in by_type:
                by_type[photo_type] = []
            by_type[photo_type].append(photo)

        return {k: sorted(v, key=lambda p: p.photo_id) for k, v in sorted(by_type.items())}

    def get_unverified_photos(self, session: InspectionSession) -> List[str]:
        results = self.validate_all_photos(session)
        return [
            photo_id for photo_id, result in results.items()
            if not result.is_valid_image
        ]
