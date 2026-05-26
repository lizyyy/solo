import pandas as pd
import json
import hashlib
from typing import Dict, Any, List, Tuple
from datetime import datetime
from io import StringIO

from .models import (
    RecordStatus,
    ProcessedRecord,
    BatchProcessResult,
    BatchStatus
)
from .rules import BusinessRuleEngine


class DataProcessorService:
    def __init__(self):
        self.rule_engine = BusinessRuleEngine()
        self.batch_history: Dict[str, BatchStatus] = {}
        self.processed_batches: set = set()

        self.existing_repairs: Dict[str, Any] = {}
        self.existing_workers: Dict[str, Any] = {}
        self.existing_ratings: Dict[str, Any] = {}

    def _generate_batch_id(self, data_content: str) -> str:
        return hashlib.md5(data_content.encode('utf-8')).hexdigest()

    def _is_batch_processed(self, batch_id: str) -> bool:
        return batch_id in self.processed_batches

    def _clean_nan(self, obj):
        if isinstance(obj, float) and pd.isna(obj):
            return None
        if isinstance(obj, dict):
            return {k: self._clean_nan(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [self._clean_nan(item) for item in obj]
        return obj

    def parse_csv(self, csv_content: str) -> List[Dict[str, Any]]:
        df = pd.read_csv(StringIO(csv_content))
        records = df.to_dict('records')
        return [self._clean_nan(record) for record in records]

    def parse_json(self, json_content: str) -> List[Dict[str, Any]]:
        data = json.loads(json_content)
        if isinstance(data, list):
            return data
        return [data]

    def process_repairs(
        self, records: List[Dict[str, Any]], batch_id: str
    ) -> Tuple[List[ProcessedRecord], List[ProcessedRecord], List[ProcessedRecord]]:
        normal = []
        pending = []
        failed = []

        for record in records:
            status, reason, suggestion = self.rule_engine.validate_repair_record(
                record, self.existing_repairs
            )

            processed = ProcessedRecord(
                original_data=record,
                status=status,
                reason=reason,
                suggestion=suggestion,
                record_type="repair"
            )

            if status == RecordStatus.NORMAL:
                normal.append(processed)
                self.existing_repairs[record.get("repair_id")] = record
            elif status == RecordStatus.PENDING_CONFIRM:
                pending.append(processed)
                self.existing_repairs[record.get("repair_id")] = record
            else:
                failed.append(processed)

        return normal, pending, failed

    def process_workers(
        self, records: List[Dict[str, Any]], batch_id: str
    ) -> Tuple[List[ProcessedRecord], List[ProcessedRecord], List[ProcessedRecord]]:
        normal = []
        pending = []
        failed = []

        for record in records:
            status, reason, suggestion = self.rule_engine.validate_worker_record(
                record, self.existing_workers
            )

            processed = ProcessedRecord(
                original_data=record,
                status=status,
                reason=reason,
                suggestion=suggestion,
                record_type="worker"
            )

            if status == RecordStatus.NORMAL:
                normal.append(processed)
                self.existing_workers[record.get("worker_id")] = record
            elif status == RecordStatus.PENDING_CONFIRM:
                pending.append(processed)
                self.existing_workers[record.get("worker_id")] = record
            else:
                failed.append(processed)

        return normal, pending, failed

    def process_ratings(
        self, records: List[Dict[str, Any]], batch_id: str
    ) -> Tuple[List[ProcessedRecord], List[ProcessedRecord], List[ProcessedRecord]]:
        normal = []
        pending = []
        failed = []

        for record in records:
            status, reason, suggestion = self.rule_engine.validate_rating_record(
                record, self.existing_ratings, self.existing_repairs, self.existing_workers
            )

            processed = ProcessedRecord(
                original_data=record,
                status=status,
                reason=reason,
                suggestion=suggestion,
                record_type="rating"
            )

            if status == RecordStatus.NORMAL:
                normal.append(processed)
                self.existing_ratings[record.get("rating_id")] = record
            elif status == RecordStatus.PENDING_CONFIRM:
                pending.append(processed)
            else:
                failed.append(processed)

        return normal, pending, failed

    def process_batch(
        self, repair_csv: str = None, worker_json: str = None, rating_json: str = None
    ) -> BatchProcessResult:
        combined_content = f"{repair_csv or ''}|{worker_json or ''}|{rating_json or ''}"
        batch_id = self._generate_batch_id(combined_content)

        if self._is_batch_processed(batch_id):
            existing = self.batch_history.get(batch_id)
            return BatchProcessResult(
                batch_id=batch_id,
                process_time=existing.created_at,
                total_count=existing.total_count,
                normal_count=existing.normal_count,
                pending_count=existing.pending_count,
                failed_count=existing.failed_count,
                normal_records=[],
                pending_records=[],
                failed_records=[]
            )

        self.rule_engine.reset()

        all_normal = []
        all_pending = []
        all_failed = []

        if repair_csv:
            repair_records = self.parse_csv(repair_csv)
            n, p, f = self.process_repairs(repair_records, batch_id)
            all_normal.extend(n)
            all_pending.extend(p)
            all_failed.extend(f)

        if worker_json:
            worker_records = self.parse_json(worker_json)
            n, p, f = self.process_workers(worker_records, batch_id)
            all_normal.extend(n)
            all_pending.extend(p)
            all_failed.extend(f)

        if rating_json:
            rating_records = self.parse_json(rating_json)
            n, p, f = self.process_ratings(rating_records, batch_id)
            all_normal.extend(n)
            all_pending.extend(p)
            all_failed.extend(f)

        total = len(all_normal) + len(all_pending) + len(all_failed)

        result = BatchProcessResult(
            batch_id=batch_id,
            process_time=datetime.now(),
            total_count=total,
            normal_count=len(all_normal),
            pending_count=len(all_pending),
            failed_count=len(all_failed),
            normal_records=all_normal,
            pending_records=all_pending,
            failed_records=all_failed
        )

        self.processed_batches.add(batch_id)
        self.batch_history[batch_id] = BatchStatus(
            batch_id=batch_id,
            created_at=datetime.now(),
            status="completed",
            total_count=total,
            normal_count=len(all_normal),
            pending_count=len(all_pending),
            failed_count=len(all_failed)
        )

        return result

    def get_batch_status(self, batch_id: str) -> BatchStatus:
        return self.batch_history.get(batch_id)

    def get_all_batches(self) -> List[BatchStatus]:
        return list(self.batch_history.values())

    def clear_history(self):
        self.batch_history.clear()
        self.processed_batches.clear()
        self.existing_repairs.clear()
        self.existing_workers.clear()
        self.existing_ratings.clear()


data_service = DataProcessorService()
