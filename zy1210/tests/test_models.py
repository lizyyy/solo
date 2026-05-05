import json
from datetime import datetime, timedelta

import pytest

from cache_forensics.models import (
    CacheEntry,
    CacheLayer,
    CachePolicy,
    DBUpdate,
    OperationType,
    RiskEvent,
    RiskType,
    SimulationStats,
    TrafficEvent,
)


class TestTrafficEvent:
    def test_from_json(self):
        data = {
            "timestamp": "2026-05-05T10:00:00",
            "operation": "read",
            "key": "user:123",
            "request_id": "req-001",
            "source": "web",
            "metadata": {"region": "cn-east-1"},
        }
        event = TrafficEvent.from_json(json.dumps(data))

        assert event.key == "user:123"
        assert event.operation == OperationType.READ
        assert event.request_id == "req-001"
        assert event.source == "web"
        assert event.metadata == {"region": "cn-east-1"}


class TestCacheEntry:
    def test_is_expired_false(self):
        now = datetime.now()
        entry = CacheEntry(
            key="test",
            value="value",
            layer=CacheLayer.LOCAL,
            created_at=now,
            expires_at=now + timedelta(hours=1),
        )
        assert entry.is_expired(now) is False

    def test_is_expired_true(self):
        now = datetime.now()
        entry = CacheEntry(
            key="test",
            value="value",
            layer=CacheLayer.LOCAL,
            created_at=now,
            expires_at=now - timedelta(hours=1),
        )
        assert entry.is_expired(now) is True

    def test_is_expired_no_expiry(self):
        now = datetime.now()
        entry = CacheEntry(
            key="test",
            value="value",
            layer=CacheLayer.LOCAL,
            created_at=now,
            expires_at=None,
        )
        assert entry.is_expired(now) is False


class TestCachePolicy:
    def test_from_dict_defaults(self):
        data = {"name": "test-policy", "ttl_seconds": 60}
        policy = CachePolicy.from_dict(data)

        assert policy.name == "test-policy"
        assert policy.ttl_seconds == 60
        assert policy.ttl_jitter_seconds == 0
        assert policy.local_cache_enabled is True
        assert policy.redis_cache_enabled is True
        assert policy.bloom_filter_enabled is False
        assert policy.mutex_lock_enabled is False

    def test_from_dict_full_config(self):
        data = {
            "name": "full-policy",
            "ttl_seconds": 300,
            "ttl_jitter_seconds": 30,
            "local_cache_enabled": False,
            "redis_cache_enabled": True,
            "bloom_filter_enabled": True,
            "mutex_lock_enabled": True,
            "warmup_enabled": True,
            "warmup_keys": ["key1", "key2"],
            "consistency_mode": "strong",
            "write_strategy": "write_through",
            "invalidation_strategy": "delete",
        }
        policy = CachePolicy.from_dict(data)

        assert policy.name == "full-policy"
        assert policy.ttl_seconds == 300
        assert policy.ttl_jitter_seconds == 30
        assert policy.local_cache_enabled is False
        assert policy.bloom_filter_enabled is True
        assert policy.warmup_keys == ["key1", "key2"]


class TestSimulationStats:
    def test_hit_rate(self):
        stats = SimulationStats(
            run_id="test-001",
            started_at=datetime.now(),
            finished_at=datetime.now(),
            policy_name="test",
            total_requests=100,
            cache_hits=75,
            cache_misses=25,
        )
        assert stats.hit_rate == 0.75

    def test_hit_rate_zero_requests(self):
        stats = SimulationStats(
            run_id="test-001",
            started_at=datetime.now(),
            finished_at=datetime.now(),
            policy_name="test",
            total_requests=0,
        )
        assert stats.hit_rate == 0.0

    def test_local_hit_rate(self):
        stats = SimulationStats(
            run_id="test-001",
            started_at=datetime.now(),
            finished_at=datetime.now(),
            policy_name="test",
            local_hits=80,
            local_misses=20,
        )
        assert stats.local_hit_rate == 0.8

    def test_redis_hit_rate(self):
        stats = SimulationStats(
            run_id="test-001",
            started_at=datetime.now(),
            finished_at=datetime.now(),
            policy_name="test",
            redis_hits=50,
            redis_misses=50,
        )
        assert stats.redis_hit_rate == 0.5
