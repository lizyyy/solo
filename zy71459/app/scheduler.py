from datetime import datetime, date, timedelta
from typing import List, Dict, Tuple, Optional, Any
from dataclasses import dataclass
import pulp
from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories import (
    RoomRepository, EquipmentRepository, BookingRequestRepository,
    ScheduleRepository, ConflictRecordRepository, ExamWeekRepository
)


@dataclass
class TimeSlot:
    start: str
    end: str

    def overlaps(self, other: 'TimeSlot') -> bool:
        return self.start < other.end and other.start < self.end

    def to_minutes(self) -> Tuple[int, int]:
        s_h, s_m = map(int, self.start.split(':'))
        e_h, e_m = map(int, self.end.split(':'))
        return s_h * 60 + s_m, e_h * 60 + e_m


@dataclass
class BookingCandidate:
    booking_id: int
    preferred_date: date
    time_slot: TimeSlot
    participant_count: int
    priority: str
    equipment_needs: Dict[int, int]
    is_exam_booking: bool = False


@dataclass
class RoomOption:
    room_id: int
    capacity: int
    equipment: Dict[int, int]


class IntegerProgrammingScheduler:
    def __init__(self, db: Session):
        self.db = db
        self.room_repo = RoomRepository(db)
        self.eq_repo = EquipmentRepository(db)
        self.booking_repo = BookingRequestRepository(db)
        self.schedule_repo = ScheduleRepository(db)
        self.conflict_repo = ConflictRecordRepository(db)
        self.exam_week_repo = ExamWeekRepository(db)

        self.priority_weights = {
            "low": 1,
            "normal": 3,
            "high": 5,
            "exam": 10
        }

    def schedule_batch(self, booking_ids: List[int], batch_id: str,
                       scheduled_date: date) -> Tuple[List[Dict], List[Dict], Dict[str, Any]]:
        bookings = [self.booking_repo.get_by_id(bid) for bid in booking_ids]
        bookings = [b for b in bookings if b is not None]

        candidates = self._prepare_candidates(bookings)
        room_options = self._prepare_room_options()

        result = self._solve_ip_problem(candidates, room_options, scheduled_date, batch_id)
        schedules = result['schedules']
        conflicts = result['conflicts']
        summary = result['summary']

        return schedules, conflicts, summary

    def _prepare_candidates(self, bookings: List[models.BookingRequest]) -> List[BookingCandidate]:
        candidates = []
        for booking in bookings:
            time_slot = TimeSlot(booking.start_time, booking.end_time)
            equipment_needs = {eq.equipment_id: eq.quantity for eq in booking.equipment}
            is_exam = booking.priority == 'exam' or self.exam_week_repo.is_exam_week(booking.preferred_date)
            candidates.append(BookingCandidate(
                booking_id=booking.id,
                preferred_date=booking.preferred_date,
                time_slot=time_slot,
                participant_count=booking.participant_count,
                priority=booking.priority,
                equipment_needs=equipment_needs,
                is_exam_booking=is_exam
            ))
        return candidates

    def _prepare_room_options(self) -> List[RoomOption]:
        rooms = self.room_repo.get_all()
        options = []
        for room in rooms:
            equipment = {eq.equipment_id: eq.quantity for eq in room.equipment}
            options.append(RoomOption(
                room_id=room.id,
                capacity=room.capacity,
                equipment=equipment
            ))
        return options

    def _solve_ip_problem(self, candidates: List[BookingCandidate],
                          room_options: List[RoomOption],
                          scheduled_date: date,
                          batch_id: str) -> Dict[str, Any]:
        n_candidates = len(candidates)
        n_rooms = len(room_options)

        prob = pulp.LpProblem("RehearsalRoomScheduling", pulp.LpMaximize)

        x = [[pulp.LpVariable(f"x_{i}_{j}", cat='Binary')
              for j in range(n_rooms)] for i in range(n_candidates)]

        objective = []
        for i, candidate in enumerate(candidates):
            weight = self.priority_weights.get(candidate.priority, 1)
            for j in range(n_rooms):
                if room_options[j].capacity >= candidate.participant_count:
                    objective.append(weight * x[i][j])
        prob += pulp.lpSum(objective)

        for i in range(n_candidates):
            prob += pulp.lpSum([x[i][j] for j in range(n_rooms)]) <= 1

        for j in range(n_rooms):
            room_id = room_options[j].room_id
            existing_schedules = self.schedule_repo.get_by_room_date(room_id, scheduled_date)
            existing_slots = [TimeSlot(s.start_time, s.end_time) for s in existing_schedules]

            for i1 in range(n_candidates):
                for i2 in range(i1 + 1, n_candidates):
                    if candidates[i1].time_slot.overlaps(candidates[i2].time_slot):
                        prob += x[i1][j] + x[i2][j] <= 1

            for i, candidate in enumerate(candidates):
                for existing_slot in existing_slots:
                    if candidate.time_slot.overlaps(existing_slot):
                        prob += x[i][j] == 0

        for i, candidate in enumerate(candidates):
            for j, room in enumerate(room_options):
                if room.capacity < candidate.participant_count:
                    prob += x[i][j] == 0

                for eq_id, qty in candidate.equipment_needs.items():
                    if room.equipment.get(eq_id, 0) < qty:
                        prob += x[i][j] == 0

        prob.solve(pulp.PULP_CBC_CMD(msg=False))

        schedules = []
        conflict_records = []
        scheduled_count = 0
        conflict_count = 0

        for i, candidate in enumerate(candidates):
            assigned = False
            for j, room in enumerate(room_options):
                if pulp.value(x[i][j]) == 1:
                    schedules.append({
                        'booking_id': candidate.booking_id,
                        'room_id': room.room_id,
                        'scheduled_date': scheduled_date,
                        'start_time': candidate.time_slot.start,
                        'end_time': candidate.time_slot.end,
                        'batch_id': batch_id,
                        'source_note': f"IP求解分配: 优先级{candidate.priority}, 人数{candidate.participant_count}"
                    })
                    assigned = True
                    scheduled_count += 1
                    break

            if not assigned:
                conflict_details = self._analyze_conflict(candidate, room_options, scheduled_date)
                conflict_records.append({
                    'booking_id': candidate.booking_id,
                    'conflict_type': conflict_details['type'],
                    'conflict_details': conflict_details,
                    'severity': 'error' if candidate.priority == 'exam' else 'warning',
                    'batch_id': batch_id
                })
                conflict_count += 1

        summary = {
            'algorithm': 'IntegerProgramming',
            'solver': 'PuLP-CBC',
            'status': pulp.LpStatus[prob.status],
            'objective_value': pulp.value(prob.objective) if prob.objective else 0,
            'total_candidates': n_candidates,
            'scheduled_count': scheduled_count,
            'conflict_count': conflict_count,
            'scheduling_date': str(scheduled_date),
            'room_count': n_rooms,
            'priority_distribution': self._get_priority_distribution(candidates)
        }

        return {
            'schedules': schedules,
            'conflicts': conflict_records,
            'summary': summary
        }

    def _analyze_conflict(self, candidate: BookingCandidate,
                          room_options: List[RoomOption],
                          scheduled_date: date) -> Dict[str, Any]:
        issues = []
        conflict_type = 'mixed'

        capacity_issues = []
        for room in room_options:
            if room.capacity < candidate.participant_count:
                capacity_issues.append(f"房间{room.room_id}(容量{room.capacity})不足")
        if len(capacity_issues) == len(room_options):
            conflict_type = 'capacity'
            issues.append(f"所有房间容量不足: 需要{candidate.participant_count}人")

        equipment_issues = []
        for eq_id, qty in candidate.equipment_needs.items():
            eq = self.eq_repo.get_by_id(eq_id)
            eq_name = eq.name if eq else f"设备{int(eq_id)}"
            available = sum(1 for r in room_options if r.equipment.get(eq_id, 0) >= qty)
            if available == 0:
                equipment_issues.append(f"{eq_name}(需要{qty}件)无可用")
        if equipment_issues and conflict_type == 'mixed':
            conflict_type = 'equipment'
        issues.extend(equipment_issues)

        time_issues = []
        for room in room_options:
            existing = self.schedule_repo.get_by_room_date(room.room_id, scheduled_date)
            for s in existing:
                slot = TimeSlot(s.start_time, s.end_time)
                if candidate.time_slot.overlaps(slot):
                    time_issues.append(
                        f"房间{room.room_id}与预约{s.booking_id}({slot.start}-{slot.end})时间冲突"
                    )
        if time_issues and conflict_type == 'mixed':
            conflict_type = 'time_overlap'
        issues.append(f"时间冲突: {len(time_issues)}个房间时段被占用")

        return {
            'type': conflict_type,
            'booking_id': candidate.booking_id,
            'requested_date': str(scheduled_date),
            'requested_time': f"{candidate.time_slot.start}-{candidate.time_slot.end}",
            'participants': candidate.participant_count,
            'priority': candidate.priority,
            'equipment_needs': candidate.equipment_needs,
            'issues': issues,
            'alternative_suggestions': self._get_alternatives(candidate, room_options, scheduled_date)
        }

    def _get_alternatives(self, candidate: BookingCandidate,
                          room_options: List[RoomOption],
                          scheduled_date: date) -> List[Dict[str, Any]]:
        alternatives = []

        for days in range(1, 8):
            alt_date = scheduled_date + timedelta(days=days)
            if self.exam_week_repo.is_exam_week(alt_date) and candidate.priority != 'exam':
                continue

            available_rooms = []
            for room in room_options:
                if room.capacity < candidate.participant_count:
                    continue
                eq_ok = all(room.equipment.get(eq_id, 0) >= qty
                            for eq_id, qty in candidate.equipment_needs.items())
                if not eq_ok:
                    continue
                existing = self.schedule_repo.get_by_room_date(room.room_id, alt_date)
                slot_free = True
                for s in existing:
                    if candidate.time_slot.overlaps(TimeSlot(s.start_time, s.end_time)):
                        slot_free = False
                        break
                if slot_free:
                    available_rooms.append(room.room_id)

            if available_rooms:
                alternatives.append({
                    'date': str(alt_date),
                    'rooms': available_rooms,
                    'score': len(available_rooms) / days
                })

        return alternatives[:3]

    def _get_priority_distribution(self, candidates: List[BookingCandidate]) -> Dict[str, int]:
        dist = {}
        for c in candidates:
            dist[c.priority] = dist.get(c.priority, 0) + 1
        return dist
