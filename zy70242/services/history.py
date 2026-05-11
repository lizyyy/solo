"""历史记录管理"""

from typing import List, Optional

from .models import HistoryRecord
from .storage import Storage


class History:
    """历史记录管理"""
    
    def __init__(self, storage: Storage):
        self.storage = storage
    
    def get_records(self, limit: int = 20, operation: Optional[str] = None) -> List[HistoryRecord]:
        return self.storage.get_history(limit=limit, operation=operation)
