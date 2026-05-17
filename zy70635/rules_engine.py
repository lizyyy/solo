from datetime import datetime, date, time, timedelta
from typing import List, Optional, Tuple, Dict
from models import (
    Student, PickupPerson, Authorization, LeaveRecord,
    LatePickupEvent, PickupReport
)


class RulesEngine:
    LATE_PICKUP_THRESHOLD = timedelta(minutes=10)
    LATE_FEE_RATE = 5.0
    LATE_FEE_PER_MINUTE = 1.0

    def __init__(self):
        self.students: Dict[str, Student] = {}
        self.pickup_persons: Dict[str, PickupPerson] = {}
        self.authorizations: Dict[str, Authorization] = {}
        self.leave_records: Dict[str, LeaveRecord] = {}
        self.late_events: Dict[str, LatePickupEvent] = {}
        self.reports: Dict[str, PickupReport] = {}

    def add_student(self, student: Student) -> None:
        self.students[student.student_id] = student

    def add_pickup_person(self, person: PickupPerson) -> None:
        self.pickup_persons[person.person_id] = person

    def add_authorization(self, auth: Authorization) -> None:
        self.authorizations[auth.auth_id] = auth

    def add_leave_record(self, leave: LeaveRecord) -> None:
        self.leave_records[leave.leave_id] = leave

    def add_late_event(self, event: LatePickupEvent) -> None:
        self.late_events[event.event_id] = event

    def is_on_leave(self, student_id: str, check_date: date) -> Tuple[bool, Optional[LeaveRecord]]:
        for leave in self.leave_records.values():
            if leave.student_id == student_id and leave.leave_date == check_date:
                return True, leave
        return False, None

    def is_authorized(self, student_id: str, pickup_person_id: str,
                      check_datetime: datetime) -> Tuple[bool, Optional[Authorization], str]:
        check_date = check_datetime.date()
        check_time = check_datetime.time()
        weekday = check_date.weekday()

        for auth in self.authorizations.values():
            if (auth.student_id == student_id and
                    auth.pickup_person_id == pickup_person_id and
                    auth.is_active):

                if not (auth.start_date <= check_date <= auth.end_date):
                    continue

                if weekday not in auth.weekdays:
                    continue

                if not (auth.start_time <= check_time <= auth.end_time):
                    return False, auth, "接送时间不在授权时段内"

                return True, auth, "授权有效"

        return False, None, "未找到有效授权"

    def calculate_late_fee(self, scheduled_end_time: time,
                           actual_pickup_time: time) -> Tuple[bool, float, int]:
        scheduled = datetime.combine(date.today(), scheduled_end_time)
        actual = datetime.combine(date.today(), actual_pickup_time)

        if actual <= scheduled:
            return False, 0.0, 0

        delay = actual - scheduled
        if delay <= self.LATE_PICKUP_THRESHOLD:
            return False, 0.0, 0

        delay_minutes = int(delay.total_seconds() // 60)
        fee = self.LATE_FEE_RATE + (delay_minutes - 10) * self.LATE_FEE_PER_MINUTE
        return True, fee, delay_minutes

    def generate_daily_report(self, report_date: date,
                              pickup_records: List[Tuple[str, str, time]],
                              auto_record_late: bool = True) -> List[PickupReport]:
        reports = []

        for idx, (student_id, pickup_person_id, pickup_time) in enumerate(pickup_records):
            report_id = f"RPT_{report_date.strftime('%Y%m%d')}_{student_id}"
            check_datetime = datetime.combine(report_date, pickup_time)

            is_on_leave, leave_record = self.is_on_leave(student_id, report_date)
            is_authorized, auth, auth_notes = self.is_authorized(
                student_id, pickup_person_id, check_datetime
            )

            scheduled_end_time = auth.end_time if auth else time(18, 0)
            is_late, late_fee, delay_minutes = self.calculate_late_fee(
                scheduled_end_time, pickup_time
            )

            notes = []
            if is_on_leave:
                notes.append(f"请假中: {leave_record.reason if leave_record else ''}")
            if not is_authorized:
                notes.append(auth_notes)
            if is_late:
                notes.append(f"迟接{delay_minutes}分钟")

            report = PickupReport(
                report_id=report_id,
                report_date=report_date,
                student_id=student_id,
                pickup_person_id=pickup_person_id,
                pickup_time=pickup_time,
                is_authorized=is_authorized,
                is_late=is_late,
                is_on_leave=is_on_leave,
                late_fee=late_fee if is_late else 0.0,
                notes="; ".join(notes)
            )
            reports.append(report)
            self.reports[report_id] = report

            if is_late and auto_record_late:
                event_id = f"LATE_{report_date.strftime('%Y%m%d')}_{student_id}_{idx}"
                late_event = LatePickupEvent(
                    event_id=event_id,
                    student_id=student_id,
                    pickup_person_id=pickup_person_id,
                    pickup_date=report_date,
                    actual_pickup_time=pickup_time,
                    scheduled_end_time=scheduled_end_time,
                    fee_amount=late_fee
                )
                self.add_late_event(late_event)

        return reports

    def get_late_events_by_student(self, student_id: str) -> List[LatePickupEvent]:
        return [e for e in self.late_events.values() if e.student_id == student_id]

    def get_late_events_by_date(self, pickup_date: date) -> List[LatePickupEvent]:
        return [e for e in self.late_events.values() if e.pickup_date == pickup_date]

    def get_late_events_by_date_range(self, start_date: date, end_date: date) -> List[LatePickupEvent]:
        return [e for e in self.late_events.values() if start_date <= e.pickup_date <= end_date]

    def get_all_late_events(self) -> List[LatePickupEvent]:
        return list(self.late_events.values())

    def validate_data(self) -> List[str]:
        errors = []

        for auth in self.authorizations.values():
            if auth.student_id not in self.students:
                errors.append(f"授权{auth.auth_id}: 学生{auth.student_id}不存在")
            if auth.pickup_person_id not in self.pickup_persons:
                errors.append(f"授权{auth.auth_id}: 接送人{auth.pickup_person_id}不存在")
            if auth.start_date > auth.end_date:
                errors.append(f"授权{auth.auth_id}: 开始日期晚于结束日期")
            if auth.start_time >= auth.end_time:
                errors.append(f"授权{auth.auth_id}: 开始时间晚于结束时间")
            if not auth.weekdays:
                errors.append(f"授权{auth.auth_id}: 未指定有效星期")

        for leave in self.leave_records.values():
            if leave.student_id not in self.students:
                errors.append(f"请假{leave.leave_id}: 学生{leave.student_id}不存在")

        return errors
