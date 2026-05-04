from typing import List, Dict, Optional, Tuple
from datetime import timedelta
from collections import defaultdict

from .models import (
    Volunteer, Course, TimeSlot, ScheduleAssignment, 
    ScheduleResult, SkillTag, LeaveRequest, SwapRequest,
    Conflict, Gap
)


class Scheduler:
    def __init__(self):
        self.assignments: List[ScheduleAssignment] = []
        self.volunteer_hours: Dict[str, float] = defaultdict(float)
        self.volunteer_slots: Dict[str, List[TimeSlot]] = defaultdict(list)

    def schedule(
        self,
        volunteers: List[Volunteer],
        courses: List[Course],
        leave_requests: List[LeaveRequest] = None,
        swap_requests: List[SwapRequest] = None
    ) -> ScheduleResult:
        leave_requests = leave_requests or []
        swap_requests = swap_requests or []
        
        self.assignments = []
        self.volunteer_hours = defaultdict(float)
        self.volunteer_slots = defaultdict(list)
        
        unavailable_volunteers = self._get_unavailable_volunteers(
            volunteers, leave_requests
        )
        
        courses_by_day = self._group_courses_by_day(courses)
        
        for day in [
            "周一", "周二", "周三", "周四", "周五", "周六", "周日"
        ]:
            if day not in courses_by_day:
                continue
            
            day_courses = courses_by_day[day]
            
            for course in day_courses:
                self._assign_volunteers_to_course(
                    course, volunteers, unavailable_volunteers
                )
        
        self._process_swap_requests(swap_requests, volunteers, courses)
        
        result = ScheduleResult(
            assignments=self.assignments.copy(),
            conflicts=[],
            gaps=[],
            notes=""
        )
        
        return result

    def _get_unavailable_volunteers(
        self,
        volunteers: List[Volunteer],
        leave_requests: List[LeaveRequest]
    ) -> Dict[str, List[TimeSlot]]:
        unavailable: Dict[str, List[TimeSlot]] = defaultdict(list)
        
        for request in leave_requests:
            if request.is_approved:
                volunteer_id = request.volunteer_id
                if request.time_slot:
                    unavailable[volunteer_id].append(request.time_slot)
        
        return unavailable

    def _group_courses_by_day(
        self, courses: List[Course]
    ) -> Dict[str, List[Course]]:
        courses_by_day: Dict[str, List[Course]] = defaultdict(list)
        
        for course in courses:
            day_value = course.time_slot.day.value
            courses_by_day[day_value].append(course)
        
        return courses_by_day

    def _assign_volunteers_to_course(
        self,
        course: Course,
        volunteers: List[Volunteer],
        unavailable_volunteers: Dict[str, List[TimeSlot]]
    ):
        required_count = course.max_volunteers
        assigned_count = 0
        
        candidates = self._rank_candidates(
            course, volunteers, unavailable_volunteers
        )
        
        for volunteer, matched_skill in candidates:
            if assigned_count >= required_count:
                break
            
            if self._can_assign(volunteer, course, unavailable_volunteers):
                assignment = ScheduleAssignment(
                    course_id=course.id,
                    course_name=course.name,
                    time_slot=course.time_slot,
                    volunteer_id=volunteer.id,
                    volunteer_name=volunteer.name,
                    assigned_skill=matched_skill,
                    is_confirmed=True,
                    notes=""
                )
                self.assignments.append(assignment)
                assigned_count += 1
                
                slot_duration = self._calculate_duration(course.time_slot)
                self.volunteer_hours[volunteer.id] += slot_duration
                self.volunteer_slots[volunteer.id].append(course.time_slot)

    def _rank_candidates(
        self,
        course: Course,
        volunteers: List[Volunteer],
        unavailable_volunteers: Dict[str, List[TimeSlot]]
    ) -> List[Tuple[Volunteer, SkillTag]]:
        ranked = []
        
        for volunteer in volunteers:
            if not self._is_available(volunteer, course.time_slot, unavailable_volunteers):
                continue
            
            matched_skill = self._get_best_matching_skill(
                volunteer.skills, course.required_skills
            )
            
            if not matched_skill:
                continue
            
            score = self._calculate_score(
                volunteer, course, matched_skill
            )
            
            ranked.append((score, volunteer, matched_skill))
        
        ranked.sort(key=lambda x: x[0], reverse=True)
        
        return [(v, s) for _, v, s in ranked]

    def _calculate_score(
        self,
        volunteer: Volunteer,
        course: Course,
        skill: SkillTag
    ) -> float:
        score = 0.0
        
        if course.required_skills and skill in course.required_skills:
            score += 10.0
        
        if skill == SkillTag.TEACHING:
            score += 5.0
        
        current_hours = self.volunteer_hours.get(volunteer.id, 0.0)
        course_duration = self._calculate_duration(course.time_slot)
        
        if current_hours + course_duration <= volunteer.max_hours_per_week:
            score += 3.0
        
        slot_count = len(self.volunteer_slots.get(volunteer.id, []))
        score -= slot_count * 0.5
        
        return score

    def _is_available(
        self,
        volunteer: Volunteer,
        course_slot: TimeSlot,
        unavailable_volunteers: Dict[str, List[TimeSlot]]
    ) -> bool:
        if volunteer.id in unavailable_volunteers:
            for unavailable_slot in unavailable_volunteers[volunteer.id]:
                if self._slots_overlap(course_slot, unavailable_slot):
                    return False
        
        if volunteer.available_slots:
            has_available = False
            for available_slot in volunteer.available_slots:
                if self._slots_overlap(course_slot, available_slot):
                    has_available = True
                    break
            if not has_available:
                return False
        
        assigned_slots = self.volunteer_slots.get(volunteer.id, [])
        for assigned_slot in assigned_slots:
            if self._slots_overlap(course_slot, assigned_slot):
                return False
        
        return True

    def _can_assign(
        self,
        volunteer: Volunteer,
        course: Course,
        unavailable_volunteers: Dict[str, List[TimeSlot]]
    ) -> bool:
        if not self._is_available(volunteer, course.time_slot, unavailable_volunteers):
            return False
        
        current_hours = self.volunteer_hours.get(volunteer.id, 0.0)
        course_duration = self._calculate_duration(course.time_slot)
        
        if current_hours + course_duration > volunteer.max_hours_per_week:
            return False
        
        return True

    def _get_best_matching_skill(
        self,
        volunteer_skills: List[SkillTag],
        required_skills: List[SkillTag]
    ) -> Optional[SkillTag]:
        if not required_skills:
            if volunteer_skills:
                return volunteer_skills[0]
            return SkillTag.ASSISTANT
        
        for req_skill in required_skills:
            if req_skill in volunteer_skills:
                return req_skill
        
        for vol_skill in volunteer_skills:
            return vol_skill
        
        return None

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

    def _process_swap_requests(
        self,
        swap_requests: List[SwapRequest],
        volunteers: List[Volunteer],
        courses: List[Course]
    ):
        for request in swap_requests:
            if not request.is_approved:
                continue
            
            original_assignment = self._find_assignment(
                request.volunteer_id, request.original_slot
            )
            
            if not original_assignment:
                continue
            
            if request.swap_with_volunteer_id and request.target_slot:
                swap_assignment = self._find_assignment(
                    request.swap_with_volunteer_id, request.target_slot
                )
                
                if swap_assignment:
                    self._swap_assignments(original_assignment, swap_assignment)
            
            elif request.target_slot:
                self._move_assignment(
                    original_assignment, request.target_slot, volunteers, courses
                )

    def _find_assignment(
        self, volunteer_id: str, time_slot: TimeSlot
    ) -> Optional[ScheduleAssignment]:
        for assignment in self.assignments:
            if (
                assignment.volunteer_id == volunteer_id and
                self._slots_match(assignment.time_slot, time_slot)
            ):
                return assignment
        return None

    def _slots_match(self, slot1: TimeSlot, slot2: TimeSlot) -> bool:
        return (
            slot1.day == slot2.day and
            slot1.start_time == slot2.start_time and
            slot1.end_time == slot2.end_time
        )

    def _swap_assignments(
        self,
        assignment1: ScheduleAssignment,
        assignment2: ScheduleAssignment
    ):
        temp_volunteer_id = assignment1.volunteer_id
        temp_volunteer_name = assignment1.volunteer_name
        
        assignment1.volunteer_id = assignment2.volunteer_id
        assignment1.volunteer_name = assignment2.volunteer_name
        
        assignment2.volunteer_id = temp_volunteer_id
        assignment2.volunteer_name = temp_volunteer_name
        
        assignment1.notes = f"与{assignment2.volunteer_name}调班"
        assignment2.notes = f"与{temp_volunteer_name}调班"

    def _move_assignment(
        self,
        assignment: ScheduleAssignment,
        target_slot: TimeSlot,
        volunteers: List[Volunteer],
        courses: List[Course]
    ):
        target_course = self._find_course_for_slot(courses, target_slot)
        
        if target_course:
            assignment.time_slot = target_slot
            assignment.course_id = target_course.id
            assignment.course_name = target_course.name
            assignment.notes = f"从原时段调班"

    def _find_course_for_slot(
        self, courses: List[Course], time_slot: TimeSlot
    ) -> Optional[Course]:
        for course in courses:
            if self._slots_match(course.time_slot, time_slot):
                return course
        return None
