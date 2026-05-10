from datetime import date
from typing import Dict, List, Optional

from models import PaymentSchedule, ScheduleRecord, ScheduleStatus


class ScheduleRepository:
    def __init__(self):
        self._schedules: Dict[str, PaymentSchedule] = {}
        self._records: Dict[str, ScheduleRecord] = {}

    def save_schedule(self, schedule: PaymentSchedule) -> None:
        self._schedules[schedule.id] = schedule

    def get_schedule_by_id(self, schedule_id: str) -> Optional[PaymentSchedule]:
        return self._schedules.get(schedule_id)

    def get_schedule_by_batch(self, batch_no: str) -> Optional[PaymentSchedule]:
        for s in self._schedules.values():
            if s.batch_no == batch_no:
                return s
        return None

    def get_schedules_by_month(self, target_month: str) -> List[PaymentSchedule]:
        return [s for s in self._schedules.values() if s.target_month == target_month]

    def get_latest_schedule(self) -> Optional[PaymentSchedule]:
        if not self._schedules:
            return None
        return max(self._schedules.values(), key=lambda s: s.created_at)

    def get_all_schedules(self) -> List[PaymentSchedule]:
        return list(self._schedules.values())

    def save_record(self, record: ScheduleRecord) -> None:
        self._records[record.id] = record

    def get_record_by_id(self, record_id: str) -> Optional[ScheduleRecord]:
        return self._records.get(record_id)

    def get_records_by_plan(self, plan_id: str) -> List[ScheduleRecord]:
        return [r for r in self._records.values() if r.payment_plan_id == plan_id]

    def get_records_by_schedule(self, schedule_id: str) -> List[ScheduleRecord]:
        return [r for r in self._records.values() if r.id.startswith('SR-')]

    def get_records_by_status(self, status: ScheduleStatus) -> List[ScheduleRecord]:
        return [r for r in self._records.values() if r.status == status]

    def get_records_by_date(self, target_date: date) -> List[ScheduleRecord]:
        return [r for r in self._records.values() 
                if r.new_payment_date == target_date or r.original_payment_date == target_date]

    def get_all_records(self) -> List[ScheduleRecord]:
        return list(self._records.values())
