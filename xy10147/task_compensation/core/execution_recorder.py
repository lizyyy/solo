from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, date
from typing import Dict, Optional, List, Any

from task_compensation.models import (
    TaskExecutionRecord, TaskStatus, TaskResult, Task
)


class ExecutionRecorder:
    def __init__(self, records_dir: str):
        self.records_dir = records_dir
        os.makedirs(records_dir, exist_ok=True)
    
    def _get_file_path(self, task_id: str, execution_date: date) -> str:
        date_str = execution_date.strftime("%Y-%m-%d")
        return os.path.join(self.records_dir, f"{task_id}_{date_str}.json")
    
    def _get_records_file_path(self, execution_id: str) -> str:
        return os.path.join(self.records_dir, f"execution_{execution_id}.json")
    
    def create_record(
        self,
        task: Task,
        execution_date: date,
        scheduled_time: Optional[datetime] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> TaskExecutionRecord:
        execution_id = str(uuid.uuid4())
        
        if scheduled_time is None:
            scheduled_time = datetime.now()
        
        record = TaskExecutionRecord(
            execution_id=execution_id,
            task_id=task.task_id,
            execution_date=execution_date,
            status=TaskStatus.PENDING,
            scheduled_time=scheduled_time,
            metadata=metadata or {}
        )
        
        self._save_record_to_file(record)
        self._append_to_task_records_file(record)
        
        return record
    
    def update_start_time(self, execution_id: str, start_time: Optional[datetime] = None) -> TaskExecutionRecord:
        record = self._load_record(execution_id)
        if not record:
            raise ValueError(f"执行记录不存在: {execution_id}")
        
        record.status = TaskStatus.RUNNING
        record.actual_start_time = start_time or datetime.now()
        
        self._save_record_to_file(record)
        self._update_task_records_file(record)
        
        return record
    
    def update_completion(
        self,
        execution_id: str,
        result: TaskResult,
        end_time: Optional[datetime] = None,
        idempotency_hash: Optional[str] = None
    ) -> TaskExecutionRecord:
        record = self._load_record(execution_id)
        if not record:
            raise ValueError(f"执行记录不存在: {execution_id}")
        
        record.status = result.status
        record.result = result
        record.actual_end_time = end_time or datetime.now()
        
        if record.actual_start_time and record.actual_end_time:
            duration = (record.actual_end_time - record.actual_start_time).total_seconds()
            record.duration_seconds = duration
        
        if idempotency_hash:
            record.idempotency_hash = idempotency_hash
        
        self._save_record_to_file(record)
        self._update_task_records_file(record)
        
        return record
    
    def get_record(self, execution_id: str) -> Optional[TaskExecutionRecord]:
        return self._load_record(execution_id)
    
    def get_records_for_task(
        self,
        task_id: str,
        execution_date: Optional[date] = None
    ) -> List[TaskExecutionRecord]:
        if execution_date:
            return self._load_task_records(task_id, execution_date)
        
        all_records = []
        if os.path.exists(self.records_dir):
            for filename in os.listdir(self.records_dir):
                if filename.startswith(f"{task_id}_") and filename.endswith(".json"):
                    date_part = filename.replace(f"{task_id}_", "").replace(".json", "")
                    try:
                        record_date = datetime.strptime(date_part, "%Y-%m-%d").date()
                        all_records.extend(self._load_task_records(task_id, record_date))
                    except ValueError:
                        continue
        
        return all_records
    
    def has_successful_execution(self, task_id: str, execution_date: date) -> bool:
        records = self._load_task_records(task_id, execution_date)
        return any(
            record.status == TaskStatus.SUCCESS
            for record in records
        )
    
    def get_latest_record(self, task_id: str, execution_date: date) -> Optional[TaskExecutionRecord]:
        records = self._load_task_records(task_id, execution_date)
        if not records:
            return None
        
        return sorted(
            records,
            key=lambda r: r.actual_start_time or r.created_at,
            reverse=True
        )[0]
    
    def get_execution_history(
        self,
        task_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: int = 100
    ) -> List[TaskExecutionRecord]:
        all_records = []
        
        if os.path.exists(self.records_dir):
            for filename in os.listdir(self.records_dir):
                if filename.startswith(f"{task_id}_") and filename.endswith(".json"):
                    date_part = filename.replace(f"{task_id}_", "").replace(".json", "")
                    try:
                        record_date = datetime.strptime(date_part, "%Y-%m-%d").date()
                        
                        if start_date and record_date < start_date:
                            continue
                        if end_date and record_date > end_date:
                            continue
                        
                        all_records.extend(self._load_task_records(task_id, record_date))
                    except ValueError:
                        continue
        
        sorted_records = sorted(
            all_records,
            key=lambda r: r.created_at,
            reverse=True
        )
        
        return sorted_records[:limit]
    
    def get_stats(self, task_id: str, execution_date: Optional[date] = None) -> Dict[str, int]:
        records = self.get_records_for_task(task_id, execution_date)
        
        stats = {
            "total": len(records),
            "success": 0,
            "failed": 0,
            "timeout": 0,
            "running": 0,
            "pending": 0,
            "cancelled": 0,
            "skipped": 0
        }
        
        for record in records:
            status_key = record.status.value
            if status_key in stats:
                stats[status_key] += 1
        
        return stats
    
    def _save_record_to_file(self, record: TaskExecutionRecord) -> None:
        file_path = self._get_records_file_path(record.execution_id)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(self._record_to_dict(record), f, ensure_ascii=False, indent=2)
    
    def _load_record(self, execution_id: str) -> Optional[TaskExecutionRecord]:
        file_path = self._get_records_file_path(execution_id)
        if not os.path.exists(file_path):
            return None
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return self._dict_to_record(data)
    
    def _append_to_task_records_file(self, record: TaskExecutionRecord) -> None:
        file_path = self._get_file_path(record.task_id, record.execution_date)
        
        records = []
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                records = json.load(f)
        
        records.append(self._record_to_dict(record))
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(records, f, ensure_ascii=False, indent=2)
    
    def _update_task_records_file(self, record: TaskExecutionRecord) -> None:
        file_path = self._get_file_path(record.task_id, record.execution_date)
        
        if not os.path.exists(file_path):
            self._append_to_task_records_file(record)
            return
        
        with open(file_path, 'r', encoding='utf-8') as f:
            records = json.load(f)
        
        for i, r in enumerate(records):
            if r['execution_id'] == record.execution_id:
                records[i] = self._record_to_dict(record)
                break
        else:
            records.append(self._record_to_dict(record))
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(records, f, ensure_ascii=False, indent=2)
    
    def _load_task_records(self, task_id: str, execution_date: date) -> List[TaskExecutionRecord]:
        file_path = self._get_file_path(task_id, execution_date)
        if not os.path.exists(file_path):
            return []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            records_data = json.load(f)
        
        return [self._dict_to_record(r) for r in records_data]
    
    def _record_to_dict(self, record: TaskExecutionRecord) -> Dict[str, Any]:
        result_dict = None
        if record.result:
            result_dict = {
                "task_id": record.result.task_id,
                "status": record.result.status.value,
                "start_time": record.result.start_time.isoformat(),
                "end_time": record.result.end_time.isoformat() if record.result.end_time else None,
                "duration": record.result.duration,
                "output": record.result.output,
                "error_message": record.result.error_message,
                "error_traceback": record.result.error_traceback,
                "retry_count": record.result.retry_count
            }
        
        return {
            "execution_id": record.execution_id,
            "task_id": record.task_id,
            "execution_date": record.execution_date.isoformat(),
            "status": record.status.value,
            "scheduled_time": record.scheduled_time.isoformat(),
            "actual_start_time": record.actual_start_time.isoformat() if record.actual_start_time else None,
            "actual_end_time": record.actual_end_time.isoformat() if record.actual_end_time else None,
            "duration_seconds": record.duration_seconds,
            "result": result_dict,
            "idempotency_hash": record.idempotency_hash,
            "metadata": record.metadata,
            "created_at": record.created_at.isoformat()
        }
    
    def _dict_to_record(self, data: Dict[str, Any]) -> TaskExecutionRecord:
        result = None
        if data.get('result'):
            result_data = data['result']
            result = TaskResult(
                task_id=result_data['task_id'],
                status=TaskStatus(result_data['status']),
                start_time=datetime.fromisoformat(result_data['start_time']),
                end_time=datetime.fromisoformat(result_data['end_time']) if result_data.get('end_time') else None,
                duration=result_data.get('duration'),
                output=result_data.get('output', {}),
                error_message=result_data.get('error_message'),
                error_traceback=result_data.get('error_traceback'),
                retry_count=result_data.get('retry_count', 0)
            )
        
        return TaskExecutionRecord(
            execution_id=data['execution_id'],
            task_id=data['task_id'],
            execution_date=datetime.fromisoformat(data['execution_date']).date(),
            status=TaskStatus(data['status']),
            scheduled_time=datetime.fromisoformat(data['scheduled_time']),
            actual_start_time=datetime.fromisoformat(data['actual_start_time']) if data.get('actual_start_time') else None,
            actual_end_time=datetime.fromisoformat(data['actual_end_time']) if data.get('actual_end_time') else None,
            duration_seconds=data.get('duration_seconds'),
            result=result,
            idempotency_hash=data.get('idempotency_hash'),
            metadata=data.get('metadata', {}),
            created_at=datetime.fromisoformat(data['created_at'])
        )
