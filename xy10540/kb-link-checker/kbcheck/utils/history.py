from datetime import datetime
from typing import Any, Optional

from kbcheck.models import HistoryRecord
from kbcheck.utils import generate_id
from kbcheck.utils.storage import Storage


class HistoryManager:
    def __init__(self, storage: Storage):
        self.storage = storage

    def record(
        self,
        command: str,
        action: str,
        entity_type: str,
        entity_id: str,
        status: str,
        message: Optional[str] = None,
        old_value: Optional[Any] = None,
        new_value: Optional[Any] = None,
        triggered_by: str = "system",
    ) -> HistoryRecord:
        record = HistoryRecord(
            history_id=generate_id("hist", command, action, entity_id),
            command=command,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_value=old_value,
            new_value=new_value,
            status=status,
            message=message,
            triggered_by=triggered_by,
            recorded_at=datetime.now(),
        )
        self.storage.save_history([record])
        return record
