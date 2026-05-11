import json
import os
import hashlib
from datetime import date
from typing import Dict, List, Optional, Any
from pathlib import Path
from .models import (
    Employee, Task, Acceptance, WorkLog, Dispute, AdjustmentHistory,
    DisputeType, DisputeStatus
)


class DataStore:
    def __init__(self, data_dir: str = ".worklog_data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        self.employees: Dict[str, Employee] = {}
        self.tasks: Dict[str, Task] = {}
        self.acceptances: Dict[str, Acceptance] = {}
        self.worklogs: Dict[str, WorkLog] = {}
        self.disputes: Dict[str, Dispute] = {}
        self.adjustments: Dict[str, AdjustmentHistory] = {}
        self.source_hashes: Dict[str, str] = {}
        
        self._load_all()
    
    def _get_file(self, name: str) -> Path:
        return self.data_dir / f"{name}.json"
    
    def _load_file(self, name: str) -> Dict:
        f = self._get_file(name)
        if f.exists():
            with open(f, "r", encoding="utf-8") as fp:
                return json.load(fp)
        return {}
    
    def _save_file(self, name: str, data: Dict):
        with open(self._get_file(name), "w", encoding="utf-8") as fp:
            json.dump(data, fp, ensure_ascii=False, indent=2)
    
    def _load_all(self):
        data = self._load_file("employees")
        self.employees = {k: Employee.from_dict(v) for k, v in data.items()}
        
        data = self._load_file("tasks")
        self.tasks = {k: Task.from_dict(v) for k, v in data.items()}
        
        data = self._load_file("acceptances")
        self.acceptances = {k: Acceptance.from_dict(v) for k, v in data.items()}
        
        data = self._load_file("worklogs")
        self.worklogs = {k: WorkLog.from_dict(v) for k, v in data.items()}
        
        data = self._load_file("disputes")
        self.disputes = {k: Dispute.from_dict(v) for k, v in data.items()}
        
        data = self._load_file("adjustments")
        self.adjustments = {k: AdjustmentHistory.from_dict(v) for k, v in data.items()}
        
        self.source_hashes = self._load_file("source_hashes")
    
    def _save_all(self):
        self._save_file("employees", {k: v.to_dict() for k, v in self.employees.items()})
        self._save_file("tasks", {k: v.to_dict() for k, v in self.tasks.items()})
        self._save_file("acceptances", {k: v.to_dict() for k, v in self.acceptances.items()})
        self._save_file("worklogs", {k: v.to_dict() for k, v in self.worklogs.items()})
        self._save_file("disputes", {k: v.to_dict() for k, v in self.disputes.items()})
        self._save_file("adjustments", {k: v.to_dict() for k, v in self.adjustments.items()})
        self._save_file("source_hashes", self.source_hashes)
    
    def save(self):
        self._save_all()
    
    def hash_source(self, content: str) -> str:
        return hashlib.sha256(content.encode("utf-8")).hexdigest()
    
    def is_source_imported(self, content: str) -> bool:
        h = self.hash_source(content)
        return h in self.source_hashes
    
    def mark_source_imported(self, content: str):
        h = self.hash_source(content)
        self.source_hashes[h] = h
    
    def add_employee(self, emp: Employee):
        self.employees[emp.employee_id] = emp
    
    def add_task(self, task: Task):
        self.tasks[task.task_id] = task
    
    def add_acceptance(self, acc: Acceptance):
        self.acceptances[acc.task_id] = acc
    
    def add_worklog(self, log: WorkLog) -> bool:
        if log.log_id in self.worklogs:
            return False
        self.worklogs[log.log_id] = log
        return True
    
    def get_active_worklogs(self) -> List[WorkLog]:
        return [w for w in self.worklogs.values() if w.is_active]
    
    def get_worklog_disputes(self, log_id: str) -> List[Dispute]:
        return [d for d in self.disputes.values() if d.log_id == log_id]
    
    def add_dispute(self, dispute: Dispute):
        self.disputes[dispute.dispute_id] = dispute
    
    def add_adjustment(self, adj: AdjustmentHistory):
        self.adjustments[adj.history_id] = adj
