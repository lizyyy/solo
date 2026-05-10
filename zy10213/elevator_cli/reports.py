"""统计报表模块"""
from datetime import date, datetime, timedelta
from typing import List, Dict, Any

from .models import (
    ORDER_TYPE_PERIODIC, ORDER_TYPE_FAULT,
    ORDER_STATUS_PENDING, ORDER_STATUS_ASSIGNED, ORDER_STATUS_COMPLETED,
    ORDER_STATUS_OVERDUE, ORDER_STATUS_ESCALATED,
    now_date
)
from .service import MaintenanceService


class ReportService:
    """报表服务"""

    ESCALATE_THRESHOLD_DAYS = 3

    def __init__(self, service: MaintenanceService):
        self.service = service

    def get_today_pending_orders(self) -> List[Dict[str, Any]]:
        """今天待派单"""
        today = now_date()
        orders = self.service.store.orders.find(
            lambda o: (
                o.status in [ORDER_STATUS_PENDING, ORDER_STATUS_ASSIGNED] and
                o.planned_date == today
            )
        )
        result = []
        for o in orders:
            b_name, e_code = self.service.get_elevator_info(o.elevator_id)
            result.append({
                "order_no": o.order_no,
                "type": "周期维保" if o.type == ORDER_TYPE_PERIODIC else "故障报修",
                "building": b_name,
                "elevator": e_code,
                "tech": self.service.get_tech_name(o.technician_id) or "未派单",
                "status": self._status_name(o.status),
                "planned_date": str(o.planned_date),
                "due_date": str(o.due_date)
            })
        return sorted(result, key=lambda x: (x["type"], x["order_no"]))

    def get_overdue_orders(self) -> List[Dict[str, Any]]:
        """已逾期工单"""
        today = now_date()
        self.service.update_order_statuses()
        orders = self.service.store.orders.find(
            lambda o: o.status == ORDER_STATUS_OVERDUE
        )
        result = []
        for o in orders:
            overdue_days = (today - o.due_date).days if o.due_date else 0
            b_name, e_code = self.service.get_elevator_info(o.elevator_id)
            result.append({
                "order_no": o.order_no,
                "type": "周期维保" if o.type == ORDER_TYPE_PERIODIC else "故障报修",
                "building": b_name,
                "elevator": e_code,
                "tech": self.service.get_tech_name(o.technician_id) or "未派单",
                "due_date": str(o.due_date),
                "overdue_days": overdue_days,
                "planned_date": str(o.planned_date)
            })
        return sorted(result, key=lambda x: x["overdue_days"], reverse=True)

    def get_escalation_needed(self) -> List[Dict[str, Any]]:
        """需要升级的工单：已升级 + 逾期超过阈值"""
        today = now_date()
        self.service.update_order_statuses()

        escalated = self.service.store.orders.find(
            lambda o: o.status == ORDER_STATUS_ESCALATED
        )

        overdue_long = self.service.store.orders.find(
            lambda o: (
                o.status == ORDER_STATUS_OVERDUE and
                o.due_date and
                (today - o.due_date).days >= self.ESCALATE_THRESHOLD_DAYS
            )
        )

        seen = set()
        combined = []
        for o in escalated + overdue_long:
            if o.id in seen:
                continue
            seen.add(o.id)
            overdue_days = (today - o.due_date).days if o.due_date else 0
            b_name, e_code = self.service.get_elevator_info(o.elevator_id)
            combined.append({
                "order_no": o.order_no,
                "type": "周期维保" if o.type == ORDER_TYPE_PERIODIC else "故障报修",
                "building": b_name,
                "elevator": e_code,
                "tech": self.service.get_tech_name(o.technician_id) or "未派单",
                "status": self._status_name(o.status),
                "due_date": str(o.due_date),
                "overdue_days": overdue_days,
                "notes": o.notes
            })
        return sorted(combined, key=lambda x: x["overdue_days"], reverse=True)

    def get_monthly_completion_rate(self, year: int = None, month: int = None) -> Dict[str, Any]:
        """月度完成率"""
        if year is None or month is None:
            today = now_date()
            year = today.year
            month = today.month

        first_day = date(year, month, 1)
        if month == 12:
            last_day = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = date(year, month + 1, 1) - timedelta(days=1)

        all_month_orders = self.service.store.orders.find(
            lambda o: (
                o.planned_date and
                first_day <= o.planned_date <= last_day
            )
        )

        completed_orders = [
            o for o in all_month_orders
            if o.status == ORDER_STATUS_COMPLETED and o.completed_date
            and first_day <= o.completed_date <= last_day
        ]

        periodic_total = len([o for o in all_month_orders if o.type == ORDER_TYPE_PERIODIC])
        periodic_done = len([o for o in completed_orders if o.type == ORDER_TYPE_PERIODIC])

        fault_total = len([o for o in all_month_orders if o.type == ORDER_TYPE_FAULT])
        fault_done = len([o for o in completed_orders if o.type == ORDER_TYPE_FAULT])

        total = len(all_month_orders)
        done = len(completed_orders)
        rate = (done / total * 100) if total > 0 else 0
        periodic_rate = (periodic_done / periodic_total * 100) if periodic_total > 0 else 0
        fault_rate = (fault_done / fault_total * 100) if fault_total > 0 else 0

        return {
            "year": year,
            "month": month,
            "total_orders": total,
            "completed": done,
            "completion_rate": round(rate, 2),
            "periodic": {
                "total": periodic_total,
                "completed": periodic_done,
                "rate": round(periodic_rate, 2)
            },
            "fault": {
                "total": fault_total,
                "completed": fault_done,
                "rate": round(fault_rate, 2)
            },
            "details": [
                {
                    "order_no": o.order_no,
                    "type": "周期维保" if o.type == ORDER_TYPE_PERIODIC else "故障报修",
                    "status": self._status_name(o.status),
                    "planned_date": str(o.planned_date),
                    "completed_date": str(o.completed_date) if o.completed_date else ""
                }
                for o in all_month_orders
            ]
        }

    def _status_name(self, status: str) -> str:
        names = {
            ORDER_STATUS_PENDING: "待派单",
            ORDER_STATUS_ASSIGNED: "已派单",
            ORDER_STATUS_COMPLETED: "已完成",
            ORDER_STATUS_OVERDUE: "已逾期",
            ORDER_STATUS_ESCALATED: "已升级"
        }
        return names.get(status, status)
