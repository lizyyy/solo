from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import csv
import json
from io import StringIO

from database import ComplaintService
from security import export_with_mask
from models import ParentComplaintDB

class ReportGenerator:
    def __init__(self, service: ComplaintService):
        self.service = service
    
    def generate_monthly_report(self, year: int, month: int) -> Dict[str, Any]:
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        end_date = end_date - timedelta(seconds=1)
        
        stats = self.service.get_statistics(start_date, end_date)
        
        complaints = self.service.list_complaints(
            start_date=start_date,
            end_date=end_date,
            mask_sensitive=False
        )
        
        bus_stats = self._get_bus_statistics(complaints)
        route_stats = self._get_route_statistics(complaints)
        
        return {
            "report_period": f"{year}年{month}月",
            "generated_at": datetime.now().isoformat(),
            "summary": stats,
            "by_bus": bus_stats,
            "by_route": route_stats
        }
    
    def _get_bus_statistics(self, complaints: List[ParentComplaintDB]) -> Dict[str, Any]:
        bus_data = {}
        for c in complaints:
            if c.bus_no not in bus_data:
                bus_data[c.bus_no] = {"count": 0, "total_delay": 0, "responsibilities": {}}
            bus_data[c.bus_no]["count"] += 1
            bus_data[c.bus_no]["total_delay"] += c.delay_minutes
            if c.responsibility:
                bus_data[c.bus_no]["responsibilities"][c.responsibility] = \
                    bus_data[c.bus_no]["responsibilities"].get(c.responsibility, 0) + 1
        
        result = {}
        for bus_no, data in bus_data.items():
            result[bus_no] = {
                "complaint_count": data["count"],
                "average_delay": round(data["total_delay"] / data["count"], 2) if data["count"] > 0 else 0,
                "by_responsibility": data["responsibilities"]
            }
        
        return result
    
    def _get_route_statistics(self, complaints: List[ParentComplaintDB]) -> Dict[str, Any]:
        route_data = {}
        for c in complaints:
            if c.route_no not in route_data:
                route_data[c.route_no] = {"count": 0, "total_delay": 0}
            route_data[c.route_no]["count"] += 1
            route_data[c.route_no]["total_delay"] += c.delay_minutes
        
        result = {}
        for route_no, data in route_data.items():
            result[route_no] = {
                "complaint_count": data["count"],
                "average_delay": round(data["total_delay"] / data["count"], 2) if data["count"] > 0 else 0
            }
        
        return result
    
    def export_complaints_to_csv(self, complaints: List[ParentComplaintDB],
                                  include_sensitive: bool = False) -> str:
        output = StringIO()
        fieldnames = [
            "id", "complaint_no", "parent_name", "parent_phone", "student_name",
            "school_name", "route_no", "bus_no", "scheduled_arrival", "actual_arrival",
            "delay_minutes", "complaint_reason", "status", "responsibility",
            "final_decision", "gps_status", "cross_site", "site_count",
            "decided_by", "decided_at", "created_at"
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        data_list = []
        for c in complaints:
            data = {
                "id": c.id,
                "complaint_no": c.complaint_no,
                "parent_name": c.parent_name,
                "parent_phone": c.parent_phone,
                "student_name": c.student_name,
                "school_name": c.school_name,
                "route_no": c.route_no,
                "bus_no": c.bus_no,
                "scheduled_arrival": c.scheduled_arrival.isoformat() if c.scheduled_arrival else "",
                "actual_arrival": c.actual_arrival.isoformat() if c.actual_arrival else "",
                "delay_minutes": c.delay_minutes,
                "complaint_reason": c.complaint_reason,
                "status": c.status,
                "responsibility": c.responsibility or "",
                "final_decision": c.final_decision or "",
                "gps_status": c.gps_status or "",
                "cross_site": "是" if c.cross_site else "否",
                "site_count": c.site_count,
                "decided_by": c.decided_by or "",
                "decided_at": c.decided_at.isoformat() if c.decided_at else "",
                "created_at": c.created_at.isoformat() if c.created_at else ""
            }
            data_list.append(data)
        
        if not include_sensitive:
            data_list = export_with_mask(data_list)
        
        for data in data_list:
            writer.writerow(data)
        
        return output.getvalue()
    
    def export_audit_log_to_csv(self, logs: List) -> str:
        output = StringIO()
        fieldnames = [
            "id", "operator", "operation", "target_type", "target_id",
            "created_at"
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for log in logs:
            writer.writerow({
                "id": log.id,
                "operator": log.operator,
                "operation": log.operation,
                "target_type": log.target_type,
                "target_id": log.target_id,
                "created_at": log.created_at.isoformat() if log.created_at else ""
            })
        
        return output.getvalue()
    
    def generate_complaint_detail_report(self, complaint_id: int) -> Dict[str, Any]:
        complaint = self.service.get_complaint(complaint_id, mask_sensitive=False)
        if not complaint:
            raise ValueError(f"Complaint {complaint_id} not found")
        
        decision_records = self.service.get_decision_records(complaint_id)
        operation_logs = self.service.get_operation_logs(
            target_type="complaint",
            target_id=complaint_id
        )
        
        return {
            "complaint": {
                "id": complaint.id,
                "complaint_no": complaint.complaint_no,
                "parent_name": complaint.parent_name,
                "student_name": complaint.student_name,
                "school_name": complaint.school_name,
                "route_no": complaint.route_no,
                "bus_no": complaint.bus_no,
                "scheduled_arrival": complaint.scheduled_arrival.isoformat(),
                "actual_arrival": complaint.actual_arrival.isoformat(),
                "delay_minutes": complaint.delay_minutes,
                "complaint_reason": complaint.complaint_reason,
                "status": complaint.status,
                "responsibility": complaint.responsibility,
                "final_decision": complaint.final_decision,
                "gps_status": complaint.gps_status,
                "cross_site": complaint.cross_site,
                "site_count": complaint.site_count,
                "decided_by": complaint.decided_by,
                "decided_at": complaint.decided_at.isoformat() if complaint.decided_at else None
            },
            "decision_process": [
                {
                    "rule_name": dr.rule_name,
                    "result": dr.rule_result,
                    "reason": dr.reason,
                    "is_blocked": dr.is_blocked,
                    "operator": dr.operator,
                    "operation_time": dr.operation_time.isoformat()
                } for dr in decision_records
            ],
            "operation_history": [
                {
                    "operator": log.operator,
                    "operation": log.operation,
                    "created_at": log.created_at.isoformat()
                } for log in operation_logs
            ]
        }
