from datetime import datetime
from typing import List, Optional, Dict, Any
from models import HistoryRecord
import uuid


class HistoryTracker:
    def __init__(self):
        self.records: List[HistoryRecord] = []

    def add_record(
        self,
        experiment_id: str,
        action: str,
        operator: str,
        details: str,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None
    ) -> HistoryRecord:
        record = HistoryRecord(
            record_id=str(uuid.uuid4()),
            experiment_id=experiment_id,
            action=action,
            operator=operator,
            timestamp=datetime.now(),
            details=details,
            before_state=before_state,
            after_state=after_state
        )
        self.records.append(record)
        return record

    def get_experiment_history(self, experiment_id: str) -> List[HistoryRecord]:
        return [r for r in self.records if r.experiment_id == experiment_id]

    def get_all_records(self) -> List[HistoryRecord]:
        return sorted(self.records, key=lambda r: r.timestamp, reverse=True)

    def format_record(self, record: HistoryRecord) -> str:
        time_str = record.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        return f"[{time_str}] {record.operator} - {record.action}: {record.details}"
