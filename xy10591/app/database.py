import json
import os
from typing import Dict, List, Optional, Any
from datetime import datetime
from .models import Batch, Box, AuditLog, RecallRequest, FreezeRequest


class InMemoryDB:
    def __init__(self, persist_path: Optional[str] = None):
        self.batches: Dict[str, Batch] = {}
        self.boxes: Dict[str, Box] = {}
        self.audit_logs: List[AuditLog] = []
        self.recall_requests: Dict[str, RecallRequest] = {}
        self.freeze_requests: Dict[str, FreezeRequest] = {}
        self.idempotency_keys: Dict[str, Dict[str, Any]] = {}
        self.persist_path = persist_path
        if persist_path and os.path.exists(persist_path):
            self._load()

    def save_batch(self, batch: Batch) -> Batch:
        self.batches[batch.batch_id] = batch
        self._persist()
        return batch

    def get_batch(self, batch_id: str) -> Optional[Batch]:
        return self.batches.get(batch_id)

    def get_all_batches(self) -> List[Batch]:
        return list(self.batches.values())

    def save_box(self, box: Box) -> Box:
        self.boxes[box.box_id] = box
        self._persist()
        return box

    def get_box(self, box_id: str) -> Optional[Box]:
        return self.boxes.get(box_id)

    def get_boxes_by_batch(self, batch_id: str) -> List[Box]:
        return [box for box in self.boxes.values() if box.batch_id == batch_id]

    def get_all_boxes(self) -> List[Box]:
        return list(self.boxes.values())

    def add_audit_log(self, log: AuditLog) -> AuditLog:
        self.audit_logs.append(log)
        self._persist()
        return log

    def get_audit_logs(self, entity_type: Optional[str] = None, entity_id: Optional[str] = None) -> List[AuditLog]:
        logs = self.audit_logs
        if entity_type:
            logs = [l for l in logs if l.entity_type == entity_type]
        if entity_id:
            logs = [l for l in logs if l.entity_id == entity_id]
        return sorted(logs, key=lambda x: x.timestamp)

    def save_recall(self, recall: RecallRequest) -> RecallRequest:
        self.recall_requests[recall.recall_id] = recall
        self._persist()
        return recall

    def get_recall(self, recall_id: str) -> Optional[RecallRequest]:
        return self.recall_requests.get(recall_id)

    def get_all_recalls(self) -> List[RecallRequest]:
        return list(self.recall_requests.values())

    def save_freeze(self, freeze: FreezeRequest) -> FreezeRequest:
        self.freeze_requests[freeze.freeze_id] = freeze
        self._persist()
        return freeze

    def get_freeze(self, freeze_id: str) -> Optional[FreezeRequest]:
        return self.freeze_requests.get(freeze_id)

    def get_all_freezes(self) -> List[FreezeRequest]:
        return list(self.freeze_requests.values())

    def set_idempotency_result(self, key: str, result: Dict[str, Any]) -> Dict[str, Any]:
        self.idempotency_keys[key] = result
        self._persist()
        return result

    def get_idempotency_result(self, key: str) -> Optional[Dict[str, Any]]:
        return self.idempotency_keys.get(key)

    def _persist(self):
        if not self.persist_path:
            return
        data = {
            "batches": {k: v.model_dump() for k, v in self.batches.items()},
            "boxes": {k: v.model_dump() for k, v in self.boxes.items()},
            "audit_logs": [v.model_dump() for v in self.audit_logs],
            "recall_requests": {k: v.model_dump() for k, v in self.recall_requests.items()},
            "freeze_requests": {k: v.model_dump() for k, v in self.freeze_requests.items()},
            "idempotency_keys": self.idempotency_keys,
        }
        with open(self.persist_path, "w", encoding="utf-8") as f:
            json.dump(data, f, default=str, ensure_ascii=False, indent=2)

    def _load(self):
        with open(self.persist_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        from .models import Batch, Box, AuditLog, RecallRequest, FreezeRequest
        for k, v in data.get("batches", {}).items():
            self.batches[k] = Batch.model_validate(v)
        for k, v in data.get("boxes", {}).items():
            self.boxes[k] = Box.model_validate(v)
        for v in data.get("audit_logs", []):
            self.audit_logs.append(AuditLog.model_validate(v))
        for k, v in data.get("recall_requests", {}).items():
            self.recall_requests[k] = RecallRequest.model_validate(v)
        for k, v in data.get("freeze_requests", {}).items():
            self.freeze_requests[k] = FreezeRequest.model_validate(v)
        self.idempotency_keys = data.get("idempotency_keys", {})


db = InMemoryDB(persist_path="./data/db.json")
