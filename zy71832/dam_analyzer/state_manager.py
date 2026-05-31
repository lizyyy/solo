import os
import json
import shutil
from datetime import datetime
from typing import List, Dict, Optional, Callable
from .config import Config
from .models import BattleRecord, RecordStatus


class StateManager:
    def __init__(self, config: Config):
        self.config = config
        self.records: Dict[str, BattleRecord] = {}
        self.history: List[Dict[str, str]] = []
        self._snapshot_counter = 0

    def add_records(self, records: List[BattleRecord], source: str = "") -> List[str]:
        added_ids = []
        for record in records:
            self.records[record.record_id] = record
            added_ids.append(record.record_id)

        if added_ids:
            self._create_snapshot(f"添加记录: {source}")

        return added_ids

    def remove_records(self, record_ids: List[str], reason: str = "") -> List[str]:
        removed_ids = []
        for rid in record_ids:
            if rid in self.records:
                del self.records[rid]
                removed_ids.append(rid)

        if removed_ids:
            self._create_snapshot(f"删除记录: {reason}")

        return removed_ids

    def update_record(self, record_id: str, updates: Dict, modify_reason: str = "") -> bool:
        if record_id not in self.records:
            return False

        record = self.records[record_id]

        for key, value in updates.items():
            if hasattr(record, key):
                setattr(record, key, value)

        record.status = RecordStatus.MANUAL_MODIFIED
        record.manual_modify_reason = modify_reason

        self._create_snapshot(f"修改记录: {record_id}")
        return True

    def get_record(self, record_id: str) -> Optional[BattleRecord]:
        return self.records.get(record_id)

    def get_all_records(self) -> List[BattleRecord]:
        return sorted(self.records.values(), key=lambda r: (r.round_num, r.team, r.player_id))

    def get_records_by_round(self, round_num: int) -> List[BattleRecord]:
        return [r for r in self.records.values() if r.round_num == round_num]

    def get_records_by_team(self, team: str) -> List[BattleRecord]:
        return [r for r in self.records.values() if r.team == team]

    def get_records_by_status(self, status: RecordStatus) -> List[BattleRecord]:
        return [r for r in self.records.values() if r.status == status]

    def get_records_by_filter(self, filter_func: Callable[[BattleRecord], bool]) -> List[BattleRecord]:
        return [r for r in self.records.values() if filter_func(r)]

    def get_round_range(self) -> tuple:
        if not self.records:
            return (0, 0)
        rounds = [r.round_num for r in self.records.values()]
        return (min(rounds), max(rounds))

    def get_all_teams(self) -> List[str]:
        return list({r.team for r in self.records.values()})

    def get_all_players(self) -> List[str]:
        return list({r.player_id for r in self.records.values()})

    def get_status_summary(self) -> Dict[str, int]:
        summary = {
            "已确认": 0,
            "待补": 0,
            "人工修改": 0,
        }
        for record in self.records.values():
            summary[record.status.value] += 1
        return summary

    def _create_snapshot(self, description: str) -> str:
        self._snapshot_counter += 1
        snapshot_id = f"snapshot_{self._snapshot_counter}_{datetime.now().strftime('%Y%m%d%H%M%S')}"

        snapshot_path = os.path.join(self.config.backup_dir, f"{snapshot_id}.json")
        self._save_to_file(snapshot_path)

        self.history.append(
            {
                "id": snapshot_id,
                "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "description": description,
                "record_count": len(self.records),
            }
        )

        if len(self.history) > 50:
            old_snapshot = self.history.pop(0)
            old_path = os.path.join(self.config.backup_dir, f"{old_snapshot['id']}.json")
            if os.path.exists(old_path):
                os.remove(old_path)

        return snapshot_id

    def rollback_to_snapshot(self, snapshot_id: str) -> bool:
        snapshot_path = os.path.join(self.config.backup_dir, f"{snapshot_id}.json")
        if not os.path.exists(snapshot_path):
            return False

        self._load_from_file(snapshot_path)
        return True

    def list_snapshots(self) -> List[Dict]:
        return list(reversed(self.history[-20:]))

    def save_to_file(self, filepath: str) -> None:
        self._save_to_file(filepath)

    def _save_to_file(self, filepath: str) -> None:
        data = {
            "records": [r.to_dict() for r in self.records.values()],
            "export_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "record_count": len(self.records),
        }

        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_from_file(self, filepath: str) -> int:
        return self._load_from_file(filepath)

    def _load_from_file(self, filepath: str) -> int:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.records = {}
        for record_data in data.get("records", []):
            record = BattleRecord.from_dict(record_data)
            self.records[record.record_id] = record

        return len(self.records)

    def clear_all(self) -> None:
        self.records.clear()
        self._create_snapshot("清空所有数据")
