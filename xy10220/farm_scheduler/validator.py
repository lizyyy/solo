from typing import List, Dict, Tuple, Optional
from datetime import date, time, datetime, timedelta
from .models import Plot, Harvester, Schedule
from .store import DataStore


class SchedulingError(Exception):
    pass


class ConstraintViolation:
    def __init__(self, constraint_type: str, message: str, severity: str = "error"):
        self.constraint_type = constraint_type
        self.message = message
        self.severity = severity
    
    def to_dict(self):
        return {
            "constraint_type": self.constraint_type,
            "message": self.message,
            "severity": self.severity
        }
    
    def __str__(self):
        return f"[{self.severity.upper()}] {self.constraint_type}: {self.message}"


class ScheduleValidator:
    def __init__(self, store: DataStore):
        self.store = store
    
    def validate_schedule(self, schedule: Schedule) -> List[ConstraintViolation]:
        violations = []
        plot = self.store.plots.get(schedule.plot_id)
        harvester = self.store.harvesters.get(schedule.harvester_id)
        
        if not plot:
            violations.append(ConstraintViolation(
                "plot_not_found",
                f"地块 {schedule.plot_id} 不存在"
            ))
        
        if not harvester:
            violations.append(ConstraintViolation(
                "harvester_not_found",
                f"农机 {schedule.harvester_id} 不存在"
            ))
        
        if plot and harvester:
            violations.extend(self._check_ripening_period(schedule, plot))
            violations.extend(self._check_maintenance_window(schedule, harvester))
            violations.extend(self._check_driver_rest(schedule, harvester))
            violations.extend(self._check_harvester_overlap(schedule))
        
        return violations
    
    def _check_ripening_period(self, schedule: Schedule, plot: Plot) -> List[ConstraintViolation]:
        violations = []
        sched_date = schedule.scheduled_date
        
        if sched_date < plot.ripening_start:
            days_early = (plot.ripening_start - sched_date).days
            violations.append(ConstraintViolation(
                "ripening_too_early",
                f"地块 {plot.plot_id}（{plot.crop_type}）在 {sched_date} 尚未成熟，最早可收割日期 {plot.ripening_start}（提前 {days_early} 天）"
            ))
        elif sched_date > plot.ripening_end:
            days_late = (sched_date - plot.ripening_end).days
            violations.append(ConstraintViolation(
                "ripening_too_late",
                f"地块 {plot.plot_id}（{plot.crop_type}）在 {sched_date} 已过成熟期，最晚可收割日期 {plot.ripening_end}（逾期 {days_late} 天）"
            ))
        
        return violations
    
    def _check_maintenance_window(self, schedule: Schedule, harvester: Harvester) -> List[ConstraintViolation]:
        violations = []
        sched_date = schedule.scheduled_date
        
        for mw in harvester.maintenance_windows:
            if mw.start_date <= sched_date <= mw.end_date:
                violations.append(ConstraintViolation(
                    "maintenance_window_conflict",
                    f"农机 {harvester.harvester_id} 在 {sched_date} 处于维修窗口：{mw.start_date} ~ {mw.end_date}（{mw.reason}）"
                ))
        
        return violations
    
    def _check_driver_rest(self, schedule: Schedule, harvester: Harvester) -> List[ConstraintViolation]:
        violations = []
        sched_date = schedule.scheduled_date
        rest_rule = harvester.rest_rule
        
        schedules_same_day = [
            s for s in self.store.schedules.values()
            if s.harvester_id == schedule.harvester_id
            and s.scheduled_date == sched_date
            and s.schedule_id != schedule.schedule_id
            and s.status != "cancelled"
        ]
        
        total_hours = self._calculate_schedule_duration(schedule)
        for s in schedules_same_day:
            total_hours += self._calculate_schedule_duration(s)
        
        if total_hours > rest_rule.max_daily_hours:
            violations.append(ConstraintViolation(
                "driver_daily_hours_exceeded",
                f"司机 {harvester.driver_name} 在 {sched_date} 的工作时长将超过限制：{total_hours:.1f} 小时 > {rest_rule.max_daily_hours} 小时"
            ))
        
        return violations
    
    def _check_harvester_overlap(self, schedule: Schedule) -> List[ConstraintViolation]:
        violations = []
        sched_date = schedule.scheduled_date
        
        existing_schedules = [
            s for s in self.store.schedules.values()
            if s.harvester_id == schedule.harvester_id
            and s.scheduled_date == sched_date
            and s.schedule_id != schedule.schedule_id
            and s.status != "cancelled"
        ]
        
        sched_start = self._combine_datetime(sched_date, schedule.start_time)
        sched_end = self._combine_datetime(sched_date, schedule.end_time)
        
        for existing in existing_schedules:
            existing_start = self._combine_datetime(sched_date, existing.start_time)
            existing_end = self._combine_datetime(sched_date, existing.end_time)
            
            if sched_start < existing_end and sched_end > existing_start:
                violations.append(ConstraintViolation(
                    "time_slot_conflict",
                    f"农机 {schedule.harvester_id} 在 {sched_date} {schedule.start_time}-{schedule.end_time} 与现有调度冲突：地块 {existing.plot_id}，时间 {existing.start_time}-{existing.end_time}"
                ))
        
        return violations
    
    def _calculate_schedule_duration(self, schedule: Schedule) -> float:
        start = datetime.combine(date.today(), schedule.start_time)
        end = datetime.combine(date.today(), schedule.end_time)
        if end < start:
            end += timedelta(days=1)
        duration = (end - start).total_seconds() / 3600
        return max(0.0, duration)
    
    def _combine_datetime(self, d: date, t: time) -> datetime:
        return datetime.combine(d, t)
    
    def validate_all_schedules(self) -> Dict[str, List[ConstraintViolation]]:
        all_violations = {}
        for schedule_id, schedule in self.store.schedules.items():
            if schedule.status != "cancelled":
                violations = self.validate_schedule(schedule)
                if violations:
                    all_violations[schedule_id] = violations
        return all_violations
