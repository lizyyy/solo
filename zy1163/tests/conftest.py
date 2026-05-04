import json
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import yaml


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@pytest.fixture
def temp_task_dump():
    def _create_task_dump(tasks):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({"tasks": tasks}, f)
            return Path(f.name)
    return _create_task_dump


@pytest.fixture
def temp_event_trace():
    def _create_event_trace(events):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as f:
            for event in events:
                f.write(json.dumps(event) + '\n')
            return Path(f.name)
    return _create_event_trace


@pytest.fixture
def temp_await_graph():
    def _create_await_graph(edges):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            yaml.dump({"edges": edges}, f)
            return Path(f.name)
    return _create_await_graph


@pytest.fixture
def temp_timeout_rules():
    def _create_timeout_rules(rules):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            yaml.dump({"rules": rules}, f)
            return Path(f.name)
    return _create_timeout_rules


@pytest.fixture
def sample_tasks():
    now = utc_now()
    return [
        {
            "task_id": "task-001",
            "name": "main_loop",
            "state": "running",
            "coro_name": "asyncio_main",
            "created_at": (now - timedelta(minutes=5)).isoformat(),
            "last_updated_at": (now - timedelta(seconds=10)).isoformat(),
            "waiting_on": None,
            "awaited_by": [],
            "cancel_requested": False,
            "metadata": {}
        },
        {
            "task_id": "task-002",
            "name": "api_request",
            "state": "pending",
            "coro_name": "fetch_user_data",
            "created_at": (now - timedelta(minutes=10)).isoformat(),
            "last_updated_at": (now - timedelta(minutes=8)).isoformat(),
            "waiting_on": "task-003",
            "awaited_by": ["task-001"],
            "cancel_requested": False,
            "metadata": {}
        },
        {
            "task_id": "task-003",
            "name": "db_query",
            "state": "pending",
            "coro_name": "query_database",
            "created_at": (now - timedelta(minutes=15)).isoformat(),
            "last_updated_at": (now - timedelta(minutes=12)).isoformat(),
            "waiting_on": None,
            "awaited_by": ["task-002"],
            "cancel_requested": False,
            "metadata": {}
        }
    ]


@pytest.fixture
def sample_leak_tasks():
    now = utc_now()
    return [
        {
            "task_id": "leak-001",
            "name": "forgotten_task",
            "state": "pending",
            "coro_name": "periodic_cleanup",
            "created_at": (now - timedelta(hours=1)).isoformat(),
            "last_updated_at": (now - timedelta(minutes=50)).isoformat(),
            "waiting_on": None,
            "awaited_by": [],
            "cancel_requested": False,
            "metadata": {}
        },
        {
            "task_id": "normal-001",
            "name": "awaited_task",
            "state": "running",
            "coro_name": "fetch_data",
            "created_at": (now - timedelta(minutes=5)).isoformat(),
            "last_updated_at": (now - timedelta(seconds=10)).isoformat(),
            "waiting_on": None,
            "awaited_by": ["main-task"],
            "cancel_requested": False,
            "metadata": {}
        }
    ]


@pytest.fixture
def sample_cancel_not_working_events():
    now = utc_now()
    return [
        {
            "timestamp": (now - timedelta(minutes=10)).isoformat(),
            "event_type": "task_created",
            "task_id": "bad-cancel-001",
            "coro_name": "badly_written_coroutine",
            "details": {}
        },
        {
            "timestamp": (now - timedelta(minutes=9, seconds=30)).isoformat(),
            "event_type": "task_running",
            "task_id": "bad-cancel-001",
            "details": {}
        },
        {
            "timestamp": (now - timedelta(minutes=8)).isoformat(),
            "event_type": "task_pending",
            "task_id": "bad-cancel-001",
            "waiting_on": "slow-io",
            "details": {}
        },
        {
            "timestamp": (now - timedelta(minutes=5)).isoformat(),
            "event_type": "task_cancel_requested",
            "task_id": "bad-cancel-001",
            "details": {"source": "timeout"}
        },
        {
            "timestamp": (now - timedelta(seconds=10)).isoformat(),
            "event_type": "task_running",
            "task_id": "bad-cancel-001",
            "details": {"note": "Still running after cancel"}
        }
    ]
