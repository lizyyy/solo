import os
import hashlib
from dataclasses import dataclass
from typing import Optional

from .executor import ExecutionResult


@dataclass
class SnapshotResult:
    passed: bool
    snapshot_matched: bool
    snapshot_path: Optional[str] = None


def get_snapshot_dir() -> str:
    return os.path.join(os.getcwd(), ".mdv_snapshots")


def get_snapshot_path(block_id: str) -> str:
    return os.path.join(get_snapshot_dir(), f"{block_id}.snap")


def ensure_snapshot_dir():
    os.makedirs(get_snapshot_dir(), exist_ok=True)


def read_snapshot(block_id: str) -> Optional[str]:
    snapshot_path = get_snapshot_path(block_id)
    if os.path.exists(snapshot_path):
        with open(snapshot_path, "r", encoding="utf-8") as f:
            return f.read()
    return None


def write_snapshot(block_id: str, output: str):
    ensure_snapshot_dir()
    snapshot_path = get_snapshot_path(block_id)
    with open(snapshot_path, "w", encoding="utf-8") as f:
        f.write(output)


def compare_snapshot(block_id: str, result: ExecutionResult) -> SnapshotResult:
    if not result.success:
        return SnapshotResult(passed=False, snapshot_matched=False)

    existing_snapshot = read_snapshot(block_id)
    if existing_snapshot is None:
        write_snapshot(block_id, result.output)
        return SnapshotResult(passed=True, snapshot_matched=False, snapshot_path=get_snapshot_path(block_id))

    if existing_snapshot == result.output:
        return SnapshotResult(passed=True, snapshot_matched=True, snapshot_path=get_snapshot_path(block_id))
    else:
        return SnapshotResult(passed=False, snapshot_matched=False, snapshot_path=get_snapshot_path(block_id))


def update_snapshot(block_id: str, result: ExecutionResult):
    if result.success:
        write_snapshot(block_id, result.output)