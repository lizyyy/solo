import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

from src.config import HISTORY_DIR
from src.models.margin_record import MarginRecord
from src.models.audit_history import AuditRecord


class HistoryManager:
    def __init__(self, history_dir: Path = HISTORY_DIR):
        self.history_dir = history_dir
        self.history_dir.mkdir(parents=True, exist_ok=True)

    def save_snapshot(self, records: List[MarginRecord], snapshot_name: str = None) -> Path:
        if snapshot_name is None:
            snapshot_name = f"snapshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        snapshot_file = self.history_dir / f"{snapshot_name}.json"
        data = {
            "snapshot_name": snapshot_name,
            "created_at": datetime.now().isoformat(),
            "records": [record.to_dict() for record in records]
        }

        with open(snapshot_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return snapshot_file

    def load_snapshot(self, snapshot_name: str) -> List[MarginRecord]:
        snapshot_file = self.history_dir / f"{snapshot_name}.json"
        if not snapshot_file.exists():
            return []

        with open(snapshot_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        return [MarginRecord.from_dict(rec) for rec in data.get("records", [])]

    def list_snapshots(self) -> List[Dict[str, Any]]:
        snapshots = []
        for file in self.history_dir.glob("snapshot_*.json"):
            with open(file, "r", encoding="utf-8") as f:
                data = json.load(f)
                snapshots.append({
                    "filename": file.name,
                    "snapshot_name": data.get("snapshot_name", file.stem),
                    "created_at": data.get("created_at", ""),
                    "record_count": len(data.get("records", []))
                })

        return sorted(snapshots, key=lambda x: x["created_at"], reverse=True)

    def get_record_history(self, margin_id: str) -> List[Dict[str, Any]]:
        history = []
        for file in self.history_dir.glob("snapshot_*.json"):
            with open(file, "r", encoding="utf-8") as f:
                data = json.load(f)
                for record in data.get("records", []):
                    if record.get("margin_id") == margin_id:
                        history.append({
                            "snapshot_name": data.get("snapshot_name"),
                            "snapshot_time": data.get("created_at"),
                            "record": record
                        })

        return sorted(history, key=lambda x: x["snapshot_time"])

    def compare_snapshots(self, snapshot1: str, snapshot2: str) -> Dict[str, Any]:
        records1 = {r.margin_id: r for r in self.load_snapshot(snapshot1)}
        records2 = {r.margin_id: r for r in self.load_snapshot(snapshot2)}

        all_ids = set(records1.keys()) | set(records2.keys())
        changes = []

        for mid in all_ids:
            r1 = records1.get(mid)
            r2 = records2.get(mid)

            if r1 is None:
                changes.append({
                    "type": "NEW",
                    "margin_id": mid,
                    "counterparty": r2.counterparty if r2 else "",
                    "new_value": r2.to_dict() if r2 else None
                })
            elif r2 is None:
                changes.append({
                    "type": "DELETED",
                    "margin_id": mid,
                    "counterparty": r1.counterparty,
                    "old_value": r1.to_dict()
                })
            else:
                diff = self._compare_records(r1, r2)
                if diff:
                    changes.append({
                        "type": "MODIFIED",
                        "margin_id": mid,
                        "counterparty": r1.counterparty,
                        "changes": diff
                    })

        return {
            "snapshot1": snapshot1,
            "snapshot2": snapshot2,
            "total_changes": len(changes),
            "changes": changes
        }

    def _compare_records(self, r1: MarginRecord, r2: MarginRecord) -> List[Dict[str, Any]]:
        diffs = []
        fields = ["required_margin", "actual_margin", "margin_shortfall", "margin_excess", "review_status", "remarks"]

        for field in fields:
            v1 = getattr(r1, field)
            v2 = getattr(r2, field)
            if v1 != v2:
                diffs.append({
                    "field": field,
                    "old_value": v1,
                    "new_value": v2
                })

        return diffs

    def save_audit_log(self, audit_records: List[AuditRecord], log_name: str = None) -> Path:
        if log_name is None:
            log_name = f"audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        log_file = self.history_dir / f"{log_name}.json"
        data = {
            "log_name": log_name,
            "created_at": datetime.now().isoformat(),
            "audit_records": [record.to_dict() for record in audit_records]
        }

        with open(log_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return log_file
