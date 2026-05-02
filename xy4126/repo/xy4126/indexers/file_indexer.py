import os
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Set
from uuid import uuid4

from models import FileEntry, FileCategory, PackageEvidence


@dataclass
class IndexResult:
    total_files: int = 0
    indexed_files: int = 0
    failed_files: int = 0
    packages_count: int = 0
    unclassified_files: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    files: Dict[str, FileEntry] = field(default_factory=dict)
    packages: Dict[str, PackageEvidence] = field(default_factory=dict)


class WaybillExtractor:
    WAYBILL_PATTERNS = [
        (re.compile(r'(SF|sf)[-_\s]?(\d{12,})'), 'SF'),
        (re.compile(r'(YT|yt|圆通)[-_\s]?(\d{10,})'), 'YT'),
        (re.compile(r'(ZT|zt|中通)[-_\s]?(\d{10,})'), 'ZT'),
        (re.compile(r'(JD|jd|京东)[-_\s]?(\d{10,})'), 'JD'),
        (re.compile(r'(YZ|yz|EMS|ems|邮政)[-_\s]?(\d{9,})'), 'YZ'),
        (re.compile(r'(77\d{11,}|73\d{11,}|46\d{11,}|88\d{11,}|99\d{11,})'), 'STO'),
        (re.compile(r'(39\d{11,}|46\d{11,}|16\d{11,}|19\d{11,})'), 'YD'),
        (re.compile(r'(95\d{11,}|96\d{11,}|97\d{11,}|98\d{11,})'), 'YZ'),
        (re.compile(r'[A-Z]{2}\d{13,}'), 'International'),
    ]
    
    LOOSE_PATTERN = re.compile(r'(\d{10,})')
    
    KEYWORDS = [
        '运单', '运单号', '快递单号', '快递',
        'waybill', 'tracking', 'tracking_number',
        '单号', '物流号', '物流单号'
    ]
    
    @classmethod
    def extract(cls, text: str) -> Optional[str]:
        text_lower = text.lower()
        
        for pattern, prefix in cls.WAYBILL_PATTERNS:
            match = pattern.search(text)
            if match:
                if len(match.groups()) == 2:
                    return f"{match.group(1)}{match.group(2)}"
                else:
                    return match.group(0)
        
        has_keyword = any(kw.lower() in text_lower for kw in cls.KEYWORDS)
        if has_keyword:
            match = cls.LOOSE_PATTERN.search(text)
            if match:
                return match.group(1)
        
        return None
    
    @classmethod
    def extract_all(cls, text: str) -> List[str]:
        results = []
        seen = set()
        
        for pattern, prefix in cls.WAYBILL_PATTERNS:
            for match in pattern.finditer(text):
                if len(match.groups()) == 2:
                    waybill = f"{match.group(1)}{match.group(2)}"
                else:
                    waybill = match.group(0)
                if waybill not in seen:
                    seen.add(waybill)
                    results.append(waybill)
        
        has_keyword = any(kw.lower() in text.lower() for kw in cls.KEYWORDS)
        if has_keyword:
            for match in cls.LOOSE_PATTERN.finditer(text):
                waybill = match.group(1)
                if waybill not in seen:
                    seen.add(waybill)
                    results.append(waybill)
        
        return results


class FileClassifier:
    IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'}
    DOCUMENT_EXTENSIONS = {'.csv', '.json', '.txt', '.pdf', '.doc', '.docx', '.xls', '.xlsx'}
    
    CATEGORY_KEYWORDS = {
        FileCategory.WAYBILL_PHOTO: [
            'waybill', '面单', '运单', '快递单', '电子面单',
            'wb_', 'waybill_', '面单照片', '快递单照片'
        ],
        FileCategory.PACKAGE_PHOTO: [
            'package', '包裹', '包装', '外箱', '箱子',
            'pkg_', '包裹照片', '外箱照片'
        ],
        FileCategory.DAMAGE_PHOTO: [
            'damage', '破损', '损坏', '凹陷', '变形', '湿', '泡水',
            '破损照片', '损坏照片', '问题件'
        ],
        FileCategory.NOTE_CSV: [
            'note', 'remark', '备注', '客服', '客服备注', '记录',
            '备注表', '登记表'
        ],
        FileCategory.CLAIM_FORM: [
            'claim', '赔付', '理赔', '索赔', '申请', '赔偿',
            '赔付申请', '理赔申请', '索赔申请表'
        ],
    }
    
    @classmethod
    def classify(cls, filename: str, content_preview: str = "") -> FileCategory:
        name_lower = filename.lower()
        preview_lower = content_preview.lower()
        
        for category, keywords in cls.CATEGORY_KEYWORDS.items():
            for kw in keywords:
                kw_lower = kw.lower()
                if kw_lower in name_lower or kw_lower in preview_lower:
                    return category
        
        ext = Path(filename).suffix.lower()
        if ext in cls.IMAGE_EXTENSIONS:
            return FileCategory.PACKAGE_PHOTO
        elif ext == '.csv':
            return FileCategory.NOTE_CSV
        elif ext in {'.json', '.txt'}:
            return FileCategory.OTHER
        
        return FileCategory.UNKNOWN
    
    @classmethod
    def is_image(cls, filename: str) -> bool:
        ext = Path(filename).suffix.lower()
        return ext in cls.IMAGE_EXTENSIONS
    
    @classmethod
    def is_csv(cls, filename: str) -> bool:
        return Path(filename).suffix.lower() == '.csv'


class FileIndexer:
    def __init__(self):
        self.waybill_extractor = WaybillExtractor()
        self.classifier = FileClassifier()
    
    def scan_directory(
        self,
        directory: str,
        recursive: bool = True,
        exclude_patterns: List[str] = None
    ) -> IndexResult:
        result = IndexResult()
        exclude_patterns = exclude_patterns or ['.DS_Store', '__pycache__', '.git', 'sessions', 'exports']
        
        dir_path = Path(directory)
        if not dir_path.exists():
            result.errors.append(f"目录不存在: {directory}")
            return result
        
        if not dir_path.is_dir():
            result.errors.append(f"路径不是目录: {directory}")
            return result
        
        files_to_process = []
        if recursive:
            for root, dirs, files in os.walk(dir_path):
                dirs[:] = [d for d in dirs if d not in exclude_patterns]
                for filename in files:
                    if filename in exclude_patterns:
                        continue
                    files_to_process.append(Path(root) / filename)
        else:
            for item in dir_path.iterdir():
                if item.is_file() and item.name not in exclude_patterns:
                    files_to_process.append(item)
        
        result.total_files = len(files_to_process)
        
        all_packages: Dict[str, PackageEvidence] = {}
        waybill_to_files: Dict[str, List[FileEntry]] = {}
        
        for file_path in files_to_process:
            try:
                file_entry = self._index_file(file_path)
                if file_entry:
                    result.files[file_entry.file_id] = file_entry
                    
                    if file_entry.waybill_number:
                        if file_entry.waybill_number not in waybill_to_files:
                            waybill_to_files[file_entry.waybill_number] = []
                        waybill_to_files[file_entry.waybill_number].append(file_entry)
                    else:
                        result.unclassified_files.append(str(file_path))
                    
                    result.indexed_files += 1
                else:
                    result.failed_files += 1
                    
            except Exception as e:
                result.errors.append(f"处理文件 {file_path} 时出错: {str(e)}")
                result.failed_files += 1
        
        for waybill_number, files in waybill_to_files.items():
            package = PackageEvidence(waybill_number=waybill_number)
            for file_entry in files:
                self._assign_file_to_package(package, file_entry)
            all_packages[waybill_number] = package
        
        result.packages = all_packages
        result.packages_count = len(all_packages)
        
        return result
    
    def _index_file(self, file_path: Path) -> Optional[FileEntry]:
        if not file_path.exists() or not file_path.is_file():
            return None
        
        stat = file_path.stat()
        filename = file_path.name
        extension = file_path.suffix.lower()
        
        created_at = datetime.fromtimestamp(stat.st_birthtime) if hasattr(stat, 'st_birthtime') else None
        modified_at = datetime.fromtimestamp(stat.st_mtime)
        
        category = self.classifier.classify(filename)
        
        waybill_number = self.waybill_extractor.extract(filename)
        
        exif_timestamp = None
        if self.classifier.is_image(filename):
            exif_timestamp = self._try_extract_exif_timestamp(file_path)
        
        file_id = f"file_{uuid4().hex[:12]}"
        
        return FileEntry(
            file_id=file_id,
            file_path=str(file_path),
            filename=filename,
            file_size=stat.st_size,
            extension=extension,
            category=category,
            waybill_number=waybill_number,
            created_at=created_at,
            modified_at=modified_at,
            exif_timestamp=exif_timestamp,
            metadata={
                "indexed_at": datetime.now().isoformat(),
                "source_path": str(file_path.parent)
            }
        )
    
    def _try_extract_exif_timestamp(self, file_path: Path) -> Optional[datetime]:
        try:
            from PIL import Image
            from PIL.ExifTags import TAGS
            
            img = Image.open(file_path)
            exif_data = img._getexif()
            
            if not exif_data:
                return None
            
            for tag_id, value in exif_data.items():
                tag = TAGS.get(tag_id, tag_id)
                if tag in ['DateTimeOriginal', 'DateTimeDigitized', 'DateTime']:
                    try:
                        return datetime.strptime(str(value), '%Y:%m:%d %H:%M:%S')
                    except (ValueError, TypeError):
                        continue
        except Exception:
            pass
        
        return None
    
    def _assign_file_to_package(self, package: PackageEvidence, file_entry: FileEntry):
        category = file_entry.category
        
        if category == FileCategory.WAYBILL_PHOTO:
            package.waybill_photos.append(file_entry)
        elif category == FileCategory.PACKAGE_PHOTO:
            package.package_photos.append(file_entry)
        elif category == FileCategory.DAMAGE_PHOTO:
            package.damage_photos.append(file_entry)
        elif category in [FileCategory.UNKNOWN, FileCategory.OTHER]:
            if file_entry.extension in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp']:
                package.photos.append(file_entry)
            else:
                package.photos.append(file_entry)
