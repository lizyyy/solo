from typing import Dict, Optional
from datetime import datetime
from models import ProcessingResult


class IdempotencyManager:
    def __init__(self):
        self._processed_batches: Dict[str, ProcessingResult] = {}
        self._batch_timestamps: Dict[str, str] = {}
    
    def is_batch_processed(self, batch_id: str) -> bool:
        return batch_id in self._processed_batches
    
    def store_batch_result(self, batch_id: str, result: ProcessingResult) -> None:
        self._processed_batches[batch_id] = result
        self._batch_timestamps[batch_id] = datetime.now().isoformat()
    
    def get_batch_result(self, batch_id: str) -> Optional[ProcessingResult]:
        return self._processed_batches.get(batch_id)
    
    def get_batch_time(self, batch_id: str) -> Optional[str]:
        return self._batch_timestamps.get(batch_id)
    
    def clear_batch(self, batch_id: str) -> bool:
        if batch_id in self._processed_batches:
            del self._processed_batches[batch_id]
            del self._batch_timestamps[batch_id]
            return True
        return False
    
    def get_all_batches(self) -> Dict[str, str]:
        return dict(self._batch_timestamps)
