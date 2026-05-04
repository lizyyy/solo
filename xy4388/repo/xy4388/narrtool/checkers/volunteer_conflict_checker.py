"""志愿者场次冲突检测"""

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List

from narrtool.database.models import (
    CheckType,
    Severity,
    Screening,
    VolunteerSchedule,
)
from .base import BaseChecker, CheckResult, time_overlap_datetime


class VolunteerConflictChecker(BaseChecker):
    """志愿者场次冲突检测"""
    
    def __init__(self, buffer_minutes: float = 30.0):
        self.buffer_minutes = buffer_minutes
    
    def check(self, screening_id: int, session) -> List[CheckResult]:
        """执行检查"""
        results = []
        
        current_screening = session.query(Screening).filter(
            Screening.id == screening_id
        ).first()
        
        if not current_screening:
            return results
        
        current_schedules = session.query(VolunteerSchedule).filter(
            VolunteerSchedule.screening_id == screening_id
        ).all()
        
        if not current_schedules:
            return results
        
        all_schedules = session.query(VolunteerSchedule).filter(
            VolunteerSchedule.screening_id != screening_id
        ).all()
        
        for schedule in current_schedules:
            conflicts = self._find_conflicts(
                schedule, all_schedules, current_screening.movie_name
            )
            for conflict in conflicts:
                results.append(conflict)
        
        return results
    
    def _find_conflicts(
        self,
        current_schedule: VolunteerSchedule,
        all_schedules: List[VolunteerSchedule],
        current_movie: str
    ) -> List[CheckResult]:
        """查找冲突"""
        results = []
        
        same_volunteer_schedules = [
            s for s in all_schedules 
            if s.volunteer_name == current_schedule.volunteer_name
        ]
        
        for other_schedule in same_volunteer_schedules:
            if self._has_conflict(current_schedule, other_schedule):
                result = self._create_result(
                    current_schedule, other_schedule, current_movie
                )
                results.append(result)
        
        return results
    
    def _has_conflict(
        self,
        schedule1: VolunteerSchedule,
        schedule2: VolunteerSchedule
    ) -> bool:
        """检查两个排班是否冲突"""
        buffer = timedelta(minutes=self.buffer_minutes)
        
        start1 = schedule1.start_time
        end1 = schedule1.end_time + buffer
        
        start2 = schedule2.start_time - buffer
        end2 = schedule2.end_time
        
        return time_overlap_datetime(start1, end1, start2, end2, allow_touch=False)
    
    def _create_result(
        self,
        schedule1: VolunteerSchedule,
        schedule2: VolunteerSchedule,
        current_movie: str
    ) -> CheckResult:
        """创建检查结果"""
        conflict_start = max(schedule1.start_time, schedule2.start_time)
        conflict_end = min(schedule1.end_time, schedule2.end_time)
        
        overlap_seconds = (conflict_end - conflict_start).total_seconds()
        if overlap_seconds < 0:
            overlap_seconds = 0
        
        if overlap_seconds > 0:
            severity = Severity.HIGH
            overlap_desc = f"重叠时长: {overlap_seconds / 60:.1f} 分钟"
        else:
            severity = Severity.MEDIUM
            overlap_desc = f"间隔不足 {self.buffer_minutes} 分钟"
        
        schedule1_movie = current_movie or "当前场次"
        schedule2_movie = schedule2.movie_name or "另一批次次"
        
        description = (
            f"志愿者 '{schedule1.volunteer_name}' 存在场次冲突。\n"
            f"  场次1: {schedule1_movie}\n"
            f"    时间: {self._format_datetime(schedule1.start_time)} - {self._format_datetime(schedule1.end_time)}\n"
            f"    角色: {schedule1.role or '未指定'}\n"
            f"  场次2: {schedule2_movie}\n"
            f"    时间: {self._format_datetime(schedule2.start_time)} - {self._format_datetime(schedule2.end_time)}\n"
            f"    角色: {schedule2.role or '未指定'}\n"
            f"  问题: {overlap_desc}"
        )
        
        return CheckResult(
            check_type=CheckType.VOLUNTEER_CONFLICT,
            severity=severity,
            description=description,
            related_ids=[schedule1.id, schedule2.id],
            time_start=(conflict_start - schedule1.start_time).total_seconds(),
            time_end=(conflict_end - schedule1.start_time).total_seconds(),
        )
    
    def _format_datetime(self, dt: datetime) -> str:
        """格式化日期时间"""
        return dt.strftime("%Y-%m-%d %H:%M")
