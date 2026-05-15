import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from tinydb import TinyDB, Query
from .models import RepairOrder, FailedRecord, ImportResult, ManualCorrection


class Storage:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        self.db_path = self.data_dir / "db.json"
        self.db = TinyDB(str(self.db_path))
        
        self.orders_table = self.db.table("repair_orders")
        self.failed_table = self.db.table("failed_records")
        self.results_table = self.db.table("import_results")
        self.corrections_table = self.db.table("manual_corrections")
    
    def save_repair_order(self, order: RepairOrder) -> None:
        self.orders_table.upsert(
            order.model_dump(mode="json"),
            Query().order_id == order.order_id
        )
    
    def get_repair_order(self, order_id: str) -> Optional[RepairOrder]:
        result = self.orders_table.get(Query().order_id == order_id)
        if result:
            return RepairOrder(**result)
        return None
    
    def get_all_repair_orders(self) -> List[RepairOrder]:
        return [RepairOrder(**item) for item in self.orders_table.all()]
    
    def save_failed_record(self, failed: FailedRecord) -> None:
        self.failed_table.insert(failed.model_dump(mode="json"))
    
    def get_failed_records(self, batch_id: Optional[str] = None) -> List[FailedRecord]:
        if batch_id:
            results = self.failed_table.search(Query().batch_id == batch_id)
        else:
            results = self.failed_table.all()
        return [FailedRecord(**item) for item in results]
    
    def save_import_result(self, result: ImportResult) -> None:
        self.results_table.upsert(
            result.model_dump(mode="json"),
            Query().batch_id == result.batch_id
        )
    
    def get_import_result(self, batch_id: str) -> Optional[ImportResult]:
        result = self.results_table.get(Query().batch_id == batch_id)
        if result:
            return ImportResult(**result)
        return None
    
    def get_all_import_results(self) -> List[ImportResult]:
        return [ImportResult(**item) for item in self.results_table.all()]
    
    def save_manual_correction(self, correction: ManualCorrection) -> None:
        self.corrections_table.insert(correction.model_dump(mode="json"))
    
    def get_manual_corrections(self, order_id: Optional[str] = None) -> List[ManualCorrection]:
        if order_id:
            results = self.corrections_table.search(Query().order_id == order_id)
        else:
            results = self.corrections_table.all()
        return [ManualCorrection(**item) for item in results]
    
    def export_failed_records(self, output_path: str, batch_id: Optional[str] = None) -> None:
        records = self.get_failed_records(batch_id)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump([r.model_dump(mode="json") for r in records], f, ensure_ascii=False, indent=2)
