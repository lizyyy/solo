from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Optional

from .models import CacheEntry, CacheLayer, CachePolicy


class BloomFilter:
    def __init__(self, size: int = 10000, hash_count: int = 3):
        self.size = size
        self.hash_count = hash_count
        self.bit_array = [False] * size

    def _hashes(self, key: str) -> list[int]:
        results = []
        for i in range(self.hash_count):
            h = hash(f"{key}:{i}") % self.size
            results.append(h)
        return results

    def add(self, key: str) -> None:
        for h in self._hashes(key):
            self.bit_array[h] = True

    def might_contain(self, key: str) -> bool:
        for h in self._hashes(key):
            if not self.bit_array[h]:
                return False
        return True


class MutexLock:
    def __init__(self):
        self.locks: dict[str, bool] = {}

    def acquire(self, key: str) -> bool:
        if self.locks.get(key, False):
            return False
        self.locks[key] = True
        return True

    def release(self, key: str) -> None:
        self.locks[key] = False


@dataclass
class LocalCache:
    policy: CachePolicy
    entries: dict[str, CacheEntry] = field(default_factory=dict)
    bloom_filter: Optional[BloomFilter] = None
    mutex_lock: Optional[MutexLock] = None

    def __post_init__(self):
        if self.policy.bloom_filter_enabled:
            self.bloom_filter = BloomFilter()
        if self.policy.mutex_lock_enabled:
            self.mutex_lock = MutexLock()

    def _calculate_expiry(self, base_time: datetime) -> datetime:
        ttl = self.policy.ttl_seconds
        jitter = random.randint(0, self.policy.ttl_jitter_seconds)
        return base_time + timedelta(seconds=ttl + jitter)

    def get(self, key: str, at_time: datetime) -> tuple[Optional[CacheEntry], bool]:
        if self.bloom_filter and not self.bloom_filter.might_contain(key):
            return None, False

        if key not in self.entries:
            return None, False

        entry = self.entries[key]
        if entry.is_expired(at_time):
            del self.entries[key]
            return None, False

        entry.last_accessed = at_time
        entry.access_count += 1
        return entry, True

    def set(self, key: str, value: Any, at_time: datetime, version: int = 1) -> CacheEntry:
        entry = CacheEntry(
            key=key,
            value=value,
            layer=CacheLayer.LOCAL,
            created_at=at_time,
            expires_at=self._calculate_expiry(at_time),
            last_accessed=at_time,
            access_count=0,
            version=version,
        )
        self.entries[key] = entry
        if self.bloom_filter:
            self.bloom_filter.add(key)
        return entry

    def delete(self, key: str) -> bool:
        if key in self.entries:
            del self.entries[key]
            return True
        return False

    def warmup(self, keys: list[str], values: dict[str, Any], at_time: datetime) -> None:
        for key in keys:
            if key in values:
                self.set(key, values[key], at_time)


@dataclass
class RedisCache:
    policy: CachePolicy
    entries: dict[str, CacheEntry] = field(default_factory=dict)
    bloom_filter: Optional[BloomFilter] = None
    mutex_lock: Optional[MutexLock] = None

    def __post_init__(self):
        if self.policy.bloom_filter_enabled:
            self.bloom_filter = BloomFilter()
        if self.policy.mutex_lock_enabled:
            self.mutex_lock = MutexLock()

    def _calculate_expiry(self, base_time: datetime) -> datetime:
        ttl = self.policy.ttl_seconds
        jitter = random.randint(0, self.policy.ttl_jitter_seconds)
        return base_time + timedelta(seconds=ttl + jitter)

    def get(self, key: str, at_time: datetime) -> tuple[Optional[CacheEntry], bool]:
        if self.bloom_filter and not self.bloom_filter.might_contain(key):
            return None, False

        if key not in self.entries:
            return None, False

        entry = self.entries[key]
        if entry.is_expired(at_time):
            del self.entries[key]
            return None, False

        entry.last_accessed = at_time
        entry.access_count += 1
        return entry, True

    def set(self, key: str, value: Any, at_time: datetime, version: int = 1) -> CacheEntry:
        entry = CacheEntry(
            key=key,
            value=value,
            layer=CacheLayer.REDIS,
            created_at=at_time,
            expires_at=self._calculate_expiry(at_time),
            last_accessed=at_time,
            access_count=0,
            version=version,
        )
        self.entries[key] = entry
        if self.bloom_filter:
            self.bloom_filter.add(key)
        return entry

    def delete(self, key: str) -> bool:
        if key in self.entries:
            del self.entries[key]
            return True
        return False

    def warmup(self, keys: list[str], values: dict[str, Any], at_time: datetime) -> None:
        for key in keys:
            if key in values:
                self.set(key, values[key], at_time)


@dataclass
class Database:
    data: dict[str, tuple[Any, int, datetime]] = field(default_factory=dict)
    version_counter: int = 0

    def get(self, key: str) -> tuple[Optional[Any], int]:
        if key not in self.data:
            return None, 0
        value, version, _ = self.data[key]
        return value, version

    def set(self, key: str, value: Any, at_time: datetime) -> int:
        self.version_counter += 1
        self.data[key] = (value, self.version_counter, at_time)
        return self.version_counter

    def delete(self, key: str) -> bool:
        if key in self.data:
            del self.data[key]
            return True
        return False

    def get_version(self, key: str) -> int:
        if key not in self.data:
            return 0
        _, version, _ = self.data[key]
        return version
