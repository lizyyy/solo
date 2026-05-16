from typing import List, Optional, Dict, Any
from datetime import datetime

from .models import HandoverRecord, RecordStatus
from .storage import Storage


class QueryService:
    def __init__(self, storage: Storage):
        self.storage = storage

    def query_records(
        self,
        status: Optional[RecordStatus] = None,
        operator: Optional[str] = None,
        has_abnormal: Optional[bool] = None,
        has_manual_correction: Optional[bool] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[HandoverRecord]:
        records = self.storage.load_all_records()
        
        if status:
            records = [r for r in records if r.status == status]
        
        if operator:
            records = [r for r in records if r.operator == operator]
        
        if has_abnormal is not None:
            records = [
                r for r in records 
                if r.system_judgment and r.system_judgment.is_abnormal == has_abnormal
            ]
        
        if has_manual_correction is not None:
            records = [
                r for r in records 
                if (len(r.manual_corrections) > 0) == has_manual_correction
            ]
        
        if start_date:
            records = [r for r in records if r.created_at >= start_date]
        
        if end_date:
            records = [r for r in records if r.created_at <= end_date]
        
        return records

    def get_record_by_id(self, record_id: str) -> Optional[HandoverRecord]:
        return self.storage.load_record_by_id(record_id)

    def get_all_records(self) -> List[HandoverRecord]:
        return self.storage.load_all_records()

    def get_abnormal_records(self) -> List[HandoverRecord]:
        return self.query_records(has_abnormal=True)

    def get_normal_records(self) -> List[HandoverRecord]:
        return self.query_records(has_abnormal=False)

    def get_records_with_corrections(self) -> List[HandoverRecord]:
        return self.query_records(has_manual_correction=True)

    def get_correction_history_by_resource(self, resource_scope: str) -> List[Dict[str, Any]]:
        records = self.storage.load_all_records()
        corrections = []
        
        for record in records:
            for correction in record.manual_corrections:
                if correction.resource_scope == resource_scope:
                    corrections.append({
                        "record_id": record.id,
                        "record_title": record.title,
                        "correction_id": correction.id,
                        "operator": correction.operator,
                        "correction_type": correction.correction_type,
                        "old_value": correction.old_value,
                        "new_value": correction.new_value,
                        "reason": correction.reason,
                        "created_at": correction.created_at,
                        "resource_scope": correction.resource_scope
                    })
        
        return sorted(corrections, key=lambda x: x["created_at"], reverse=True)