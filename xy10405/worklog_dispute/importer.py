import csv
import json
import hashlib
from datetime import date, datetime
from typing import List, Dict, Any
from .models import Employee, Task, Acceptance, WorkLog
from .store import DataStore
import uuid


def parse_date(value: Any) -> date:
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%m/%d/%Y"]:
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"无法解析日期: {value}")
    raise ValueError(f"无法解析日期: {value}")


def generate_log_id(*args) -> str:
    content = "|".join(str(a) for a in args)
    return "LOG-" + hashlib.md5(content.encode("utf-8")).hexdigest()[:12]


def generate_dispute_id() -> str:
    return "DSP-" + str(uuid.uuid4())[:8]


def generate_adjustment_id() -> str:
    return "ADJ-" + str(uuid.uuid4())[:8]


class Importer:
    def __init__(self, store: DataStore):
        self.store = store
    
    def import_worklogs_from_csv(self, file_path: str) -> Dict:
        with open(file_path, "r", encoding="utf-8-sig") as f:
            content = f.read()
        
        if self.store.is_source_imported(content):
            return {"skipped": 0, "added": 0, "duplicate_source": True}
        
        reader = csv.DictReader(content.splitlines())
        
        added = 0
        skipped = 0
        
        for row in reader:
            emp_id = row.get("employee_id", "").strip()
            emp_name = row.get("employee_name", row.get("name", "")).strip()
            task_id = row.get("task_id", "").strip()
            work_date = parse_date(row.get("date", row.get("work_date", "")))
            hours = float(row.get("hours", row.get("工时", "0")))
            desc = row.get("description", row.get("描述", "")).strip()
            
            if not emp_id:
                continue
            
            if emp_id not in self.store.employees:
                hourly_rate = float(row.get("hourly_rate", "100"))
                self.store.add_employee(Employee(
                    employee_id=emp_id,
                    name=emp_name or emp_id,
                    hourly_rate=hourly_rate
                ))
            
            log_id = generate_log_id(emp_id, task_id, work_date.isoformat(), hours, desc)
            log = WorkLog(
                log_id=log_id,
                employee_id=emp_id,
                task_id=task_id,
                work_date=work_date,
                hours=hours,
                description=desc
            )
            
            if self.store.add_worklog(log):
                added += 1
            else:
                skipped += 1
        
        self.store.mark_source_imported(content)
        self.store.save()
        
        return {"added": added, "skipped": skipped, "duplicate_source": False}
    
    def import_worklogs_from_json(self, file_path: str) -> Dict:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        if self.store.is_source_imported(content):
            return {"skipped": 0, "added": 0, "duplicate_source": True}
        
        data = json.loads(content)
        
        added = 0
        skipped = 0
        
        for item in data:
            emp_id = item.get("employee_id", "").strip()
            emp_name = item.get("employee_name", item.get("name", "")).strip()
            task_id = item.get("task_id", "").strip()
            work_date = parse_date(item.get("date", item.get("work_date", "")))
            hours = float(item.get("hours", 0))
            desc = item.get("description", "")
            
            if not emp_id:
                continue
            
            if emp_id not in self.store.employees:
                hourly_rate = float(item.get("hourly_rate", 100))
                self.store.add_employee(Employee(
                    employee_id=emp_id,
                    name=emp_name or emp_id,
                    hourly_rate=hourly_rate
                ))
            
            log_id = generate_log_id(emp_id, task_id, work_date.isoformat(), hours, desc)
            log = WorkLog(
                log_id=log_id,
                employee_id=emp_id,
                task_id=task_id,
                work_date=work_date,
                hours=hours,
                description=desc
            )
            
            if self.store.add_worklog(log):
                added += 1
            else:
                skipped += 1
        
        self.store.mark_source_imported(content)
        self.store.save()
        
        return {"added": added, "skipped": skipped, "duplicate_source": False}
    
    def import_tasks_from_csv(self, file_path: str) -> Dict:
        with open(file_path, "r", encoding="utf-8-sig") as f:
            content = f.read()
        
        if self.store.is_source_imported(content):
            return {"added": 0, "duplicate_source": True}
        
        reader = csv.DictReader(content.splitlines())
        added = 0
        
        for row in reader:
            task_id = row.get("task_id", "").strip()
            if not task_id:
                continue
            
            est = row.get("estimated_hours")
            task = Task(
                task_id=task_id,
                title=row.get("title", row.get("任务名称", "")),
                status=row.get("status", row.get("状态", "open")),
                estimated_hours=float(est) if est else None,
                max_daily_hours=float(row.get("max_daily_hours", 8))
            )
            
            self.store.add_task(task)
            added += 1
        
        self.store.mark_source_imported(content)
        self.store.save()
        
        return {"added": added, "duplicate_source": False}
    
    def import_tasks_from_json(self, file_path: str) -> Dict:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        if self.store.is_source_imported(content):
            return {"added": 0, "duplicate_source": True}
        
        data = json.loads(content)
        added = 0
        
        for item in data:
            task_id = item.get("task_id", "").strip()
            if not task_id:
                continue
            
            task = Task(
                task_id=task_id,
                title=item.get("title", ""),
                status=item.get("status", "open"),
                estimated_hours=item.get("estimated_hours"),
                max_daily_hours=item.get("max_daily_hours", 8)
            )
            
            self.store.add_task(task)
            added += 1
        
        self.store.mark_source_imported(content)
        self.store.save()
        
        return {"added": added, "duplicate_source": False}
    
    def import_acceptance_from_csv(self, file_path: str) -> Dict:
        with open(file_path, "r", encoding="utf-8-sig") as f:
            content = f.read()
        
        if self.store.is_source_imported(content):
            return {"added": 0, "duplicate_source": True}
        
        reader = csv.DictReader(content.splitlines())
        added = 0
        
        for row in reader:
            task_id = row.get("task_id", "").strip()
            if not task_id:
                continue
            
            accepted_str = row.get("accepted", row.get("验收", "")).lower().strip()
            accepted = accepted_str in ["true", "yes", "是", "通过", "1"]
            
            acc_date = row.get("accepted_date")
            rej_reason = row.get("rejection_reason", row.get("驳回原因", None))
            
            acc = Acceptance(
                task_id=task_id,
                accepted=accepted,
                accepted_date=parse_date(acc_date) if acc_date else None,
                rejection_reason=rej_reason if rej_reason else None
            )
            
            self.store.add_acceptance(acc)
            added += 1
        
        self.store.mark_source_imported(content)
        self.store.save()
        
        return {"added": added, "duplicate_source": False}
    
    def import_acceptance_from_json(self, file_path: str) -> Dict:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        if self.store.is_source_imported(content):
            return {"added": 0, "duplicate_source": True}
        
        data = json.loads(content)
        added = 0
        
        for item in data:
            task_id = item.get("task_id", "").strip()
            if not task_id:
                continue
            
            accepted = item.get("accepted", False)
            acc_date = item.get("accepted_date")
            
            acc = Acceptance(
                task_id=task_id,
                accepted=accepted,
                accepted_date=parse_date(acc_date) if acc_date else None,
                rejection_reason=item.get("rejection_reason")
            )
            
            self.store.add_acceptance(acc)
            added += 1
        
        self.store.mark_source_imported(content)
        self.store.save()
        
        return {"added": added, "duplicate_source": False}
