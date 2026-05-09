from __future__ import annotations

import re
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional, Set, Tuple
from abc import ABC, abstractmethod

from task_compensation.models import Task, TaskStatus, TaskExecutionRecord, SystemConfig
from task_compensation.core.task_registry import TaskRegistry


class CronParser:
    def __init__(self):
        self._weekday_map = {
            'SUN': 0, 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5, 'SAT': 6,
            'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6,
        }
    
    def _parse_field(self, field: str, min_val: int, max_val: int, 
                    special_map: Optional[Dict[str, int]] = None) -> Set[int]:
        special_map = special_map or {}
        values = set()
        
        if field == '*':
            return set(range(min_val, max_val + 1))
        
        parts = field.split(',')
        for part in parts:
            if '/' in part:
                base, step = part.split('/')
                step = int(step)
                if base == '*':
                    start = min_val
                else:
                    start = int(base)
                for v in range(start, max_val + 1, step):
                    values.add(v)
            elif '-' in part:
                start, end = part.split('-')
                start = special_map.get(start, int(start))
                end = special_map.get(end, int(end))
                for v in range(start, end + 1):
                    values.add(v)
            else:
                if part in special_map:
                    values.add(special_map[part])
                else:
                    values.add(int(part))
        
        return values
    
    def should_run_on_date(self, cron_expr: str, target_date: date) -> bool:
        parts = cron_expr.split()
        if len(parts) != 5:
            raise ValueError(f"无效的 cron 表达式: {cron_expr}")
        
        minute = self._parse_field(parts[0], 0, 59)
        hour = self._parse_field(parts[1], 0, 23)
        day = self._parse_field(parts[2], 1, 31)
        month = self._parse_field(parts[3], 1, 12)
        weekday = self._parse_field(parts[4], 0, 6, self._weekday_map)
        
        if target_date.month not in month:
            return False
        
        if target_date.day not in day:
            return False
        
        cron_weekday = (target_date.weekday() + 1) % 7
        if cron_weekday not in weekday:
            return False
        
        return True


class ExecutionRecordStore(ABC):
    @abstractmethod
    def get_records_for_task(self, task_id: str, execution_date: date) -> List[TaskExecutionRecord]:
        pass
    
    @abstractmethod
    def has_successful_execution(self, task_id: str, execution_date: date) -> bool:
        pass


class FileSystemExecutionRecordStore(ExecutionRecordStore):
    def __init__(self, records_dir: str):
        import os
        self.records_dir = records_dir
        os.makedirs(records_dir, exist_ok=True)
    
    def _get_file_path(self, task_id: str, execution_date: date) -> str:
        import os
        date_str = execution_date.strftime("%Y-%m-%d")
        return os.path.join(self.records_dir, f"{task_id}_{date_str}.json")
    
    def get_records_for_task(self, task_id: str, execution_date: date) -> List[TaskExecutionRecord]:
        import json
        import os
        
        file_path = self._get_file_path(task_id, execution_date)
        if not os.path.exists(file_path):
            return []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        records = []
        for item in data:
            item['execution_date'] = datetime.fromisoformat(item['execution_date']).date()
            item['scheduled_time'] = datetime.fromisoformat(item['scheduled_time'])
            if item.get('actual_start_time'):
                item['actual_start_time'] = datetime.fromisoformat(item['actual_start_time'])
            if item.get('actual_end_time'):
                item['actual_end_time'] = datetime.fromisoformat(item['actual_end_time'])
            item['created_at'] = datetime.fromisoformat(item['created_at'])
            records.append(TaskExecutionRecord(**item))
        
        return records
    
    def has_successful_execution(self, task_id: str, execution_date: date) -> bool:
        records = self.get_records_for_task(task_id, execution_date)
        return any(
            record.status in [TaskStatus.SUCCESS] 
            for record in records
        )


class MissedTaskDetector:
    def __init__(
        self, 
        registry: TaskRegistry,
        record_store: ExecutionRecordStore,
        cron_parser: Optional[CronParser] = None
    ):
        self.registry = registry
        self.record_store = record_store
        self.cron_parser = cron_parser or CronParser()
    
    def detect(
        self, 
        target_date: date,
        include_inactive: bool = False,
        specific_task_ids: Optional[List[str]] = None
    ) -> Dict[str, List[str]]:
        results = {
            'missed_tasks': [],
            'failed_tasks': [],
            'pending_tasks': [],
            'success_tasks': [],
            'skipped_tasks': [],
        }
        
        tasks = self._get_tasks_to_check(include_inactive, specific_task_ids)
        
        for task in tasks:
            if not self.cron_parser.should_run_on_date(task.cron_expression, target_date):
                results['skipped_tasks'].append(task.task_id)
                continue
            
            if self._is_task_successful(task.task_id, target_date):
                results['success_tasks'].append(task.task_id)
                continue
            
            records = self.record_store.get_records_for_task(task.task_id, target_date)
            if not records:
                results['missed_tasks'].append(task.task_id)
            else:
                latest_record = self._get_latest_record(records)
                if latest_record.status in [TaskStatus.FAILED, TaskStatus.TIMEOUT]:
                    results['failed_tasks'].append(task.task_id)
                elif latest_record.status == TaskStatus.RUNNING:
                    results['pending_tasks'].append(task.task_id)
                else:
                    results['missed_tasks'].append(task.task_id)
        
        return results
    
    def _get_tasks_to_check(
        self, 
        include_inactive: bool, 
        specific_task_ids: Optional[List[str]]
    ) -> List[Task]:
        if specific_task_ids:
            tasks = [self.registry.get_task(tid) for tid in specific_task_ids]
            return [t for t in tasks if t and (include_inactive or t.active)]
        
        if include_inactive:
            return self.registry.get_all_tasks()
        return self.registry.get_active_tasks()
    
    def _is_task_successful(self, task_id: str, execution_date: date) -> bool:
        return self.record_store.has_successful_execution(task_id, execution_date)
    
    def _get_latest_record(self, records: List[TaskExecutionRecord]) -> TaskExecutionRecord:
        if not records:
            raise ValueError("没有执行记录")
        
        sorted_records = sorted(
            records, 
            key=lambda r: r.actual_start_time or r.created_at,
            reverse=True
        )
        return sorted_records[0]
    
    def get_detailed_missed_info(
        self, 
        target_date: date,
        include_inactive: bool = False
    ) -> List[Dict]:
        detection = self.detect(target_date, include_inactive)
        all_missed = detection['missed_tasks'] + detection['failed_tasks']
        
        detailed_info = []
        for task_id in all_missed:
            task = self.registry.get_task(task_id)
            if not task:
                continue
            
            records = self.record_store.get_records_for_task(task_id, target_date)
            latest_record = self._get_latest_record(records) if records else None
            
            info = {
                'task_id': task_id,
                'task_name': task.task_name,
                'cron_expression': task.cron_expression,
                'dependencies': task.dependencies,
                'status': 'missed' if task_id in detection['missed_tasks'] else 'failed',
                'latest_record': latest_record,
                'records_count': len(records),
            }
            detailed_info.append(info)
        
        return detailed_info
