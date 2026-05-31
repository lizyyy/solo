import json
import os
from typing import Dict, List, Optional, Any
from datetime import datetime

from .models import (
    DiffRecord,
    ChangeOrder,
    OperationLog,
    ManualConfirm,
    RecordStatus,
    DiffType,
    generate_id,
)


class DiffReportStorage:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self._ensure_dirs()

    def _ensure_dirs(self):
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "records"), exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "orders"), exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "logs"), exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "confirms"), exist_ok=True)

    def _get_record_path(self, record_id: str) -> str:
        return os.path.join(self.data_dir, "records", f"{record_id}.json")

    def _get_order_path(self, order_id: str) -> str:
        return os.path.join(self.data_dir, "orders", f"{order_id}.json")

    def _get_log_path(self, log_id: str) -> str:
        return os.path.join(self.data_dir, "logs", f"{log_id}.json")

    def _get_confirm_path(self, confirm_id: str) -> str:
        return os.path.join(self.data_dir, "confirms", f"{confirm_id}.json")

    def save_record(self, record: DiffRecord) -> None:
        record.update_time = datetime.now().isoformat()
        with open(self._get_record_path(record.record_id), "w", encoding="utf-8") as f:
            json.dump(record.to_dict(), f, ensure_ascii=False, indent=2)

    def load_record(self, record_id: str) -> Optional[DiffRecord]:
        path = self._get_record_path(record_id)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            return DiffRecord.from_dict(json.load(f))

    def load_all_records(self) -> List[DiffRecord]:
        records = []
        records_dir = os.path.join(self.data_dir, "records")
        for filename in os.listdir(records_dir):
            if filename.endswith(".json"):
                record_id = filename[:-5]
                record = self.load_record(record_id)
                if record:
                    records.append(record)
        return sorted(records, key=lambda r: r.create_time, reverse=True)

    def save_order(self, order: ChangeOrder) -> None:
        with open(self._get_order_path(order.order_id), "w", encoding="utf-8") as f:
            json.dump(order.to_dict(), f, ensure_ascii=False, indent=2)

    def load_order(self, order_id: str) -> Optional[ChangeOrder]:
        path = self._get_order_path(order_id)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return ChangeOrder(**data)

    def save_log(self, log: OperationLog) -> None:
        with open(self._get_log_path(log.log_id), "w", encoding="utf-8") as f:
            json.dump(log.to_dict(), f, ensure_ascii=False, indent=2)

    def load_logs_for_record(self, record_id: str) -> List[OperationLog]:
        logs = []
        logs_dir = os.path.join(self.data_dir, "logs")
        for filename in os.listdir(logs_dir):
            if filename.endswith(".json"):
                with open(os.path.join(logs_dir, filename), "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if data.get("record_id") == record_id:
                        logs.append(OperationLog(**data))
        return sorted(logs, key=lambda l: l.timestamp)

    def save_confirm(self, confirm: ManualConfirm) -> None:
        with open(self._get_confirm_path(confirm.confirm_id), "w", encoding="utf-8") as f:
            json.dump(confirm.to_dict(), f, ensure_ascii=False, indent=2)

    def load_confirms_for_record(self, record_id: str) -> List[ManualConfirm]:
        confirms = []
        confirms_dir = os.path.join(self.data_dir, "confirms")
        for filename in os.listdir(confirms_dir):
            if filename.endswith(".json"):
                with open(os.path.join(confirms_dir, filename), "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if data.get("record_id") == record_id:
                        confirms.append(ManualConfirm(**data))
        return sorted(confirms, key=lambda c: c.timestamp)
