import os
import json
import uuid
from datetime import datetime
from typing import List, Dict, Optional, Any
from pathlib import Path

from models import (
    CallRecord,
    AuditLog,
    QualityCheckRecord,
    Discrepancy,
    ReviewTask
)


class DataStorage:
    def __init__(self, base_dir: str = "./data"):
        self.base_dir = Path(base_dir)
        self._ensure_dirs()
        self._load_indexes()

    def _ensure_dirs(self):
        (self.base_dir / "calls").mkdir(parents=True, exist_ok=True)
        (self.base_dir / "audit").mkdir(parents=True, exist_ok=True)
        (self.base_dir / "quality").mkdir(parents=True, exist_ok=True)
        (self.base_dir / "discrepancies").mkdir(parents=True, exist_ok=True)
        (self.base_dir / "tasks").mkdir(parents=True, exist_ok=True)
        (self.base_dir / "indexes").mkdir(parents=True, exist_ok=True)

    def _load_indexes(self):
        self.call_hash_index = self._load_index("call_hash_index.json")
        self.task_batch_index = self._load_index("task_batch_index.json")

    def _load_index(self, filename: str) -> Dict[str, Any]:
        path = self.base_dir / "indexes" / filename
        if path.exists():
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}

    def _save_index(self, filename: str, data: Dict[str, Any]):
        path = self.base_dir / "indexes" / filename
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _save_json(self, directory: str, obj_id: str, data: Dict[str, Any]):
        path = self.base_dir / directory / f"{obj_id}.json"
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load_json(self, directory: str, obj_id: str) -> Optional[Dict[str, Any]]:
        path = self.base_dir / directory / f"{obj_id}.json"
        if path.exists():
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None

    def _list_ids(self, directory: str) -> List[str]:
        path = self.base_dir / directory
        if not path.exists():
            return []
        return [f.stem for f in path.glob("*.json")]

    def import_calls(self, calls: List[CallRecord], batch_id: str) -> Dict[str, Any]:
        skipped_count = 0
        imported_count = 0
        imported_calls = []
        skipped_calls = []

        for call in calls:
            record_hash = call.get_record_hash()

            if record_hash in self.call_hash_index:
                skipped_count += 1
                existing_call_id = self.call_hash_index[record_hash]
                skipped_calls.append({
                    "call_id": call.call_id,
                    "existing_call_id": existing_call_id,
                    "reason": "记录已存在（根据任务ID+呼叫ID+呼叫时间判定）"
                })
                continue

            self.call_hash_index[record_hash] = call.call_id
            self._save_json("calls", call.call_id, call.to_dict())
            imported_count += 1
            imported_calls.append(call.call_id)

        self._save_index("call_hash_index.json", self.call_hash_index)

        if batch_id not in self.task_batch_index:
            self.task_batch_index[batch_id] = []
        for call_id in imported_calls:
            if call_id not in self.task_batch_index[batch_id]:
                self.task_batch_index[batch_id].append(call_id)
        self._save_index("task_batch_index.json", self.task_batch_index)

        return {
            "imported_count": imported_count,
            "skipped_count": skipped_count,
            "total_count": len(calls),
            "imported_call_ids": imported_calls,
            "skipped_calls": skipped_calls
        }

    def get_call(self, call_id: str) -> Optional[CallRecord]:
        data = self._load_json("calls", call_id)
        if data:
            return CallRecord.from_dict(data)
        return None

    def get_calls_by_batch(self, batch_id: str) -> List[CallRecord]:
        call_ids = self.task_batch_index.get(batch_id, [])
        calls = []
        for call_id in call_ids:
            call = self.get_call(call_id)
            if call:
                calls.append(call)
        return calls

    def get_calls_by_task(self, task_id: str) -> List[CallRecord]:
        all_calls = self.get_all_calls()
        return [c for c in all_calls if c.task_id == task_id]

    def get_all_calls(self) -> List[CallRecord]:
        calls = []
        for call_id in self._list_ids("calls"):
            call = self.get_call(call_id)
            if call:
                calls.append(call)
        return calls

    def update_call(self, call: CallRecord) -> CallRecord:
        call.updated_at = datetime.now()
        self._save_json("calls", call.call_id, call.to_dict())
        return call

    def add_audit_log(self, audit_log: AuditLog):
        self._save_json("audit", audit_log.log_id, audit_log.to_dict())

    def get_audit_logs(self, call_id: Optional[str] = None) -> List[AuditLog]:
        logs = []
        for log_id in self._list_ids("audit"):
            data = self._load_json("audit", log_id)
            if data:
                log = AuditLog.from_dict(data)
                if call_id is None or log.call_id == call_id:
                    logs.append(log)
        logs.sort(key=lambda x: x.operate_time, reverse=True)
        return logs

    def get_manual_operators(self) -> List[str]:
        logs = self.get_audit_logs()
        operators = set()
        for log in logs:
            if log.field_name == "manual_result":
                operators.add(log.operator)
        return sorted(list(operators))

    def save_quality_check(self, qc: QualityCheckRecord):
        self._save_json("quality", qc.check_id, qc.to_dict())

    def get_quality_checks(self, call_id: Optional[str] = None) -> List[QualityCheckRecord]:
        checks = []
        for check_id in self._list_ids("quality"):
            data = self._load_json("quality", check_id)
            if data:
                qc = QualityCheckRecord.from_dict(data)
                if call_id is None or qc.call_id == call_id:
                    checks.append(qc)
        checks.sort(key=lambda x: x.check_time, reverse=True)
        return checks

    def save_discrepancy(self, discrepancy: Discrepancy):
        self._save_json("discrepancies", discrepancy.discrepancy_id, discrepancy.to_dict())

    def get_discrepancies(self, task_id: Optional[str] = None, resolved: Optional[bool] = None) -> List[Discrepancy]:
        discrepancies = []
        for d_id in self._list_ids("discrepancies"):
            data = self._load_json("discrepancies", d_id)
            if data:
                d = Discrepancy.from_dict(data)
                if task_id is not None and d.task_id != task_id:
                    continue
                if resolved is not None and d.resolved != resolved:
                    continue
                discrepancies.append(d)
        discrepancies.sort(key=lambda x: x.created_at, reverse=True)
        return discrepancies

    def save_review_task(self, task: ReviewTask):
        self._save_json("tasks", task.task_id, task.to_dict())

    def get_review_task(self, task_id: str) -> Optional[ReviewTask]:
        data = self._load_json("tasks", task_id)
        if data:
            return ReviewTask.from_dict(data)
        return None

    def get_all_review_tasks(self) -> List[ReviewTask]:
        tasks = []
        for task_id in self._list_ids("tasks"):
            task = self.get_review_task(task_id)
            if task:
                tasks.append(task)
        tasks.sort(key=lambda x: x.created_at, reverse=True)
        return tasks

    def is_batch_imported(self, batch_id: str) -> bool:
        return batch_id in self.task_batch_index

    def get_batch_summary(self, batch_id: str) -> Dict[str, Any]:
        if batch_id not in self.task_batch_index:
            return {"exists": False}

        call_ids = self.task_batch_index[batch_id]
        calls = [self.get_call(cid) for cid in call_ids]
        calls = [c for c in calls if c is not None]

        manual_judged = [c for c in calls if c.manual_result is not None]
        has_quality = [c for c in calls if len(self.get_quality_checks(c.call_id)) > 0]

        return {
            "exists": True,
            "batch_id": batch_id,
            "total_calls": len(calls),
            "manual_judged_count": len(manual_judged),
            "quality_checked_count": len(has_quality),
            "call_ids": call_ids
        }
