from datetime import datetime, timedelta
from pathlib import Path

import pytest

from lock_analyzer.lock_model import LockType
from lock_analyzer.parser import LockConfig, OperationType, WorkloadEvent
from lock_analyzer.simulator import EventStatus, Simulator


class TestSimulatorBasic:
    def setup_method(self):
        self.config = LockConfig()
        self.base_time = datetime(2026, 5, 5, 10, 0, 0)

    def create_event(
        self,
        connection_id: str,
        operation: str,
        offset_ms: int = 0,
        duration_ms: int = 5,
        table: str = None,
        row_id: str = None,
    ) -> WorkloadEvent:
        return WorkloadEvent(
            connection_id=connection_id,
            operation=OperationType(operation),
            timestamp=self.base_time + timedelta(milliseconds=offset_ms),
            duration_ms=duration_ms,
            table=table,
            row_id=row_id,
            raw={},
        )

    def test_simulate_single_transaction(self):
        events = [
            self.create_event("conn-1", "begin", 0, 2),
            self.create_event("conn-1", "read", 10, 10, "users", "row-1"),
            self.create_event("conn-1", "commit", 100, 15),
        ]
        
        simulator = Simulator(self.config)
        result = simulator.simulate(events)
        
        assert result.success is True
        assert result.total_events == 3
        assert result.completed_events == 3
        assert len(result.deadlocks) == 0
        assert len(result.starvation_risks) == 0

    def test_simulate_concurrent_reads(self):
        events = [
            self.create_event("conn-1", "begin", 0, 2),
            self.create_event("conn-2", "begin", 5, 2),
            self.create_event("conn-1", "read", 10, 100, "users", "row-1"),
            self.create_event("conn-2", "read", 15, 100, "users", "row-2"),
            self.create_event("conn-2", "commit", 200, 15),
            self.create_event("conn-1", "commit", 250, 15),
        ]
        
        simulator = Simulator(self.config)
        result = simulator.simulate(events)
        
        assert result.success is True
        assert result.completed_events == 6
        assert len(result.deadlocks) == 0


class TestSimulatorLockConflicts:
    def setup_method(self):
        self.config = LockConfig(busy_timeout_ms=5000)
        self.base_time = datetime(2026, 5, 5, 10, 0, 0)

    def create_event(
        self,
        connection_id: str,
        operation: str,
        offset_ms: int = 0,
        duration_ms: int = 5,
        table: str = None,
        row_id: str = None,
    ) -> WorkloadEvent:
        return WorkloadEvent(
            connection_id=connection_id,
            operation=OperationType(operation),
            timestamp=self.base_time + timedelta(milliseconds=offset_ms),
            duration_ms=duration_ms,
            table=table,
            row_id=row_id,
            raw={},
        )

    def test_long_read_blocks_write(self):
        events = [
            self.create_event("reader", "begin", 0, 2),
            self.create_event("writer", "begin", 5, 2),
            self.create_event("reader", "read", 10, 5000, "table", "row-1"),
            self.create_event("writer", "write", 20, 50, "table", "row-2"),
            self.create_event("reader", "commit", 5100, 15),
            self.create_event("writer", "commit", 5200, 15),
        ]
        
        simulator = Simulator(self.config)
        result = simulator.simulate(events)
        
        assert result.success is True
        
        write_ops = [e for e in result.timeline if e.operation == OperationType.WRITE]
        assert len(write_ops) > 0

    def test_multiple_readers_block_writer(self):
        events = [
            self.create_event("reader-1", "begin", 0, 2),
            self.create_event("reader-2", "begin", 5, 2),
            self.create_event("reader-1", "read", 10, 10000, "table", "row-1"),
            self.create_event("reader-2", "read", 15, 10000, "table", "row-2"),
            self.create_event("writer", "begin", 20, 2),
            self.create_event("writer", "write", 30, 50, "table", "row-3"),
        ]
        
        simulator = Simulator(self.config)
        result = simulator.simulate(events)
        
        assert result.success is True


class TestSimulatorExplain:
    def setup_method(self):
        self.config = LockConfig()
        self.base_time = datetime(2026, 5, 5, 10, 0, 0)

    def create_event(
        self,
        connection_id: str,
        operation: str,
        offset_ms: int = 0,
        duration_ms: int = 5,
        table: str = None,
        row_id: str = None,
    ) -> WorkloadEvent:
        return WorkloadEvent(
            connection_id=connection_id,
            operation=OperationType(operation),
            timestamp=self.base_time + timedelta(milliseconds=offset_ms),
            duration_ms=duration_ms,
            table=table,
            row_id=row_id,
            raw={},
        )

    def test_explain_nonexistent_connection(self):
        events = [
            self.create_event("conn-1", "begin", 0, 2),
            self.create_event("conn-1", "commit", 100, 15),
        ]
        
        simulator = Simulator(self.config)
        result = simulator.simulate(events)
        
        explanation = simulator.explain_block("nonexistent")
        assert "error" in explanation

    def test_explain_completed_connection(self):
        events = [
            self.create_event("conn-1", "begin", 0, 2),
            self.create_event("conn-1", "read", 10, 10, "users", "row-1"),
            self.create_event("conn-1", "commit", 100, 15),
        ]
        
        simulator = Simulator(self.config)
        result = simulator.simulate(events)
        
        explanation = simulator.explain_block("conn-1")
        assert "error" not in explanation
        assert explanation["connection_id"] == "conn-1"


class TestSimulatorTimeline:
    def setup_method(self):
        self.config = LockConfig()
        self.base_time = datetime(2026, 5, 5, 10, 0, 0)

    def create_event(
        self,
        connection_id: str,
        operation: str,
        offset_ms: int = 0,
        duration_ms: int = 5,
        table: str = None,
        row_id: str = None,
    ) -> WorkloadEvent:
        return WorkloadEvent(
            connection_id=connection_id,
            operation=OperationType(operation),
            timestamp=self.base_time + timedelta(milliseconds=offset_ms),
            duration_ms=duration_ms,
            table=table,
            row_id=row_id,
            raw={},
        )

    def test_timeline_has_correct_events(self):
        events = [
            self.create_event("conn-1", "begin", 0, 2),
            self.create_event("conn-1", "read", 10, 10, "users", "row-1"),
            self.create_event("conn-1", "commit", 100, 15),
        ]
        
        simulator = Simulator(self.config)
        result = simulator.simulate(events)
        
        assert len(result.timeline) == 3
        
        operations = [e.operation for e in result.timeline]
        assert OperationType.BEGIN in operations
        assert OperationType.READ in operations
        assert OperationType.COMMIT in operations

    def test_timeline_ordered_by_time(self):
        events = [
            self.create_event("conn-1", "read", 50, 10, "users", "row-1"),
            self.create_event("conn-1", "begin", 0, 2),
            self.create_event("conn-1", "commit", 100, 15),
        ]
        
        simulator = Simulator(self.config)
        result = simulator.simulate(events)
        
        for i in range(len(result.timeline) - 1):
            assert result.timeline[i].start_time <= result.timeline[i + 1].start_time
