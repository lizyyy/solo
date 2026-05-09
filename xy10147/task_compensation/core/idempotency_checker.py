from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, date
from typing import Dict, Optional, List

from task_compensation.models import Task, TaskStatus, IdempotencyRecord


class IdempotencyStore:
    def save(self, record: IdempotencyRecord) -> None:
        raise NotImplementedError
    
    def get(self, idempotency_hash: str) -> Optional[IdempotencyRecord]:
        raise NotImplementedError
    
    def get_by_task_and_date(self, task_id: str, execution_date: date) -> Optional[IdempotencyRecord]:
        raise NotImplementedError
    
    def update_status(self, idempotency_hash: str, status: TaskStatus, 
                     execution_record_id: Optional[str] = None,
                     output: Optional[Dict] = None) -> None:
        raise NotImplementedError


class FileSystemIdempotencyStore(IdempotencyStore):
    def __init__(self, store_dir: str):
        self.store_dir = store_dir
        os.makedirs(store_dir, exist_ok=True)
    
    def _get_file_path(self, hash_value: str) -> str:
        return os.path.join(self.store_dir, f"{hash_value}.json")
    
    def _get_index_path(self, task_id: str, execution_date: date) -> str:
        date_str = execution_date.isoformat()
        return os.path.join(self.store_dir, f"index_{task_id}_{date_str}.json")
    
    def save(self, record: IdempotencyRecord) -> None:
        record_dict = self._record_to_dict(record)
        
        hash_file = self._get_file_path(record.idempotency_hash)
        with open(hash_file, 'w', encoding='utf-8') as f:
            json.dump(record_dict, f, ensure_ascii=False, indent=2)
        
        index_file = self._get_index_path(record.task_id, record.execution_date)
        index_data = {
            "idempotency_hash": record.idempotency_hash,
            "task_id": record.task_id,
            "execution_date": record.execution_date.isoformat(),
            "status": record.status.value,
            "updated_at": datetime.now().isoformat()
        }
        with open(index_file, 'w', encoding='utf-8') as f:
            json.dump(index_data, f, ensure_ascii=False, indent=2)
    
    def get(self, idempotency_hash: str) -> Optional[IdempotencyRecord]:
        hash_file = self._get_file_path(idempotency_hash)
        if not os.path.exists(hash_file):
            return None
        
        with open(hash_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return self._dict_to_record(data)
    
    def get_by_task_and_date(self, task_id: str, execution_date: date) -> Optional[IdempotencyRecord]:
        index_file = self._get_index_path(task_id, execution_date)
        if not os.path.exists(index_file):
            return None
        
        with open(index_file, 'r', encoding='utf-8') as f:
            index_data = json.load(f)
        
        idempotency_hash = index_data.get('idempotency_hash')
        if not idempotency_hash:
            return None
        
        return self.get(idempotency_hash)
    
    def update_status(self, idempotency_hash: str, status: TaskStatus, 
                     execution_record_id: Optional[str] = None,
                     output: Optional[Dict] = None) -> None:
        record = self.get(idempotency_hash)
        if not record:
            raise ValueError(f"幂等记录不存在: {idempotency_hash}")
        
        record.status = status
        record.updated_at = datetime.now()
        if execution_record_id:
            record.execution_record_id = execution_record_id
        if output is not None:
            record.output = output
        
        self.save(record)
    
    def _record_to_dict(self, record: IdempotencyRecord) -> Dict:
        return {
            "idempotency_hash": record.idempotency_hash,
            "task_id": record.task_id,
            "execution_date": record.execution_date.isoformat(),
            "status": record.status.value,
            "execution_record_id": record.execution_record_id,
            "output": record.output,
            "created_at": record.created_at.isoformat(),
            "updated_at": record.updated_at.isoformat()
        }
    
    def _dict_to_record(self, data: Dict) -> IdempotencyRecord:
        return IdempotencyRecord(
            idempotency_hash=data["idempotency_hash"],
            task_id=data["task_id"],
            execution_date=datetime.fromisoformat(data["execution_date"]).date(),
            status=TaskStatus(data["status"]),
            execution_record_id=data.get("execution_record_id"),
            output=data.get("output"),
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"])
        )


class IdempotencyChecker:
    def __init__(self, store: IdempotencyStore):
        self.store = store
    
    def check(self, task_id: str, execution_date: date, 
             task: Optional[Task] = None) -> Optional[IdempotencyRecord]:
        if task is None:
            return self.store.get_by_task_and_date(task_id, execution_date)
        
        idempotency_hash = task.generate_idempotency_hash(execution_date)
        return self.store.get(idempotency_hash)
    
    def can_execute(self, task_id: str, execution_date: date,
                   task: Optional[Task] = None) -> bool:
        record = self.check(task_id, execution_date, task)
        if not record:
            return True
        
        if record.status == TaskStatus.SUCCESS:
            return False
        
        if record.status in [TaskStatus.FAILED, TaskStatus.TIMEOUT, TaskStatus.CANCELLED]:
            return True
        
        if record.status == TaskStatus.RUNNING:
            return False
        
        return True
    
    def register_execution(self, task: Task, execution_date: date) -> IdempotencyRecord:
        idempotency_hash = task.generate_idempotency_hash(execution_date)
        
        existing = self.store.get(idempotency_hash)
        if existing and existing.status == TaskStatus.RUNNING:
            raise RuntimeError(
                f"任务 {task.task_id} 在 {execution_date} 正在执行中，"
                f"幂等哈希: {idempotency_hash}"
            )
        
        record = IdempotencyRecord(
            idempotency_hash=idempotency_hash,
            task_id=task.task_id,
            execution_date=execution_date,
            status=TaskStatus.RUNNING
        )
        
        self.store.save(record)
        return record
    
    def mark_success(self, idempotency_hash: str, 
                    execution_record_id: Optional[str] = None,
                    output: Optional[Dict] = None) -> None:
        self.store.update_status(
            idempotency_hash=idempotency_hash,
            status=TaskStatus.SUCCESS,
            execution_record_id=execution_record_id,
            output=output
        )
    
    def mark_failed(self, idempotency_hash: str, 
                   execution_record_id: Optional[str] = None,
                   error_output: Optional[Dict] = None) -> None:
        self.store.update_status(
            idempotency_hash=idempotency_hash,
            status=TaskStatus.FAILED,
            execution_record_id=execution_record_id,
            output=error_output
        )
    
    def mark_timeout(self, idempotency_hash: str, 
                    execution_record_id: Optional[str] = None) -> None:
        self.store.update_status(
            idempotency_hash=idempotency_hash,
            status=TaskStatus.TIMEOUT,
            execution_record_id=execution_record_id
        )
    
    def clear_lock(self, idempotency_hash: str) -> None:
        record = self.store.get(idempotency_hash)
        if record and record.status == TaskStatus.RUNNING:
            self.store.update_status(
                idempotency_hash=idempotency_hash,
                status=TaskStatus.PENDING
            )
    
    def get_status_summary(self, task_ids: List[str], execution_date: date) -> Dict[str, str]:
        summary = {}
        for task_id in task_ids:
            record = self.store.get_by_task_and_date(task_id, execution_date)
            if record:
                summary[task_id] = record.status.value
            else:
                summary[task_id] = "unknown"
        return summary
