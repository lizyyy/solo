from datetime import datetime, date
from typing import List, Dict, Any, Optional

from models import PreflightCheck, PreflightStatus, MaintenanceRecord


class MachineChecker:
    def __init__(self, maintenance_records: List[MaintenanceRecord] = None):
        self.maintenance_records = maintenance_records or []
    
    def check_machine(
        self,
        work_order,
        check_time: Optional[datetime] = None
    ) -> PreflightCheck:
        check_name = "Machine Availability Check"
        check_type = "machine"
        
        if check_time is None:
            check_time = datetime.now()
        
        cutting_template_id = getattr(work_order, 'cutting_template_id', None)
        
        if not cutting_template_id:
            return PreflightCheck(
                check_name=check_name,
                check_type=check_type,
                status=PreflightStatus.WARNING,
                message="未指定裁切模板，无法检查机器可用性",
                details={"note": "工单中未指定裁切模板"},
                severity="normal"
            )
        
        conflicting_maintenance = self._find_conflicting_maintenance(
            check_time,
            cutting_template_id
        )
        
        if conflicting_maintenance:
            work_order_details = {
                "work_order_id": work_order.id,
                "check_time": check_time.isoformat(),
                "template_id": cutting_template_id,
                "conflicts": []
            }
            
            for record in conflicting_maintenance:
                work_order_details["conflicts"].append({
                    "maintenance_id": record.id,
                    "machine_id": record.machine_id,
                    "machine_name": record.machine_name,
                    "maintenance_type": record.maintenance_type,
                    "status": record.status,
                    "scheduled_date": record.scheduled_date.isoformat() if record.scheduled_date else None,
                    "start_time": record.scheduled_start_time,
                    "end_time": record.scheduled_end_time,
                    "description": record.description
                })
            
            return PreflightCheck(
                check_name=check_name,
                check_type=check_type,
                status=PreflightStatus.FAILED,
                message=f"发现 {len(conflicting_maintenance)} 个机器保养冲突",
                details=work_order_details,
                severity="high"
            )
        
        return PreflightCheck(
            check_name=check_name,
            check_type=check_type,
            status=PreflightStatus.PASSED,
            message="所有相关机器当前可用",
            details={
                "check_time": check_time.isoformat(),
                "template_id": cutting_template_id,
                "checked_maintenance_count": len(self.maintenance_records)
            },
            severity="normal"
        )
    
    def _find_conflicting_maintenance(
        self,
        check_time: datetime,
        template_id: str
    ) -> List[MaintenanceRecord]:
        conflicting = []
        
        for record in self.maintenance_records:
            if record.is_overlapping(check_time):
                conflicting.append(record)
        
        return conflicting
    
    def check_machine_for_date(
        self,
        work_order,
        target_date: date,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None
    ) -> PreflightCheck:
        check_name = "Machine Availability Check (Scheduled)"
        check_type = "machine"
        
        cutting_template_id = getattr(work_order, 'cutting_template_id', None)
        
        if not cutting_template_id:
            return PreflightCheck(
                check_name=check_name,
                check_type=check_type,
                status=PreflightStatus.WARNING,
                message="未指定裁切模板，无法检查机器可用性",
                details={"note": "工单中未指定裁切模板"},
                severity="normal"
            )
        
        conflicting = []
        
        for record in self.maintenance_records:
            if record.scheduled_date == target_date:
                if start_time and end_time:
                    if self._time_overlaps(
                        start_time, end_time,
                        record.scheduled_start_time, record.scheduled_end_time
                    ):
                        conflicting.append(record)
                else:
                    conflicting.append(record)
        
        if conflicting:
            return PreflightCheck(
                check_name=check_name,
                check_type=check_type,
                status=PreflightStatus.FAILED,
                message=f"在 {target_date} 发现 {len(conflicting)} 个机器保养冲突",
                details={
                    "target_date": target_date.isoformat(),
                    "start_time": start_time,
                    "end_time": end_time,
                    "conflicting_maintenance": [
                        {
                            "id": r.id,
                            "machine": r.machine_name,
                            "type": r.maintenance_type,
                            "start": r.scheduled_start_time,
                            "end": r.scheduled_end_time
                        }
                        for r in conflicting
                    ]
                },
                severity="high"
            )
        
        return PreflightCheck(
            check_name=check_name,
            check_type=check_type,
            status=PreflightStatus.PASSED,
            message=f"在 {target_date} 所有相关机器可用",
            details={
                "target_date": target_date.isoformat(),
                "start_time": start_time,
                "end_time": end_time
            },
            severity="normal"
        )
    
    def _time_overlaps(
        self,
        start1: str, end1: str,
        start2: Optional[str], end2: Optional[str]
    ) -> bool:
        if not start2 or not end2:
            return True
        
        try:
            t1_start = datetime.strptime(start1, "%H:%M").time()
            t1_end = datetime.strptime(end1, "%H:%M").time()
            t2_start = datetime.strptime(start2, "%H:%M").time()
            t2_end = datetime.strptime(end2, "%H:%M").time()
            
            return not (t1_end <= t2_start or t1_start >= t2_end)
        except ValueError:
            return True
    
    def get_upcoming_maintenance(self, days: int = 7) -> List[MaintenanceRecord]:
        today = date.today()
        upcoming = []
        
        for record in self.maintenance_records:
            if record.status in ["scheduled", "in_progress"]:
                days_until = (record.scheduled_date - today).days
                if 0 <= days_until <= days:
                    upcoming.append(record)
        
        return upcoming
