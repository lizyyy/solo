import hashlib
import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from models import (
    MineRepairRecord,
    RecordSource,
    RecordStatus,
)
from storage import StorageManager


class MineRepairManager:
    def __init__(self, storage_path: str = "./data"):
        self.storage = StorageManager(storage_path)
        self.records: Dict[str, MineRepairRecord] = {}
        self.material_success_map: Dict[str, str] = {}
        self.material_history: Dict[str, List[str]] = {}
        self._load_from_storage()

    def _load_from_storage(self):
        self.records, self.material_success_map, self.material_history = self.storage.load_records()

    def save(self):
        self.storage.save_records(self.records, self.material_success_map, self.material_history)

    def _generate_material_hash(self, material_data: Dict[str, Any]) -> str:
        sorted_data = json.dumps(material_data, sort_keys=True)
        return hashlib.md5(sorted_data.encode('utf-8')).hexdigest()

    def _generate_record_id(self) -> str:
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")
        return f"MRR-{timestamp}"

    def create_record(
        self,
        material_data: Dict[str, Any],
        source: RecordSource,
        created_by: str,
        pending_reason: str = "",
        metadata: Optional[Dict[str, Any]] = None
    ) -> Tuple[MineRepairRecord, bool]:
        material_id = self._generate_material_hash(material_data)
        
        if material_id in self.material_success_map:
            existing_record_id = self.material_success_map[material_id]
            existing_record = self.records[existing_record_id]
            return existing_record, False
        
        record_id = self._generate_record_id()
        status = RecordStatus.PENDING if pending_reason else RecordStatus.PROCESSING
        
        record = MineRepairRecord(
            record_id=record_id,
            material_id=material_id,
            source=source,
            status=status,
            created_at=datetime.now(),
            created_by=created_by,
            pending_reason=pending_reason,
            metadata=metadata or {}
        )
        
        self.records[record_id] = record
        
        if material_id not in self.material_history:
            self.material_history[material_id] = []
        self.material_history[material_id].append(record_id)
        
        return record, True

    def get_record(self, record_id: str) -> Optional[MineRepairRecord]:
        return self.records.get(record_id)

    def get_records_by_material(self, material_data: Dict[str, Any]) -> List[MineRepairRecord]:
        material_id = self._generate_material_hash(material_data)
        record_ids = self.material_history.get(material_id, [])
        return [self.records[rid] for rid in record_ids if rid in self.records]

    def get_records_by_source(self, source: RecordSource) -> List[MineRepairRecord]:
        return [r for r in self.records.values() if r.source == source]

    def get_records_by_status(self, status: RecordStatus) -> List[MineRepairRecord]:
        return [r for r in self.records.values() if r.status == status]

    def get_records_by_operator(self, operator: str) -> List[MineRepairRecord]:
        return [
            r for r in self.records.values()
            if any(c.operator == operator for c in r.change_history)
        ]

    def update_status(
        self,
        record_id: str,
        new_status: RecordStatus,
        operator: str,
        reason: str
    ) -> bool:
        record = self.records.get(record_id)
        if not record:
            return False
        
        old_status = record.status
        record.add_change(operator, "status", old_status.value, new_status.value, reason)
        record.status = new_status
        
        if new_status == RecordStatus.SUCCESS:
            self.material_success_map[record.material_id] = record_id
        
        return True

    def update_pending_reason(
        self,
        record_id: str,
        new_reason: str,
        operator: str,
        reason: str
    ) -> bool:
        record = self.records.get(record_id)
        if not record:
            return False
        
        old_reason = record.pending_reason
        record.add_change(operator, "pending_reason", old_reason, new_reason, reason)
        record.pending_reason = new_reason
        
        return True

    def record_unit_table_change(
        self,
        record_id: str,
        unit_id: str,
        field_name: str,
        old_value: Any,
        new_value: Any,
        operator: str,
        reason: str
    ) -> bool:
        record = self.records.get(record_id)
        if not record:
            return False
        
        record.add_unit_table_change(unit_id, operator, field_name, old_value, new_value, reason)
        return True

    def handle_discrepancy(
        self,
        record_id: str,
        source_type: RecordSource,
        battle_report_value: Any,
        settlement_value: Any,
        next_owner: str,
        description: str,
        operator: str
    ) -> bool:
        record = self.records.get(record_id)
        if not record:
            return False
        
        record.set_discrepancy(
            source_type=source_type,
            battle_report_value=battle_report_value,
            settlement_value=settlement_value,
            next_owner=next_owner,
            description=description
        )
        record.add_change(
            operator=operator,
            field_name="discrepancy",
            old_value=None,
            new_value=f"battle={battle_report_value}, settlement={settlement_value}",
            reason=description
        )
        return True

    def get_discrepancy_records(self) -> List[MineRepairRecord]:
        return [r for r in self.records.values() if r.discrepancy is not None]

    def get_unit_table_change_history(self, record_id: str, unit_id: Optional[str] = None) -> Dict[str, Any]:
        record = self.records.get(record_id)
        if not record:
            return {}
        
        if unit_id:
            return {unit_id: record.unit_table_changes.get(unit_id, [])}
        return record.unit_table_changes

    def get_full_history(self, record_id: str) -> Dict[str, Any]:
        record = self.records.get(record_id)
        if not record:
            return {}
        
        return {
            "record_id": record.record_id,
            "material_id": record.material_id,
            "source": record.source.value,
            "status": record.status.value,
            "created_at": record.created_at,
            "created_by": record.created_by,
            "pending_reason": record.pending_reason,
            "change_history": [
                {
                    "timestamp": c.timestamp,
                    "operator": c.operator,
                    "field": c.field_name,
                    "old_value": c.old_value,
                    "new_value": c.new_value,
                    "reason": c.reason
                }
                for c in record.change_history
            ],
            "unit_table_changes": {
                unit_id: [
                    {
                        "timestamp": c.timestamp,
                        "operator": c.operator,
                        "field": c.field_name,
                        "old_value": c.old_value,
                        "new_value": c.new_value,
                        "reason": c.reason
                    }
                    for c in changes
                ]
                for unit_id, changes in record.unit_table_changes.items()
            },
            "discrepancy": {
                "source_type": record.discrepancy.source_type.value,
                "battle_report_value": record.discrepancy.battle_report_value,
                "settlement_value": record.discrepancy.settlement_value,
                "next_owner": record.discrepancy.next_owner,
                "description": record.discrepancy.description
            } if record.discrepancy else None
        }
