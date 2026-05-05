import tempfile
from datetime import datetime
from pathlib import Path

import pytest

from cache_forensics.models import SimulationStats
from cache_forensics.storage import SQLiteStorage


def create_test_stats() -> SimulationStats:
    return SimulationStats(
        run_id="test-run-001",
        started_at=datetime(2026, 5, 5, 10, 0, 0),
        finished_at=datetime(2026, 5, 5, 10, 0, 10),
        policy_name="test-policy",
        total_requests=100,
        cache_hits=75,
        cache_misses=25,
        db_queries=30,
        db_writes=5,
        local_hits=40,
        local_misses=10,
        redis_hits=35,
        redis_misses=15,
        consistency_violations=3,
        stale_reads=2,
        key_access_counts={"user:123": 50, "user:456": 30, "user:789": 20},
    )


class TestSQLiteStorage:
    def test_init_creates_tables(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            storage = SQLiteStorage(str(db_path))

            with storage.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = [row["name"] for row in cursor.fetchall()]

            assert "runs" in tables
            assert "risk_events" in tables

    def test_save_and_get_run(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            storage = SQLiteStorage(str(db_path))

            stats = create_test_stats()
            storage.save_run(stats)

            retrieved = storage.get_run("test-run-001")

            assert retrieved is not None
            assert retrieved["id"] == "test-run-001"
            assert retrieved["policy_name"] == "test-policy"
            assert retrieved["total_requests"] == 100
            assert retrieved["cache_hits"] == 75
            assert retrieved["key_access_counts"] == {
                "user:123": 50,
                "user:456": 30,
                "user:789": 20,
            }

    def test_get_nonexistent_run(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            storage = SQLiteStorage(str(db_path))

            retrieved = storage.get_run("non-existent")
            assert retrieved is None

    def test_get_runs(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            storage = SQLiteStorage(str(db_path))

            for i in range(5):
                stats = SimulationStats(
                    run_id=f"run-{i:03d}",
                    started_at=datetime(2026, 5, 5, 10, 0, i),
                    finished_at=datetime(2026, 5, 5, 10, 0, i + 1),
                    policy_name=f"policy-{i}",
                )
                storage.save_run(stats)

            runs = storage.get_runs(limit=3)

            assert len(runs) == 3
            assert runs[0]["id"] in [f"run-{i:03d}" for i in range(5)]

    def test_delete_run(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            storage = SQLiteStorage(str(db_path))

            stats = create_test_stats()
            storage.save_run(stats)

            assert storage.get_run("test-run-001") is not None

            deleted = storage.delete_run("test-run-001")
            assert deleted is True
            assert storage.get_run("test-run-001") is None

    def test_delete_nonexistent_run(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            storage = SQLiteStorage(str(db_path))

            deleted = storage.delete_run("non-existent")
            assert deleted is False

    def test_clear_all(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            storage = SQLiteStorage(str(db_path))

            for i in range(3):
                stats = SimulationStats(
                    run_id=f"run-{i}",
                    started_at=datetime.now(),
                    finished_at=datetime.now(),
                    policy_name="test",
                )
                storage.save_run(stats)

            assert len(storage.get_runs()) == 3

            storage.clear_all()

            assert len(storage.get_runs()) == 0

    def test_hit_rate_calculation(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            storage = SQLiteStorage(str(db_path))

            stats = create_test_stats()
            storage.save_run(stats)

            retrieved = storage.get_run("test-run-001")
            assert retrieved is not None
            assert retrieved["hit_rate"] == pytest.approx(0.75)
            assert retrieved["local_hit_rate"] == pytest.approx(0.8)
            assert retrieved["redis_hit_rate"] == pytest.approx(0.7)
