import json
import os
from datetime import datetime
from typing import Dict, List, Optional

from .models import (
    DataSource,
    LockSnapshot,
    HeartbeatRecord,
    ExecutionLog,
    LockPolicy,
    ReleaseRecord,
    AbnormalReport,
)


def parse_datetime(value: str) -> datetime:
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        from dateutil import parser
        return parser.parse(value)


class DataLoader:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir

    def load(self) -> DataSource:
        snapshots = self._load_snapshots()
        heartbeats = self._load_heartbeats()
        execution_logs = self._load_execution_logs()
        policies = self._load_policies()
        release_history = self._load_release_history()
        abnormal_reports = self._load_abnormal_reports()

        return DataSource(
            snapshots=snapshots,
            heartbeats=heartbeats,
            execution_logs=execution_logs,
            policies=policies,
            release_history=release_history,
            abnormal_reports=abnormal_reports,
        )

    def save_release_record(self, record: ReleaseRecord):
        path = os.path.join(self.data_dir, "release_history.json")
        records = self._load_json_file(path, default=[])
        records.append(self._release_record_to_dict(record))
        self._save_json_file(path, records)

    def save_abnormal_report(self, report: AbnormalReport):
        path = os.path.join(self.data_dir, "abnormal_reports.json")
        reports = self._load_json_file(path, default=[])
        reports.append(self._abnormal_report_to_dict(report))
        self._save_json_file(path, reports)

    def _load_json_file(self, filename: str, default=None):
        path = os.path.join(self.data_dir, filename)
        if not os.path.exists(path):
            return default if default is not None else []
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_json_file(self, filename: str, data):
        path = os.path.join(self.data_dir, filename)
        os.makedirs(self.data_dir, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    def _load_snapshots(self) -> List[LockSnapshot]:
        data = self._load_json_file("lock_snapshots.json", default=[])
        return [
            LockSnapshot(
                lock_key=item["lock_key"],
                lock_value=item.get("lock_value", ""),
                holder_id=item.get("holder_id", ""),
                holder_name=item.get("holder_name", ""),
                holder_ip=item.get("holder_ip", ""),
                holder_pid=item.get("holder_pid", 0),
                acquired_at=parse_datetime(item["acquired_at"]),
                expire_at=parse_datetime(item["expire_at"]),
                last_heartbeat_at=(
                    parse_datetime(item["last_heartbeat_at"])
                    if item.get("last_heartbeat_at")
                    else None
                ),
                metadata=item.get("metadata", {}),
            )
            for item in data
        ]

    def _load_heartbeats(self) -> List[HeartbeatRecord]:
        data = self._load_json_file("heartbeats.json", default=[])
        return [
            HeartbeatRecord(
                holder_id=item["holder_id"],
                timestamp=parse_datetime(item["timestamp"]),
                status=item.get("status", "alive"),
                load=item.get("load"),
                memory_usage=item.get("memory_usage"),
            )
            for item in data
        ]

    def _load_execution_logs(self) -> List[ExecutionLog]:
        data = self._load_json_file("execution_logs.json", default=[])
        return [
            ExecutionLog(
                lock_key=item["lock_key"],
                holder_id=item["holder_id"],
                event=item["event"],
                timestamp=parse_datetime(item["timestamp"]),
                details=item.get("details", {}),
            )
            for item in data
        ]

    def _load_policies(self) -> List[LockPolicy]:
        data = self._load_json_file("lock_policies.json", default=[])
        return [
            LockPolicy(
                task_name=item["task_name"],
                lock_key_pattern=item["lock_key_pattern"],
                max_execution_time=item["max_execution_time"],
                heartbeat_interval=item["heartbeat_interval"],
                heartbeat_timeout=item["heartbeat_timeout"],
                allowed_holders=item.get("allowed_holders", []),
                description=item.get("description", ""),
            )
            for item in data
        ]

    def _load_release_history(self) -> List[ReleaseRecord]:
        from .models import ReleaseResult
        data = self._load_json_file("release_history.json", default=[])
        return [
            ReleaseRecord(
                lock_key=item["lock_key"],
                release_time=parse_datetime(item["release_time"]),
                result=ReleaseResult(item["result"]),
                confirmation_code=item["confirmation_code"],
                checks=item.get("checks", []),
                user_confirmation=item.get("user_confirmation"),
                task_recovered=item.get("task_recovered"),
                notes=item.get("notes"),
            )
            for item in data
        ]

    def _load_abnormal_reports(self) -> List[AbnormalReport]:
        data = self._load_json_file("abnormal_reports.json", default=[])
        return [
            AbnormalReport(
                type=item["type"],
                lock_key=item["lock_key"],
                message=item["message"],
                timestamp=parse_datetime(item["timestamp"]),
                details=item.get("details", {}),
            )
            for item in data
        ]

    def _release_record_to_dict(self, record: ReleaseRecord) -> Dict:
        return {
            "lock_key": record.lock_key,
            "release_time": record.release_time.isoformat(),
            "result": record.result.value,
            "confirmation_code": record.confirmation_code,
            "checks": record.checks,
            "user_confirmation": record.user_confirmation,
            "task_recovered": record.task_recovered,
            "notes": record.notes,
        }

    def _abnormal_report_to_dict(self, report: AbnormalReport) -> Dict:
        return {
            "type": report.type,
            "lock_key": report.lock_key,
            "message": report.message,
            "timestamp": report.timestamp.isoformat(),
            "details": report.details,
        }
