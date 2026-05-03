"""数据校验器和分析器"""

from datetime import datetime, date, time, timedelta
from typing import List, Dict, Set, Optional
from collections import defaultdict

from .models import (
    Booking, FaultRecord, RiskIssue, RiskLevel, 
    AnalysisResult, TimeSlot
)


class ScheduleAnalyzer:
    """排班分析器"""
    
    def __init__(
        self,
        max_booking_duration: timedelta = timedelta(hours=4),
        max_consecutive_hours: float = 8.0,
        work_start_time: time = time(8, 0),
        work_end_time: time = time(22, 0),
        min_slot_duration: timedelta = timedelta(hours=1)
    ):
        self.max_booking_duration = max_booking_duration
        self.max_consecutive_hours = max_consecutive_hours
        self.work_start_time = work_start_time
        self.work_end_time = work_end_time
        self.min_slot_duration = min_slot_duration
    
    def analyze(
        self, 
        bookings: List[Booking], 
        faults: List[FaultRecord]
    ) -> AnalysisResult:
        """执行完整分析"""
        result = AnalysisResult(bookings=bookings, faults=faults)
        
        result.issues.extend(self._check_time_conflicts(bookings))
        result.issues.extend(self._check_overtime_bookings(bookings))
        result.issues.extend(self._check_fault_period_bookings(bookings, faults))
        result.issues.extend(self._check_consecutive_duty(bookings))
        
        result.available_slots = self._find_available_slots(bookings, faults)
        
        return result
    
    def _check_time_conflicts(self, bookings: List[Booking]) -> List[RiskIssue]:
        """检查时间冲突"""
        issues = []
        
        bookings_by_instrument: Dict[str, List[Booking]] = defaultdict(list)
        for booking in bookings:
            bookings_by_instrument[booking.instrument_id].append(booking)
        
        for instr_id, instr_bookings in bookings_by_instrument.items():
            sorted_bookings = sorted(instr_bookings, key=lambda b: b.start_time)
            
            for i in range(len(sorted_bookings)):
                for j in range(i + 1, len(sorted_bookings)):
                    b1 = sorted_bookings[i]
                    b2 = sorted_bookings[j]
                    
                    if b1.overlaps_with(b2):
                        overlap_start = max(b1.start_time, b2.start_time)
                        overlap_end = min(b1.end_time, b2.end_time)
                        overlap_duration = overlap_end - overlap_start
                        
                        issues.append(RiskIssue(
                            issue_type="时间冲突",
                            risk_level=RiskLevel.HIGH,
                            description=f"仪器 [{b1.instrument_name}] 在 {overlap_start.strftime('%Y-%m-%d %H:%M')} - {overlap_end.strftime('%H:%M')} 存在时间冲突（重叠 {self._format_timedelta(overlap_duration)}）",
                            affected_bookings=[b1, b2],
                            details={
                                "instrument_id": instr_id,
                                "instrument_name": b1.instrument_name,
                                "overlap_start": overlap_start.isoformat(),
                                "overlap_end": overlap_end.isoformat(),
                                "overlap_duration_minutes": int(overlap_duration.total_seconds() / 60)
                            }
                        ))
                    elif b2.start_time >= b1.end_time:
                        break
        
        return issues
    
    def _check_overtime_bookings(self, bookings: List[Booking]) -> List[RiskIssue]:
        """检查超时占用"""
        issues = []
        
        for booking in bookings:
            if booking.duration > self.max_booking_duration:
                overtime = booking.duration - self.max_booking_duration
                issues.append(RiskIssue(
                    issue_type="超时占用",
                    risk_level=RiskLevel.MEDIUM,
                    description=f"预约 [{booking.id}] 由 {booking.user_name} 使用仪器 [{booking.instrument_name}] 超时 {self._format_timedelta(overtime)}（预约时长 {self._format_timedelta(booking.duration)}，限 {self._format_timedelta(self.max_booking_duration)}）",
                    affected_bookings=[booking],
                    details={
                        "booking_id": booking.id,
                        "user_name": booking.user_name,
                        "instrument_name": booking.instrument_name,
                        "duration_minutes": int(booking.duration.total_seconds() / 60),
                        "max_duration_minutes": int(self.max_booking_duration.total_seconds() / 60),
                        "overtime_minutes": int(overtime.total_seconds() / 60)
                    }
                ))
        
        return issues
    
    def _check_fault_period_bookings(self, bookings: List[Booking], faults: List[FaultRecord]) -> List[RiskIssue]:
        """检查故障期误预约"""
        issues = []
        
        faults_by_instrument: Dict[str, List[FaultRecord]] = defaultdict(list)
        for fault in faults:
            faults_by_instrument[fault.instrument_id].append(fault)
        
        for booking in bookings:
            instr_faults = faults_by_instrument.get(booking.instrument_id, [])
            for fault in instr_faults:
                if booking.is_in_fault_period(fault):
                    overlap_start = max(booking.start_time, fault.start_time)
                    overlap_end = min(booking.end_time, fault.end_time)
                    
                    issues.append(RiskIssue(
                        issue_type="故障期误预约",
                        risk_level=RiskLevel.HIGH,
                        description=f"预约 [{booking.id}] 由 {booking.user_name} 预约的仪器 [{booking.instrument_name}] 在故障期内使用（故障: {fault.description}，重叠时间: {overlap_start.strftime('%Y-%m-%d %H:%M')} - {overlap_end.strftime('%H:%M')}）",
                        affected_bookings=[booking],
                        affected_faults=[fault],
                        details={
                            "booking_id": booking.id,
                            "fault_id": fault.id,
                            "instrument_name": booking.instrument_name,
                            "fault_description": fault.description,
                            "overlap_start": overlap_start.isoformat(),
                            "overlap_end": overlap_end.isoformat()
                        }
                    ))
        
        return issues
    
    def _check_consecutive_duty(self, bookings: List[Booking]) -> List[RiskIssue]:
        """检查人员连续值守过长"""
        issues = []
        
        bookings_by_user: Dict[str, List[Booking]] = defaultdict(list)
        for booking in bookings:
            bookings_by_user[booking.user_id].append(booking)
        
        for user_id, user_bookings in bookings_by_user.items():
            sorted_bookings = sorted(user_bookings, key=lambda b: b.start_time)
            
            if not sorted_bookings:
                continue
            
            user_name = sorted_bookings[0].user_name
            
            current_block_start = sorted_bookings[0].start_time
            current_block_end = sorted_bookings[0].end_time
            current_block_bookings = [sorted_bookings[0]]
            
            for booking in sorted_bookings[1:]:
                gap = booking.start_time - current_block_end
                
                if gap <= timedelta(minutes=30):
                    current_block_end = booking.end_time
                    current_block_bookings.append(booking)
                else:
                    block_duration = current_block_end - current_block_start
                    if block_duration.total_seconds() > self.max_consecutive_hours * 3600:
                        issues.append(self._create_consecutive_duty_issue(
                            user_name, current_block_start, current_block_end,
                            block_duration, current_block_bookings
                        ))
                    
                    current_block_start = booking.start_time
                    current_block_end = booking.end_time
                    current_block_bookings = [booking]
            
            block_duration = current_block_end - current_block_start
            if block_duration.total_seconds() > self.max_consecutive_hours * 3600:
                issues.append(self._create_consecutive_duty_issue(
                    user_name, current_block_start, current_block_end,
                    block_duration, current_block_bookings
                ))
        
        return issues
    
    def _create_consecutive_duty_issue(
        self, 
        user_name: str,
        start: datetime,
        end: datetime,
        duration: timedelta,
        bookings: List[Booking]
    ) -> RiskIssue:
        overtime = timedelta(seconds=duration.total_seconds() - self.max_consecutive_hours * 3600)
        
        return RiskIssue(
            issue_type="连续值守过长",
            risk_level=RiskLevel.MEDIUM,
            description=f"用户 [{user_name}] 在 {start.strftime('%Y-%m-%d %H:%M')} - {end.strftime('%Y-%m-%d %H:%M')} 连续值守 {self._format_timedelta(duration)}，超过限制 {self._format_timedelta(overtime)}",
            affected_bookings=bookings,
            details={
                "user_name": user_name,
                "block_start": start.isoformat(),
                "block_end": end.isoformat(),
                "duration_hours": round(duration.total_seconds() / 3600, 1),
                "max_hours": self.max_consecutive_hours,
                "overtime_hours": round(overtime.total_seconds() / 3600, 1)
            }
        )
    
    def _find_available_slots(
        self, 
        bookings: List[Booking], 
        faults: List[FaultRecord]
    ) -> List[TimeSlot]:
        """查找可用时段"""
        slots: List[TimeSlot] = []
        
        all_dates = self._get_all_dates(bookings, faults)
        instruments = self._get_all_instruments(bookings, faults)
        
        for instr_id, instr_name in instruments.items():
            instr_bookings = [b for b in bookings if b.instrument_id == instr_id]
            instr_faults = [f for f in faults if f.instrument_id == instr_id]
            
            for d in all_dates:
                day_start = datetime.combine(d, self.work_start_time)
                day_end = datetime.combine(d, self.work_end_time)
                
                blocked_periods = self._get_blocked_periods(
                    instr_bookings, instr_faults, day_start, day_end
                )
                
                day_slots = self._find_gaps_in_day(
                    day_start, day_end, blocked_periods, instr_id, instr_name
                )
                slots.extend(day_slots)
        
        return sorted(slots, key=lambda s: (s.start_time, s.instrument_id))
    
    def _get_all_dates(self, bookings: List[Booking], faults: List[FaultRecord]) -> Set[date]:
        """获取所有涉及的日期"""
        dates: Set[date] = set()
        for booking in bookings:
            dates.add(booking.start_time.date())
            dates.add(booking.end_time.date())
        for fault in faults:
            dates.add(fault.start_time.date())
            dates.add(fault.end_time.date())
        
        if not dates:
            return {date.today()}
        
        min_date = min(dates)
        max_date = max(dates)
        
        all_dates: Set[date] = set()
        current = min_date
        while current <= max_date:
            all_dates.add(current)
            current += timedelta(days=1)
        
        return all_dates
    
    def _get_all_instruments(self, bookings: List[Booking], faults: List[FaultRecord]) -> Dict[str, str]:
        """获取所有仪器"""
        instruments: Dict[str, str] = {}
        for booking in bookings:
            instruments[booking.instrument_id] = booking.instrument_name
        for fault in faults:
            instruments[fault.instrument_id] = fault.instrument_name
        return instruments
    
    def _get_blocked_periods(
        self,
        bookings: List[Booking],
        faults: List[FaultRecord],
        day_start: datetime,
        day_end: datetime
    ) -> List[tuple]:
        """获取一天内的所有阻塞时段"""
        periods: List[tuple] = []
        
        for booking in bookings:
            b_start = max(booking.start_time, day_start)
            b_end = min(booking.end_time, day_end)
            if b_start < b_end:
                periods.append((b_start, b_end, "booking"))
        
        for fault in faults:
            f_start = max(fault.start_time, day_start)
            f_end = min(fault.end_time, day_end)
            if f_start < f_end:
                periods.append((f_start, f_end, "fault"))
        
        periods.sort(key=lambda p: p[0])
        
        merged: List[tuple] = []
        for period in periods:
            if not merged:
                merged.append(period)
            else:
                last_start, last_end, _ = merged[-1]
                curr_start, curr_end, curr_type = period
                
                if curr_start <= last_end:
                    new_start = min(last_start, curr_start)
                    new_end = max(last_end, curr_end)
                    merged[-1] = (new_start, new_end, "merged")
                else:
                    merged.append(period)
        
        return merged
    
    def _find_gaps_in_day(
        self,
        day_start: datetime,
        day_end: datetime,
        blocked_periods: List[tuple],
        instrument_id: str,
        instrument_name: str
    ) -> List[TimeSlot]:
        """查找一天内的空闲时段"""
        slots: List[TimeSlot] = []
        
        current_time = day_start
        
        for (block_start, block_end, _) in blocked_periods:
            if current_time < block_start:
                gap_duration = block_start - current_time
                if gap_duration >= self.min_slot_duration:
                    slots.append(TimeSlot(
                        start_time=current_time,
                        end_time=block_start,
                        instrument_id=instrument_id,
                        instrument_name=instrument_name
                    ))
            
            current_time = max(current_time, block_end)
        
        if current_time < day_end:
            gap_duration = day_end - current_time
            if gap_duration >= self.min_slot_duration:
                slots.append(TimeSlot(
                    start_time=current_time,
                    end_time=day_end,
                    instrument_id=instrument_id,
                    instrument_name=instrument_name
                ))
        
        return slots
    
    def _format_timedelta(self, td: timedelta) -> str:
        """格式化时间差"""
        hours = int(td.total_seconds() // 3600)
        minutes = int((td.total_seconds() % 3600) // 60)
        
        if hours > 0 and minutes > 0:
            return f"{hours}小时{minutes}分钟"
        elif hours > 0:
            return f"{hours}小时"
        else:
            return f"{minutes}分钟"
