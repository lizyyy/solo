from datetime import date
from typing import List, Optional, Tuple, Dict
from .models import (
    Person, VaccineBatch, Appointment, WaitingListEntry,
    AppointmentStatus, WaitingListStatus, NotificationRecord,
    PromotedEntry, RejectionReason
)
from .data_io import DataStore
import uuid


class WaitingListEngine:
    def __init__(self, store: DataStore, skip_notified_unconfirmed: bool = True):
        self.store = store
        self.skip_notified_unconfirmed = skip_notified_unconfirmed

    def cancel_appointment(self, appointment_id: str, cancellation_id: Optional[str] = None) -> Tuple[bool, str]:
        if cancellation_id:
            for promoted in self.store.promoted_entries:
                if promoted.source_cancellation_id == cancellation_id:
                    return False, f"取消记录 {cancellation_id} 已处理过，不能重复转正"

        appointment = self.store.appointments.get(appointment_id)
        if not appointment:
            return False, f"预约记录 {appointment_id} 不存在"

        if appointment.status == AppointmentStatus.CANCELLED:
            return False, f"预约记录 {appointment_id} 已取消"

        if appointment.status == AppointmentStatus.COMPLETED:
            return False, f"预约记录 {appointment_id} 已完成，无法取消"

        appointment.status = AppointmentStatus.CANCELLED
        appointment.cancelled_at = date.today()
        appointment.cancellation_id = cancellation_id or f"CANCEL-{uuid.uuid4().hex[:8]}"

        batch = self.store.vaccine_batches.get(appointment.vaccine_batch_id)
        if batch:
            batch.available_slots += 1

        return True, appointment.cancellation_id

    def check_age_qualification(self, entry: WaitingListEntry) -> Tuple[bool, str]:
        person = self.store.persons.get(entry.person_id)
        batch = self.store.vaccine_batches.get(entry.vaccine_batch_id)

        if not person:
            return False, f"接种人 {entry.person_id} 不存在"

        if not batch:
            return False, f"疫苗批次 {entry.vaccine_batch_id} 不存在"

        if not batch.is_age_qualified(person):
            age_months = person.age * 12
            return False, (
                f"年龄不符合要求: 实际 {age_months} 个月, "
                f"要求 {batch.min_age_months}-{batch.max_age_months} 个月"
            )

        return True, "年龄符合要求"

    def check_dose_interval(self, entry: WaitingListEntry) -> Tuple[bool, str]:
        if entry.dose_number <= 1:
            return True, "首剂无需检查间隔"

        batch = self.store.vaccine_batches.get(entry.vaccine_batch_id)
        if not batch:
            return False, f"疫苗批次 {entry.vaccine_batch_id} 不存在"

        required_interval = batch.get_required_interval(entry.dose_number)
        if required_interval == 0:
            return True, "该剂次无需检查间隔"

        last_dose = None
        for dose in self.store.dose_records:
            if dose.person_id == entry.person_id and dose.dose_number == entry.dose_number - 1:
                last_dose = dose
                break

        if not last_dose:
            prev_appointments = [
                a for a in self.store.appointments.values()
                if a.person_id == entry.person_id
                and a.vaccine_batch_id == entry.vaccine_batch_id
                and a.dose_number == entry.dose_number - 1
                and a.status in [AppointmentStatus.BOOKED, AppointmentStatus.COMPLETED]
            ]
            if prev_appointments:
                return True, "已有前剂次预约"
            return False, f"未找到第 {entry.dose_number - 1} 剂接种记录"

        days_since = (date.today() - last_dose.date).days
        if days_since < required_interval:
            return False, (
                f"剂次间隔不足: 已间隔 {days_since} 天, "
                f"要求至少 {required_interval} 天"
            )

        return True, f"剂次间隔满足: 已间隔 {days_since} 天"

    def check_duplicate_waiting(self, entry: WaitingListEntry) -> Tuple[bool, str]:
        person = self.store.persons.get(entry.person_id)
        if not person:
            return False, f"接种人 {entry.person_id} 不存在"

        for other in self.store.waiting_list.values():
            if other.id == entry.id:
                continue
            if other.status in [WaitingListStatus.PENDING, WaitingListStatus.NOTIFIED]:
                other_person = self.store.persons.get(other.person_id)
                if other_person and other_person.id_card == person.id_card:
                    if (other.vaccine_batch_id == entry.vaccine_batch_id and
                            other.dose_number == entry.dose_number):
                        return False, f"身份证 {person.id_card} 已存在有效候补记录 {other.id}"

        return True, "无重复候补"

    def check_notified_unconfirmed(self, entry: WaitingListEntry) -> Tuple[bool, str]:
        if entry.status == WaitingListStatus.NOTIFIED:
            if self.skip_notified_unconfirmed:
                return False, "已通知但未确认，跳过"
            return True, "已通知但未确认，继续处理"
        return True, "状态正常"

    def check_all_qualifications(self, entry: WaitingListEntry) -> List[Tuple[str, bool, str]]:
        results = []

        ok, reason = self.check_duplicate_waiting(entry)
        results.append(("重复候补检查", ok, reason))

        ok, reason = self.check_age_qualification(entry)
        results.append(("年龄检查", ok, reason))

        ok, reason = self.check_dose_interval(entry)
        results.append(("剂次间隔检查", ok, reason))

        ok, reason = self.check_notified_unconfirmed(entry)
        results.append(("通知状态检查", ok, reason))

        return results

    def is_fully_qualified(self, entry: WaitingListEntry) -> Tuple[bool, List[str]]:
        results = self.check_all_qualifications(entry)
        all_ok = all(ok for _, ok, _ in results)
        reasons = [reason for _, ok, reason in results if not ok]
        return all_ok, reasons

    def get_eligible_waiting_list(self, vaccine_batch_id: str, dose_number: int) -> List[WaitingListEntry]:
        candidates = [
            entry for entry in self.store.waiting_list.values()
            if entry.vaccine_batch_id == vaccine_batch_id
            and entry.dose_number == dose_number
            and entry.status in [WaitingListStatus.PENDING, WaitingListStatus.NOTIFIED]
        ]

        candidates.sort(key=lambda e: (-e.priority, e.created_at or date.min))
        return candidates

    def notify_candidate(self, entry: WaitingListEntry, order: int) -> NotificationRecord:
        record = NotificationRecord(
            id=f"NOTIFY-{uuid.uuid4().hex[:8]}",
            waiting_list_entry_id=entry.id,
            person_id=entry.person_id,
            vaccine_batch_id=entry.vaccine_batch_id,
            dose_number=entry.dose_number,
            notification_time=date.today(),
            order=order
        )
        self.store.notification_records.append(record)
        return record

    def promote_entry(self, entry: WaitingListEntry, source_cancellation_id: str) -> Tuple[bool, str]:
        if entry.status == WaitingListStatus.CONFIRMED:
            return False, f"候补 {entry.id} 已转正"

        qualified, reasons = self.is_fully_qualified(entry)
        if not qualified:
            entry.status = WaitingListStatus.REJECTED
            entry.rejected_at = date.today()
            entry.rejection_reason = "; ".join(reasons)

            self.store.rejection_reasons.append(RejectionReason(
                waiting_list_entry_id=entry.id,
                person_id=entry.person_id,
                vaccine_batch_id=entry.vaccine_batch_id,
                dose_number=entry.dose_number,
                reason="; ".join(reasons),
                check_time=date.today()
            ))
            return False, f"不符合资格: {'; '.join(reasons)}"

        batch = self.store.vaccine_batches.get(entry.vaccine_batch_id)
        if not batch or batch.available_slots <= 0:
            return False, "没有可用名额"

        batch.available_slots -= 1
        entry.status = WaitingListStatus.CONFIRMED
        entry.confirmed_at = date.today()

        new_appointment = Appointment(
            id=f"APPT-{uuid.uuid4().hex[:8]}",
            person_id=entry.person_id,
            vaccine_batch_id=entry.vaccine_batch_id,
            dose_number=entry.dose_number,
            appointment_date=date.today(),
            status=AppointmentStatus.BOOKED
        )
        self.store.appointments[new_appointment.id] = new_appointment
        entry.appointment_id = new_appointment.id

        promoted = PromotedEntry(
            waiting_list_entry_id=entry.id,
            person_id=entry.person_id,
            vaccine_batch_id=entry.vaccine_batch_id,
            dose_number=entry.dose_number,
            promoted_at=date.today(),
            source_cancellation_id=source_cancellation_id
        )
        self.store.promoted_entries.append(promoted)

        return True, new_appointment.id

    def process_cancellation(self, appointment_id: str, cancellation_id: Optional[str] = None
                            ) -> Dict[str, any]:
        result = {
            'success': False,
            'cancellation_id': None,
            'available_slots': 0,
            'notified': [],
            'promoted': [],
            'rejected': []
        }

        ok, cancel_result = self.cancel_appointment(appointment_id, cancellation_id)
        if not ok:
            result['error'] = cancel_result
            return result

        result['cancellation_id'] = cancel_result
        result['success'] = True

        appointment = self.store.appointments[appointment_id]
        batch = self.store.vaccine_batches.get(appointment.vaccine_batch_id)

        if not batch:
            return result

        result['available_slots'] = batch.available_slots

        while batch.available_slots > 0:
            candidates = self.get_eligible_waiting_list(
                appointment.vaccine_batch_id,
                appointment.dose_number
            )

            if not candidates:
                break

            promoted_any = False
            for i, candidate in enumerate(candidates):
                notification_order = len(result['notified']) + 1
                self.notify_candidate(candidate, notification_order)
                result['notified'].append({
                    'entry_id': candidate.id,
                    'order': notification_order
                })

                ok, promote_result = self.promote_entry(candidate, cancel_result)
                if ok:
                    result['promoted'].append({
                        'entry_id': candidate.id,
                        'new_appointment_id': promote_result
                    })
                    promoted_any = True
                    break
                else:
                    result['rejected'].append({
                        'entry_id': candidate.id,
                        'reason': promote_result
                    })

            if not promoted_any:
                break

        return result

    def process_multiple_cancellations(self, appointment_ids: List[str]) -> List[Dict[str, any]]:
        results = []
        for appt_id in appointment_ids:
            result = self.process_cancellation(appt_id)
            results.append(result)
        return results
