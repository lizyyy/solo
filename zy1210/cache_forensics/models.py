from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum, auto
from typing import Any, Optional


class OperationType(Enum):
    READ = "read"
    WRITE = "write"
    DELETE = "delete"
    UPDATE = "update"


class CacheLayer(Enum):
    LOCAL = "local"
    REDIS = "redis"
    DB = "database"


class RiskType(Enum):
    STALE_READ = "stale_read"
    CONSISTENCY_WINDOW = "consistency_window"
    CACHE_PENETRATION = "cache_penetration"
    HOT_KEY_BREAKDOWN = "hot_key_breakdown"
    BATCH_EXPIRE_AVALANCHE = "batch_expire_avalanche"
    CACHE_MISS_STORM = "cache_miss_storm"


@dataclass
class TrafficEvent:
    timestamp: datetime
    operation: OperationType
    key: str
    request_id: str
    source: Optional[str] = None
    value: Optional[Any] = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_json(cls, line: str) -> "TrafficEvent":
        data = json.loads(line)
        return cls(
            timestamp=datetime.fromisoformat(data["timestamp"]),
            operation=OperationType(data["operation"]),
            key=data["key"],
            request_id=data["request_id"],
            source=data.get("source"),
            value=data.get("value"),
            metadata=data.get("metadata", {}),
        )


@dataclass
class DBUpdate:
    timestamp: datetime
    operation: OperationType
    key: str
    old_value: Optional[Any]
    new_value: Optional[Any]
    transaction_id: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "DBUpdate":
        return cls(
            timestamp=datetime.fromisoformat(data["timestamp"]),
            operation=OperationType(data["operation"]),
            key=data["key"],
            old_value=data.get("old_value"),
            new_value=data.get("new_value"),
            transaction_id=data.get("transaction_id"),
        )


@dataclass
class CacheEntry:
    key: str
    value: Any
    layer: CacheLayer
    created_at: datetime
    expires_at: Optional[datetime] = None
    last_accessed: Optional[datetime] = None
    access_count: int = 0
    version: int = 1

    def is_expired(self, at_time: Optional[datetime] = None) -> bool:
        if self.expires_at is None:
            return False
        check_time = at_time or datetime.now()
        return check_time >= self.expires_at


@dataclass
class CachePolicy:
    name: str
    ttl_seconds: int
    ttl_jitter_seconds: int = 0
    local_cache_enabled: bool = True
    redis_cache_enabled: bool = True
    bloom_filter_enabled: bool = False
    mutex_lock_enabled: bool = False
    warmup_enabled: bool = False
    warmup_keys: list[str] = field(default_factory=list)
    consistency_mode: str = "eventual"
    write_strategy: str = "write_through"
    invalidation_strategy: str = "delete"
    hot_key_threshold: int = 100
    penetration_threshold: int = 50
    avalanche_window_seconds: int = 60

    @classmethod
    def from_dict(cls, data: dict) -> "CachePolicy":
        return cls(
            name=data.get("name", "default"),
            ttl_seconds=data.get("ttl_seconds", 300),
            ttl_jitter_seconds=data.get("ttl_jitter_seconds", 0),
            local_cache_enabled=data.get("local_cache_enabled", True),
            redis_cache_enabled=data.get("redis_cache_enabled", True),
            bloom_filter_enabled=data.get("bloom_filter_enabled", False),
            mutex_lock_enabled=data.get("mutex_lock_enabled", False),
            warmup_enabled=data.get("warmup_enabled", False),
            warmup_keys=data.get("warmup_keys", []),
            consistency_mode=data.get("consistency_mode", "eventual"),
            write_strategy=data.get("write_strategy", "write_through"),
            invalidation_strategy=data.get("invalidation_strategy", "delete"),
            hot_key_threshold=data.get("hot_key_threshold", 100),
            penetration_threshold=data.get("penetration_threshold", 50),
            avalanche_window_seconds=data.get("avalanche_window_seconds", 60),
        )


@dataclass
class RiskEvent:
    risk_type: RiskType
    timestamp: datetime
    key: str
    description: str
    severity: str
    context: dict[str, Any] = field(default_factory=dict)


@dataclass
class SimulationStats:
    run_id: str
    started_at: datetime
    finished_at: datetime
    policy_name: str
    total_requests: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    db_queries: int = 0
    db_writes: int = 0
    local_hits: int = 0
    local_misses: int = 0
    redis_hits: int = 0
    redis_misses: int = 0
    risk_events: list[RiskEvent] = field(default_factory=list)
    key_access_counts: dict[str, int] = field(default_factory=dict)
    consistency_violations: int = 0
    stale_reads: int = 0

    @property
    def hit_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return self.cache_hits / self.total_requests

    @property
    def local_hit_rate(self) -> float:
        local_total = self.local_hits + self.local_misses
        if local_total == 0:
            return 0.0
        return self.local_hits / local_total

    @property
    def redis_hit_rate(self) -> float:
        redis_total = self.redis_hits + self.redis_misses
        if redis_total == 0:
            return 0.0
        return self.redis_hits / redis_total
