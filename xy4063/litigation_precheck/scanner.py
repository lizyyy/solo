import hashlib
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass, asdict, field

try:
    from PyPDF2 import PdfReader
    HAS_PYPDF2 = True
except ImportError:
    HAS_PYPDF2 = False


@dataclass
class FileInfo:
    file_path: str
    file_name: str
    extension: str
    file_size: int
    created_time: str
    modified_time: str
    file_hash: str
    page_count: Optional[int] = None
    material_type: Optional[str] = None
    evidence_number: Optional[int] = None
    is_signature_page_marked: Optional[bool] = None
    issues: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Manifest:
    scan_time: str
    total_files: int
    total_size: int
    files: List[FileInfo] = field(default_factory=list)
    directories: List[str] = field(default_factory=list)
    scan_config: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "scan_time": self.scan_time,
            "total_files": self.total_files,
            "total_size": self.total_size,
            "files": [f.to_dict() for f in self.files],
            "directories": self.directories,
            "scan_config": self.scan_config
        }


class FileScanner:
    def __init__(self, scan_config: Dict[str, Any]):
        self.scan_config = scan_config
        self.allowed_extensions = set(scan_config.get("allowed_extensions", []))
        self.ignore_patterns = scan_config.get("ignore_patterns", [])
        self.recursive = scan_config.get("recursive", True)
    
    def _should_ignore(self, file_path: Path) -> bool:
        file_name = file_path.name
        for pattern in self.ignore_patterns:
            if pattern.startswith("*"):
                suffix = pattern[1:]
                if file_name.endswith(suffix):
                    return True
            elif pattern.endswith("*"):
                prefix = pattern[:-1]
                if file_name.startswith(prefix):
                    return True
            elif file_name == pattern:
                return True
        return False
    
    def _is_allowed_extension(self, file_path: Path) -> bool:
        if not self.allowed_extensions:
            return True
        suffix = file_path.suffix
        return suffix in self.allowed_extensions
    
    @staticmethod
    def calculate_file_hash(file_path: Path, algorithm: str = "sha256") -> str:
        hash_obj = hashlib.new(algorithm)
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                hash_obj.update(chunk)
        return hash_obj.hexdigest()
    
    @staticmethod
    def get_pdf_page_count(file_path: Path) -> Optional[int]:
        if not HAS_PYPDF2:
            return None
        try:
            reader = PdfReader(str(file_path))
            return len(reader.pages)
        except Exception:
            return None
    
    @staticmethod
    def get_file_info(file_path: Path) -> Tuple[int, str, str]:
        stat = file_path.stat()
        file_size = stat.st_size
        created_time = datetime.fromtimestamp(stat.st_birthtime).isoformat() if hasattr(stat, 'st_birthtime') else datetime.fromtimestamp(stat.st_mtime).isoformat()
        modified_time = datetime.fromtimestamp(stat.st_mtime).isoformat()
        return file_size, created_time, modified_time
    
    def scan_file(self, file_path: Path, base_path: Path) -> FileInfo:
        relative_path = str(file_path.relative_to(base_path))
        file_name = file_path.name
        extension = file_path.suffix
        
        file_size, created_time, modified_time = self.get_file_info(file_path)
        file_hash = self.calculate_file_hash(file_path)
        
        page_count = None
        if extension.lower() == ".pdf":
            page_count = self.get_pdf_page_count(file_path)
        
        evidence_number = self._extract_evidence_number(file_name)
        material_type = self._detect_material_type(file_name)
        
        return FileInfo(
            file_path=relative_path,
            file_name=file_name,
            extension=extension,
            file_size=file_size,
            created_time=created_time,
            modified_time=modified_time,
            file_hash=file_hash,
            page_count=page_count,
            evidence_number=evidence_number,
            material_type=material_type,
            issues=[]
        )
    
    def _extract_evidence_number(self, file_name: str) -> Optional[int]:
        patterns = [
            r"证据(\d+)",
            r"证据[零一二三四五六七八九十百]+",
            r"^(\d+)[-_]",
            r"[_\-](\d+)[_\-]",
        ]
        for pattern in patterns:
            match = re.search(pattern, file_name)
            if match:
                num_str = match.group(1)
                if num_str.isdigit():
                    return int(num_str)
                else:
                    return self._chinese_to_arabic(num_str)
        return None
    
    def _chinese_to_arabic(self, chinese_num: str) -> Optional[int]:
        mapping = {
            "零": 0, "一": 1, "二": 2, "三": 3, "四": 4,
            "五": 5, "六": 6, "七": 7, "八": 8, "九": 9,
            "十": 10, "百": 100
        }
        
        if not chinese_num:
            return None
        
        result = 0
        temp = 0
        
        for char in chinese_num:
            if char in mapping:
                value = mapping[char]
                if value == 10:
                    if temp == 0:
                        temp = 1
                    result += temp * 10
                    temp = 0
                elif value == 100:
                    if temp == 0:
                        temp = 1
                    result += temp * 100
                    temp = 0
                else:
                    temp = value
            else:
                return None
        
        result += temp
        return result if result > 0 else None
    
    def _detect_material_type(self, file_name: str) -> Optional[str]:
        file_lower = file_name.lower()
        
        if re.search(r"起诉状", file_name) or re.search(r"起诉书", file_name):
            return "COMPLAINT"
        elif re.search(r"授权委托书", file_name):
            return "POA"
        elif re.search(r"证据目录", file_name) and (file_lower.endswith(".csv") or file_lower.endswith(".xlsx") or file_lower.endswith(".xls")):
            return "EVIDENCE_LIST"
        elif re.search(r"送达地址确认书", file_name):
            return "ADDRESS_CONFIRM"
        elif re.search(r"证据\d+", file_name) or re.search(r"^[一二三四五六七八九十百]+[、\.]", file_name):
            return "EVIDENCE"
        elif re.search(r"(身份证|营业执照|身份证明)", file_name):
            return "IDENTITY"
        
        return None
    
    def scan_directory(self, directory_path: Path) -> Manifest:
        files: List[FileInfo] = []
        directories: List[str] = []
        total_size = 0
        
        pattern = "**/*" if self.recursive else "*"
        
        for item in directory_path.glob(pattern):
            if item.is_file():
                if self._should_ignore(item):
                    continue
                if not self._is_allowed_extension(item):
                    continue
                
                file_info = self.scan_file(item, directory_path)
                files.append(file_info)
                total_size += file_info.file_size
            elif item.is_dir():
                relative_path = str(item.relative_to(directory_path))
                if relative_path:
                    directories.append(relative_path)
        
        return Manifest(
            scan_time=datetime.now().isoformat(),
            total_files=len(files),
            total_size=total_size,
            files=files,
            directories=sorted(directories),
            scan_config=self.scan_config
        )


class ManifestManager:
    @staticmethod
    def save_manifest(manifest: Manifest, output_path: Path) -> None:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(manifest.to_dict(), f, ensure_ascii=False, indent=2)
    
    @staticmethod
    def load_manifest(manifest_path: Path) -> Manifest:
        with open(manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        files = []
        for file_data in data.get("files", []):
            files.append(FileInfo(**file_data))
        
        return Manifest(
            scan_time=data.get("scan_time", ""),
            total_files=data.get("total_files", 0),
            total_size=data.get("total_size", 0),
            files=files,
            directories=data.get("directories", []),
            scan_config=data.get("scan_config", {})
        )
