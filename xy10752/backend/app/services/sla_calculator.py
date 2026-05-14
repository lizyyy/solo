from datetime import datetime, timedelta
from typing import Optional, Tuple, List
from sqlalchemy.orm import Session
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import Ticket, SLARule, PauseRecord, Holiday, SLATimeline, SLACompensation


class SLACalculator:
    def __init__(self, db: Session):
        self.db = db

    def is_work_day(self, date: datetime, sla_rule: SLARule) -> bool:
        work_days = [int(d) for d in sla_rule.work_days.split(",")]
        if date.weekday() not in work_days:
            return False
        
        date_str = date.strftime("%Y-%m-%d")
        holiday = self.db.query(Holiday).filter(Holiday.date == date_str).first()
        if holiday:
            return False
        
        return True

    def is_work_hour(self, date: datetime, sla_rule: SLARule) -> bool:
        if not self.is_work_day(date, sla_rule):
            return False
        
        hour = date.hour
        return sla_rule.work_start_hour <= hour < sla_rule.work_end_hour

    def calculate_work_hours_between(
        self, start: datetime, end: datetime, sla_rule: SLARule
    ) -> float:
        if start >= end:
            return 0.0
        
        total_hours = 0.0
        current = start
        
        while current < end:
            if self.is_work_hour(current, sla_rule):
                next_hour = current + timedelta(hours=1)
                segment_end = min(next_hour, end)
                if self.is_work_hour(segment_end - timedelta(seconds=1), sla_rule):
                    delta = (segment_end - current).total_seconds() / 3600
                    total_hours += delta
            current = current + timedelta(hours=1)
            if current.hour == 0:
                current = current.replace(hour=sla_rule.work_start_hour)
        
        return round(total_hours, 2)

    def calculate_deadline(
        self, start_time: datetime, hours: float, sla_rule: SLARule
    ) -> datetime:
        deadline = start_time
        remaining_hours = hours
        
        while remaining_hours > 0:
            if self.is_work_hour(deadline, sla_rule):
                remaining_hours -= 1
            deadline += timedelta(hours=1)
            
            if deadline.hour >= sla_rule.work_end_hour:
                deadline = deadline.replace(hour=sla_rule.work_start_hour) + timedelta(days=1)
                while not self.is_work_day(deadline, sla_rule):
                    deadline += timedelta(days=1)
        
        return deadline

    def calculate_total_pause_hours(self, ticket: Ticket) -> float:
        total_pause = 0.0
        for pause in ticket.pause_records:
            if pause.resumed_at:
                total_pause += pause.pause_duration_hours
        return total_pause

    def calculate_compensation_hours(self, ticket: Ticket) -> float:
        total_compensation = 0.0
        for comp in self.db.query(SLACompensation).filter(
            SLACompensation.ticket_id == ticket.id,
            SLACompensation.status == "applied"
        ).all():
            total_compensation += comp.compensation_hours
        return total_compensation

    def calculate_sla(
        self, ticket: Ticket, recalculate: bool = False
    ) -> Tuple[float, float, Optional[datetime], str]:
        if not ticket.sla_rule:
            return 0.0, 0.0, None, "no_rule"

        sla_rule = ticket.sla_rule
        now = datetime.now()

        if ticket.status in ["resolved", "closed"]:
            end_time = ticket.resolved_at or ticket.closed_at or now
        else:
            end_time = now

        total_allowed_hours = sla_rule.resolution_hours
        used_work_hours = self.calculate_work_hours_between(
            ticket.created_at, end_time, sla_rule
        )

        pause_hours = self.calculate_total_pause_hours(ticket)
        compensation_hours = self.calculate_compensation_hours(ticket)

        actual_used_hours = used_work_hours - pause_hours
        remaining_hours = total_allowed_hours - actual_used_hours + compensation_hours
        remaining_hours = max(0.0, round(remaining_hours, 2))
        actual_used_hours = round(actual_used_hours, 2)

        sla_deadline = self.calculate_deadline(
            ticket.created_at, total_allowed_hours + compensation_hours, sla_rule
        )

        sla_status = "running"
        if ticket.current_sla_status == "paused":
            sla_status = "paused"
        elif ticket.status in ["resolved", "closed"]:
            sla_status = "completed" if remaining_hours > 0 else "breached"
        elif remaining_hours <= 0:
            sla_status = "breached"
        elif remaining_hours <= 4:
            sla_status = "warning"

        return actual_used_hours, remaining_hours, sla_deadline, sla_status

    def recalculate_ticket_sla(self, ticket: Ticket) -> None:
        used_hours, remaining_hours, sla_deadline, sla_status = self.calculate_sla(
            ticket, recalculate=True
        )

        old_remaining = ticket.remaining_hours
        ticket.total_used_hours = used_hours
        ticket.remaining_hours = remaining_hours
        ticket.sla_deadline = sla_deadline
        if ticket.current_sla_status != "paused":
            ticket.current_sla_status = sla_status

        self.db.add(ticket)

        timeline = SLATimeline(
            ticket_id=ticket.id,
            event_type="sla_recalculation",
            event_title="SLA重新计算",
            event_detail=f"已用时长: {used_hours}小时, 剩余时长: {remaining_hours}小时",
            operator="system",
            sla_impact_hours=remaining_hours - old_remaining,
            remaining_before=old_remaining,
            remaining_after=remaining_hours
        )
        self.db.add(timeline)
        self.db.commit()

    def pause_ticket(
        self, ticket: Ticket, reason_code: str, reason_name: str, paused_by: str, remarks: Optional[str] = None
    ) -> PauseRecord:
        pause_record = PauseRecord(
            ticket_id=ticket.id,
            pause_reason_code=reason_code,
            pause_reason_name=reason_name,
            paused_by=paused_by,
            remarks=remarks,
            is_active=True
        )
        self.db.add(pause_record)

        old_status = ticket.current_sla_status
        ticket.current_sla_status = "paused"
        self.db.add(ticket)

        timeline = SLATimeline(
            ticket_id=ticket.id,
            event_type="pause",
            event_title=f"SLA暂停: {reason_name}",
            event_detail=f"暂停原因: {reason_name}, 操作人: {paused_by}",
            operator=paused_by,
            sla_impact_hours=0.0,
            remaining_before=ticket.remaining_hours,
            remaining_after=ticket.remaining_hours
        )
        self.db.add(timeline)
        self.db.commit()

        return pause_record

    def resume_ticket(self, ticket: Ticket, resumed_by: str) -> PauseRecord:
        active_pause = self.db.query(PauseRecord).filter(
            PauseRecord.ticket_id == ticket.id,
            PauseRecord.is_active == True
        ).first()

        if not active_pause:
            raise ValueError("没有活动的暂停记录")

        now = datetime.now()
        active_pause.resumed_at = now
        
        if ticket.sla_rule:
            pause_duration = self.calculate_work_hours_between(
                active_pause.paused_at, now, ticket.sla_rule
            )
            active_pause.pause_duration_hours = round(pause_duration, 2)

        active_pause.is_active = False
        self.db.add(active_pause)

        has_other_pauses = self.db.query(PauseRecord).filter(
            PauseRecord.ticket_id == ticket.id,
            PauseRecord.is_active == True
        ).count() > 0

        if not has_other_pauses:
            ticket.current_sla_status = "running"
            self.recalculate_ticket_sla(ticket)

        timeline = SLATimeline(
            ticket_id=ticket.id,
            event_type="resume",
            event_title="SLA恢复",
            event_detail=f"暂停时长: {active_pause.pause_duration_hours}小时, 操作人: {resumed_by}",
            operator=resumed_by,
            sla_impact_hours=0.0,
            remaining_before=ticket.remaining_hours,
            remaining_after=ticket.remaining_hours
        )
        self.db.add(timeline)
        self.db.commit()

        return active_pause

    def apply_compensation(
        self, ticket: Ticket, compensation_type: str, hours: float, reason: str, operator: str
    ) -> SLACompensation:
        compensation = SLACompensation(
            ticket_id=ticket.id,
            compensation_type=compensation_type,
            compensation_hours=hours,
            reason=reason,
            operator=operator,
            status="applied"
        )
        self.db.add(compensation)

        old_remaining = ticket.remaining_hours
        self.recalculate_ticket_sla(ticket)

        timeline = SLATimeline(
            ticket_id=ticket.id,
            event_type="compensation",
            event_title=f"SLA补偿: {compensation_type}",
            event_detail=f"补偿时长: {hours}小时, 原因: {reason}",
            operator=operator,
            sla_impact_hours=hours,
            remaining_before=old_remaining,
            remaining_after=ticket.remaining_hours
        )
        self.db.add(timeline)
        self.db.commit()

        return compensation

    def check_sla_paths(self, ticket: Ticket) -> dict:
        paths = {
            "success": False,
            "blocked": False,
            "compensation": False,
            "manual_review": False
        }

        if ticket.status in ["resolved", "closed"] and ticket.remaining_hours > 0:
            paths["success"] = True

        if ticket.current_sla_status == "paused":
            paths["blocked"] = True

        has_compensation = self.db.query(SLACompensation).filter(
            SLACompensation.ticket_id == ticket.id
        ).count() > 0
        if has_compensation:
            paths["compensation"] = True

        if ticket.remaining_hours < 0 or ticket.priority == "critical":
            paths["manual_review"] = True

        return paths
