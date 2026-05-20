import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

from models import ProcessedResult, BatchSummary


class BatchManager:
    def __init__(self, storage_dir: str = "batch_data"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(exist_ok=True)
        self._batch_cache: Dict[str, ProcessedResult] = {}
        self._load_from_disk()

    def _load_from_disk(self):
        for batch_file in self.storage_dir.glob("*.json"):
            try:
                with open(batch_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    batch_id = data.get('batch_id', batch_file.stem)
                    self._batch_cache[batch_id] = ProcessedResult(**data)
            except Exception:
                continue

    def _save_to_disk(self, batch_id: str, result: ProcessedResult):
        file_path = self.storage_dir / f"{batch_id}.json"
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(result.model_dump(), f, ensure_ascii=False, indent=2, default=str)

    def is_batch_processed(self, batch_id: str) -> bool:
        return batch_id in self._batch_cache

    def save_batch(self, batch_id: str, result: ProcessedResult):
        self._batch_cache[batch_id] = result
        self._save_to_disk(batch_id, result)

    def get_batch(self, batch_id: str) -> Optional[ProcessedResult]:
        return self._batch_cache.get(batch_id)

    def list_batches(self) -> List[BatchSummary]:
        summaries = []
        for batch_id, result in self._batch_cache.items():
            total_amount = sum(item.amount for item in result.success_items)
            summary = BatchSummary(
                batch_id=batch_id,
                processed_at=result.processed_at,
                total_records=result.total_records,
                success_count=result.success_count,
                pending_count=result.pending_count,
                failed_count=result.failed_count,
                total_amount=total_amount
            )
            summaries.append(summary)
        
        summaries.sort(key=lambda x: x.processed_at, reverse=True)
        return summaries

    def get_tenant_history(self, tenant_id: str) -> Dict[str, Any]:
        tenant_records = []
        
        for batch_id, result in self._batch_cache.items():
            for item_type in ['success_items', 'pending_items', 'failed_items']:
                items = getattr(result, item_type, [])
                for item in items:
                    if item.tenant_id == tenant_id:
                        tenant_records.append({
                            "batch_id": batch_id,
                            "processed_at": result.processed_at.isoformat(),
                            "record": item.model_dump()
                        })
        
        tenant_records.sort(key=lambda x: x['processed_at'], reverse=True)
        
        summary = {
            "tenant_id": tenant_id,
            "total_batches": len(set(r['batch_id'] for r in tenant_records)),
            "total_records": len(tenant_records),
            "total_amount": sum(r['record']['amount'] for r in tenant_records if r['record']['status'] == 'success'),
            "records": tenant_records
        }
        
        return summary
