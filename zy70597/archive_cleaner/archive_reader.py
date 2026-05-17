"""归档读取模块"""

import zipfile
import tarfile
import os
from pathlib import Path
from typing import List, Optional, Generator, Tuple
from datetime import datetime
import charset_normalizer
from .models import ArchiveInfo, FileEntry, PathIssueType


class ArchiveReader:
    """归档文件读取器"""
    
    SUPPORTED_FORMATS = {
        '.zip': 'zip',
        '.tar': 'tar',
        '.tar.gz': 'tar',
        '.tgz': 'tar',
        '.tar.bz2': 'tar',
        '.tbz2': 'tar',
    }
    
    def __init__(self, archive_path: str):
        self.archive_path = Path(archive_path)
        self.format = self._detect_format()
        self._file: Optional[object] = None
    
    def _detect_format(self) -> str:
        """检测归档格式"""
        path_str = str(self.archive_path).lower()
        for ext, fmt in self.SUPPORTED_FORMATS.items():
            if path_str.endswith(ext):
                return fmt
        raise ValueError(f"不支持的归档格式: {self.archive_path}")
    
    def __enter__(self):
        """打开归档文件"""
        if self.format == 'zip':
            self._file = zipfile.ZipFile(self.archive_path, 'r')
        elif self.format == 'tar':
            self._file = tarfile.open(self.archive_path, 'r:*')
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """关闭归档文件"""
        if self._file:
            self._file.close()
    
    def get_info(self) -> ArchiveInfo:
        """获取归档包信息"""
        stat = self.archive_path.stat()
        return ArchiveInfo(
            path=str(self.archive_path.absolute()),
            size_bytes=stat.st_size,
            file_count=len(list(self._list_names())),
            format=self.format,
            created_at=datetime.fromtimestamp(stat.st_ctime).isoformat(),
            modified_at=datetime.fromtimestamp(stat.st_mtime).isoformat()
        )
    
    def _list_names(self) -> Generator[str, None, None]:
        """列出归档中的所有文件名"""
        if self.format == 'zip':
            for name in self._file.namelist():
                yield name
        elif self.format == 'tar':
            for member in self._file.getmembers():
                yield member.name
    
    def _detect_encoding(self, name_bytes: bytes) -> Tuple[Optional[str], float]:
        """检测文件名编码"""
        result = charset_normalizer.from_bytes(name_bytes).best()
        if result:
            return result.encoding, result.confidence
        return None, 0.0
    
    def iter_entries(self) -> Generator[FileEntry, None, None]:
        """迭代所有文件条目"""
        if self.format == 'zip':
            for idx, info in enumerate(self._file.infolist()):
                issues = []
                encoding = None
                confidence = 0.0
                
                try:
                    name_bytes = info.filename.encode('cp437')
                    encoding, confidence = self._detect_encoding(name_bytes)
                except:
                    pass
                
                if info.flag_bits & 0x800:
                    encoding = 'utf-8'
                
                is_dir = info.filename.endswith('/')
                
                entry = FileEntry(
                    index=idx,
                    original_path=info.filename,
                    normalized_path=info.filename,
                    file_size=info.file_size,
                    is_directory=is_dir,
                    encoding_detected=encoding,
                    encoding_confidence=confidence,
                    issues=issues
                )
                yield entry
                
        elif self.format == 'tar':
            for idx, member in enumerate(self._file.getmembers()):
                entry = FileEntry(
                    index=idx,
                    original_path=member.name,
                    normalized_path=member.name,
                    file_size=member.size,
                    is_directory=member.isdir(),
                    issues=[]
                )
                yield entry
    
    def extract_file(self, member_name: str, dest_path: Path) -> None:
        """提取单个文件"""
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        
        if self.format == 'zip':
            with self._file.open(member_name) as source:
                with open(dest_path, 'wb') as target:
                    target.write(source.read())
        elif self.format == 'tar':
            member = self._file.getmember(member_name)
            source = self._file.extractfile(member)
            if source:
                with open(dest_path, 'wb') as target:
                    target.write(source.read())
