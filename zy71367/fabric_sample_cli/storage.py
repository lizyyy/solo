import json
import os
from datetime import datetime
from typing import Optional
from .models import DataStore, Supplier, FabricSample, Garment, MatchingRecord, ErrorRecord, HistoryRecord, ArrivalReminder, OperationType


DATA_FILE = os.path.join(os.path.dirname(__file__), 'data', 'datastore.json')
ERRORS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'errors.json')
HISTORY_FILE = os.path.join(os.path.dirname(__file__), 'data', 'history.json')


class StorageManager:
    def __init__(self, data_dir: Optional[str] = None):
        self.data_dir = data_dir or os.path.join(os.path.dirname(__file__), 'data')
        self.data_file = os.path.join(self.data_dir, 'datastore.json')
        self.errors_file = os.path.join(self.data_dir, 'errors.json')
        self.history_file = os.path.join(self.data_dir, 'history.json')
        self._ensure_dirs()

    def _ensure_dirs(self):
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(os.path.join(os.path.dirname(__file__), 'exports'), exist_ok=True)
        os.makedirs(os.path.join(os.path.dirname(__file__), 'history'), exist_ok=True)

    def load(self) -> DataStore:
        if os.path.exists(self.data_file):
            with open(self.data_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return DataStore(**data)
        return DataStore()

    def save(self, store: DataStore) -> None:
        data = store.model_dump(mode='json')
        with open(self.data_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def add_history(self, record: HistoryRecord, store: DataStore) -> DataStore:
        store.history[record.record_id] = record
        self._append_history_file(record)
        return store

    def _append_history_file(self, record: HistoryRecord):
        records = []
        if os.path.exists(self.history_file):
            with open(self.history_file, 'r', encoding='utf-8') as f:
                records = json.load(f)
        records.append(record.model_dump(mode='json'))
        with open(self.history_file, 'w', encoding='utf-8') as f:
            json.dump(records, f, ensure_ascii=False, indent=2)

    def add_error(self, error: ErrorRecord, store: DataStore) -> DataStore:
        store.errors[error.error_id] = error
        self._append_errors_file(error)
        return store

    def _append_errors_file(self, error: ErrorRecord):
        records = []
        if os.path.exists(self.errors_file):
            with open(self.errors_file, 'r', encoding='utf-8') as f:
                records = json.load(f)
        records.append(error.model_dump(mode='json'))
        with open(self.errors_file, 'w', encoding='utf-8') as f:
            json.dump(records, f, ensure_ascii=False, indent=2)

    def load_errors(self) -> list[ErrorRecord]:
        if os.path.exists(self.errors_file):
            with open(self.errors_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return [ErrorRecord(**item) for item in data]
        return []

    def load_history(self) -> list[HistoryRecord]:
        if os.path.exists(self.history_file):
            with open(self.history_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return [HistoryRecord(**item) for item in data]
        return []

    def generate_id(self, prefix: str) -> str:
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")[:-3]
        return f"{prefix}-{timestamp}"

    def create_history_record(
        self,
        operation_type: OperationType,
        entity_type: str,
        entity_id: str,
        before_data: Optional[dict] = None,
        after_data: Optional[dict] = None,
        change_reason: Optional[str] = None,
        operator: Optional[str] = None,
        calculation_trace: Optional[list] = None
    ) -> HistoryRecord:
        return HistoryRecord(
            record_id=self.generate_id("HIST"),
            operation_type=operation_type,
            entity_type=entity_type,
            entity_id=entity_id,
            operator=operator,
            before_data=before_data,
            after_data=after_data,
            change_reason=change_reason,
            calculation_trace=calculation_trace
        )

    def create_error_record(
        self,
        error_type: str,
        error_code: str,
        message: str,
        sample_id: Optional[str] = None,
        garment_id: Optional[str] = None,
        supplier_id: Optional[str] = None,
        severity: str = "warning",
        calculation_detail: Optional[dict] = None
    ) -> ErrorRecord:
        return ErrorRecord(
            error_id=self.generate_id("ERR"),
            error_type=error_type,
            error_code=error_code,
            message=message,
            related_sample_id=sample_id,
            related_garment_id=garment_id,
            related_supplier_id=supplier_id,
            severity=severity,
            calculation_detail=calculation_detail
        )
