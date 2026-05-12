import json
from pathlib import Path
from typing import Dict, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class CacheOperationResult:
    success: bool
    message: str
    value: Optional[str] = None
    error_details: Optional[str] = None


class MockCacheClient:
    def __init__(self, mock_cache_file: str):
        self.mock_cache_file = Path(mock_cache_file)
        self._cache: Dict[str, Dict[str, str]] = {}
        self._load()

    def _load(self):
        with open(self.mock_cache_file, 'r', encoding='utf-8') as f:
            self._cache = json.load(f)

    def _save(self):
        with open(self.mock_cache_file, 'w', encoding='utf-8') as f:
            json.dump(self._cache, f, ensure_ascii=False, indent=2)

    def ping(self, region_id: str) -> CacheOperationResult:
        if region_id not in self._cache:
            return CacheOperationResult(
                success=False,
                message=f"区域不可达: {region_id}",
                error_details=f"区域 {region_id} 不存在于缓存配置中"
            )
        return CacheOperationResult(
            success=True,
            message=f"区域 {region_id} 可达"
        )

    def get(self, region_id: str, cache_key: str) -> CacheOperationResult:
        if region_id not in self._cache:
            return CacheOperationResult(
                success=False,
                message=f"区域不可达: {region_id}",
                error_details=f"区域 {region_id} 不存在于缓存配置中"
            )
        
        region_cache = self._cache[region_id]
        if cache_key not in region_cache:
            return CacheOperationResult(
                success=True,
                message=f"键不存在: {cache_key}",
                value=None
            )
        
        return CacheOperationResult(
            success=True,
            message=f"获取成功",
            value=region_cache[cache_key]
        )

    def delete(self, region_id: str, cache_key: str) -> CacheOperationResult:
        if region_id not in self._cache:
            return CacheOperationResult(
                success=False,
                message=f"区域不可达: {region_id}",
                error_details=f"区域 {region_id} 不存在于缓存配置中"
            )
        
        region_cache = self._cache[region_id]
        if cache_key in region_cache:
            del region_cache[cache_key]
            self._save()
            return CacheOperationResult(
                success=True,
                message=f"删除成功: {cache_key}"
            )
        
        return CacheOperationResult(
            success=True,
            message=f"键不存在，无需删除: {cache_key}"
        )

    def set(self, region_id: str, cache_key: str, value: str) -> CacheOperationResult:
        if region_id not in self._cache:
            return CacheOperationResult(
                success=False,
                message=f"区域不可达: {region_id}",
                error_details=f"区域 {region_id} 不存在于缓存配置中"
            )
        
        self._cache[region_id][cache_key] = value
        self._save()
        return CacheOperationResult(
            success=True,
            message=f"设置成功: {cache_key}"
        )

    def get_all_regions(self) -> list:
        return list(self._cache.keys())

    def is_key_exists(self, region_id: str, cache_key: str) -> bool:
        if region_id not in self._cache:
            return False
        return cache_key in self._cache[region_id]
