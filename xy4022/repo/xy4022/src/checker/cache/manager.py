"""缓存管理器"""

import json
import os
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, List, Any
from hashlib import sha256

from checker.config.models import Config
from checker.utils.helpers import compute_sha256, get_file_size


@dataclass
class FileCacheEntry:
    """单个文件的缓存条目"""
    file_path: str
    relative_path: str
    last_modified: float  # 时间戳
    file_size: int
    sha256: str
    cached_at: float = field(default_factory=lambda: datetime.now().timestamp())


@dataclass
class ScanCache:
    """完整扫描缓存"""
    version: str = "1.0"
    created_at: float = field(default_factory=lambda: datetime.now().timestamp())
    config_hash: str = ""
    ignore_patterns_hash: str = ""
    files: Dict[str, FileCacheEntry] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": self.version,
            "created_at": self.created_at,
            "config_hash": self.config_hash,
            "ignore_patterns_hash": self.ignore_patterns_hash,
            "files": {
                rel_path: asdict(entry)
                for rel_path, entry in self.files.items()
            }
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ScanCache":
        cache = cls(
            version=data.get("version", "1.0"),
            created_at=data.get("created_at", datetime.now().timestamp()),
            config_hash=data.get("config_hash", ""),
            ignore_patterns_hash=data.get("ignore_patterns_hash", "")
        )
        
        files_data = data.get("files", {})
        for rel_path, entry_data in files_data.items():
            cache.files[rel_path] = FileCacheEntry(
                file_path=entry_data["file_path"],
                relative_path=entry_data["relative_path"],
                last_modified=entry_data["last_modified"],
                file_size=entry_data["file_size"],
                sha256=entry_data["sha256"],
                cached_at=entry_data.get("cached_at", cache.created_at)
            )
        
        return cache


class CacheManager:
    """缓存管理器"""
    
    CACHE_FILE = "scan_cache.json"
    
    def __init__(self, config: Config):
        self.config = config
        self.cache_dir = Path(config.cache_dir)
        self.cache_file = self.cache_dir / self.CACHE_FILE
        self._cache: Optional[ScanCache] = None
    
    def init_cache_dir(self):
        """初始化缓存目录"""
        self.cache_dir.mkdir(parents=True, exist_ok=True)
    
    def load_cache(self) -> ScanCache:
        """加载缓存"""
        if self._cache is not None:
            return self._cache
        
        if not self.cache_file.exists():
            self._cache = ScanCache()
            return self._cache
        
        try:
            with open(self.cache_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            self._cache = ScanCache.from_dict(data)
        except (json.JSONDecodeError, KeyError):
            self._cache = ScanCache()
        
        return self._cache
    
    def save_cache(self, cache: Optional[ScanCache] = None):
        """保存缓存"""
        self.init_cache_dir()
        
        if cache is None:
            cache = self._cache if self._cache else ScanCache()
        
        with open(self.cache_file, 'w', encoding='utf-8') as f:
            json.dump(cache.to_dict(), f, ensure_ascii=False, indent=2)
    
    def compute_config_hash(self) -> str:
        """计算配置的哈希值"""
        config_data = {
            "root_dir": str(self.config.root_dir),
            "dist_dir": str(self.config.dist_dir),
            "large_file_threshold": self.config.large_file_threshold,
        }
        content = json.dumps(config_data, sort_keys=True)
        return sha256(content.encode('utf-8')).hexdigest()
    
    def compute_ignore_patterns_hash(self) -> str:
        """计算忽略规则的哈希值"""
        patterns = sorted(self.config.ignore_patterns)
        content = json.dumps(patterns, sort_keys=True)
        return sha256(content.encode('utf-8')).hexdigest()
    
    def is_cache_valid(self) -> bool:
        """检查缓存是否有效
        
        缓存无效的情况：
        1. 配置已更改
        2. 忽略规则已更改
        3. 缓存文件不存在
        """
        cache = self.load_cache()
        
        current_config_hash = self.compute_config_hash()
        current_ignore_hash = self.compute_ignore_patterns_hash()
        
        if cache.config_hash != current_config_hash:
            return False
        
        if cache.ignore_patterns_hash != current_ignore_hash:
            return False
        
        return True
    
    def is_file_cached(self, relative_path: str, full_path: str) -> bool:
        """检查文件是否有缓存且未变更"""
        cache = self.load_cache()
        
        if relative_path not in cache.files:
            return False
        
        cached = cache.files[relative_path]
        
        # 检查文件是否存在
        if not os.path.exists(full_path):
            return False
        
        # 检查修改时间和大小（快速检查）
        current_mtime = os.path.getmtime(full_path)
        current_size = os.path.getsize(full_path)
        
        if cached.last_modified != current_mtime:
            return False
        
        if cached.file_size != current_size:
            return False
        
        # 快速检查通过，但为了确保准确性，再检查哈希
        # 如果快速检查通过，哈希检查可以跳过以提高性能
        # 这里我们假设快速检查足够
        return True
    
    def update_file_cache(self, relative_path: str, full_path: str) -> FileCacheEntry:
        """更新文件缓存"""
        cache = self.load_cache()
        
        if not os.path.exists(full_path):
            if relative_path in cache.files:
                del cache.files[relative_path]
            self.save_cache()
            raise FileNotFoundError(f"File not found: {full_path}")
        
        mtime = os.path.getmtime(full_path)
        size = os.path.getsize(full_path)
        file_hash = compute_sha256(full_path)
        
        entry = FileCacheEntry(
            file_path=full_path,
            relative_path=relative_path,
            last_modified=mtime,
            file_size=size,
            sha256=file_hash
        )
        
        cache.files[relative_path] = entry
        self.save_cache()
        
        return entry
    
    def mark_full_scan(self, files_to_cache: Dict[str, str]):
        """标记完整扫描，更新所有缓存信息
        
        Args:
            files_to_cache: Dict[relative_path, full_path]
        """
        cache = ScanCache()
        cache.config_hash = self.compute_config_hash()
        cache.ignore_patterns_hash = self.compute_ignore_patterns_hash()
        
        for rel_path, full_path in files_to_cache.items():
            if os.path.exists(full_path):
                mtime = os.path.getmtime(full_path)
                size = os.path.getsize(full_path)
                file_hash = compute_sha256(full_path)
                
                cache.files[rel_path] = FileCacheEntry(
                    file_path=full_path,
                    relative_path=rel_path,
                    last_modified=mtime,
                    file_size=size,
                    sha256=file_hash
                )
        
        self._cache = cache
        self.save_cache()
    
    def get_cached_files(self) -> Dict[str, FileCacheEntry]:
        """获取所有缓存的文件"""
        cache = self.load_cache()
        return dict(cache.files)
    
    def clear_cache(self):
        """清除缓存"""
        if self.cache_file.exists():
            self.cache_file.unlink()
        self._cache = None
    
    def get_file_hash(self, relative_path: str) -> Optional[str]:
        """获取缓存的文件哈希"""
        cache = self.load_cache()
        if relative_path in cache.files:
            return cache.files[relative_path].sha256
        return None
