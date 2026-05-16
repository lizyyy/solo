import json
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path

from .models import (
    DutyRecord,
    CandidateItem,
    InspectionBatch,
    HistoryRecord,
    RiskType,
    OperationType,
    OperationStatus,
    generate_id
)


class Storage:
    def __init__(self, base_path: str = "./data"):
        self.base_path = Path(base_path)
        self.duty_records_path = self.base_path / "duty_records.json"
        self.batches_path = self.base_path / "batches.json"
        self.history_path = self.base_path / "history.json"
        self._init_storage()

    def _init_storage(self):
        self.base_path.mkdir(parents=True, exist_ok=True)
        for path in [self.duty_records_path, self.batches_path, self.history_path]:
            if not path.exists():
                with open(path, 'w', encoding='utf-8') as f:
                    json.dump([], f)

    def _load_json(self, path: Path) -> List[Dict[str, Any]]:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _save_json(self, path: Path, data: List[Dict[str, Any]]):
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def save_duty_record(self, record: DutyRecord):
        records = self._load_json(self.duty_records_path)
        existing = next((r for r in records if r["record_id"] == record.record_id), None)
        if existing:
            records.remove(existing)
        records.append(record.to_dict())
        self._save_json(self.duty_records_path, records)

    def get_duty_record(self, record_id: str) -> Optional[DutyRecord]:
        records = self._load_json(self.duty_records_path)
        for r in records:
            if r["record_id"] == record_id:
                return DutyRecord(
                    record_id=r["record_id"],
                    date=r["date"],
                    engineer=r["engineer"],
                    content=r["content"],
                    version=r["version"],
                    last_updated=datetime.fromisoformat(r["last_updated"]),
                    created_at=datetime.fromisoformat(r["created_at"]),
                    is_expired=r["is_expired"],
                    metadata=r.get("metadata", {})
                )
        return None

    def get_all_duty_records(self) -> List[DutyRecord]:
        records = self._load_json(self.duty_records_path)
        result = []
        for r in records:
            result.append(DutyRecord(
                record_id=r["record_id"],
                date=r["date"],
                engineer=r["engineer"],
                content=r["content"],
                version=r["version"],
                last_updated=datetime.fromisoformat(r["last_updated"]),
                created_at=datetime.fromisoformat(r["created_at"]),
                is_expired=r["is_expired"],
                metadata=r.get("metadata", {})
            ))
        return result

    def save_batch(self, batch: InspectionBatch):
        batches = self._load_json(self.batches_path)
        existing = next((b for b in batches if b["batch_id"] == batch.batch_id), None)
        if existing:
            batches.remove(existing)
        batches.append(batch.to_dict())
        self._save_json(self.batches_path, batches)

    def get_batch(self, batch_id: str) -> Optional[InspectionBatch]:
        batches = self._load_json(self.batches_path)
        for b in batches:
            if b["batch_id"] == batch_id:
                candidates = []
                for c in b["candidates"]:
                    candidates.append(CandidateItem(
                        record_id=c["record_id"],
                        risk_type=RiskType(c["risk_type"]),
                        description=c["description"],
                        suggestion=c["suggestion"],
                        current_version=c["current_version"],
                        detected_version=c.get("detected_version"),
                        details=c.get("details", {})
                    ))
                return InspectionBatch(
                    batch_id=b["batch_id"],
                    operator=b["operator"],
                    operation_type=OperationType(b["operation_type"]),
                    created_at=datetime.fromisoformat(b["created_at"]),
                    status=OperationStatus(b["status"]),
                    candidates=candidates,
                    executed_at=datetime.fromisoformat(b["executed_at"]) if b["executed_at"] else None,
                    notes=b.get("notes", "")
                )
        return None

    def get_all_batches(self) -> List[InspectionBatch]:
        batches = self._load_json(self.batches_path)
        result = []
        for b in batches:
            candidates = []
            for c in b["candidates"]:
                candidates.append(CandidateItem(
                    record_id=c["record_id"],
                    risk_type=RiskType(c["risk_type"]),
                    description=c["description"],
                    suggestion=c["suggestion"],
                    current_version=c["current_version"],
                    detected_version=c.get("detected_version"),
                    details=c.get("details", {})
                ))
            result.append(InspectionBatch(
                batch_id=b["batch_id"],
                operator=b["operator"],
                operation_type=OperationType(b["operation_type"]),
                created_at=datetime.fromisoformat(b["created_at"]),
                status=OperationStatus(b["status"]),
                candidates=candidates,
                executed_at=datetime.fromisoformat(b["executed_at"]) if b["executed_at"] else None,
                notes=b.get("notes", "")
            ))
        return result

    def save_history(self, history: HistoryRecord):
        histories = self._load_json(self.history_path)
        histories.append(history.to_dict())
        self._save_json(self.history_path, histories)

    def get_history_by_batch(self, batch_id: str) -> List[HistoryRecord]:
        histories = self._load_json(self.history_path)
        result = []
        for h in histories:
            if h["batch_id"] == batch_id:
                result.append(HistoryRecord(
                    history_id=h["history_id"],
                    batch_id=h["batch_id"],
                    record_id=h["record_id"],
                    operator=h["operator"],
                    risk_type=RiskType(h["risk_type"]),
                    operation_type=OperationType(h["operation_type"]),
                    executed_at=datetime.fromisoformat(h["executed_at"]),
                    before_state=h["before_state"],
                    after_state=h["after_state"],
                    result=h["result"],
                    is_anomaly=h.get("is_anomaly", False),
                    details=h.get("details", {})
                ))
        return result

    def get_all_history(self) -> List[HistoryRecord]:
        histories = self._load_json(self.history_path)
        result = []
        for h in histories:
            result.append(HistoryRecord(
                history_id=h["history_id"],
                batch_id=h["batch_id"],
                record_id=h["record_id"],
                operator=h["operator"],
                risk_type=RiskType(h["risk_type"]),
                operation_type=OperationType(h["operation_type"]),
                executed_at=datetime.fromisoformat(h["executed_at"]),
                before_state=h["before_state"],
                after_state=h["after_state"],
                result=h["result"],
                is_anomaly=h.get("is_anomaly", False),
                details=h.get("details", {})
            ))
        return result
