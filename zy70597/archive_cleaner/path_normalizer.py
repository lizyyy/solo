"""路径规范化模块"""

import os
import re
from pathlib import Path
from typing import List
from .models import FileEntry, PathIssueType, PurificationRules


class PathNormalizer:
    """路径规范化处理器"""
    
    CHINESE_SPACE = '\u3000'
    SPECIAL_CHARS = r'[<>:"|?*]'
    
    def __init__(self, rules: PurificationRules = None):
        self.rules = rules or PurificationRules()
    
    def normalize_path(self, entry: FileEntry) -> FileEntry:
        """规范化单条路径"""
        path = entry.original_path
        issues: List[PathIssueType] = []
        
        if self.rules.remove_absolute:
            if os.path.isabs(path) or path.startswith('/') or (len(path) > 1 and path[1] == ':'):
                issues.append(PathIssueType.ABSOLUTE_PATH)
                path = self._remove_absolute(path)
        
        if self.rules.normalize_separators:
            path = path.replace('\\', '/')
        
        if self.rules.replace_chinese_spaces:
            if self.CHINESE_SPACE in path:
                issues.append(PathIssueType.CHINESE_SPACE)
                path = path.replace(self.CHINESE_SPACE, '_')
        
        if self.rules.replace_spaces:
            if ' ' in path:
                issues.append(PathIssueType.NORMAL_SPACE)
                path = path.replace(' ', '_')
        
        special_matches = re.findall(self.SPECIAL_CHARS, path)
        if special_matches:
            issues.append(PathIssueType.SPECIAL_CHARACTER)
            path = re.sub(self.SPECIAL_CHARS, '_', path)
        
        path = self._clean_path(path)
        
        entry.normalized_path = path
        entry.issues.extend(issues)
        
        return entry
    
    def _remove_absolute(self, path: str) -> str:
        """移除绝对路径前缀"""
        if path.startswith('/'):
            path = path.lstrip('/')
        elif len(path) > 1 and path[1] == ':':
            path = path[2:].lstrip('/\\')
        
        parts = path.split('/')
        parts = [p for p in parts if p not in ('.', '..', '')]
        return '/'.join(parts)
    
    def _clean_path(self, path: str) -> str:
        """清理路径，移除危险组件"""
        parts = []
        for part in path.split('/'):
            if part == '..':
                if parts:
                    parts.pop()
            elif part and part != '.':
                if len(part) > self.rules.max_filename_length:
                    name, ext = os.path.splitext(part)
                    part = name[:self.rules.max_filename_length - len(ext)] + ext
                parts.append(part)
        return '/'.join(parts)
    
    def normalize_all(self, entries: List[FileEntry]) -> List[FileEntry]:
        """批量规范化所有路径"""
        return [self.normalize_path(entry) for entry in entries]
