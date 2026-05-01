"""排班分析器"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from ..models.config import ProjectConfig
from ..models.frequency import FrequencyChannel, FrequencyPlan
from ..models.log import ContactLog
from ..models.schedule import DutySchedule, DutyShift


@dataclass
class TimeSlot:
    """时间段"""

    start_time: str
    end_time: str
    start_minutes: int
    end_minutes: int


@dataclass
class ChannelOccupancy:
    """频道占用情况"""

    channel_id: str
    channel_name: Optional[str]
    frequency_mhz: Optional[float]

    date: str
    time_slot: TimeSlot

    occupied: bool
    primary_call_sign: Optional[str]
    primary_operator: Optional[str]
    primary_shift_id: Optional[str]

    backup_call_sign: Optional[str]
    backup_operator: Optional[str]

    conflicts: List[Dict[str, Any]] = field(default_factory=list)
    notes: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "channel_id": self.channel_id,
            "channel_name": self.channel_name,
            "frequency_mhz": self.frequency_mhz,
            "date": self.date,
            "time_slot": {
                "start_time": self.time_slot.start_time,
                "end_time": self.time_slot.end_time,
            },
            "occupied": self.occupied,
            "primary_call_sign": self.primary_call_sign,
            "primary_operator": self.primary_operator,
            "primary_shift_id": self.primary_shift_id,
            "backup_call_sign": self.backup_call_sign,
            "backup_operator": self.backup_operator,
            "conflicts": self.conflicts,
            "notes": self.notes,
        }


@dataclass
class ConflictReport:
    """冲突报告"""

    conflict_id: str
    conflict_type: str

    date: str
    time_start: str
    time_end: str

    channel_id: Optional[str] = None
    call_sign: Optional[str] = None

    involved_shifts: List[Dict[str, Any]] = field(default_factory=list)
    description: str = ""
    severity: str = "medium"

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "conflict_id": self.conflict_id,
            "conflict_type": self.conflict_type,
            "date": self.date,
            "time_start": self.time_start,
            "time_end": self.time_end,
            "channel_id": self.channel_id,
            "call_sign": self.call_sign,
            "involved_shifts": self.involved_shifts,
            "description": self.description,
            "severity": self.severity,
        }


@dataclass
class AnalysisResult:
    """分析结果"""

    generated_at: datetime = field(default_factory=datetime.now)

    total_channels: int = 0
    total_dates: int = 0
    total_time_slots: int = 0

    occupied_slots: int = 0
    free_slots: int = 0
    conflict_slots: int = 0

    channel_occupancies: List[ChannelOccupancy] = field(default_factory=list)
    conflicts: List[ConflictReport] = field(default_factory=list)

    summary: Dict[str, Any] = field(default_factory=dict)


class ScheduleAnalyzer:
    """排班分析器"""

    def __init__(
        self,
        duty_schedule: DutySchedule,
        frequency_plan: Optional[FrequencyPlan] = None,
        project_config: Optional[ProjectConfig] = None,
        time_slot_minutes: int = 60,
    ):
        """
        初始化排班分析器

        Args:
            duty_schedule: 值守排班表
            frequency_plan: 频率计划
            project_config: 项目配置
            time_slot_minutes: 时间槽长度（分钟），默认60分钟
        """
        self.duty_schedule = duty_schedule
        self.frequency_plan = frequency_plan
        self.project_config = project_config
        self.time_slot_minutes = time_slot_minutes

        # 生成时间槽（全天24小时，按指定间隔分割）
        self._time_slots = self._generate_time_slots()

    def _generate_time_slots(self) -> List[TimeSlot]:
        """生成时间槽"""
        slots: List[TimeSlot] = []
        start_minute = 0
        end_minute = 24 * 60

        while start_minute < end_minute:
            slot_end = min(start_minute + self.time_slot_minutes, end_minute)
            slots.append(TimeSlot(
                start_time=self._minutes_to_time(start_minute),
                end_time=self._minutes_to_time(slot_end),
                start_minutes=start_minute,
                end_minutes=slot_end,
            ))
            start_minute = slot_end

        return slots

    def _minutes_to_time(self, minutes: int) -> str:
        """将分钟数转换为时间字符串"""
        hours = minutes // 60
        mins = minutes % 60
        return f"{hours:02d}:{mins:02d}"

    def _time_to_minutes(self, time_str: str) -> Optional[int]:
        """将时间字符串转换为分钟数"""
        try:
            parts = time_str.split(":")
            if len(parts) >= 2:
                hours = int(parts[0])
                mins = int(parts[1])
                return hours * 60 + mins
        except (ValueError, IndexError):
            pass
        return None

    def _check_time_overlap(
        self,
        shift_start: int,
        shift_end: int,
        slot_start: int,
        slot_end: int,
    ) -> bool:
        """检查班次是否与时间槽有重叠"""
        return shift_start < slot_end and shift_end > slot_start

    def _get_channel_info(self, channel_id: str) -> Tuple[Optional[str], Optional[float]]:
        """获取频道信息"""
        if self.frequency_plan:
            channel = self.frequency_plan.get_channel_by_id(channel_id)
            if channel:
                return channel.channel_name, channel.frequency_mhz
        return None, None

    def analyze(self) -> AnalysisResult:
        """
        执行排班分析

        Returns:
            分析结果
        """
        result = AnalysisResult()

        # 获取所有日期
        dates = self.duty_schedule.get_dates()
        result.total_dates = len(dates)

        # 获取所有频道
        channel_ids = set()
        for shift in self.duty_schedule.shifts:
            channel_ids.add(shift.channel_id)
        result.total_channels = len(channel_ids)

        # 生成时间槽
        result.total_time_slots = len(dates) * len(self._time_slots) * len(channel_ids)

        # 按日期和频道分组
        date_channel_shifts: Dict[Tuple[str, str], List[DutyShift]] = {}

        for shift in self.duty_schedule.shifts:
            key = (shift.date, shift.channel_id)
            if key not in date_channel_shifts:
                date_channel_shifts[key] = []
            date_channel_shifts[key].append(shift)

        # 分析每个日期和频道的占用情况
        for date in dates:
            for channel_id in channel_ids:
                key = (date, channel_id)
                shifts = date_channel_shifts.get(key, [])

                # 获取频道信息
                channel_name, frequency_mhz = self._get_channel_info(channel_id)

                # 分析每个时间槽
                for time_slot in self._time_slots:
                    # 找出在这个时间槽内的班次
                    overlapping_shifts: List[DutyShift] = []

                    for shift in shifts:
                        shift_start = self._time_to_minutes(shift.start_time)
                        shift_end = self._time_to_minutes(shift.end_time)

                        if shift_start is None or shift_end is None:
                            continue

                        if self._check_time_overlap(
                            shift_start, shift_end,
                            time_slot.start_minutes, time_slot.end_minutes,
                        ):
                            overlapping_shifts.append(shift)

                    # 创建频道占用记录
                    occupancy = ChannelOccupancy(
                        channel_id=channel_id,
                        channel_name=channel_name,
                        frequency_mhz=frequency_mhz,
                        date=date,
                        time_slot=time_slot,
                        occupied=len(overlapping_shifts) > 0,
                        primary_call_sign=None,
                        primary_operator=None,
                        primary_shift_id=None,
                        backup_call_sign=None,
                        backup_operator=None,
                        conflicts=[],
                    )

                    # 分析重叠班次
                    if overlapping_shifts:
                        # 分离主班和备班
                        primary_shifts = [s for s in overlapping_shifts if not s.is_backup]
                        backup_shifts = [s for s in overlapping_shifts if s.is_backup]

                        # 检查主班冲突
                        if len(primary_shifts) > 1:
                            # 有多个主班，记录冲突
                            conflict_shifts = [
                                {
                                    "shift_id": s.shift_id,
                                    "call_sign": s.call_sign,
                                    "operator_name": s.operator_name,
                                    "start_time": s.start_time,
                                    "end_time": s.end_time,
                                }
                                for s in primary_shifts
                            ]

                            occupancy.conflicts = conflict_shifts

                            # 生成冲突报告
                            conflict = ConflictReport(
                                conflict_id=f"CH_{date}_{time_slot.start_time}_{channel_id}",
                                conflict_type="channel_conflict",
                                date=date,
                                time_start=time_slot.start_time,
                                time_end=time_slot.end_time,
                                channel_id=channel_id,
                                involved_shifts=conflict_shifts,
                                description=f"频道 {channel_id} 在 {date} {time_slot.start_time}-{time_slot.end_time} 有多个主班值守",
                                severity="critical",
                            )
                            result.conflicts.append(conflict)
                            result.conflict_slots += 1

                        elif len(primary_shifts) == 1:
                            # 只有一个主班
                            primary = primary_shifts[0]
                            occupancy.primary_call_sign = primary.call_sign
                            occupancy.primary_operator = primary.operator_name
                            occupancy.primary_shift_id = primary.shift_id

                            # 检查备班
                            if backup_shifts:
                                backup = backup_shifts[0]
                                occupancy.backup_call_sign = backup.call_sign
                                occupancy.backup_operator = backup.operator_name

                        result.occupied_slots += 1
                    else:
                        result.free_slots += 1

                    result.channel_occupancies.append(occupancy)

        # 检查操作员冲突（同一操作员同一时段在多个频道）
        self._check_operator_conflicts(result)

        # 生成摘要
        result.summary = {
            "total_channels": result.total_channels,
            "total_dates": result.total_dates,
            "total_time_slots": result.total_time_slots,
            "occupied_slots": result.occupied_slots,
            "free_slots": result.free_slots,
            "conflict_slots": result.conflict_slots,
            "utilization_rate": round(
                result.occupied_slots / result.total_time_slots * 100,
                2,
            ) if result.total_time_slots > 0 else 0.0,
        }

        return result

    def _check_operator_conflicts(self, result: AnalysisResult) -> None:
        """检查操作员冲突（同一操作员同一时段在多个频道）"""
        # 按日期和呼号分组
        date_call_sign_shifts: Dict[Tuple[str, str], List[DutyShift]] = {}

        for shift in self.duty_schedule.shifts:
            if shift.is_backup:
                continue  # 忽略备班

            key = (shift.date, shift.call_sign)
            if key not in date_call_sign_shifts:
                date_call_sign_shifts[key] = []
            date_call_sign_shifts[key].append(shift)

        # 检查每个日期和呼号的班次
        for (date, call_sign), shifts in date_call_sign_shifts.items():
            if len(shifts) < 2:
                continue

            # 检查每对班次是否有时间重叠
            for i in range(len(shifts)):
                for j in range(i + 1, len(shifts)):
                    shift1 = shifts[i]
                    shift2 = shifts[j]

                    start1 = self._time_to_minutes(shift1.start_time)
                    end1 = self._time_to_minutes(shift1.end_time)
                    start2 = self._time_to_minutes(shift2.start_time)
                    end2 = self._time_to_minutes(shift2.end_time)

                    if start1 is None or end1 is None or start2 is None or end2 is None:
                        continue

                    # 计算重叠
                    overlap_start = max(start1, start2)
                    overlap_end = min(end1, end2)

                    if overlap_start < overlap_end:
                        # 有重叠，检查是否在不同频道
                        if shift1.channel_id != shift2.channel_id:
                            # 生成冲突报告
                            conflict = ConflictReport(
                                conflict_id=f"OP_{date}_{self._minutes_to_time(overlap_start)}_{call_sign}",
                                conflict_type="operator_conflict",
                                date=date,
                                time_start=self._minutes_to_time(overlap_start),
                                time_end=self._minutes_to_time(overlap_end),
                                call_sign=call_sign,
                                involved_shifts=[
                                    {
                                        "shift_id": shift1.shift_id,
                                        "channel_id": shift1.channel_id,
                                        "operator_name": shift1.operator_name,
                                        "start_time": shift1.start_time,
                                        "end_time": shift1.end_time,
                                    },
                                    {
                                        "shift_id": shift2.shift_id,
                                        "channel_id": shift2.channel_id,
                                        "operator_name": shift2.operator_name,
                                        "start_time": shift2.start_time,
                                        "end_time": shift2.end_time,
                                    },
                                ],
                                description=f"操作员 {call_sign} 在 {date} {self._minutes_to_time(overlap_start)}-{self._minutes_to_time(overlap_end)} 同时值守频道 {shift1.channel_id} 和 {shift2.channel_id}",
                                severity="critical",
                            )
                            result.conflicts.append(conflict)

    def generate_occupancy_matrix(self) -> Dict[str, Any]:
        """
        生成频道占用矩阵

        Returns:
            占用矩阵数据
        """
        dates = self.duty_schedule.get_dates()
        channel_ids = sorted({s.channel_id for s in self.duty_schedule.shifts})

        matrix: Dict[str, Any] = {
            "dates": dates,
            "channels": [],
            "time_slots": [
                {"start": ts.start_time, "end": ts.end_time}
                for ts in self._time_slots
            ],
            "data": {},
        }

        for channel_id in channel_ids:
            channel_name, frequency_mhz = self._get_channel_info(channel_id)
            matrix["channels"].append({
                "channel_id": channel_id,
                "channel_name": channel_name,
                "frequency_mhz": frequency_mhz,
            })

            # 收集该频道的所有班次
            channel_shifts = [
                s for s in self.duty_schedule.shifts
                if s.channel_id == channel_id
            ]

            # 按日期分组
            date_shifts: Dict[str, List[DutyShift]] = {}
            for shift in channel_shifts:
                if shift.date not in date_shifts:
                    date_shifts[shift.date] = []
                date_shifts[shift.date].append(shift)

            # 生成每个日期的占用情况
            for date in dates:
                key = f"{channel_id}_{date}"
                shifts = date_shifts.get(date, [])

                matrix["data"][key] = []

                for time_slot in self._time_slots:
                    # 检查在这个时间槽内的班次
                    slot_shifts: List[Dict[str, Any]] = []

                    for shift in shifts:
                        shift_start = self._time_to_minutes(shift.start_time)
                        shift_end = self._time_to_minutes(shift.end_time)

                        if shift_start is None or shift_end is None:
                            continue

                        if self._check_time_overlap(
                            shift_start, shift_end,
                            time_slot.start_minutes, time_slot.end_minutes,
                        ):
                            slot_shifts.append({
                                "shift_id": shift.shift_id,
                                "call_sign": shift.call_sign,
                                "operator_name": shift.operator_name,
                                "is_backup": shift.is_backup,
                            })

                    matrix["data"][key].append({
                        "time_slot": f"{time_slot.start_time}-{time_slot.end_time}",
                        "occupied": len(slot_shifts) > 0,
                        "shifts": slot_shifts,
                        "conflict": len([s for s in slot_shifts if not s["is_backup"]]) > 1,
                    })

        return matrix
