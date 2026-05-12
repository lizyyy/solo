from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Set
from dataclasses import dataclass
from .models import (
    Candidate, Interviewer, Room, TimeSlot, Interview,
    InterviewStatus, RoundType, RoundRule, RescheduleRecord,
    ScheduleState, generate_id
)


@dataclass
class Conflict:
    interview_id: str
    conflict_type: str
    description: str
    severity: str = "error"
    related_interview_id: Optional[str] = None


@dataclass
class SchedulingResult:
    success: bool
    interview_id: Optional[str] = None
    conflicts: List[Conflict] = None
    message: str = ""
    assigned_slot: Optional[TimeSlot] = None
    assigned_interviewers: List[str] = None
    assigned_room: Optional[str] = None


class Scheduler:
    def __init__(self, state: ScheduleState):
        self.state = state

    def get_round_rule(self, position_type: str, round_type: RoundType) -> Optional[RoundRule]:
        key = f"{position_type}_{round_type.value}"
        if key in self.state.round_rules:
            return self.state.round_rules[key]
        return None

    def check_interviewer_conflict(self, interviewer_id: str, slot: TimeSlot, exclude_interview_id: Optional[str] = None) -> List[Conflict]:
        conflicts = []
        for interview in self.state.interviews.values():
            if exclude_interview_id and interview.id == exclude_interview_id:
                continue
            if interviewer_id in interview.interviewer_ids and interview.slot and interview.slot.overlaps_with(slot):
                if interview.status in [InterviewStatus.SCHEDULED, InterviewStatus.CONFIRMED]:
                    conflicts.append(Conflict(
                        interview_id=interview.id,
                        conflict_type="interviewer_conflict",
                        description=f"面试官 {interviewer_id} 在 {slot} 与已安排面试冲突: 面试 {interview.id}",
                        severity="error",
                        related_interview_id=interview.id
                    ))
        return conflicts

    def check_room_conflict(self, room_id: str, slot: TimeSlot, exclude_interview_id: Optional[str] = None) -> List[Conflict]:
        conflicts = []
        for interview in self.state.interviews.values():
            if exclude_interview_id and interview.id == exclude_interview_id:
                continue
            if interview.room_id == room_id and interview.slot and interview.slot.overlaps_with(slot):
                if interview.status in [InterviewStatus.SCHEDULED, InterviewStatus.CONFIRMED]:
                    room = self.state.rooms.get(room_id)
                    room_name = room.name if room else room_id
                    conflicts.append(Conflict(
                        interview_id=interview.id,
                        conflict_type="room_conflict",
                        description=f"会议室 {room_name} 在 {slot} 与已安排面试冲突: 面试 {interview.id}",
                        severity="error",
                        related_interview_id=interview.id
                    ))
        return conflicts

    def check_candidate_gap(self, candidate_id: str, slot: TimeSlot, round_type: RoundType, exclude_interview_id: Optional[str] = None) -> List[Conflict]:
        conflicts = []
        candidate = self.state.candidates.get(candidate_id)
        if not candidate:
            return conflicts

        position_type = self._get_position_type(candidate.position)
        rule = self.get_round_rule(position_type, round_type)
        if not rule:
            return conflicts

        min_gap = timedelta(hours=rule.min_gap_hours)

        for interview in self.state.interviews.values():
            if exclude_interview_id and interview.id == exclude_interview_id:
                continue
            if interview.candidate_id == candidate_id and interview.slot:
                if interview.status in [InterviewStatus.SCHEDULED, InterviewStatus.CONFIRMED, InterviewStatus.COMPLETED]:
                    gap_before = slot.start - interview.slot.end
                    gap_after = interview.slot.start - slot.end

                    if gap_before >= timedelta(0) and gap_before < min_gap:
                        conflicts.append(Conflict(
                            interview_id=exclude_interview_id or generate_id("temp"),
                            conflict_type="candidate_gap_violation",
                            description=f"候选人时间间隔不足: 与前一轮面试间隔 {gap_before.total_seconds()/3600:.1f} 小时，要求至少 {rule.min_gap_hours} 小时",
                            severity="error",
                            related_interview_id=interview.id
                        ))
                    if gap_after >= timedelta(0) and gap_after < min_gap:
                        conflicts.append(Conflict(
                            interview_id=exclude_interview_id or generate_id("temp"),
                            conflict_type="candidate_gap_violation",
                            description=f"候选人时间间隔不足: 与后一轮面试间隔 {gap_after.total_seconds()/3600:.1f} 小时，要求至少 {rule.min_gap_hours} 小时",
                            severity="error",
                            related_interview_id=interview.id
                        ))
        return conflicts

    def check_room_capacity(self, room_id: str, required_interviewers: int) -> List[Conflict]:
        conflicts = []
        room = self.state.rooms.get(room_id)
        if not room:
            conflicts.append(Conflict(
                interview_id=generate_id("temp"),
                conflict_type="room_not_found",
                description=f"会议室 {room_id} 不存在",
                severity="error"
            ))
            return conflicts

        attendees = required_interviewers + 1
        if attendees > room.capacity:
            conflicts.append(Conflict(
                interview_id=generate_id("temp"),
                conflict_type="room_capacity_violation",
                description=f"会议室容量不足: {room.name} 容量 {room.capacity}，需容纳 {attendees} 人",
                severity="error"
            ))
        return conflicts

    def _get_position_type(self, position: str) -> str:
        pos_lower = position.lower()
        if any(key in pos_lower for key in ["工程", "开发", "技术", "架构", "前端", "后端", "数据", "算法", "测试"]):
            return "engineering"
        elif "产品" in pos_lower:
            return "product"
        elif "销售" in pos_lower or "渠道" in pos_lower:
            return "sales"
        return "engineering"

    def find_available_interviewers(self, candidate: Candidate, slot: TimeSlot, round_type: RoundType) -> List[str]:
        position_type = self._get_position_type(candidate.position)
        rule = self.get_round_rule(position_type, round_type)
        if not rule:
            return []

        required_count = rule.required_interviewers
        available_interviewers = []

        for interviewer in self.state.interviewers.values():
            if candidate.department not in interviewer.departments:
                continue

            is_available = False
            for avail_slot in interviewer.available_slots:
                if slot.start >= avail_slot.start and slot.end <= avail_slot.end:
                    is_available = True
                    break

            if not is_available:
                continue

            has_conflict = False
            for interview in self.state.interviews.values():
                if interviewer.id in interview.interviewer_ids and interview.slot:
                    if interview.slot.overlaps_with(slot):
                        if interview.status in [InterviewStatus.SCHEDULED, InterviewStatus.CONFIRMED]:
                            has_conflict = True
                            break

            if not has_conflict:
                available_interviewers.append(interviewer.id)
                if len(available_interviewers) >= required_count:
                    break

        return available_interviewers[:required_count]

    def find_available_rooms(self, slot: TimeSlot, required_interviewers: int, required_equipment: List[str]) -> List[str]:
        required_capacity = required_interviewers + 1
        available_rooms = []

        for room in self.state.rooms.values():
            if room.capacity < required_capacity:
                continue

            has_all_equipment = True
            for eq in required_equipment:
                if eq not in room.equipment:
                    has_all_equipment = False
                    break
            if not has_all_equipment:
                continue

            has_conflict = False
            for interview in self.state.interviews.values():
                if interview.room_id == room.id and interview.slot:
                    if interview.slot.overlaps_with(slot):
                        if interview.status in [InterviewStatus.SCHEDULED, InterviewStatus.CONFIRMED]:
                            has_conflict = True
                            break

            if not has_conflict:
                available_rooms.append(room.id)

        return available_rooms

    def find_slot(self, candidate: Candidate, round_type: RoundType) -> Optional[Tuple[TimeSlot, List[str], str]]:
        position_type = self._get_position_type(candidate.position)
        rule = self.get_round_rule(position_type, round_type)
        if not rule:
            return None

        duration = timedelta(minutes=rule.duration_minutes)

        candidate_interviews = [
            i for i in self.state.interviews.values()
            if i.candidate_id == candidate.id and i.status in [InterviewStatus.SCHEDULED, InterviewStatus.CONFIRMED, InterviewStatus.COMPLETED]
        ]

        for interviewer_id in self.state.interviewers:
            interviewer = self.state.interviewers[interviewer_id]
            if candidate.department not in interviewer.departments:
                continue

            for avail_slot in interviewer.available_slots:
                current = avail_slot.start
                while current + duration <= avail_slot.end:
                    test_slot = TimeSlot(start=current, end=current + duration)

                    gap_conflicts = self.check_candidate_gap(candidate.id, test_slot, round_type)
                    if gap_conflicts:
                        current += timedelta(minutes=30)
                        continue

                    interviewers = self.find_available_interviewers(candidate, test_slot, round_type)
                    if len(interviewers) < rule.required_interviewers:
                        current += timedelta(minutes=30)
                        continue

                    rooms = self.find_available_rooms(test_slot, rule.required_interviewers, rule.required_equipment)
                    if rooms:
                        return (test_slot, interviewers, rooms[0])

                    current += timedelta(minutes=30)

        return None

    def schedule_interview(self, candidate_id: str, round_type: RoundType, operator: str,
                          preferred_slot: Optional[TimeSlot] = None,
                          preferred_interviewers: List[str] = None,
                          preferred_room: Optional[str] = None) -> SchedulingResult:
        candidate = self.state.candidates.get(candidate_id)
        if not candidate:
            return SchedulingResult(
                success=False,
                message=f"候选人 {candidate_id} 不存在"
            )

        position_type = self._get_position_type(candidate.position)
        rule = self.get_round_rule(position_type, round_type)
        if not rule:
            return SchedulingResult(
                success=False,
                message=f"未找到岗位 {position_type} 轮次 {round_type.value} 的排班规则"
            )

        all_conflicts = []

        if preferred_slot:
            slot = preferred_slot

            if preferred_interviewers:
                interviewers = preferred_interviewers
            else:
                interviewers = self.find_available_interviewers(candidate, slot, round_type)

            if preferred_room:
                room_id = preferred_room
            else:
                rooms = self.find_available_rooms(slot, rule.required_interviewers, rule.required_equipment)
                room_id = rooms[0] if rooms else None

            for interviewer_id in interviewers:
                conflicts = self.check_interviewer_conflict(interviewer_id, slot)
                all_conflicts.extend(conflicts)

            if room_id:
                conflicts = self.check_room_conflict(room_id, slot)
                all_conflicts.extend(conflicts)

            conflicts = self.check_candidate_gap(candidate_id, slot, round_type)
            all_conflicts.extend(conflicts)

            if room_id:
                conflicts = self.check_room_capacity(room_id, rule.required_interviewers)
                all_conflicts.extend(conflicts)

            if len(interviewers) < rule.required_interviewers:
                all_conflicts.append(Conflict(
                    interview_id=generate_id("temp"),
                    conflict_type="insufficient_interviewers",
                    description=f"可用面试官不足: 需要 {rule.required_interviewers} 人，当前找到 {len(interviewers)} 人",
                    severity="error"
                ))

            if not room_id:
                all_conflicts.append(Conflict(
                    interview_id=generate_id("temp"),
                    conflict_type="no_room_available",
                    description=f"在时间段 {slot} 没有可用的会议室",
                    severity="error"
                ))

            if all_conflicts:
                return SchedulingResult(
                    success=False,
                    conflicts=all_conflicts,
                    message="存在冲突，无法按指定时间安排"
                )

            assigned_slot = slot
            assigned_interviewers = interviewers
            assigned_room = room_id
        else:
            result = self.find_slot(candidate, round_type)
            if not result:
                return SchedulingResult(
                    success=False,
                    message="未找到可用的时间段、面试官和会议室组合"
                )
            assigned_slot, assigned_interviewers, assigned_room = result

        interview_id = generate_id("intv")
        interview = Interview(
            id=interview_id,
            candidate_id=candidate_id,
            round_type=round_type,
            slot=assigned_slot,
            interviewer_ids=assigned_interviewers,
            room_id=assigned_room,
            status=InterviewStatus.SCHEDULED,
            operator=operator,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )

        self.state.interviews[interview_id] = interview
        self.state.last_updated = datetime.now()

        return SchedulingResult(
            success=True,
            interview_id=interview_id,
            message="面试安排成功",
            assigned_slot=assigned_slot,
            assigned_interviewers=assigned_interviewers,
            assigned_room=assigned_room
        )

    def reschedule_interview(self, interview_id: str, reason: str, requested_by: str,
                            new_slot: Optional[TimeSlot] = None,
                            new_interviewers: List[str] = None,
                            new_room: Optional[str] = None,
                            operator: str = None) -> SchedulingResult:
        interview = self.state.interviews.get(interview_id)
        if not interview:
            return SchedulingResult(
                success=False,
                message=f"面试 {interview_id} 不存在"
            )

        candidate = self.state.candidates.get(interview.candidate_id)
        if not candidate:
            return SchedulingResult(
                success=False,
                message=f"候选人 {interview.candidate_id} 不存在"
            )

        position_type = self._get_position_type(candidate.position)
        rule = self.get_round_rule(position_type, interview.round_type)
        if not rule:
            return SchedulingResult(
                success=False,
                message=f"未找到岗位 {position_type} 轮次 {interview.round_type.value} 的排班规则"
            )

        original_slot = interview.slot
        original_room_id = interview.room_id

        if new_slot:
            slot = new_slot
            if new_interviewers:
                interviewers = new_interviewers
            else:
                interviewers = self.find_available_interviewers(candidate, slot, interview.round_type)

            if new_room:
                room_id = new_room
            else:
                rooms = self.find_available_rooms(slot, rule.required_interviewers, rule.required_equipment)
                room_id = rooms[0] if rooms else None
        else:
            result = self.find_slot(candidate, interview.round_type)
            if not result:
                return SchedulingResult(
                    success=False,
                    message="未找到可用的新时间段"
                )
            slot, interviewers, room_id = result

        all_conflicts = []
        for interviewer_id in interviewers:
            conflicts = self.check_interviewer_conflict(interviewer_id, slot, exclude_interview_id=interview_id)
            all_conflicts.extend(conflicts)

        if room_id:
            conflicts = self.check_room_conflict(room_id, slot, exclude_interview_id=interview_id)
            all_conflicts.extend(conflicts)

        conflicts = self.check_candidate_gap(interview.candidate_id, slot, interview.round_type, exclude_interview_id=interview_id)
        all_conflicts.extend(conflicts)

        if room_id:
            conflicts = self.check_room_capacity(room_id, rule.required_interviewers)
            all_conflicts.extend(conflicts)

        if all_conflicts:
            return SchedulingResult(
                success=False,
                conflicts=all_conflicts,
                message="改期存在冲突"
            )

        record = RescheduleRecord(
            id=generate_id("res"),
            interview_id=interview_id,
            original_slot=original_slot,
            new_slot=slot,
            original_room_id=original_room_id,
            new_room_id=room_id,
            reason=reason,
            requested_by=requested_by,
            requested_at=datetime.now(),
            is_resolved=True,
            resolution_notes=f"改期成功: 从 {original_slot} 改至 {slot}" if original_slot else f"首次安排至 {slot}"
        )

        interview.reschedule_history.append(record)
        interview.reschedule_count += 1
        interview.slot = slot
        interview.interviewer_ids = interviewers
        interview.room_id = room_id
        interview.status = InterviewStatus.RESCHEDULED
        interview.operator = operator or requested_by
        interview.updated_at = datetime.now()
        interview.notes = f"改期原因: {reason}"

        self.state.last_updated = datetime.now()

        return SchedulingResult(
            success=True,
            interview_id=interview_id,
            message="面试改期成功",
            assigned_slot=slot,
            assigned_interviewers=interviewers,
            assigned_room=room_id
        )

    def mark_no_show(self, interview_id: str, is_candidate: bool, reason: str, operator: str) -> SchedulingResult:
        interview = self.state.interviews.get(interview_id)
        if not interview:
            return SchedulingResult(
                success=False,
                message=f"面试 {interview_id} 不存在"
            )

        original_status = interview.status
        if is_candidate:
            interview.status = InterviewStatus.CANDIDATE_NO_SHOW
            status_text = "候选人爽约"
        else:
            interview.status = InterviewStatus.INTERVIEWER_NO_SHOW
            status_text = "面试官爽约"

        record = RescheduleRecord(
            id=generate_id("res"),
            interview_id=interview_id,
            original_slot=interview.slot,
            new_slot=None,
            original_room_id=interview.room_id,
            new_room_id=None,
            reason=f"{status_text}: {reason}",
            requested_by=operator,
            requested_at=datetime.now(),
            is_resolved=False,
            resolution_notes=""
        )
        interview.reschedule_history.append(record)
        interview.operator = operator
        interview.updated_at = datetime.now()

        self.state.last_updated = datetime.now()

        return SchedulingResult(
            success=True,
            interview_id=interview_id,
            message=f"已标记{status_text}"
        )

    def confirm_interview(self, interview_id: str, operator: str) -> SchedulingResult:
        interview = self.state.interviews.get(interview_id)
        if not interview:
            return SchedulingResult(
                success=False,
                message=f"面试 {interview_id} 不存在"
            )

        if interview.status in [InterviewStatus.SCHEDULED, InterviewStatus.RESCHEDULED]:
            interview.status = InterviewStatus.CONFIRMED
            interview.operator = operator
            interview.updated_at = datetime.now()
            self.state.last_updated = datetime.now()
            return SchedulingResult(
                success=True,
                interview_id=interview_id,
                message="面试已确认"
            )
        else:
            return SchedulingResult(
                success=False,
                message=f"面试状态 {interview.status.value} 无法确认"
            )

    def get_interviews_for_candidate(self, candidate_id: str) -> List[Interview]:
        return [i for i in self.state.interviews.values() if i.candidate_id == candidate_id]

    def get_interviews_for_interviewer(self, interviewer_id: str) -> List[Interview]:
        return [
            i for i in self.state.interviews.values()
            if interviewer_id in i.interviewer_ids and i.status in [InterviewStatus.SCHEDULED, InterviewStatus.CONFIRMED]
        ]

    def get_reminders(self) -> List[Dict[str, Any]]:
        reminders = []
        now = datetime.now()
        tomorrow = now + timedelta(days=1)
        three_days_later = now + timedelta(days=3)

        for interview in self.state.interviews.values():
            if not interview.slot:
                continue

            if interview.status in [InterviewStatus.SCHEDULED, InterviewStatus.RESCHEDULED]:
                if now <= interview.slot.start <= three_days_later:
                    reminders.append({
                        "type": "interview_coming",
                        "interview_id": interview.id,
                        "message": f"面试 {interview.id} ({interview.round_type.value}) 将于 {interview.slot} 进行，尚未确认",
                        "urgency": "high" if interview.slot.start <= tomorrow else "medium"
                    })

            if interview.status == InterviewStatus.PENDING:
                reminders.append({
                    "type": "interview_pending",
                    "interview_id": interview.id,
                    "message": f"面试 {interview.id} ({interview.round_type.value}) 尚未安排时间",
                    "urgency": "high"
                })

            if interview.status in [InterviewStatus.CANDIDATE_NO_SHOW, InterviewStatus.INTERVIEWER_NO_SHOW]:
                reminders.append({
                    "type": "no_show_pending",
                    "interview_id": interview.id,
                    "message": f"面试 {interview.id} ({interview.round_type.value}) 存在爽约记录，需重新安排",
                    "urgency": "high"
                })

            if interview.reschedule_count > 0:
                unresolved = [r for r in interview.reschedule_history if not r.is_resolved]
                if unresolved:
                    reminders.append({
                        "type": "unresolved_reschedule",
                        "interview_id": interview.id,
                        "message": f"面试 {interview.id} ({interview.round_type.value}) 有未解决的改期请求",
                        "urgency": "medium"
                    })

        return sorted(reminders, key=lambda x: {"high": 0, "medium": 1, "low": 2}[x["urgency"]])
