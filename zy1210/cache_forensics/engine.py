from __future__ import annotations

import random
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Optional

from .cache import Database, LocalCache, RedisCache
from .models import (
    CacheLayer,
    CachePolicy,
    DBUpdate,
    OperationType,
    RiskEvent,
    RiskType,
    SimulationStats,
    TrafficEvent,
)


@dataclass
class SimulationEngine:
    policy: CachePolicy
    local_cache: Optional[LocalCache] = None
    redis_cache: Optional[RedisCache] = None
    database: Database = field(default_factory=Database)
    stats: Optional[SimulationStats] = None
    db_updates: list[DBUpdate] = field(default_factory=list)
    traffic_events: list[TrafficEvent] = field(default_factory=list)
    db_version_history: dict[str, list[tuple[datetime, int]]] = field(
        default_factory=lambda: defaultdict(list)
    )

    def __post_init__(self):
        if self.policy.local_cache_enabled:
            self.local_cache = LocalCache(self.policy)
        if self.policy.redis_cache_enabled:
            self.redis_cache = RedisCache(self.policy)

    def load_traffic(self, events: list[TrafficEvent]) -> None:
        self.traffic_events = sorted(events, key=lambda e: e.timestamp)

    def load_db_updates(self, updates: list[DBUpdate]) -> None:
        self.db_updates = sorted(updates, key=lambda u: u.timestamp)
        for update in self.db_updates:
            self.db_version_history[update.key].append((update.timestamp, self.database.version_counter + 1))

    def initialize_database(self, initial_data: dict[str, Any], start_time: datetime) -> None:
        for key, value in initial_data.items():
            version = self.database.set(key, value, start_time)
            self.db_version_history[key].append((start_time, version))

    def warmup(self, at_time: datetime) -> None:
        if not self.policy.warmup_enabled or not self.policy.warmup_keys:
            return

        warmup_values = {}
        for key in self.policy.warmup_keys:
            value, _ = self.database.get(key)
            if value is not None:
                warmup_values[key] = value

        if self.local_cache:
            self.local_cache.warmup(self.policy.warmup_keys, warmup_values, at_time)
        if self.redis_cache:
            self.redis_cache.warmup(self.policy.warmup_keys, warmup_values, at_time)

    def _get_db_version_at_time(self, key: str, at_time: datetime) -> int:
        history = self.db_version_history.get(key, [])
        for i in range(len(history) - 1, -1, -1):
            ts, version = history[i]
            if ts <= at_time:
                return version
        return 0

    def _handle_read(self, event: TrafficEvent) -> tuple[Optional[Any], Optional[CacheLayer], list[RiskEvent]]:
        risks: list[RiskEvent] = []
        key = event.key
        at_time = event.timestamp

        self.stats.key_access_counts[key] = self.stats.key_access_counts.get(key, 0) + 1
        self.stats.total_requests += 1

        if self.local_cache:
            entry, hit = self.local_cache.get(key, at_time)
            if hit and entry is not None:
                self.stats.cache_hits += 1
                self.stats.local_hits += 1

                db_version = self._get_db_version_at_time(key, at_time)
                if entry.version < db_version:
                    self.stats.stale_reads += 1
                    self.stats.consistency_violations += 1
                    risks.append(
                        RiskEvent(
                            risk_type=RiskType.STALE_READ,
                            timestamp=at_time,
                            key=key,
                            description=f"读取到旧值: 缓存版本 {entry.version}, 数据库版本 {db_version}",
                            severity="high",
                            context={
                                "cache_version": entry.version,
                                "db_version": db_version,
                                "request_id": event.request_id,
                            },
                        )
                    )
                return entry.value, CacheLayer.LOCAL, risks

            self.stats.local_misses += 1

        if self.redis_cache:
            entry, hit = self.redis_cache.get(key, at_time)
            if hit and entry is not None:
                self.stats.cache_hits += 1
                self.stats.redis_hits += 1

                if self.local_cache and self.policy.local_cache_enabled:
                    self.local_cache.set(key, entry.value, at_time, entry.version)

                db_version = self._get_db_version_at_time(key, at_time)
                if entry.version < db_version:
                    self.stats.stale_reads += 1
                    self.stats.consistency_violations += 1
                    risks.append(
                        RiskEvent(
                            risk_type=RiskType.STALE_READ,
                            timestamp=at_time,
                            key=key,
                            description=f"读取到旧值: 缓存版本 {entry.version}, 数据库版本 {db_version}",
                            severity="high",
                            context={
                                "cache_version": entry.version,
                                "db_version": db_version,
                                "request_id": event.request_id,
                            },
                        )
                    )
                return entry.value, CacheLayer.REDIS, risks

            self.stats.redis_misses += 1

        self.stats.cache_misses += 1
        self.stats.db_queries += 1

        value, version = self.database.get(key)

        if value is None:
            risks.append(
                RiskEvent(
                    risk_type=RiskType.CACHE_PENETRATION,
                    timestamp=at_time,
                    key=key,
                    description=f"缓存穿透: key={key} 在缓存和数据库中都不存在",
                    severity="medium",
                    context={"request_id": event.request_id},
                )
            )
        else:
            if self.redis_cache and self.policy.redis_cache_enabled:
                self.redis_cache.set(key, value, at_time, version)
            if self.local_cache and self.policy.local_cache_enabled:
                self.local_cache.set(key, value, at_time, version)

        return value, CacheLayer.DB, risks

    def _handle_write(self, event: TrafficEvent) -> list[RiskEvent]:
        risks: list[RiskEvent] = []
        key = event.key
        value = event.value
        at_time = event.timestamp

        self.stats.total_requests += 1
        self.stats.db_writes += 1

        if self.policy.write_strategy == "write_through":
            version = self.database.set(key, value, at_time)
            self.db_version_history[key].append((at_time, version))

            if self.policy.invalidation_strategy == "delete":
                if self.local_cache:
                    self.local_cache.delete(key)
                if self.redis_cache:
                    self.redis_cache.delete(key)
            elif self.policy.invalidation_strategy == "update":
                if self.local_cache:
                    self.local_cache.set(key, value, at_time, version)
                if self.redis_cache:
                    self.redis_cache.set(key, value, at_time, version)

        elif self.policy.write_strategy == "write_behind":
            if self.redis_cache:
                self.redis_cache.set(key, value, at_time, self.database.get_version(key) + 1)
            if self.local_cache:
                self.local_cache.set(key, value, at_time, self.database.get_version(key) + 1)
            version = self.database.set(key, value, at_time)
            self.db_version_history[key].append((at_time, version))

        elif self.policy.write_strategy == "write_around":
            version = self.database.set(key, value, at_time)
            self.db_version_history[key].append((at_time, version))

            if self.local_cache:
                self.local_cache.delete(key)
            if self.redis_cache:
                self.redis_cache.delete(key)

        return risks

    def _handle_delete(self, event: TrafficEvent) -> list[RiskEvent]:
        risks: list[RiskEvent] = []
        key = event.key
        at_time = event.timestamp

        self.stats.total_requests += 1
        self.stats.db_writes += 1

        self.database.delete(key)

        if self.local_cache:
            self.local_cache.delete(key)
        if self.redis_cache:
            self.redis_cache.delete(key)

        return risks

    def run(self, run_id: Optional[str] = None) -> SimulationStats:
        if not self.traffic_events:
            raise ValueError("没有加载流量数据")

        start_time = self.traffic_events[0].timestamp
        end_time = self.traffic_events[-1].timestamp

        self.stats = SimulationStats(
            run_id=run_id or str(uuid.uuid4())[:8],
            started_at=start_time,
            finished_at=end_time,
            policy_name=self.policy.name,
        )

        self.warmup(start_time)

        db_update_index = 0

        for event in self.traffic_events:
            while db_update_index < len(self.db_updates):
                update = self.db_updates[db_update_index]
                if update.timestamp <= event.timestamp:
                    if update.operation == OperationType.WRITE or update.operation == OperationType.UPDATE:
                        version = self.database.set(update.key, update.new_value or {}, update.timestamp)
                        self.db_version_history[update.key].append((update.timestamp, version))
                    elif update.operation == OperationType.DELETE:
                        self.database.delete(update.key)
                    db_update_index += 1
                else:
                    break

            risks: list[RiskEvent] = []
            if event.operation == OperationType.READ:
                _, _, risks = self._handle_read(event)
            elif event.operation in (OperationType.WRITE, OperationType.UPDATE):
                risks = self._handle_write(event)
            elif event.operation == OperationType.DELETE:
                risks = self._handle_delete(event)

            for risk in risks:
                self.stats.risk_events.append(risk)

        self.stats.finished_at = datetime.now()

        self._detect_hot_keys()
        self._detect_avalanche()
        self._detect_penetration_patterns()

        return self.stats

    def _detect_hot_keys(self) -> None:
        threshold = self.policy.hot_key_threshold
        for key, count in self.stats.key_access_counts.items():
            if count >= threshold:
                self.stats.risk_events.append(
                    RiskEvent(
                        risk_type=RiskType.HOT_KEY_BREAKDOWN,
                        timestamp=self.stats.started_at,
                        key=key,
                        description=f"热点 Key: {key} 被访问 {count} 次，超过阈值 {threshold}",
                        severity="high" if count >= threshold * 2 else "medium",
                        context={"access_count": count, "threshold": threshold},
                    )
                )

    def _detect_avalanche(self) -> None:
        window = timedelta(seconds=self.policy.avalanche_window_seconds)

        cache_miss_times: list[datetime] = []
        for event in self.traffic_events:
            if event.operation == OperationType.READ:
                cache_miss_times.append(event.timestamp)

        for i, miss_time in enumerate(cache_miss_times):
            window_end = miss_time + window
            window_misses = sum(1 for t in cache_miss_times[i:] if t <= window_end)

            if window_misses >= self.policy.penetration_threshold:
                self.stats.risk_events.append(
                    RiskEvent(
                        risk_type=RiskType.BATCH_EXPIRE_AVALANCHE,
                        timestamp=miss_time,
                        key="*",
                        description=f"批量过期雪崩: 在 {window.total_seconds()}s 窗口内有 {window_misses} 次缓存未命中",
                        severity="high",
                        context={
                            "window_seconds": window.total_seconds(),
                            "miss_count": window_misses,
                            "threshold": self.policy.penetration_threshold,
                        },
                    )
                )
                break

    def _detect_penetration_patterns(self) -> None:
        penetration_events = [
            e for e in self.stats.risk_events if e.risk_type == RiskType.CACHE_PENETRATION
        ]
        if len(penetration_events) >= self.policy.penetration_threshold:
            keys = list(set(e.key for e in penetration_events))
            self.stats.risk_events.append(
                RiskEvent(
                    risk_type=RiskType.CACHE_MISS_STORM,
                    timestamp=self.stats.started_at,
                    key=", ".join(keys[:10]) + ("..." if len(keys) > 10 else ""),
                    description=f"缓存未命中风暴: 检测到 {len(penetration_events)} 次穿透事件，涉及 {len(keys)} 个不同的 key",
                    severity="high",
                    context={"penetration_count": len(penetration_events), "unique_keys": len(keys)},
                )
            )
