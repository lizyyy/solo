from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from .models import (
    WorkLog, Task, Acceptance, Employee, Dispute,
    DisputeType, DisputeStatus, AdjustmentHistory
)
from .store import DataStore
from .importer import generate_dispute_id, generate_adjustment_id


class DisputeEngine:
    def __init__(self, store: DataStore):
        self.store = store
    
    def find_duplicate_logs(self) -> List[Tuple[WorkLog, WorkLog]]:
        key_map = defaultdict(list)
        
        for log in self.store.get_active_worklogs():
            key = (log.employee_id, log.task_id, log.work_date.isoformat())
            key_map[key].append(log)
        
        duplicates = []
        for key, logs in key_map.items():
            if len(logs) > 1:
                sorted_logs = sorted(logs, key=lambda x: x.created_at)
                for i in range(1, len(sorted_logs)):
                    duplicates.append((sorted_logs[0], sorted_logs[i]))
        
        return duplicates
    
    def calculate_daily_overtime(self) -> Dict[Tuple[str, str], Dict]:
        daily_map = defaultdict(list)
        for log in self.store.get_active_worklogs():
            key = (log.employee_id, log.work_date.isoformat())
            daily_map[key].append(log)
        
        overtime_map = {}
        for key, logs in daily_map.items():
            sorted_logs = sorted(logs, key=lambda x: x.created_at)
            total_hours = sum(l.hours for l in sorted_logs)
            
            max_hours = 8.0
            for l in sorted_logs:
                task = self.store.tasks.get(l.task_id)
                if task and task.max_daily_hours:
                    max_hours = task.max_daily_hours
                    break
            
            if total_hours > max_hours:
                overtime_map[key] = {
                    "total": total_hours,
                    "max": max_hours,
                    "extra": total_hours - max_hours,
                    "logs": sorted_logs
                }
        
        return overtime_map
    
    def check_no_task(self, log: WorkLog) -> bool:
        if not log.task_id:
            return True
        return log.task_id not in self.store.tasks
    
    def check_unaccepted(self, log: WorkLog) -> bool:
        if log.task_id not in self.store.acceptances:
            return True
        return not self.store.acceptances[log.task_id].accepted
    
    def check_rejected(self, log: WorkLog) -> bool:
        if log.task_id in self.store.acceptances:
            acc = self.store.acceptances[log.task_id]
            return not acc.accepted and acc.rejection_reason is not None
        return False
    
    def analyze_log(self, log: WorkLog) -> List[Dispute]:
        disputes = []
        
        existing = self.store.get_worklog_disputes(log.log_id)
        existing_types = {d.dispute_type for d in existing if d.status == DisputeStatus.OPEN}
        
        if DisputeType.NO_TASK not in existing_types:
            if self.check_no_task(log):
                disputes.append(Dispute(
                    dispute_id=generate_dispute_id(),
                    log_id=log.log_id,
                    dispute_type=DisputeType.NO_TASK,
                    status=DisputeStatus.OPEN,
                    original_hours=log.hours,
                    adjusted_hours=0.0
                ))
        
        if self.check_rejected(log):
            if DisputeType.REJECTED not in existing_types:
                disputes.append(Dispute(
                    dispute_id=generate_dispute_id(),
                    log_id=log.log_id,
                    dispute_type=DisputeType.REJECTED,
                    status=DisputeStatus.OPEN,
                    original_hours=log.hours,
                    adjusted_hours=0.0
                ))
        elif self.check_unaccepted(log):
            if DisputeType.UNACCEPTED not in existing_types:
                disputes.append(Dispute(
                    dispute_id=generate_dispute_id(),
                    log_id=log.log_id,
                    dispute_type=DisputeType.UNACCEPTED,
                    status=DisputeStatus.OPEN,
                    original_hours=log.hours,
                    adjusted_hours=None
                ))
        
        return disputes
    
    def run_full_analysis(self) -> Dict[str, int]:
        counts = defaultdict(int)
        
        for original, duplicate in self.find_duplicate_logs():
            existing = self.store.get_worklog_disputes(duplicate.log_id)
            if any(d.dispute_type == DisputeType.DUPLICATE and d.status == DisputeStatus.OPEN for d in existing):
                continue
            
            disp = Dispute(
                dispute_id=generate_dispute_id(),
                log_id=duplicate.log_id,
                dispute_type=DisputeType.DUPLICATE,
                status=DisputeStatus.OPEN,
                original_hours=duplicate.hours,
                adjusted_hours=0.0
            )
            self.store.add_dispute(disp)
            counts["duplicate"] += 1
        
        overtime_map = self.calculate_daily_overtime()
        for key, info in overtime_map.items():
            emp_id, date_str = key
            logs = info["logs"]
            extra = info["extra"]
            max_hours = info["max"]
            
            remaining_extra = extra
            for log in reversed(logs):
                if remaining_extra <= 0:
                    break
                
                existing = self.store.get_worklog_disputes(log.log_id)
                if any(d.dispute_type == DisputeType.OVERTIME and d.status == DisputeStatus.OPEN for d in existing):
                    continue
                
                adjust_amount = min(log.hours, remaining_extra)
                new_hours = log.hours - adjust_amount
                remaining_extra -= adjust_amount
                
                disp = Dispute(
                    dispute_id=generate_dispute_id(),
                    log_id=log.log_id,
                    dispute_type=DisputeType.OVERTIME,
                    status=DisputeStatus.OPEN,
                    original_hours=log.hours,
                    adjusted_hours=new_hours
                )
                self.store.add_dispute(disp)
                counts["overtime"] += 1
        
        for log in self.store.get_active_worklogs():
            new_disputes = self.analyze_log(log)
            for d in new_disputes:
                self.store.add_dispute(d)
                counts[d.dispute_type.value] += 1
        
        self.store.save()
        return dict(counts)
    
    def adjust_worklog(self, log_id: str, new_hours: float, reason: str) -> Optional[WorkLog]:
        if log_id not in self.store.worklogs:
            return None
        
        log = self.store.worklogs[log_id]
        old_hours = log.hours
        
        if old_hours == new_hours:
            return log
        
        adj = AdjustmentHistory(
            history_id=generate_adjustment_id(),
            log_id=log_id,
            before_hours=old_hours,
            after_hours=new_hours,
            reason=reason
        )
        self.store.add_adjustment(adj)
        
        log.hours = new_hours
        self.store.save()
        
        return log
    
    def resolve_dispute(self, dispute_id: str, status: DisputeStatus, note: str = "", 
                        adjusted_hours: Optional[float] = None) -> Optional[Dispute]:
        if dispute_id not in self.store.disputes:
            return None
        
        disp = self.store.disputes[dispute_id]
        disp.status = status
        disp.resolved_at = datetime.now()
        
        if note:
            disp.notes.append(f"[{datetime.now().isoformat()}] {note}")
        
        if adjusted_hours is not None:
            disp.adjusted_hours = adjusted_hours
        
        self.store.save()
        return disp
    
    def add_note(self, dispute_id: str, note: str) -> bool:
        if dispute_id not in self.store.disputes:
            return False
        
        disp = self.store.disputes[dispute_id]
        disp.notes.append(f"[{datetime.now().isoformat()}] {note}")
        self.store.save()
        return True
    
    def get_settlement_report(self) -> Dict:
        employees = self.store.employees
        tasks = self.store.tasks
        acceptances = self.store.acceptances
        
        by_employee = defaultdict(lambda: {"total_hours": 0.0, "settleable_hours": 0.0, 
                                           "held_hours": 0.0, "total_amount": 0.0, 
                                           "settleable_amount": 0.0, "held_amount": 0.0,
                                           "logs": []})
        by_date = defaultdict(lambda: {"total_hours": 0.0, "settleable_hours": 0.0, "held_hours": 0.0})
        by_task = defaultdict(lambda: {"total_hours": 0.0, "settleable_hours": 0.0, "held_hours": 0.0})
        
        for log in self.store.get_active_worklogs():
            emp = employees.get(log.employee_id, Employee(employee_id=log.employee_id, name=log.employee_id))
            rate = emp.hourly_rate
            
            disputes = [d for d in self.store.disputes.values() 
                       if d.log_id == log.log_id and d.status == DisputeStatus.OPEN]
            
            effective_hours = log.hours
            settleable = True
            
            for d in disputes:
                if d.dispute_type == DisputeType.OVERTIME:
                    if d.adjusted_hours is not None:
                        effective_hours = min(effective_hours, d.adjusted_hours)
                elif d.dispute_type in [DisputeType.DUPLICATE, DisputeType.NO_TASK, DisputeType.REJECTED]:
                    settleable = False
                    effective_hours = 0.0
                    break
                elif d.dispute_type == DisputeType.UNACCEPTED:
                    settleable = False
            
            total_amount = log.hours * rate
            settleable_amount = effective_hours * rate if settleable else 0.0
            held_amount = total_amount - settleable_amount
            held_hours = log.hours - (effective_hours if settleable else 0.0)
            
            by_employee[emp.name]["total_hours"] += log.hours
            by_employee[emp.name]["settleable_hours"] += (effective_hours if settleable else 0.0)
            by_employee[emp.name]["held_hours"] += held_hours
            by_employee[emp.name]["total_amount"] += total_amount
            by_employee[emp.name]["settleable_amount"] += settleable_amount
            by_employee[emp.name]["held_amount"] += held_amount
            
            by_employee[emp.name]["logs"].append({
                "log_id": log.log_id,
                "date": log.work_date.isoformat(),
                "task": log.task_id,
                "hours": log.hours,
                "effective_hours": effective_hours,
                "settleable": settleable,
                "disputes": [d.dispute_type.value for d in disputes]
            })
            
            by_date[log.work_date.isoformat()]["total_hours"] += log.hours
            by_date[log.work_date.isoformat()]["settleable_hours"] += (effective_hours if settleable else 0.0)
            by_date[log.work_date.isoformat()]["held_hours"] += held_hours
            
            by_task[log.task_id]["total_hours"] += log.hours
            by_task[log.task_id]["settleable_hours"] += (effective_hours if settleable else 0.0)
            by_task[log.task_id]["held_hours"] += held_hours
        
        totals = {
            "total_hours": sum(e["total_hours"] for e in by_employee.values()),
            "settleable_hours": sum(e["settleable_hours"] for e in by_employee.values()),
            "held_hours": sum(e["held_hours"] for e in by_employee.values()),
            "total_amount": sum(e["total_amount"] for e in by_employee.values()),
            "settleable_amount": sum(e["settleable_amount"] for e in by_employee.values()),
            "held_amount": sum(e["held_amount"] for e in by_employee.values()),
        }
        
        return {
            "generated_at": datetime.now().isoformat(),
            "totals": totals,
            "by_employee": dict(by_employee),
            "by_date": dict(sorted(by_date.items())),
            "by_task": dict(by_task),
            "open_disputes": [d.to_dict() for d in self.store.disputes.values() 
                             if d.status == DisputeStatus.OPEN]
        }
