from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from dataclasses import dataclass

from ..models import Appointment, Room, AppointmentStatus, HealthDeclaration


@dataclass
class ValidationResult:
    is_valid: bool
    message: str
    error_code: Optional[str] = None


class ValidationService:
    @staticmethod
    def validate_room_capacity(
        room: Room,
        new_visitor_count: int,
        current_appointments: List[Appointment],
        scheduled_start: datetime,
        scheduled_end: datetime,
        exclude_appointment_id: Optional[str] = None
    ) -> ValidationResult:
        overlapping_visitors = 0
        for apt in current_appointments:
            if exclude_appointment_id and apt.id == exclude_appointment_id:
                continue
            if apt.room_number != room.room_number:
                continue
            if apt.status in [AppointmentStatus.CANCELLED, AppointmentStatus.REJECTED, AppointmentStatus.COMPLETED]:
                continue

            if ValidationService._is_overlapping(
                apt.scheduled_start, apt.scheduled_end,
                scheduled_start, scheduled_end
            ):
                overlapping_visitors += len(apt.visitor_ids)

        total_visitors = overlapping_visitors + new_visitor_count
        if total_visitors > room.capacity:
            return ValidationResult(
                False,
                f"房间容量超出限制。当前重叠探访人数: {overlapping_visitors}, "
                f"新增: {new_visitor_count}, 总容量: {room.capacity}",
                "CAPACITY_EXCEEDED"
            )
        return ValidationResult(True, "容量校验通过")

    @staticmethod
    def _is_overlapping(start1: datetime, end1: datetime,
                       start2: datetime, end2: datetime) -> bool:
        return start1 < end2 and start2 < end1

    @staticmethod
    def validate_duplicate_appointment(
        visitor_ids: List[str],
        scheduled_start: datetime,
        scheduled_end: datetime,
        current_appointments: List[Appointment],
        exclude_appointment_id: Optional[str] = None
    ) -> ValidationResult:
        for apt in current_appointments:
            if exclude_appointment_id and apt.id == exclude_appointment_id:
                continue
            if apt.status in [AppointmentStatus.CANCELLED, AppointmentStatus.REJECTED]:
                continue

            for visitor_id in visitor_ids:
                if visitor_id in apt.visitor_ids:
                    if ValidationService._is_overlapping(
                        apt.scheduled_start, apt.scheduled_end,
                        scheduled_start, scheduled_end
                    ):
                        return ValidationResult(
                            False,
                            f"探访人 {visitor_id} 在该时间段已有预约",
                            "DUPLICATE_APPOINTMENT"
                        )
        return ValidationResult(True, "无重复预约")

    @staticmethod
    def validate_time_slot(
        scheduled_start: datetime,
        scheduled_end: datetime
    ) -> ValidationResult:
        if scheduled_start >= scheduled_end:
            return ValidationResult(
                False,
                "预约开始时间必须早于结束时间",
                "INVALID_TIME_RANGE"
            )

        duration = scheduled_end - scheduled_start
        if duration < timedelta(minutes=15):
            return ValidationResult(
                False,
                "预约时长至少需要15分钟",
                "DURATION_TOO_SHORT"
            )
        if duration > timedelta(hours=4):
            return ValidationResult(
                False,
                "预约时长不能超过4小时",
                "DURATION_TOO_LONG"
            )

        if scheduled_start < datetime.now():
            return ValidationResult(
                False,
                "不能预约过去的时间",
                "PAST_TIME_NOT_ALLOWED"
            )

        return ValidationResult(True, "时间槽校验通过")

    @staticmethod
    def validate_health_declaration(
        declaration: HealthDeclaration
    ) -> ValidationResult:
        if declaration.temperature >= 37.3:
            return ValidationResult(
                False,
                f"体温异常: {declaration.temperature}℃，不允许探访",
                "FEVER_DETECTED"
            )
        if declaration.has_fever or declaration.has_cough or declaration.has_other_symptoms:
            return ValidationResult(
                False,
                "存在健康异常症状，不允许探访",
                "HEALTH_SYMPTOMS_DETECTED"
            )
        return ValidationResult(True, "健康申报通过")

    @staticmethod
    def validate_status_transition(
        current_status: AppointmentStatus,
        new_status: AppointmentStatus
    ) -> ValidationResult:
        valid_transitions = {
            AppointmentStatus.PENDING: [
                AppointmentStatus.CONFIRMED,
                AppointmentStatus.CANCELLED,
                AppointmentStatus.REJECTED
            ],
            AppointmentStatus.CONFIRMED: [
                AppointmentStatus.CHECKED_IN,
                AppointmentStatus.CANCELLED,
                AppointmentStatus.RESCHEDULED
            ],
            AppointmentStatus.CHECKED_IN: [
                AppointmentStatus.COMPLETED,
                AppointmentStatus.CANCELLED
            ],
            AppointmentStatus.RESCHEDULED: [
                AppointmentStatus.CONFIRMED,
                AppointmentStatus.CANCELLED
            ],
            AppointmentStatus.COMPLETED: [],
            AppointmentStatus.CANCELLED: [],
            AppointmentStatus.REJECTED: []
        }

        if new_status not in valid_transitions.get(current_status, []):
            return ValidationResult(
                False,
                f"无法从 {current_status.value} 状态转换到 {new_status.value}",
                "INVALID_STATUS_TRANSITION"
            )
        return ValidationResult(True, "状态转换合法")
