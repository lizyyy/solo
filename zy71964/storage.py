from typing import Dict, List, Optional
from datetime import datetime
from models import MaterialInfo, TrainingLog, RollbackRecord, RollbackStatus


class Storage:
    def __init__(self):
        self._materials: Dict[str, MaterialInfo] = {}
        self._training_logs: Dict[str, List[TrainingLog]] = {}
        self._rollback_records: Dict[str, RollbackRecord] = {}

    def save_material(self, material: MaterialInfo) -> None:
        self._materials[material.material_id] = material

    def get_material(self, material_id: str) -> Optional[MaterialInfo]:
        return self._materials.get(material_id)

    def save_training_log(self, log: TrainingLog) -> None:
        if log.material_id not in self._training_logs:
            self._training_logs[log.material_id] = []
        self._training_logs[log.material_id].append(log)
        self._training_logs[log.material_id].sort(key=lambda x: x.uploaded_at, reverse=True)

    def get_latest_log(self, material_id: str) -> Optional[TrainingLog]:
        logs = self._training_logs.get(material_id, [])
        return logs[0] if logs else None

    def get_all_logs(self, material_id: str) -> List[TrainingLog]:
        return self._training_logs.get(material_id, []).copy()

    def get_log_by_hash(self, material_id: str, content_hash: str) -> Optional[TrainingLog]:
        for log in self._training_logs.get(material_id, []):
            if log.content_hash() == content_hash:
                return log
        return None

    def save_rollback_record(self, record: RollbackRecord) -> None:
        self._rollback_records[record.record_id] = record

    def get_rollback_records_by_material(self, material_id: str) -> List[RollbackRecord]:
        return [
            r for r in self._rollback_records.values()
            if r.material_id == material_id
        ]

    def get_successful_rollback(self, material_id: str, log_content_hash: str) -> Optional[RollbackRecord]:
        for record in self._rollback_records.values():
            if (record.material_id == material_id
                    and record.status == RollbackStatus.SUCCESS
                    and not record.is_historical):
                log = self.get_log_by_hash(material_id, log_content_hash)
                if log and record.log_id == log.log_id:
                    return record
        return None

    def get_active_successful_record(self, material_id: str) -> Optional[RollbackRecord]:
        for record in self._rollback_records.values():
            if (record.material_id == material_id
                    and record.status == RollbackStatus.SUCCESS
                    and not record.is_historical):
                return record
        return None

    def mark_record_as_historical(self, record_id: str, new_record_id: str) -> None:
        if record_id in self._rollback_records:
            self._rollback_records[record_id].is_historical = True
            self._rollback_records[record_id].previous_record_id = new_record_id
            self._rollback_records[record_id].updated_at = datetime.now()
