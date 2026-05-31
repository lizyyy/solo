import json
import os
from datetime import datetime
from typing import Any, Dict

from models import (
    ChangeLog,
    DiscrepancyInfo,
    MineRepairRecord,
    RecordSource,
    RecordStatus,
)


class StorageManager:
    def __init__(self, storage_path: str = "./data"):
        self.storage_path = storage_path
        self._ensure_storage_dir()

    def _ensure_storage_dir(self):
        if not os.path.exists(self.storage_path):
            os.makedirs(self.storage_path)

    def _serialize_datetime(self, dt: datetime) -> str:
        return dt.isoformat()

    def _deserialize_datetime(self, dt_str: str) -> datetime:
        return datetime.fromisoformat(dt_str)

    def _serialize_change_log(self, log: ChangeLog) -> Dict[str, Any]:
        return {
            "timestamp": self._serialize_datetime(log.timestamp),
            "operator": log.operator,
            "field_name": log.field_name,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "reason": log.reason
        }

    def _deserialize_change_log(self, data: Dict[str, Any]) -> ChangeLog:
        return ChangeLog(
            timestamp=self._deserialize_datetime(data["timestamp"]),
            operator=data["operator"],
            field_name=data["field_name"],
            old_value=data["old_value"],
            new_value=data["new_value"],
            reason=data["reason"]
        )

    def _serialize_record(self, record: MineRepairRecord) -> Dict[str, Any]:
        return {
            "record_id": record.record_id,
            "material_id": record.material_id,
            "source": record.source.value,
            "status": record.status.value,
            "created_at": self._serialize_datetime(record.created_at),
            "created_by": record.created_by,
            "pending_reason": record.pending_reason,
            "change_history": [self._serialize_change_log(c) for c in record.change_history],
            "discrepancy": {
                "source_type": record.discrepancy.source_type.value,
                "battle_report_value": record.discrepancy.battle_report_value,
                "settlement_value": record.discrepancy.settlement_value,
                "next_owner": record.discrepancy.next_owner,
                "description": record.discrepancy.description
            } if record.discrepancy else None,
            "unit_table_changes": {
                unit_id: [self._serialize_change_log(c) for c in changes]
                for unit_id, changes in record.unit_table_changes.items()
            },
            "metadata": record.metadata
        }

    def _deserialize_record(self, data: Dict[str, Any]) -> MineRepairRecord:
        record = MineRepairRecord(
            record_id=data["record_id"],
            material_id=data["material_id"],
            source=RecordSource(data["source"]),
            status=RecordStatus(data["status"]),
            created_at=self._deserialize_datetime(data["created_at"]),
            created_by=data["created_by"],
            pending_reason=data.get("pending_reason", ""),
            metadata=data.get("metadata", {})
        )
        
        record.change_history = [
            self._deserialize_change_log(c) for c in data.get("change_history", [])
        ]
        
        if data.get("discrepancy"):
            disc_data = data["discrepancy"]
            record.discrepancy = DiscrepancyInfo(
                source_type=RecordSource(disc_data["source_type"]),
                battle_report_value=disc_data["battle_report_value"],
                settlement_value=disc_data["settlement_value"],
                next_owner=disc_data["next_owner"],
                description=disc_data["description"]
            )
        
        record.unit_table_changes = {
            unit_id: [self._deserialize_change_log(c) for c in changes]
            for unit_id, changes in data.get("unit_table_changes", {}).items()
        }
        
        return record

    def save_records(self, records: Dict[str, MineRepairRecord], 
                     material_success_map: Dict[str, str],
                     material_history: Dict[str, list]) -> None:
        data = {
            "records": {rid: self._serialize_record(r) for rid, r in records.items()},
            "material_success_map": material_success_map,
            "material_history": material_history
        }
        
        file_path = os.path.join(self.storage_path, "mine_repair_records.json")
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_records(self) -> tuple:
        file_path = os.path.join(self.storage_path, "mine_repair_records.json")
        if not os.path.exists(file_path):
            return {}, {}, {}
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        records = {
            rid: self._deserialize_record(rdata)
            for rid, rdata in data.get("records", {}).items()
        }
        material_success_map = data.get("material_success_map", {})
        material_history = data.get("material_history", {})
        
        return records, material_success_map, material_history
