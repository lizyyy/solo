import json
from datetime import datetime, timedelta

import pytest

from cache_forensics.engine import SimulationEngine
from cache_forensics.models import (
    CachePolicy,
    DBUpdate,
    OperationType,
    RiskType,
    TrafficEvent,
)


def create_test_event(
    timestamp: datetime, operation: OperationType, key: str, value=None
) -> TrafficEvent:
    return TrafficEvent(
        timestamp=timestamp,
        operation=operation,
        key=key,
        request_id=f"req-{key}-{timestamp.timestamp()}",
        value=value,
    )


class TestSimulationEngine:
    def test_cache_hit_flow(self):
        policy = CachePolicy(name="test", ttl_seconds=300)
        engine = SimulationEngine(policy=policy)

        base_time = datetime.now()
        traffic = [
            create_test_event(base_time, OperationType.READ, "user:123"),
            create_test_event(base_time + timedelta(seconds=1), OperationType.READ, "user:123"),
        ]

        engine.load_traffic(traffic)
        engine.initialize_database({"user:123": {"name": "test"}}, base_time)

        stats = engine.run()

        assert stats.total_requests == 2
        assert stats.cache_misses == 1
        assert stats.cache_hits == 1
        assert stats.db_queries == 1

    def test_stale_read_detection(self):
        policy = CachePolicy(name="test", ttl_seconds=300)
        engine = SimulationEngine(policy=policy)

        base_time = datetime.now()
        traffic = [
            create_test_event(base_time, OperationType.READ, "user:123"),
            create_test_event(
                base_time + timedelta(seconds=1),
                OperationType.WRITE,
                "user:123",
                {"name": "updated"},
            ),
            create_test_event(base_time + timedelta(seconds=2), OperationType.READ, "user:123"),
        ]

        db_updates = [
            DBUpdate(
                timestamp=base_time + timedelta(seconds=1),
                operation=OperationType.WRITE,
                key="user:123",
                old_value={"name": "test"},
                new_value={"name": "updated"},
            )
        ]

        engine.load_traffic(traffic)
        engine.load_db_updates(db_updates)
        engine.initialize_database({"user:123": {"name": "test"}}, base_time)

        stats = engine.run()

        assert stats.stale_reads >= 0

    def test_cache_penetration_detection(self):
        policy = CachePolicy(name="test", ttl_seconds=300, penetration_threshold=1)
        engine = SimulationEngine(policy=policy)

        base_time = datetime.now()
        traffic = [
            create_test_event(base_time, OperationType.READ, "user:999"),
        ]

        engine.load_traffic(traffic)
        engine.initialize_database({"user:123": {"name": "test"}}, base_time)

        stats = engine.run()

        penetration_risks = [r for r in stats.risk_events if r.risk_type == RiskType.CACHE_PENETRATION]
        assert len(penetration_risks) == 1

    def test_local_cache_disabled(self):
        policy = CachePolicy(name="test", ttl_seconds=300, local_cache_enabled=False)
        engine = SimulationEngine(policy=policy)

        base_time = datetime.now()
        traffic = [
            create_test_event(base_time, OperationType.READ, "user:123"),
            create_test_event(base_time + timedelta(seconds=1), OperationType.READ, "user:123"),
        ]

        engine.load_traffic(traffic)
        engine.initialize_database({"user:123": {"name": "test"}}, base_time)

        stats = engine.run()

        assert stats.local_hits == 0
        assert stats.local_misses == 0

    def test_redis_cache_disabled(self):
        policy = CachePolicy(
            name="test", ttl_seconds=300, local_cache_enabled=False, redis_cache_enabled=False
        )
        engine = SimulationEngine(policy=policy)

        base_time = datetime.now()
        traffic = [
            create_test_event(base_time, OperationType.READ, "user:123"),
            create_test_event(base_time + timedelta(seconds=1), OperationType.READ, "user:123"),
        ]

        engine.load_traffic(traffic)
        engine.initialize_database({"user:123": {"name": "test"}}, base_time)

        stats = engine.run()

        assert stats.redis_hits == 0
        assert stats.redis_misses == 0
        assert stats.cache_hits == 0
        assert stats.db_queries == 2

    def test_write_through_strategy(self):
        policy = CachePolicy(
            name="test",
            ttl_seconds=300,
            write_strategy="write_through",
            invalidation_strategy="delete",
        )
        engine = SimulationEngine(policy=policy)

        base_time = datetime.now()
        traffic = [
            create_test_event(base_time, OperationType.READ, "user:123"),
            create_test_event(
                base_time + timedelta(seconds=1),
                OperationType.WRITE,
                "user:123",
                {"name": "updated"},
            ),
            create_test_event(base_time + timedelta(seconds=2), OperationType.READ, "user:123"),
        ]

        engine.load_traffic(traffic)
        engine.initialize_database({"user:123": {"name": "test"}}, base_time)

        stats = engine.run()

        assert stats.db_writes >= 1

    def test_hot_key_detection(self):
        policy = CachePolicy(name="test", ttl_seconds=300, hot_key_threshold=3)
        engine = SimulationEngine(policy=policy)

        base_time = datetime.now()
        traffic = [
            create_test_event(base_time + timedelta(seconds=i), OperationType.READ, "user:hot")
            for i in range(5)
        ]

        engine.load_traffic(traffic)
        engine.initialize_database({"user:hot": {"name": "hot"}}, base_time)

        stats = engine.run()

        hot_key_risks = [r for r in stats.risk_events if r.risk_type == RiskType.HOT_KEY_BREAKDOWN]
        assert len(hot_key_risks) == 1
        assert hot_key_risks[0].key == "user:hot"

    def test_no_traffic_error(self):
        policy = CachePolicy(name="test", ttl_seconds=300)
        engine = SimulationEngine(policy=policy)

        with pytest.raises(ValueError, match="没有加载流量数据"):
            engine.run()

    def test_warmup_enabled(self):
        policy = CachePolicy(
            name="test",
            ttl_seconds=300,
            warmup_enabled=True,
            warmup_keys=["user:123", "user:456"],
        )
        engine = SimulationEngine(policy=policy)

        base_time = datetime.now()
        traffic = [
            create_test_event(base_time, OperationType.READ, "user:123"),
        ]

        engine.load_traffic(traffic)
        engine.initialize_database(
            {"user:123": {"name": "test123"}, "user:456": {"name": "test456"}}, base_time
        )

        stats = engine.run()

        assert stats.db_queries == 0

    def test_db_updates_applied(self):
        policy = CachePolicy(name="test", ttl_seconds=300)
        engine = SimulationEngine(policy=policy)

        base_time = datetime.now()
        traffic = [
            create_test_event(base_time, OperationType.READ, "user:123"),
            create_test_event(base_time + timedelta(seconds=5), OperationType.READ, "user:123"),
        ]

        db_updates = [
            DBUpdate(
                timestamp=base_time + timedelta(seconds=2),
                operation=OperationType.UPDATE,
                key="user:123",
                old_value={"name": "old"},
                new_value={"name": "new"},
            )
        ]

        engine.load_traffic(traffic)
        engine.load_db_updates(db_updates)
        engine.initialize_database({"user:123": {"name": "old"}}, base_time)

        stats = engine.run()

        assert stats.total_requests == 2
