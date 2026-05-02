import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Any, List

from .models import SubtitleFile


class CacheEntry:
    def __init__(self, file_path: Path, file_hash: str, last_modified: float, issues_data: List[Dict]):
        self.file_path = file_path
        self.file_hash = file_hash
        self.last_modified = last_modified
        self.issues_data = issues_data
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'file_path': str(self.file_path),
            'file_hash': self.file_hash,
            'last_modified': self.last_modified,
            'issues_data': self.issues_data
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CacheEntry':
        return cls(
            file_path=Path(data['file_path']),
            file_hash=data['file_hash'],
            last_modified=data['last_modified'],
            issues_data=data.get('issues_data', [])
        )


class CacheManager:
    DEFAULT_CACHE_DIR = '.subtitle-checker-cache'
    CACHE_FILENAME = 'check_cache.json'
    
    def __init__(self, cache_dir: Optional[Path] = None, config_hash: str = ''):
        self.cache_dir = cache_dir or Path.cwd() / self.DEFAULT_CACHE_DIR
        self.cache_file = self.cache_dir / self.CACHE_FILENAME
        self.config_hash = config_hash
        self._entries: Dict[str, CacheEntry] = {}
        self._stored_config_hash: str = ''
        self._loaded = False
    
    def _load(self) -> None:
        if self._loaded:
            return
        
        if not self.cache_file.exists():
            self._loaded = True
            return
        
        try:
            with open(self.cache_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            self._stored_config_hash = data.get('config_hash', '')
            
            entries_data = data.get('entries', {})
            for key, entry_data in entries_data.items():
                self._entries[key] = CacheEntry.from_dict(entry_data)
            
            self._loaded = True
        except (json.JSONDecodeError, KeyError):
            self._loaded = True
            self._entries = {}
            self._stored_config_hash = ''
    
    def _save(self) -> None:
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        data = {
            'config_hash': self.config_hash,
            'last_updated': datetime.now().isoformat(),
            'entries': {key: entry.to_dict() for key, entry in self._entries.items()}
        }
        
        with open(self.cache_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        self._stored_config_hash = self.config_hash
    
    @staticmethod
    def _get_file_hash(file_path: Path) -> str:
        hasher = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                hasher.update(chunk)
        return hasher.hexdigest()
    
    @staticmethod
    def _get_cache_key(file_path: Path) -> str:
        return str(file_path.resolve())
    
    def is_config_changed(self) -> bool:
        self._load()
        return self.config_hash != self._stored_config_hash
    
    def is_file_changed(self, file_path: Path) -> bool:
        self._load()
        
        key = self._get_cache_key(file_path)
        
        if key not in self._entries:
            return True
        
        entry = self._entries[key]
        
        if not file_path.exists():
            return True
        
        current_mtime = file_path.stat().st_mtime
        if current_mtime != entry.last_modified:
            return True
        
        current_hash = self._get_file_hash(file_path)
        return current_hash != entry.file_hash
    
    def should_recheck(self, file_path: Path) -> bool:
        if self.is_config_changed():
            return True
        
        return self.is_file_changed(file_path)
    
    def get_cached_issues(self, file_path: Path) -> Optional[List[Dict]]:
        self._load()
        
        if self.is_config_changed():
            return None
        
        if self.is_file_changed(file_path):
            return None
        
        key = self._get_cache_key(file_path)
        if key in self._entries:
            return self._entries[key].issues_data
        
        return None
    
    def cache_issues(self, file_path: Path, issues_data: List[Dict]) -> None:
        self._load()
        
        key = self._get_cache_key(file_path)
        file_hash = self._get_file_hash(file_path)
        last_modified = file_path.stat().st_mtime
        
        self._entries[key] = CacheEntry(
            file_path=file_path,
            file_hash=file_hash,
            last_modified=last_modified,
            issues_data=issues_data
        )
        
        self._save()
    
    def clear(self) -> None:
        self._entries = {}
        self._stored_config_hash = ''
        
        if self.cache_file.exists():
            self.cache_file.unlink()
        
        if self.cache_dir.exists() and not any(self.cache_dir.iterdir()):
            self.cache_dir.rmdir()
    
    def get_cache_stats(self) -> Dict[str, Any]:
        self._load()
        
        return {
            'total_entries': len(self._entries),
            'config_hash_current': self.config_hash,
            'config_hash_stored': self._stored_config_hash,
            'config_changed': self.is_config_changed(),
            'cache_file': str(self.cache_file)
        }
