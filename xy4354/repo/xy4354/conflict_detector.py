from typing import List, Dict, Tuple, Optional, Any
from collections import defaultdict
from datetime import time

from .models import (
    Volunteer, Course, ScheduleAssignment, ScheduleResult,
    TimeSlot, SkillTag, LeaveRequest, SwapRequest,
    Conflict, Gap, DayOfWeek
)


class ConflictDetector:
    def __init__(self):
        pass

    def detect_and_update(
        self,
        schedule_result: ScheduleResult,
        volunteers: List[Volunteer],
        courses: List[Course],
        leave_requests: List[LeaveRequest] = None,
        swap_requests: List[SwapRequest] = None
    ) -> ScheduleResult:
        conflicts = self.detect_conflicts(
            schedule_result.assignments, volunteers, courses,
            leave_requests, swap_requests
        )
        
        gaps = self.detect_gaps(
            schedule_result.assignments, courses, volunteers
        )
        
        schedule_result.conflicts = conflicts
        schedule_result.gaps = gaps
        
        return schedule_result

    def detect_conflicts(
        self,
        assignments: List[ScheduleAssignment],
        volunteers: List[Volunteer],
        courses: List[Course],
        leave_requests: List[LeaveRequest] = None,
        swap_requests: List[SwapRequest] = None
    ) -> List[Conflict]:
        conflicts: List[Conflict] = []
        
        conflicts.extend(self._detect_time_overlap_conflicts(assignments))
        conflicts.extend(self._detect_leave_conflicts(
            assignments, leave_requests or []
        ))
        conflicts.extend(self._detect_skill_mismatch_conflicts(
            assignments, volunteers, courses
        ))
        conflicts.extend(self._detect_hours_exceeded_conflicts(
            assignments, volunteers
        ))
        conflicts.extend(self._detect_unapproved_swap_conflicts(
            assignments, swap_requests or []
        ))
        
        return conflicts

    def detect_gaps(
        self,
        assignments: List[ScheduleAssignment],
        courses: List[Course],
        volunteers: List[Volunteer]
    ) -> List[Gap]:
        gaps: List[Gap] = []
        
        course_assignments: Dict[str, List[ScheduleAssignment]] = defaultdict(list)
        for assignment in assignments:
            course_assignments[assignment.course_id].append(assignment)
        
        for course in courses:
            course_assignment_list = course_assignments.get(course.id, [])
            assigned_count = len(course_assignment_list)
            
            if assigned_count < course.min_volunteers:
                missing_count = course.min_volunteers - assigned_count
                
                assigned_skills = [a.assigned_skill for a in course_assignment_list]
                missing_skills = []
                
                for req_skill in course.required_skills:
                    if req_skill not in assigned_skills:
                        missing_skills.append(req_skill)
                
                if not missing_skills and course.required_skills:
                    missing_skills = course.required_skills
                
                gap = Gap(
                    gap_type="人员不足",
                    description=f"课程 '{course.name}' 需要至少 {course.min_volunteers} 名志愿者，当前仅分配 {assigned_count} 名，缺少 {missing_count} 名",
                    course_id=course.id,
                    course_name=course.name,
                    time_slot=course.time_slot,
                    required=course.min_volunteers,
                    current=assigned_count,
                    missing_skills=missing_skills
                )
                gaps.append(gap)
            
            if not course.required_skills:
                continue
            
            assigned_skills = [a.assigned_skill for a in course_assignment_list]
            for req_skill in course.required_skills:
                if req_skill not in assigned_skills:
                    gap = Gap(
                        gap_type="技能缺失",
                        description=f"课程 '{course.name}' 需要 {req_skill.value} 技能的志愿者，但当前无人分配",
                        course_id=course.id,
                        course_name=course.name,
                        time_slot=course.time_slot,
                        required=1,
                        current=0,
                        missing_skills=[req_skill]
                    )
                    gaps.append(gap)
        
        return gaps

    def _detect_time_overlap_conflicts(
        self, assignments: List[ScheduleAssignment]
    ) -> List[Conflict]:
        conflicts: List[Conflict] = []
        
        volunteer_assignments: Dict[str, List[ScheduleAssignment]] = defaultdict(list)
        for assignment in assignments:
            volunteer_assignments[assignment.volunteer_id].append(assignment)
        
        for volunteer_id, vol_assignments in volunteer_assignments.items():
            if len(vol_assignments) < 2:
                continue
            
            for i, assignment1 in enumerate(vol_assignments):
                for assignment2 in vol_assignments[i + 1:]:
                    if self._slots_overlap(assignment1.time_slot, assignment2.time_slot):
                        conflict = Conflict(
                            conflict_type="时间重叠",
                            description=f"志愿者 '{assignment1.volunteer_name}' 在同一时段被分配到多个课程："
                                        f"'{assignment1.course_name}' ({assignment1.time_slot}) 和 "
                                        f"'{assignment2.course_name}' ({assignment2.time_slot})",
                            severity="高",
                            affected_volunteers=[assignment1.volunteer_name],
                            affected_courses=[assignment1.course_name, assignment2.course_name],
                            details={
                                "volunteer_id": volunteer_id,
                                "overlapping_assignments": [
                                    {
                                        "course_id": assignment1.course_id,
                                        "course_name": assignment1.course_name,
                                        "time_slot": str(assignment1.time_slot)
                                    },
                                    {
                                        "course_id": assignment2.course_id,
                                        "course_name": assignment2.course_name,
                                        "time_slot": str(assignment2.time_slot)
                                    }
                                ]
                            }
                        )
                        conflicts.append(conflict)
        
        return conflicts

    def _detect_leave_conflicts(
        self,
        assignments: List[ScheduleAssignment],
        leave_requests: List[LeaveRequest]
    ) -> List[Conflict]:
        conflicts: List[Conflict] = []
        
        approved_leaves = [r for r in leave_requests if r.is_approved]
        
        for assignment in assignments:
            for leave in approved_leaves:
                if assignment.volunteer_id != leave.volunteer_id:
                    continue
                
                if leave.time_slot and self._slots_overlap(
                    assignment.time_slot, leave.time_slot
                ):
                    conflict = Conflict(
                        conflict_type="请假冲突",
                        description=f"志愿者 '{assignment.volunteer_name}' 已请假 ({leave.leave_type.value}: {leave.reason})，"
                                    f"但仍被分配到课程 '{assignment.course_name}' ({assignment.time_slot})",
                        severity="高",
                        affected_volunteers=[assignment.volunteer_name],
                        affected_courses=[assignment.course_name],
                        details={
                            "volunteer_id": assignment.volunteer_id,
                            "leave_type": leave.leave_type.value,
                            "leave_reason": leave.reason,
                            "assignment_time_slot": str(assignment.time_slot),
                            "leave_time_slot": str(leave.time_slot) if leave.time_slot else None
                        }
                    )
                    conflicts.append(conflict)
                    break
        
        return conflicts

    def _detect_skill_mismatch_conflicts(
        self,
        assignments: List[ScheduleAssignment],
        volunteers: List[Volunteer],
        courses: List[Course]
    ) -> List[Conflict]:
        conflicts: List[Conflict] = []
        
        volunteer_dict: Dict[str, Volunteer] = {v.id: v for v in volunteers}
        course_dict: Dict[str, Course] = {c.id: c for c in courses}
        
        for assignment in assignments:
            volunteer = volunteer_dict.get(assignment.volunteer_id)
            course = course_dict.get(assignment.course_id)
            
            if not volunteer or not course:
                continue
            
            if not course.required_skills:
                continue
            
            if assignment.assigned_skill not in course.required_skills:
                conflict = Conflict(
                    conflict_type="技能不匹配",
                    description=f"志愿者 '{volunteer.name}' 被分配为 '{assignment.assigned_skill.value}'，"
                                f"但课程 '{course.name}' 仅需要以下技能：{[s.value for s in course.required_skills]}",
                    severity="中",
                    affected_volunteers=[volunteer.name],
                    affected_courses=[course.name],
                    details={
                        "volunteer_id": volunteer.id,
                        "course_id": course.id,
                        "assigned_skill": assignment.assigned_skill.value,
                        "required_skills": [s.value for s in course.required_skills]
                    }
                )
                conflicts.append(conflict)
        
        return conflicts

    def _detect_hours_exceeded_conflicts(
        self,
        assignments: List[ScheduleAssignment],
        volunteers: List[Volunteer]
    ) -> List[Conflict]:
        conflicts: List[Conflict] = []
        
        volunteer_dict: Dict[str, Volunteer] = {v.id: v for v in volunteers}
        volunteer_hours: Dict[str, float] = defaultdict(float)
        
        for assignment in assignments:
            duration = self._calculate_duration(assignment.time_slot)
            volunteer_hours[assignment.volunteer_id] += duration
        
        for volunteer_id, total_hours in volunteer_hours.items():
            volunteer = volunteer_dict.get(volunteer_id)
            if not volunteer:
                continue
            
            if total_hours > volunteer.max_hours_per_week:
                exceed_hours = total_hours - volunteer.max_hours_per_week
                conflict = Conflict(
                    conflict_type="超时警告",
                    description=f"志愿者 '{volunteer.name}' 本周分配时长 {total_hours:.1f} 小时，"
                                f"超过其最大限制 {volunteer.max_hours_per_week} 小时，超出 {exceed_hours:.1f} 小时",
                    severity="中",
                    affected_volunteers=[volunteer.name],
                    affected_courses=[],
                    details={
                        "volunteer_id": volunteer_id,
                        "assigned_hours": total_hours,
                        "max_hours": volunteer.max_hours_per_week,
                        "exceeded_hours": exceed_hours
                    }
                )
                conflicts.append(conflict)
        
        return conflicts

    def _detect_unapproved_swap_conflicts(
        self,
        assignments: List[ScheduleAssignment],
        swap_requests: List[SwapRequest]
    ) -> List[Conflict]:
        conflicts: List[Conflict] = []
        
        unapproved_swaps = [r for r in swap_requests if not r.is_approved]
        
        for swap in unapproved_swaps:
            conflict = Conflict(
                conflict_type="待处理调班",
                description=f"志愿者 '{swap.volunteer_name}' 申请调班尚未审批："
                            f"从 {swap.original_slot} 调到 {swap.target_slot if swap.target_slot else '待定'}"
                            + (f"，与 {swap.swap_with_volunteer_name} 对调" if swap.swap_with_volunteer_name else ""),
                severity="低",
                affected_volunteers=[swap.volunteer_name],
                affected_courses=[],
                details={
                    "volunteer_id": swap.volunteer_id,
                    "original_slot": str(swap.original_slot),
                    "target_slot": str(swap.target_slot) if swap.target_slot else None,
                    "swap_with": swap.swap_with_volunteer_name,
                    "reason": swap.reason
                }
            )
            conflicts.append(conflict)
        
        return conflicts

    def _slots_overlap(self, slot1: TimeSlot, slot2: TimeSlot) -> bool:
        if slot1.day != slot2.day:
            return False
        
        start1 = slot1.start_time
        end1 = slot1.end_time
        start2 = slot2.start_time
        end2 = slot2.end_time
        
        return not (end1 <= start2 or end2 <= start1)

    def _calculate_duration(self, slot: TimeSlot) -> float:
        start = slot.start_time
        end = slot.end_time
        
        start_minutes = start.hour * 60 + start.minute
        end_minutes = end.hour * 60 + end.minute
        
        duration_minutes = end_minutes - start_minutes
        return duration_minutes / 60.0

    def get_conflict_summary(self, conflicts: List[Conflict]) -> Dict[str, Any]:
        severity_counts: Dict[str, int] = defaultdict(int)
        type_counts: Dict[str, int] = defaultdict(int)
        
        for conflict in conflicts:
            severity_counts[conflict.severity] += 1
            type_counts[conflict.conflict_type] += 1
        
        return {
            "total_conflicts": len(conflicts),
            "by_severity": dict(severity_counts),
            "by_type": dict(type_counts)
        }

    def get_gap_summary(self, gaps: List[Gap]) -> Dict[str, Any]:
        type_counts: Dict[str, int] = defaultdict(int)
        total_missing = 0
        
        for gap in gaps:
            type_counts[gap.gap_type] += 1
            total_missing += (gap.required - gap.current)
        
        return {
            "total_gaps": len(gaps),
            "by_type": dict(type_counts),
            "total_missing_volunteers": total_missing
        }
