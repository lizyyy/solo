"""重复文件检测模块"""

import hashlib
from pathlib import Path
from typing import List, Dict, Optional
from collections import defaultdict
from .models import FileEntry, DuplicateGroup, PathIssueType


class DuplicateDetector:
    """重复文件检测器"""
    
    def __init__(self, strategy: str = "index_suffix"):
        self.strategy = strategy
        self.groups: List[DuplicateGroup] = []
    
    def detect_by_path(self, entries: List[FileEntry]) -> List[DuplicateGroup]:
        """按规范化路径检测重复"""
        path_map: Dict[str, List[FileEntry]] = defaultdict(list)
        
        for entry in entries:
            if not entry.is_directory:
                normalized = entry.normalized_path
                path_map[normalized].append(entry)
        
        groups = []
        for normalized, files in path_map.items():
            if len(files) > 1:
                group = DuplicateGroup(
                    group_id=self._generate_group_id(normalized),
                    normalized_name=normalized,
                    files=files
                )
                groups.append(group)
        
        return groups
    
    def detect_by_content(self, entries: List[FileEntry], archive_reader) -> List[DuplicateGroup]:
        """按文件内容检测重复"""
        hash_map: Dict[str, List[FileEntry]] = defaultdict(list)
        
        for entry in entries:
            if not entry.is_directory and entry.file_size > 0:
                try:
                    content_hash = self._hash_file_content(archive_reader, entry.original_path)
                    hash_map[content_hash].append(entry)
                except Exception as e:
                    entry.error_message = str(e)
        
        groups = []
        for content_hash, files in hash_map.items():
            if len(files) > 1:
                group = DuplicateGroup(
                    group_id=content_hash[:16],
                    normalized_name=files[0].normalized_path,
                    files=files
                )
                groups.append(group)
        
        return groups
    
    def _hash_file_content(self, archive_reader, member_name: str) -> str:
        """计算文件内容哈希"""
        hasher = hashlib.md5()
        if archive_reader.format == 'zip':
            with archive_reader._file.open(member_name) as f:
                while chunk := f.read(8192):
                    hasher.update(chunk)
        else:
            member = archive_reader._file.getmember(member_name)
            f = archive_reader._file.extractfile(member)
            if f:
                while chunk := f.read(8192):
                    hasher.update(chunk)
        return hasher.hexdigest()
    
    def _generate_group_id(self, path: str) -> str:
        """生成重复组ID"""
        return hashlib.md5(path.encode('utf-8')).hexdigest()[:12]
    
    def resolve_duplicates(self, groups: List[DuplicateGroup]) -> None:
        """解决重复文件名冲突"""
        for group in groups:
            for idx, entry in enumerate(group.files):
                entry.duplicate_group = group.group_id
                entry.duplicate_index = idx
                
                if idx > 0:
                    if PathIssueType.DUPLICATE not in entry.issues:
                        entry.issues.append(PathIssueType.DUPLICATE)
                    
                    if self.strategy == "index_suffix":
                        base, ext = self._split_ext(entry.normalized_path)
                        entry.normalized_path = f"{base}_{idx+1}{ext}"
    
    def _split_ext(self, path: str) -> tuple:
        """分离文件名和扩展名"""
        if '.' in path.split('/')[-1]:
            parts = path.rsplit('.', 1)
            return parts[0], '.' + parts[1]
        return path, ''
