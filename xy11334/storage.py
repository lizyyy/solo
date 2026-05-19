import json
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import uuid4

from models import Patient, Escort, Task, ActionLog, TaskStatus, TaskPriority, ActionType


class Storage:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.tasks_file = os.path.join(data_dir, "tasks.json")
        self.escorts_file = os.path.join(data_dir, "escorts.json")
        self._ensure_data_dir()

    def _ensure_data_dir(self):
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)

    def _read_json(self, filepath: str, default: Any) -> Any:
        if not os.path.exists(filepath):
            return default
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _write_json(self, filepath: str, data: Any):
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _parse_datetime(self, dt_str: Optional[str]) -> Optional[datetime]:
        if not dt_str:
            return None
        return datetime.fromisoformat(dt_str)

    def save_escort(self, escort: Escort) -> Escort:
        escorts = self._read_json(self.escorts_file, [])
        escorts_dict = {e['id']: e for e in escorts}
        escorts_dict[escort.id] = escort.to_dict()
        self._write_json(self.escorts_file, list(escorts_dict.values()))
        return escort

    def get_escort(self, escort_id: str) -> Optional[Escort]:
        escorts = self._read_json(self.escorts_file, [])
        for e in escorts:
            if e['id'] == escort_id:
                return Escort(
                    id=e['id'],
                    name=e['name'],
                    phone=e['phone'],
                    employee_id=e['employee_id'],
                    is_active=e['is_active']
                )
        return None

    def get_all_escorts(self) -> List[Escort]:
        escorts = self._read_json(self.escorts_file, [])
        return [
            Escort(
                id=e['id'],
                name=e['name'],
                phone=e['phone'],
                employee_id=e['employee_id'],
                is_active=e['is_active']
            )
            for e in escorts
        ]

    def save_task(self, task: Task) -> Task:
        tasks = self._read_json(self.tasks_file, [])
        tasks_dict = {t['id']: t for t in tasks}
        tasks_dict[task.id] = task.to_dict()
        self._write_json(self.tasks_file, list(tasks_dict.values()))
        return task

    def get_task(self, task_id: str) -> Optional[Task]:
        tasks = self._read_json(self.tasks_file, [])
        for t in tasks:
            if t['id'] == task_id:
                return self._dict_to_task(t)
        return None

    def _dict_to_task(self, t: Dict) -> Task:
        patient = Patient(
            id=t['patient']['id'],
            name=t['patient']['name'],
            phone=t['patient']['phone'],
            id_card=t['patient']['id_card'],
            department=t['patient']['department'],
            is_emergency=t['patient']['is_emergency']
        )
        escort = None
        if t.get('escort'):
            escort = Escort(
                id=t['escort']['id'],
                name=t['escort']['name'],
                phone=t['escort']['phone'],
                employee_id=t['escort']['employee_id'],
                is_active=t['escort']['is_active']
            )
        action_logs = [
            ActionLog(
                id=log['id'],
                task_id=log['task_id'],
                action_type=ActionType(log['action_type']),
                operator=log['operator'],
                timestamp=self._parse_datetime(log['timestamp']),
                reason=log['reason'],
                from_escort_id=log.get('from_escort_id'),
                to_escort_id=log.get('to_escort_id'),
                success=log.get('success', True)
            )
            for log in t.get('action_logs', [])
        ]
        return Task(
            id=t['id'],
            patient=patient,
            priority=TaskPriority(t['priority']),
            status=TaskStatus(t['status']),
            created_at=self._parse_datetime(t['created_at']),
            escort=escort,
            accepted_at=self._parse_datetime(t.get('accepted_at')),
            completed_at=self._parse_datetime(t.get('completed_at')),
            timeout_minutes=t.get('timeout_minutes', 30),
            position=t.get('position', 0),
            action_logs=action_logs
        )

    def get_all_tasks(self) -> List[Task]:
        tasks = self._read_json(self.tasks_file, [])
        return [self._dict_to_task(t) for t in tasks]

    def get_pending_tasks(self) -> List[Task]:
        all_tasks = self.get_all_tasks()
        pending = [t for t in all_tasks if t.status == TaskStatus.PENDING]
        pending.sort(key=lambda x: (
            0 if x.priority == TaskPriority.EMERGENCY else 1,
            x.position,
            x.created_at
        ))
        return pending

    def get_next_position(self) -> int:
        tasks = self.get_all_tasks()
        if not tasks:
            return 1
        return max(t.position for t in tasks) + 1

    def add_action_log(self, task_id: str, action_log: ActionLog) -> bool:
        task = self.get_task(task_id)
        if not task:
            return False
        task.action_logs.append(action_log)
        self.save_task(task)
        return True
