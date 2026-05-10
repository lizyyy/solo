import hashlib
import json
from typing import Dict, Any, Optional
from datetime import datetime


class CacheService:
    _instance = None
    _cache_store: Dict[str, Dict[str, Any]] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @staticmethod
    def _hash_value(value: Any) -> str:
        if isinstance(value, dict):
            value_str = json.dumps(value, sort_keys=True)
        else:
            value_str = str(value)
        return hashlib.sha256(value_str.encode()).hexdigest()

    def get(self, key: str) -> Optional[Any]:
        entry = self._cache_store.get(key)
        if not entry:
            return None
        if entry.get("expire_at") and datetime.utcnow() > entry["expire_at"]:
            del self._cache_store[key]
            return None
        return entry["value"]

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> str:
        expire_at = None
        if ttl_seconds:
            expire_at = datetime.utcnow().timestamp() + ttl_seconds
        value_hash = self._hash_value(value)
        self._cache_store[key] = {
            "value": value,
            "value_hash": value_hash,
            "expire_at": expire_at,
            "version": None
        }
        return value_hash

    def get_hash(self, key: str) -> Optional[str]:
        entry = self._cache_store.get(key)
        if not entry:
            return None
        if entry.get("expire_at") and datetime.utcnow() > entry["expire_at"]:
            del self._cache_store[key]
            return None
        return entry.get("value_hash")

    def delete(self, key: str) -> bool:
        if key in self._cache_store:
            del self._cache_store[key]
            return True
        return False

    def exists(self, key: str) -> bool:
        return self.get(key) is not None

    def clear_all(self):
        self._cache_store.clear()

    def get_all_keys(self) -> list:
        return list(self._cache_store.keys())


cache_service = CacheService()
