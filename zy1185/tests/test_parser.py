import json
import tempfile
from datetime import datetime
from pathlib import Path

import pytest
import yaml

from lock_analyzer.parser import (
    ConfigParser,
    LockConfig,
    OperationType,
    WorkloadEvent,
    WorkloadParser,
    generate_seed_workload,
)


class TestOperationType:
    def test_operation_type_values(self):
        assert OperationType.CONNECT.value == "connect"
        assert OperationType.DISCONNECT.value == "disconnect"
        assert OperationType.BEGIN.value == "begin"
        assert OperationType.READ.value == "read"
        assert OperationType.WRITE.value == "write"
        assert OperationType.COMMIT.value == "commit"
        assert OperationType.ROLLBACK.value == "rollback"


class TestWorkloadParser:
    def setup_method(self):
        self.parser = WorkloadParser()
        self.temp_dir = tempfile.mkdtemp()

    def create_test_workload(self, events: list, filename: str = "test.jsonl") -> Path:
        file_path = Path(self.temp_dir) / filename
        with open(file_path, "w") as f:
            for event in events:
                f.write(json.dumps(event) + "\n")
        return file_path

    def test_parse_simple_event(self):
        event = {
            "connection_id": "conn-001",
            "operation": "begin",
            "timestamp": "2026-05-05T10:00:00.000Z",
            "duration_ms": 2,
        }
        
        file_path = self.create_test_workload([event])
        events = self.parser.parse_file(file_path)
        
        assert len(events) == 1
        assert events[0].connection_id == "conn-001"
        assert events[0].operation == OperationType.BEGIN
        assert events[0].duration_ms == 2

    def test_parse_read_event_with_table(self):
        event = {
            "connection_id": "conn-001",
            "operation": "read",
            "timestamp": "2026-05-05T10:00:00.000Z",
            "duration_ms": 10,
            "table": "users",
            "row_id": "row-1",
        }
        
        file_path = self.create_test_workload([event])
        events = self.parser.parse_file(file_path)
        
        assert events[0].table == "users"
        assert events[0].row_id == "row-1"

    def test_parse_multiple_events(self):
        events = [
            {
                "connection_id": "conn-001",
                "operation": "begin",
                "timestamp": "2026-05-05T10:00:00.000Z",
                "duration_ms": 2,
            },
            {
                "connection_id": "conn-001",
                "operation": "read",
                "timestamp": "2026-05-05T10:00:00.010Z",
                "duration_ms": 10,
            },
            {
                "connection_id": "conn-001",
                "operation": "commit",
                "timestamp": "2026-05-05T10:00:00.100Z",
                "duration_ms": 15,
            },
        ]
        
        file_path = self.create_test_workload(events)
        parsed = self.parser.parse_file(file_path)
        
        assert len(parsed) == 3
        assert parsed[0].operation == OperationType.BEGIN
        assert parsed[1].operation == OperationType.READ
        assert parsed[2].operation == OperationType.COMMIT

    def test_parse_sorted_by_timestamp(self):
        events = [
            {
                "connection_id": "conn-001",
                "operation": "read",
                "timestamp": "2026-05-05T10:00:00.050Z",
                "duration_ms": 10,
            },
            {
                "connection_id": "conn-001",
                "operation": "begin",
                "timestamp": "2026-05-05T10:00:00.000Z",
                "duration_ms": 2,
            },
        ]
        
        file_path = self.create_test_workload(events)
        parsed = self.parser.parse_file(file_path)
        
        assert parsed[0].operation == OperationType.BEGIN
        assert parsed[1].operation == OperationType.READ

    def test_missing_required_field_raises(self):
        event = {
            "connection_id": "conn-001",
            "operation": "begin",
        }
        
        file_path = self.create_test_workload([event])
        with pytest.raises(ValueError, match="Missing required field"):
            self.parser.parse_file(file_path)

    def test_invalid_operation_raises(self):
        event = {
            "connection_id": "conn-001",
            "operation": "unknown",
            "timestamp": "2026-05-05T10:00:00.000Z",
            "duration_ms": 2,
        }
        
        file_path = self.create_test_workload([event])
        with pytest.raises(ValueError, match="Unknown operation type"):
            self.parser.parse_file(file_path)

    def test_get_connection_ids(self):
        events = [
            {
                "connection_id": "conn-001",
                "operation": "begin",
                "timestamp": "2026-05-05T10:00:00.000Z",
                "duration_ms": 2,
            },
            {
                "connection_id": "conn-002",
                "operation": "begin",
                "timestamp": "2026-05-05T10:00:00.010Z",
                "duration_ms": 2,
            },
        ]
        
        file_path = self.create_test_workload(events)
        self.parser.parse_file(file_path)
        
        conn_ids = self.parser.get_connection_ids()
        assert "conn-001" in conn_ids
        assert "conn-002" in conn_ids

    def test_file_not_found_raises(self):
        with pytest.raises(FileNotFoundError):
            self.parser.parse_file(Path("/nonexistent/path.jsonl"))


class TestConfigParser:
    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()

    def test_parse_default_config(self):
        config = ConfigParser.parse_dict({})
        assert config.busy_timeout_ms == 5000
        assert config.max_shared_locks == 100
        assert config.enable_deadlock_detection is True
        assert config.starvation_threshold_ms == 30000

    def test_parse_custom_config(self):
        raw = {
            "busy_timeout_ms": 10000,
            "max_shared_locks": 50,
            "enable_deadlock_detection": False,
            "starvation_threshold_ms": 60000,
        }
        
        config = ConfigParser.parse_dict(raw)
        assert config.busy_timeout_ms == 10000
        assert config.max_shared_locks == 50
        assert config.enable_deadlock_detection is False
        assert config.starvation_threshold_ms == 60000

    def test_to_dict(self):
        config = LockConfig(
            busy_timeout_ms=10000,
            max_shared_locks=50,
            enable_deadlock_detection=False,
            starvation_threshold_ms=60000,
            lock_upgrade_enabled=True,
            pending_lock_priority=True,
        )
        
        data = ConfigParser.to_dict(config)
        assert data["busy_timeout_ms"] == 10000
        assert data["max_shared_locks"] == 50
        assert data["enable_deadlock_detection"] is False
        assert data["starvation_threshold_ms"] == 60000

    def test_write_and_read(self):
        config = LockConfig(busy_timeout_ms=15000)
        file_path = Path(self.temp_dir) / "test-config.yaml"
        
        ConfigParser.write(config, file_path)
        
        loaded = ConfigParser.parse_file(file_path)
        assert loaded.busy_timeout_ms == 15000

    def test_parse_nonexistent_file_returns_default(self):
        config = ConfigParser.parse_file(Path("/nonexistent/config.yaml"))
        assert config.busy_timeout_ms == 5000


class TestGenerateSeedWorkload:
    def test_generate_deterministic(self):
        events1 = generate_seed_workload(seed=42, num_connections=3, num_events=10)
        events2 = generate_seed_workload(seed=42, num_connections=3, num_events=10)
        
        assert len(events1) == len(events2)
        for e1, e2 in zip(events1, events2):
            assert e1["connection_id"] == e2["connection_id"]
            assert e1["operation"] == e2["operation"]

    def test_generate_correct_count(self):
        events = generate_seed_workload(seed=42, num_connections=3, num_events=20)
        assert len(events) >= 20

    def test_generate_valid_events(self):
        events = generate_seed_workload(seed=42, num_connections=2, num_events=10)
        
        for event in events:
            assert "connection_id" in event
            assert "operation" in event
            assert "timestamp" in event
            assert "duration_ms" in event
            
            valid_ops = ["begin", "read", "write", "commit", "rollback"]
            assert event["operation"] in valid_ops

    def test_generate_connections_in_range(self):
        events = generate_seed_workload(seed=42, num_connections=5, num_events=50)
        
        connection_ids = {e["connection_id"] for e in events}
        assert len(connection_ids) <= 5
        
        for conn_id in connection_ids:
            assert conn_id.startswith("conn-")
