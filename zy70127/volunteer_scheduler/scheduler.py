from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Dict, List, Optional, Set, Tuple, Any
from collections import defaultdict
import copy

from .models import (
    PositionRequirement,
    Volunteer,
    Schedule,
    LeaveRequest,
    SubstitutionRecord,
    EventLog,
    LeaveStatus,
    CheckInPermission,
    ScheduleStatus,
    EventType,
    generate_id,
)


class ValidationError(Exception):
    pass


class SchedulingError(Exception):
    pass


class NotFoundError(Exception):
    pass


class ConflictError(Exception):
    pass


@dataclass
class GapAlert:
    position_id: str
    position_name: str
    date: date
    time_slot: str
    required_count: int
    current_count: int
    gap_count: int
    required_qualifications: List[str]
    severity: str = "high"

    def to_dict(self) -> Dict[str, Any]:
        data = {
            "position_id": self.position_id,
            "position_name": self.position_name,
            "date": self.date.isoformat(),
            "time_slot": self.time_slot,
            "required_count": self.required_count,
            "current_count": self.current_count,
            "gap_count": self.gap_count,
            "required_qualifications": self.required_qualifications,
            "severity": self.severity,
        }
        return data


@dataclass
class SchedulerState:
    positions: Dict[str, PositionRequirement] = field(default_factory=dict)
    volunteers: Dict[str, Volunteer] = field(default_factory=dict)
    schedules: Dict[str, Schedule] = field(default_factory=dict)
    leave_requests: Dict[str, LeaveRequest] = field(default_factory=dict)
    substitutions: Dict[str, SubstitutionRecord] = field(default_factory=dict)
    event_logs: List[EventLog] = field(default_factory=list)
    processed_leave_ids: Set[str] = field(default_factory=set)


class VolunteerScheduler:
    def __init__(self, state: Optional[SchedulerState] = None):
        self.state = state or SchedulerState()

    def _log_event(
        self,
        event_type: EventType,
        entity_id: str,
        entity_type: str,
        details: Dict[str, Any],
        success: bool = True,
        error_message: Optional[str] = None,
    ) -> EventLog:
        log = EventLog(
            event_id=generate_id(),
            event_type=event_type,
            timestamp=datetime.now(),
            entity_id=entity_id,
            entity_type=entity_type,
            details=details,
            success=success,
            error_message=error_message,
        )
        self.state.event_logs.append(log)
        return log

    def _log_and_raise(self, error: Exception, event_type: EventType, entity_id: str, entity_type: str, details: Dict[str, Any]):
        self._log_event(
            event_type=event_type,
            entity_id=entity_id,
            entity_type=entity_type,
            details=details,
            success=False,
            error_message=str(error),
        )
        raise error

    def validate_leave_request(self, leave: LeaveRequest) -> bool:
        if not leave.volunteer_id or not leave.volunteer_id.strip():
            raise ValidationError("志愿者ID不能为空")
        if not leave.schedule_id or not leave.schedule_id.strip():
            raise ValidationError("排班ID不能为空")
        if not leave.reason or not leave.reason.strip():
            raise ValidationError("请假原因不能为空")
        if leave.volunteer_id not in self.state.volunteers:
            raise NotFoundError(f"志愿者不存在: {leave.volunteer_id}")
        if leave.schedule_id not in self.state.schedules:
            raise NotFoundError(f"排班记录不存在: {leave.schedule_id}")

        schedule = self.state.schedules[leave.schedule_id]
        if schedule.volunteer_id != leave.volunteer_id:
            raise ConflictError("排班记录不属于该志愿者")
        if schedule.status != ScheduleStatus.ACTIVE:
            raise ConflictError(f"排班记录状态异常: {schedule.status}")
        if schedule.checkin_permission == CheckInPermission.REVOKED:
            raise ConflictError("该志愿者的签到权限已被撤销")
        return True

    def is_duplicate_leave_request(self, schedule_id: str) -> bool:
        for leave in self.state.leave_requests.values():
            if (
                leave.schedule_id == schedule_id
                and leave.status in (LeaveStatus.PENDING, LeaveStatus.APPROVED)
            ):
                return True
        return False

    def create_leave_request(
        self,
        volunteer_id: str,
        schedule_id: str,
        date: date,
        time_slot: str,
        reason: str,
    ) -> LeaveRequest:
        if self.is_duplicate_leave_request(schedule_id):
            raise ConflictError("该排班已有待处理或已批准的请假申请")

        leave = LeaveRequest(
            leave_id=generate_id(),
            volunteer_id=volunteer_id,
            schedule_id=schedule_id,
            date=date,
            time_slot=time_slot,
            reason=reason,
        )

        try:
            self.validate_leave_request(leave)
        except (ValidationError, NotFoundError, ConflictError) as e:
            self._log_and_raise(
                e,
                EventType.LEAVE_REQUEST_CREATED,
                "new",
                "LeaveRequest",
                {"volunteer_id": volunteer_id, "schedule_id": schedule_id},
            )

        self.state.leave_requests[leave.leave_id] = leave
        self._log_event(
            EventType.LEAVE_REQUEST_CREATED,
            leave.leave_id,
            "LeaveRequest",
            {
                "volunteer_id": volunteer_id,
                "schedule_id": schedule_id,
                "reason": reason,
            },
        )
        return leave

    def find_eligible_substitutes(
        self, position_id: str, exclude_volunteer_ids: Set[str], date: date, time_slot: str
    ) -> List[Volunteer]:
        position = self.state.positions.get(position_id)
        if not position:
            raise NotFoundError(f"岗位不存在: {position_id}")

        candidates = []
        busy_volunteers = self._get_busy_volunteers(date, time_slot)

        for vid, volunteer in self.state.volunteers.items():
            if not volunteer.is_active:
                continue
            if vid in exclude_volunteer_ids:
                continue
            if vid in busy_volunteers:
                continue
            if not volunteer.matches_requirements(position.required_qualifications):
                continue
            candidates.append(volunteer)

        return candidates

    def _get_busy_volunteers(self, date: date, time_slot: str) -> Set[str]:
        busy = set()
        for schedule in self.state.schedules.values():
            if (
                schedule.date == date
                and schedule.time_slot == time_slot
                and schedule.status == ScheduleStatus.ACTIVE
                and schedule.checkin_permission == CheckInPermission.GRANTED
            ):
                busy.add(schedule.volunteer_id)
        return busy

    def get_position_gap(self, position_id: str) -> GapAlert:
        position = self.state.positions.get(position_id)
        if not position:
            raise NotFoundError(f"岗位不存在: {position_id}")

        active_count = 0
        for schedule in self.state.schedules.values():
            if (
                schedule.position_id == position_id
                and schedule.status == ScheduleStatus.ACTIVE
                and schedule.checkin_permission == CheckInPermission.GRANTED
            ):
                active_count += 1

        gap_count = position.required_count - active_count
        severity = "high" if gap_count > 0 else "low"

        return GapAlert(
            position_id=position_id,
            position_name=position.name,
            date=position.date,
            time_slot=position.time_slot,
            required_count=position.required_count,
            current_count=active_count,
            gap_count=gap_count,
            required_qualifications=position.required_qualifications,
            severity=severity,
        )

    def update_checkin_permission(
        self,
        schedule_id: str,
        permission: CheckInPermission,
        notes: Optional[str] = None,
    ) -> Schedule:
        if schedule_id not in self.state.schedules:
            raise NotFoundError(f"排班记录不存在: {schedule_id}")

        schedule = self.state.schedules[schedule_id]
        old_permission = schedule.checkin_permission
        schedule.checkin_permission = permission
        schedule.updated_at = datetime.now()
        if notes:
            schedule.notes = notes

        self._log_event(
            EventType.CHECKIN_PERMISSION_UPDATED,
            schedule_id,
            "Schedule",
            {
                "volunteer_id": schedule.volunteer_id,
                "old_permission": old_permission,
                "new_permission": permission,
            },
        )
        return schedule

    def process_leave_approval(
        self, leave_id: str, approved: bool, processed_by: Optional[str] = None
    ) -> Tuple[Optional[SubstitutionRecord], List[GapAlert]]:
        if leave_id not in self.state.leave_requests:
            raise NotFoundError(f"请假记录不存在: {leave_id}")

        if leave_id in self.state.processed_leave_ids:
            raise ConflictError("该请假已处理，重复请求被忽略")

        leave = self.state.leave_requests[leave_id]
        substitution = None
        gaps = []

        try:
            self.state.processed_leave_ids.add(leave_id)

            if not approved:
                leave.status = LeaveStatus.REJECTED
                leave.processed_at = datetime.now()
                leave.processed_by = processed_by
                self._log_event(
                    EventType.LEAVE_REJECTED,
                    leave_id,
                    "LeaveRequest",
                    {"reason": "未批准"},
                )
                return None, []

            leave.status = LeaveStatus.APPROVED
            leave.processed_at = datetime.now()
            leave.processed_by = processed_by
            self._log_event(
                EventType.LEAVE_APPROVED,
                leave_id,
                "LeaveRequest",
                {"volunteer_id": leave.volunteer_id},
            )

            original_schedule = self.state.schedules[leave.schedule_id]
            self.update_checkin_permission(
                leave.schedule_id,
                CheckInPermission.REVOKED,
                f"请假被批准: {leave.reason}",
            )
            original_schedule.status = ScheduleStatus.REPLACED
            original_schedule.updated_at = datetime.now()

            position = self.state.positions[original_schedule.position_id]
            substitutes = self.find_eligible_substitutes(
                original_schedule.position_id,
                {leave.volunteer_id},
                position.date,
                position.time_slot,
            )

            if substitutes:
                substitute = substitutes[0]
                new_schedule = Schedule(
                    schedule_id=generate_id(),
                    position_id=original_schedule.position_id,
                    volunteer_id=substitute.volunteer_id,
                    date=position.date,
                    time_slot=position.time_slot,
                    checkin_permission=CheckInPermission.GRANTED,
                    status=ScheduleStatus.ACTIVE,
                    notes=f"替补志愿者，替代 {leave.volunteer_id}",
                )
                self.state.schedules[new_schedule.schedule_id] = new_schedule

                substitution = SubstitutionRecord(
                    substitution_id=generate_id(),
                    leave_request_id=leave_id,
                    original_schedule_id=leave.schedule_id,
                    new_schedule_id=new_schedule.schedule_id,
                    original_volunteer_id=leave.volunteer_id,
                    substitute_volunteer_id=substitute.volunteer_id,
                    position_id=original_schedule.position_id,
                    date=position.date,
                    time_slot=position.time_slot,
                )
                self.state.substitutions[substitution.substitution_id] = substitution

                self._log_event(
                    EventType.SUBSTITUTION_FOUND,
                    substitution.substitution_id,
                    "SubstitutionRecord",
                    {
                        "original_volunteer": leave.volunteer_id,
                        "substitute_volunteer": substitute.volunteer_id,
                        "position_id": original_schedule.position_id,
                    },
                )

                gap = self.get_position_gap(original_schedule.position_id)
                if gap.gap_count <= 0:
                    self._log_event(
                        EventType.GAP_RESOLVED,
                        original_schedule.position_id,
                        "PositionRequirement",
                        {"resolved_by": substitute.volunteer_id},
                    )
            else:
                self._log_event(
                    EventType.SUBSTITUTION_FAILED,
                    leave_id,
                    "LeaveRequest",
                    {
                        "position_id": original_schedule.position_id,
                        "missing_qualifications": position.required_qualifications,
                    },
                    success=False,
                    error_message="未找到合格替补",
                )

            gap = self.get_position_gap(original_schedule.position_id)
            if gap.gap_count > 0:
                self._log_event(
                    EventType.GAP_DETECTED,
                    original_schedule.position_id,
                    "PositionRequirement",
                    {
                        "gap_count": gap.gap_count,
                        "required_count": gap.required_count,
                        "current_count": gap.current_count,
                    },
                )
                gaps.append(gap)

            return substitution, gaps

        except Exception as e:
            if leave_id in self.state.processed_leave_ids:
                self.state.processed_leave_ids.remove(leave_id)
            raise SchedulingError(f"处理请假失败: {str(e)}") from e

    def get_all_gaps(self) -> List[GapAlert]:
        gaps = []
        for position_id in self.state.positions:
            gap = self.get_position_gap(position_id)
            if gap.gap_count > 0:
                gaps.append(gap)
        return gaps

    def apply_manual_correction(
        self,
        entity_type: str,
        entity_id: str,
        corrections: Dict[str, Any],
        corrected_by: Optional[str] = None,
    ) -> Any:
        if entity_type == "Volunteer":
            if entity_id not in self.state.volunteers:
                raise NotFoundError(f"志愿者不存在: {entity_id}")
            volunteer = self.state.volunteers[entity_id]
            for key, value in corrections.items():
                if hasattr(volunteer, key):
                    setattr(volunteer, key, value)
            result = volunteer
        elif entity_type == "Schedule":
            if entity_id not in self.state.schedules:
                raise NotFoundError(f"排班记录不存在: {entity_id}")
            schedule = self.state.schedules[entity_id]
            for key, value in corrections.items():
                if hasattr(schedule, key):
                    setattr(schedule, key, value)
            schedule.updated_at = datetime.now()
            result = schedule
        elif entity_type == "PositionRequirement":
            if entity_id not in self.state.positions:
                raise NotFoundError(f"岗位不存在: {entity_id}")
            position = self.state.positions[entity_id]
            for key, value in corrections.items():
                if hasattr(position, key):
                    setattr(position, key, value)
            result = position
        else:
            raise ValidationError(f"不支持的实体类型: {entity_type}")

        self._log_event(
            EventType.MANUAL_CORRECTION,
            entity_id,
            entity_type,
            {
                "corrections": corrections,
                "corrected_by": corrected_by,
            },
        )
        return result

    def export_schedule(self, target_date: Optional[date] = None) -> List[Dict[str, Any]]:
        exported = []
        for schedule in self.state.schedules.values():
            if target_date and schedule.date != target_date:
                continue
            volunteer = self.state.volunteers.get(schedule.volunteer_id)
            position = self.state.positions.get(schedule.position_id)
            exported.append(
                {
                    "schedule_id": schedule.schedule_id,
                    "position_id": schedule.position_id,
                    "position_name": position.name if position else "Unknown",
                    "volunteer_id": schedule.volunteer_id,
                    "volunteer_name": volunteer.name if volunteer else "Unknown",
                    "date": schedule.date.isoformat(),
                    "time_slot": schedule.time_slot,
                    "checkin_permission": schedule.checkin_permission,
                    "status": schedule.status,
                    "notes": schedule.notes,
                }
            )
        self._log_event(
            EventType.SCHEDULE_EXPORTED,
            "export",
            "Schedule",
            {
                "count": len(exported),
                "target_date": target_date.isoformat() if target_date else None,
            },
        )
        return exported
