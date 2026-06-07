import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, Type, TypeVar
from config import SNAPSHOT_DIR, TRAINING_LOG_DIR, DROPOUT_RECORDS_DIR, HISTORY_DIR
from models import (
    FeatureSnapshot, TrainingLog, DropoutRecord,
    HistoryEntry, ReviewDecision, DropoutStatus
)

T = TypeVar('T')


class StorageManager:
    def __init__(self):
        self._snapshot_index: Dict[str, str] = {}
        self._load_indexes()

    def _load_indexes(self):
        for f in SNAPSHOT_DIR.glob("*.json"):
            try:
                data = json.loads(f.read_text())
                self._snapshot_index[data['snapshot_id']] = str(f)
            except Exception:
                pass

    def _save_json(self, obj: Any, path: Path):
        path.write_text(json.dumps(obj.model_dump(mode='json'), indent=2, ensure_ascii=False))

    def _load_json(self, path: Path, cls: Type[T]) -> Optional[T]:
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text())
            return cls(**data)
        except Exception:
            return None

    def _gen_id(self) -> str:
        return uuid.uuid4().hex[:16]

    def save_snapshot(self, snapshot: FeatureSnapshot) -> FeatureSnapshot:
        if snapshot.snapshot_id in self._snapshot_index:
            existing = self._load_json(Path(self._snapshot_index[snapshot.snapshot_id]), FeatureSnapshot)
            if existing:
                return existing
        path = SNAPSHOT_DIR / f"{snapshot.snapshot_id}.json"
        self._save_json(snapshot, path)
        self._snapshot_index[snapshot.snapshot_id] = str(path)
        return snapshot

    def get_snapshot(self, snapshot_id: str) -> Optional[FeatureSnapshot]:
        if snapshot_id in self._snapshot_index:
            return self._load_json(Path(self._snapshot_index[snapshot_id]), FeatureSnapshot)
        path = SNAPSHOT_DIR / f"{snapshot_id}.json"
        if path.exists():
            return self._load_json(path, FeatureSnapshot)
        return None

    def list_snapshots(self, client_id: Optional[str] = None) -> List[FeatureSnapshot]:
        snapshots = []
        for f in SNAPSHOT_DIR.glob("*.json"):
            s = self._load_json(f, FeatureSnapshot)
            if s and (client_id is None or s.client_id == client_id):
                snapshots.append(s)
        return sorted(snapshots, key=lambda x: x.timestamp)

    def save_training_log(self, log: TrainingLog) -> TrainingLog:
        path = TRAINING_LOG_DIR / f"{log.log_id}.json"
        self._save_json(log, path)
        return log

    def get_training_log(self, log_id: str) -> Optional[TrainingLog]:
        path = TRAINING_LOG_DIR / f"{log_id}.json"
        return self._load_json(path, TrainingLog)

    def list_training_logs(self, client_id: Optional[str] = None, round_num: Optional[int] = None) -> List[TrainingLog]:
        logs = []
        for f in TRAINING_LOG_DIR.glob("*.json"):
            log = self._load_json(f, TrainingLog)
            if log:
                if client_id and log.client_id != client_id:
                    continue
                if round_num and log.round_num != round_num:
                    continue
                logs.append(log)
        return sorted(logs, key=lambda x: x.timestamp)

    def save_dropout_record(self, record: DropoutRecord) -> DropoutRecord:
        path = DROPOUT_RECORDS_DIR / f"{record.record_id}.json"
        self._save_json(record, path)
        return record

    def get_dropout_record(self, record_id: str) -> Optional[DropoutRecord]:
        path = DROPOUT_RECORDS_DIR / f"{record_id}.json"
        return self._load_json(path, DropoutRecord)

    def list_dropout_records(self, status: Optional[DropoutStatus] = None,
                             client_id: Optional[str] = None) -> List[DropoutRecord]:
        records = []
        for f in DROPOUT_RECORDS_DIR.glob("*.json"):
            r = self._load_json(f, DropoutRecord)
            if r:
                if status and r.status != status:
                    continue
                if client_id and r.client_id != client_id:
                    continue
                records.append(r)
        return sorted(records, key=lambda x: x.detected_at, reverse=True)

    def add_history_entry(self, record_id: str, field_name: str,
                          old_value: Any, new_value: Any, changed_by: str) -> HistoryEntry:
        entry = HistoryEntry(
            entry_id=self._gen_id(),
            record_id=record_id,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            changed_by=changed_by
        )
        path = HISTORY_DIR / f"{entry.entry_id}.json"
        self._save_json(entry, path)
        return entry

    def get_record_history(self, record_id: str) -> List[HistoryEntry]:
        entries = []
        for f in HISTORY_DIR.glob("*.json"):
            e = self._load_json(f, HistoryEntry)
            if e and e.record_id == record_id:
                entries.append(e)
        return sorted(entries, key=lambda x: x.changed_at)

    def save_review_decision(self, decision: ReviewDecision) -> ReviewDecision:
        path = HISTORY_DIR / f"review_{decision.record_id}_{decision.decided_at.strftime('%Y%m%d%H%M%S')}.json"
        self._save_json(decision, path)
        return decision
