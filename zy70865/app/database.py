from typing import Dict, List, Optional
from datetime import datetime
import uuid
from .models import WashItem, RecycleItem, RoomTypeConfig, CompensationRecord, ReconciliationResult


class Database:
    def __init__(self):
        self.wash_records: Dict[str, List[WashItem]] = {}
        self.recycle_records: Dict[str, List[RecycleItem]] = {}
        self.room_configs: Dict[str, RoomTypeConfig] = {}
        self.compensation_records: List[CompensationRecord] = []
        self.processed_batches: set = set()
        self.reconciliation_history: Dict[str, ReconciliationResult] = {}

    def add_wash_items(self, items: List[WashItem]) -> None:
        for item in items:
            if item.batch_id not in self.wash_records:
                self.wash_records[item.batch_id] = []
            self.wash_records[item.batch_id].append(item)

    def add_recycle_items(self, items: List[RecycleItem]) -> None:
        for item in items:
            if item.batch_id not in self.recycle_records:
                self.recycle_records[item.batch_id] = []
            self.recycle_records[item.batch_id].append(item)

    def add_room_config(self, config: RoomTypeConfig) -> None:
        self.room_configs[config.room_type] = config

    def is_batch_processed(self, batch_id: str) -> bool:
        return batch_id in self.processed_batches

    def mark_batch_processed(self, batch_id: str) -> None:
        self.processed_batches.add(batch_id)

    def add_compensation(self, compensation: CompensationRecord) -> None:
        self.compensation_records.append(compensation)

    def get_compensations_by_batch(self, batch_id: str) -> List[CompensationRecord]:
        return [c for c in self.compensation_records if c.source_batch_id == batch_id]

    def get_compensations_by_item(self, item_type: str) -> List[CompensationRecord]:
        return [c for c in self.compensation_records if c.source_item_type == item_type]

    def get_compensation_trace(self, compensation_id: str) -> Optional[Dict]:
        compensation = next((c for c in self.compensation_records if c.compensation_id == compensation_id), None)
        if not compensation:
            return None
        
        batch_id = compensation.source_batch_id
        wash_items = self.wash_records.get(batch_id, [])
        recycle_items = self.recycle_records.get(batch_id, [])
        
        return {
            "compensation": compensation,
            "wash_items": [item for item in wash_items if item.item_type == compensation.source_item_type],
            "recycle_items": [item for item in recycle_items if item.item_type == compensation.source_item_type]
        }

    def save_reconciliation_result(self, result: ReconciliationResult) -> None:
        self.reconciliation_history[result.batch_id] = result

    def get_reconciliation_result(self, batch_id: str) -> Optional[ReconciliationResult]:
        return self.reconciliation_history.get(batch_id)


db = Database()
