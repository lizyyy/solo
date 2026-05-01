import hashlib
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Optional, Any

from pydantic import BaseModel


class FontHashCalculator:
    @staticmethod
    def calculate_file_hash(file_path: Path, algorithm: str = "sha256") -> str:
        hash_obj = hashlib.new(algorithm)
        
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                hash_obj.update(chunk)
        
        return hash_obj.hexdigest()
    
    @staticmethod
    def calculate_string_hash(content: str, algorithm: str = "sha256") -> str:
        hash_obj = hashlib.new(algorithm)
        hash_obj.update(content.encode("utf-8"))
        return hash_obj.hexdigest()


class CacheEntry(BaseModel):
    key: str
    value: Any
    created_at: str
    expires_at: Optional[str] = None


class HashCache:
    CACHE_FILE_NAME = ".font-auditor-cache.json"
    
    def __init__(self, cache_dir: Path):
        self.cache_dir = cache_dir
        self.cache_file = cache_dir / self.CACHE_FILE_NAME
        self._cache: Dict[str, Any] = {}
        self._loaded = False
    
    def _load(self) -> None:
        if self._loaded:
            return
        
        if self.cache_file.exists():
            try:
                with open(self.cache_file, "r", encoding="utf-8") as f:
                    self._cache = json.load(f)
            except (json.JSONDecodeError, IOError):
                self._cache = {}
        
        self._loaded = True
    
    def _save(self) -> None:
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        with open(self.cache_file, "w", encoding="utf-8") as f:
            json.dump(self._cache, f, indent=2)
    
    def get(self, key: str) -> Optional[Any]:
        self._load()
        
        entry = self._cache.get(key)
        if entry is None:
            return None
        
        if isinstance(entry, dict) and "expires_at" in entry:
            expires_at = entry.get("expires_at")
            if expires_at:
                try:
                    expire_time = datetime.fromisoformat(expires_at)
                    if datetime.now() > expire_time:
                        del self._cache[key]
                        return None
                except ValueError:
                    pass
        
        if isinstance(entry, dict) and "value" in entry:
            return entry["value"]
        return entry
    
    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        self._load()
        
        entry = {
            "key": key,
            "value": value,
            "created_at": datetime.now().isoformat(),
        }
        
        if ttl_seconds:
            expires_at = datetime.now() + timedelta(seconds=ttl_seconds)
            entry["expires_at"] = expires_at.isoformat()
        
        self._cache[key] = entry
        self._save()
    
    def delete(self, key: str) -> bool:
        self._load()
        
        if key in self._cache:
            del self._cache[key]
            self._save()
            return True
        return False
    
    def clear(self) -> int:
        count = len(self._cache)
        self._cache = {}
        self._save()
        return count
    
    def get_or_set(self, key: str, value_provider, ttl_seconds: Optional[int] = None) -> Any:
        value = self.get(key)
        if value is not None:
            return value
        
        value = value_provider()
        self.set(key, value, ttl_seconds)
        return value
