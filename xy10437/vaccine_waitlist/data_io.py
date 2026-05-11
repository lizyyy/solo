import json
import csv
from datetime import date, datetime
from typing import Dict, List, Any, Optional
from .models import (
    Person, VaccineBatch, Appointment, WaitingListEntry,
    DoseRecord, NotificationRecord, PromotedEntry, RejectionReason,
    AppointmentStatus, WaitingListStatus
)


class DataStore:
    def __init__(self):
        self.persons: Dict[str, Person] = {}
        self.vaccine_batches: Dict[str, VaccineBatch] = {}
        self.appointments: Dict[str, Appointment] = {}
        self.waiting_list: Dict[str, WaitingListEntry] = {}
        self.dose_records: List[DoseRecord] = []
        self.notification_records: List[NotificationRecord] = []
        self.promoted_entries: List[PromotedEntry] = []
        self.rejection_reasons: List[RejectionReason] = []

    def parse_date(self, date_str: str) -> date:
        for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y%m%d']:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"Invalid date format: {date_str}")

    def import_persons(self, data: List[Dict[str, Any]]):
        for item in data:
            person = Person(
                id=item['id'],
                name=item['name'],
                id_card=item['id_card'],
                birth_date=self.parse_date(item['birth_date']),
                gender=item['gender'],
                phone=item['phone']
            )
            self.persons[person.id] = person

    def import_vaccine_batches(self, data: List[Dict[str, Any]]):
        for item in data:
            batch = VaccineBatch(
                id=item['id'],
                vaccine_name=item['vaccine_name'],
                vaccine_type=item['vaccine_type'],
                min_age_months=item['min_age_months'],
                max_age_months=item['max_age_months'],
                total_doses=item['total_doses'],
                intervals_days=item.get('intervals_days', []),
                available_slots=item.get('available_slots', 0),
                date=self.parse_date(item['date']) if 'date' in item else None
            )
            self.vaccine_batches[batch.id] = batch

    def import_appointments(self, data: List[Dict[str, Any]]):
        for item in data:
            status = AppointmentStatus(item.get('status', 'booked'))
            appointment = Appointment(
                id=item['id'],
                person_id=item['person_id'],
                vaccine_batch_id=item['vaccine_batch_id'],
                dose_number=item['dose_number'],
                appointment_date=self.parse_date(item['appointment_date']),
                status=status,
                cancelled_at=self.parse_date(item['cancelled_at']) if item.get('cancelled_at') else None,
                cancellation_id=item.get('cancellation_id')
            )
            self.appointments[appointment.id] = appointment

    def import_waiting_list(self, data: List[Dict[str, Any]]):
        for item in data:
            status = WaitingListStatus(item.get('status', 'pending'))
            entry = WaitingListEntry(
                id=item['id'],
                person_id=item['person_id'],
                vaccine_batch_id=item['vaccine_batch_id'],
                dose_number=item['dose_number'],
                status=status,
                priority=item.get('priority', 0),
                notified_at=self.parse_date(item['notified_at']) if item.get('notified_at') else None,
                confirmed_at=self.parse_date(item['confirmed_at']) if item.get('confirmed_at') else None,
                rejected_at=self.parse_date(item['rejected_at']) if item.get('rejected_at') else None,
                rejection_reason=item.get('rejection_reason'),
                created_at=self.parse_date(item['created_at']) if item.get('created_at') else None,
                appointment_id=item.get('appointment_id')
            )
            self.waiting_list[entry.id] = entry

    def import_from_json(self, filepath: str):
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if 'persons' in data:
            self.import_persons(data['persons'])
        if 'vaccine_batches' in data:
            self.import_vaccine_batches(data['vaccine_batches'])
        if 'appointments' in data:
            self.import_appointments(data['appointments'])
        if 'waiting_list' in data:
            self.import_waiting_list(data['waiting_list'])
        if 'notification_records' in data:
            for item in data['notification_records']:
                self.notification_records.append(NotificationRecord(
                    id=item['id'],
                    waiting_list_entry_id=item['waiting_list_entry_id'],
                    person_id=item['person_id'],
                    vaccine_batch_id=item['vaccine_batch_id'],
                    dose_number=item['dose_number'],
                    notification_time=self.parse_date(item['notification_time']),
                    order=item['order']
                ))
        if 'promoted_entries' in data:
            for item in data['promoted_entries']:
                self.promoted_entries.append(PromotedEntry(
                    waiting_list_entry_id=item['waiting_list_entry_id'],
                    person_id=item['person_id'],
                    vaccine_batch_id=item['vaccine_batch_id'],
                    dose_number=item['dose_number'],
                    promoted_at=self.parse_date(item['promoted_at']),
                    source_cancellation_id=item['source_cancellation_id']
                ))
        if 'rejection_reasons' in data:
            for item in data['rejection_reasons']:
                self.rejection_reasons.append(RejectionReason(
                    waiting_list_entry_id=item['waiting_list_entry_id'],
                    person_id=item['person_id'],
                    vaccine_batch_id=item['vaccine_batch_id'],
                    dose_number=item['dose_number'],
                    reason=item['reason'],
                    check_time=self.parse_date(item['check_time'])
                ))

    def export_to_json(self, filepath: str):
        data = {
            'persons': [self._person_to_dict(p) for p in self.persons.values()],
            'vaccine_batches': [self._batch_to_dict(b) for b in self.vaccine_batches.values()],
            'appointments': [self._appointment_to_dict(a) for a in self.appointments.values()],
            'waiting_list': [self._waiting_to_dict(w) for w in self.waiting_list.values()],
            'notification_records': [self._notification_to_dict(n) for n in self.notification_records],
            'promoted_entries': [self._promoted_to_dict(p) for p in self.promoted_entries],
            'rejection_reasons': [self._rejection_to_dict(r) for r in self.rejection_reasons],
        }
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    def export_vaccination_list(self, filepath: str):
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                '接种人ID', '姓名', '身份证号', '性别', '年龄',
                '疫苗名称', '疫苗批次', '剂次', '预约日期',
                '候补记录ID', '转正日期', '来源取消记录ID'
            ])

            for promoted in self.promoted_entries:
                person = self.persons.get(promoted.person_id)
                batch = self.vaccine_batches.get(promoted.vaccine_batch_id)
                appointment = self.appointments.get(promoted.waiting_list_entry_id)

                writer.writerow([
                    person.id if person else promoted.person_id,
                    person.name if person else '',
                    person.id_card if person else '',
                    person.gender if person else '',
                    person.age if person else '',
                    batch.vaccine_name if batch else '',
                    promoted.vaccine_batch_id,
                    promoted.dose_number,
                    appointment.appointment_date if appointment else '',
                    promoted.waiting_list_entry_id,
                    promoted.promoted_at,
                    promoted.source_cancellation_id
                ])

    def export_rejection_reasons(self, filepath: str):
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                '候补记录ID', '接种人ID', '姓名', '疫苗批次',
                '剂次', '拒绝原因', '检查时间'
            ])

            for rejection in self.rejection_reasons:
                person = self.persons.get(rejection.person_id)
                writer.writerow([
                    rejection.waiting_list_entry_id,
                    rejection.person_id,
                    person.name if person else '',
                    rejection.vaccine_batch_id,
                    rejection.dose_number,
                    rejection.reason,
                    rejection.check_time
                ])

    def export_notification_log(self, filepath: str):
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                '通知ID', '候补记录ID', '接种人ID', '姓名',
                '疫苗批次', '剂次', '通知时间', '通知顺序'
            ])

            for record in self.notification_records:
                person = self.persons.get(record.person_id)
                writer.writerow([
                    record.id,
                    record.waiting_list_entry_id,
                    record.person_id,
                    person.name if person else '',
                    record.vaccine_batch_id,
                    record.dose_number,
                    record.notification_time,
                    record.order
                ])

    def _person_to_dict(self, person: Person) -> Dict[str, Any]:
        return {
            'id': person.id,
            'name': person.name,
            'id_card': person.id_card,
            'birth_date': str(person.birth_date),
            'gender': person.gender,
            'phone': person.phone
        }

    def _batch_to_dict(self, batch: VaccineBatch) -> Dict[str, Any]:
        return {
            'id': batch.id,
            'vaccine_name': batch.vaccine_name,
            'vaccine_type': batch.vaccine_type,
            'min_age_months': batch.min_age_months,
            'max_age_months': batch.max_age_months,
            'total_doses': batch.total_doses,
            'intervals_days': batch.intervals_days,
            'available_slots': batch.available_slots,
            'date': str(batch.date) if batch.date else None
        }

    def _appointment_to_dict(self, appointment: Appointment) -> Dict[str, Any]:
        return {
            'id': appointment.id,
            'person_id': appointment.person_id,
            'vaccine_batch_id': appointment.vaccine_batch_id,
            'dose_number': appointment.dose_number,
            'appointment_date': str(appointment.appointment_date),
            'status': appointment.status.value,
            'cancelled_at': str(appointment.cancelled_at) if appointment.cancelled_at else None,
            'cancellation_id': appointment.cancellation_id
        }

    def _waiting_to_dict(self, entry: WaitingListEntry) -> Dict[str, Any]:
        return {
            'id': entry.id,
            'person_id': entry.person_id,
            'vaccine_batch_id': entry.vaccine_batch_id,
            'dose_number': entry.dose_number,
            'status': entry.status.value,
            'priority': entry.priority,
            'notified_at': str(entry.notified_at) if entry.notified_at else None,
            'confirmed_at': str(entry.confirmed_at) if entry.confirmed_at else None,
            'rejected_at': str(entry.rejected_at) if entry.rejected_at else None,
            'rejection_reason': entry.rejection_reason,
            'created_at': str(entry.created_at) if entry.created_at else None,
            'appointment_id': entry.appointment_id
        }

    def _notification_to_dict(self, record: NotificationRecord) -> Dict[str, Any]:
        return {
            'id': record.id,
            'waiting_list_entry_id': record.waiting_list_entry_id,
            'person_id': record.person_id,
            'vaccine_batch_id': record.vaccine_batch_id,
            'dose_number': record.dose_number,
            'notification_time': str(record.notification_time),
            'order': record.order
        }

    def _promoted_to_dict(self, entry: PromotedEntry) -> Dict[str, Any]:
        return {
            'waiting_list_entry_id': entry.waiting_list_entry_id,
            'person_id': entry.person_id,
            'vaccine_batch_id': entry.vaccine_batch_id,
            'dose_number': entry.dose_number,
            'promoted_at': str(entry.promoted_at),
            'source_cancellation_id': entry.source_cancellation_id
        }

    def _rejection_to_dict(self, reason: RejectionReason) -> Dict[str, Any]:
        return {
            'waiting_list_entry_id': reason.waiting_list_entry_id,
            'person_id': reason.person_id,
            'vaccine_batch_id': reason.vaccine_batch_id,
            'dose_number': reason.dose_number,
            'reason': reason.reason,
            'check_time': str(reason.check_time)
        }
