from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml


class OperationType(Enum):
    CONNECT = "connect"
    DISCONNECT = "disconnect"
    BEGIN = "begin"
    READ = "read"
    WRITE = "write"
    COMMIT = "commit"
    ROLLBACK = "rollback"


@dataclass
class WorkloadEvent:
    connection_id: str
    operation: OperationType
    timestamp: datetime
    duration_ms: int = 0
    table: Optional[str] = None
    row_id: Optional[str] = None
    data: Dict[str, Any] = field(default_factory=dict)
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LockConfig:
    busy_timeout_ms: int = 5000
    max_shared_locks: int = 100
    enable_deadlock_detection: bool = True
    starvation_threshold_ms: int = 30000
    lock_upgrade_enabled: bool = True
    pending_lock_priority: bool = True


class WorkloadParser:
    def __init__(self):
        self.events: List[WorkloadEvent] = []

    def parse_file(self, file_path: Path) -> List[WorkloadEvent]:
        if not file_path.exists():
            raise FileNotFoundError(f"Workload file not found: {file_path}")
        
        events = []
        with open(file_path, "r") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                
                try:
                    raw = json.loads(line)
                    event = self._parse_event(raw, line_num)
                    events.append(event)
                except json.JSONDecodeError as e:
                    raise ValueError(f"Invalid JSON at line {line_num}: {e}")
                except ValueError as e:
                    raise ValueError(f"Invalid event at line {line_num}: {e}")
        
        self.events = sorted(events, key=lambda e: e.timestamp)
        return self.events

    def _parse_event(self, raw: Dict[str, Any], line_num: int) -> WorkloadEvent:
        required_fields = ["connection_id", "operation", "timestamp"]
        for field in required_fields:
            if field not in raw:
                raise ValueError(f"Missing required field: {field}")
        
        try:
            operation = OperationType(raw["operation"].lower())
        except ValueError:
            raise ValueError(f"Unknown operation type: {raw['operation']}")
        
        timestamp = self._parse_timestamp(raw["timestamp"])
        
        return WorkloadEvent(
            connection_id=str(raw["connection_id"]),
            operation=operation,
            timestamp=timestamp,
            duration_ms=raw.get("duration_ms", 0),
            table=raw.get("table"),
            row_id=raw.get("row_id"),
            data=raw.get("data", {}),
            raw=raw,
        )

    def _parse_timestamp(self, ts: Any) -> datetime:
        if isinstance(ts, str):
            formats = [
                "%Y-%m-%dT%H:%M:%S.%fZ",
                "%Y-%m-%dT%H:%M:%SZ",
                "%Y-%m-%d %H:%M:%S.%f",
                "%Y-%m-%d %H:%M:%S",
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(ts, fmt)
                except ValueError:
                    continue
            raise ValueError(f"Cannot parse timestamp: {ts}")
        elif isinstance(ts, (int, float)):
            return datetime.fromtimestamp(ts)
        else:
            raise ValueError(f"Invalid timestamp type: {type(ts)}")

    def get_connection_ids(self) -> List[str]:
        return sorted({e.connection_id for e in self.events})

    def get_time_range(self) -> tuple[datetime, datetime]:
        if not self.events:
            raise ValueError("No events loaded")
        return min(e.timestamp for e in self.events), max(e.timestamp for e in self.events)


class ConfigParser:
    @staticmethod
    def parse_file(file_path: Path) -> LockConfig:
        if not file_path.exists():
            return LockConfig()
        
        with open(file_path, "r") as f:
            raw = yaml.safe_load(f)
        
        return ConfigParser.parse_dict(raw)

    @staticmethod
    def parse_dict(raw: Dict[str, Any]) -> LockConfig:
        config = LockConfig()
        
        if "busy_timeout_ms" in raw:
            config.busy_timeout_ms = int(raw["busy_timeout_ms"])
        if "max_shared_locks" in raw:
            config.max_shared_locks = int(raw["max_shared_locks"])
        if "enable_deadlock_detection" in raw:
            config.enable_deadlock_detection = bool(raw["enable_deadlock_detection"])
        if "starvation_threshold_ms" in raw:
            config.starvation_threshold_ms = int(raw["starvation_threshold_ms"])
        if "lock_upgrade_enabled" in raw:
            config.lock_upgrade_enabled = bool(raw["lock_upgrade_enabled"])
        if "pending_lock_priority" in raw:
            config.pending_lock_priority = bool(raw["pending_lock_priority"])
        
        return config

    @staticmethod
    def to_dict(config: LockConfig) -> Dict[str, Any]:
        return {
            "busy_timeout_ms": config.busy_timeout_ms,
            "max_shared_locks": config.max_shared_locks,
            "enable_deadlock_detection": config.enable_deadlock_detection,
            "starvation_threshold_ms": config.starvation_threshold_ms,
            "lock_upgrade_enabled": config.lock_upgrade_enabled,
            "pending_lock_priority": config.pending_lock_priority,
        }

    @staticmethod
    def write(config: LockConfig, file_path: Path):
        data = ConfigParser.to_dict(config)
        with open(file_path, "w") as f:
            yaml.safe_dump(data, f, default_flow_style=False, sort_keys=False)


def generate_seed_workload(seed: int = 42, num_connections: int = 3, num_events: int = 20) -> List[Dict[str, Any]]:
    import random
    random.seed(seed)
    
    events = []
    base_time = datetime(2026, 5, 5, 10, 0, 0)
    
    connections = [f"conn-{i:03d}" for i in range(num_connections)]
    active_transactions: Dict[str, bool] = {c: False for c in connections}
    
    for i in range(num_events):
        conn_id = random.choice(connections)
        offset_ms = i * 100 + random.randint(0, 50)
        timestamp = base_time + timedelta(milliseconds=offset_ms)
        
        if not active_transactions[conn_id]:
            operation = "begin"
            active_transactions[conn_id] = True
            duration_ms = random.randint(1, 5)
        else:
            op_choices = ["read", "write", "commit", "rollback"]
            weights = [40, 30, 20, 10]
            operation = random.choices(op_choices, weights=weights, k=1)[0]
            
            if operation in ["commit", "rollback"]:
                active_transactions[conn_id] = False
                duration_ms = random.randint(5, 20)
            else:
                duration_ms = random.randint(2, 10)
        
        event = {
            "connection_id": conn_id,
            "operation": operation,
            "timestamp": timestamp.isoformat() + "Z",
            "duration_ms": duration_ms,
        }
        
        if operation in ["read", "write"]:
            event["table"] = random.choice(["users", "orders", "products"])
            event["row_id"] = f"row-{random.randint(1, 100)}"
        
        events.append(event)
    
    for conn_id in connections:
        if active_transactions[conn_id]:
            offset_ms = num_events * 100 + 100
            timestamp = base_time + timedelta(milliseconds=offset_ms)
            events.append({
                "connection_id": conn_id,
                "operation": "rollback",
                "timestamp": timestamp.isoformat() + "Z",
                "duration_ms": 5,
            })
    
    return events
