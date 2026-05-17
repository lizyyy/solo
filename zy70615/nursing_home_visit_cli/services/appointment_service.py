from datetime import datetime
from typing import List, Optional, Tuple
import uuid

from ..models import (
    Appointment,
    AppointmentStatus,
    AppointmentChangeLog,
    HealthDeclaration,
    Elder,
    Visitor,
    Room
)
from .storage import StorageService
from .validation import ValidationService, ValidationResult


class AppointmentService:
    def __init__(self, storage: StorageService):
        self.storage = storage
        self.validation = ValidationService()

    def create_appointment(
        self,
        elder_id: str,
        visitor_ids: List[str],
        room_number: str,
        scheduled_start: datetime,
        scheduled_end: datetime,
        operator: str = "system",
        notes: Optional[str] = None
    ) -> Tuple[Optional[Appointment], List[ValidationResult]]:
        results = []

        elder = self.storage.get_elder(elder_id)
        if not elder:
            results.append(ValidationResult(False, f"老人 {elder_id} 不存在", "ELDER_NOT_FOUND"))
            return None, results

        for visitor_id in visitor_ids:
            visitor = self.storage.get_visitor(visitor_id)
            if not visitor:
                results.append(ValidationResult(False, f"探访人 {visitor_id} 不存在", "VISITOR_NOT_FOUND"))
                return None, results

        room = self.storage.get_room_by_number(room_number)
        if not room:
            results.append(ValidationResult(False, f"房间 {room_number} 不存在", "ROOM_NOT_FOUND"))
            return None, results

        time_result = self.validation.validate_time_slot(scheduled_start, scheduled_end)
        results.append(time_result)
        if not time_result.is_valid:
            return None, results

        current_appointments = self.storage.get_all_appointments()

        duplicate_result = self.validation.validate_duplicate_appointment(
            visitor_ids, scheduled_start, scheduled_end, current_appointments
        )
        results.append(duplicate_result)
        if not duplicate_result.is_valid:
            return None, results

        capacity_result = self.validation.validate_room_capacity(
            room, len(visitor_ids), current_appointments, scheduled_start, scheduled_end
        )
        results.append(capacity_result)
        if not capacity_result.is_valid:
            return None, results

        appointment = Appointment(
            id=f"APT{uuid.uuid4().hex[:8].upper()}",
            elder_id=elder_id,
            visitor_ids=visitor_ids,
            room_number=room_number,
            scheduled_start=scheduled_start,
            scheduled_end=scheduled_end,
            status=AppointmentStatus.PENDING,
            operator=operator,
            notes=notes
        )

        appointment.change_history.append(AppointmentChangeLog(
            changed_at=datetime.now(),
            changed_by=operator,
            new_status=AppointmentStatus.PENDING,
            reason="创建预约"
        ))

        self.storage.add_appointment(appointment)
        return appointment, results

    def update_status(
        self,
        appointment_id: str,
        new_status: AppointmentStatus,
        operator: str,
        reason: Optional[str] = None
    ) -> Tuple[Optional[Appointment], ValidationResult]:
        appointment = self.storage.get_appointment(appointment_id)
        if not appointment:
            return None, ValidationResult(False, "预约不存在", "APPOINTMENT_NOT_FOUND")

        transition_result = self.validation.validate_status_transition(
            appointment.status, new_status
        )
        if not transition_result.is_valid:
            return None, transition_result

        old_status = appointment.status
        appointment.status = new_status
        appointment.change_history.append(AppointmentChangeLog(
            changed_at=datetime.now(),
            changed_by=operator,
            old_status=old_status,
            new_status=new_status,
            reason=reason
        ))
        appointment.updated_at = datetime.now()

        self.storage.update_appointment(appointment)
        return appointment, transition_result

    def reschedule(
        self,
        appointment_id: str,
        new_start: datetime,
        new_end: datetime,
        operator: str,
        reason: Optional[str] = None
    ) -> Tuple[Optional[Appointment], List[ValidationResult]]:
        results = []

        appointment = self.storage.get_appointment(appointment_id)
        if not appointment:
            results.append(ValidationResult(False, "预约不存在", "APPOINTMENT_NOT_FOUND"))
            return None, results

        if appointment.status not in [AppointmentStatus.CONFIRMED, AppointmentStatus.RESCHEDULED]:
            results.append(ValidationResult(
                False,
                f"当前状态 {appointment.status.value} 不允许改约",
                "INVALID_STATUS_FOR_RESCHEDULE"
            ))
            return None, results

        time_result = self.validation.validate_time_slot(new_start, new_end)
        results.append(time_result)
        if not time_result.is_valid:
            return None, results

        current_appointments = self.storage.get_all_appointments()

        duplicate_result = self.validation.validate_duplicate_appointment(
            appointment.visitor_ids, new_start, new_end,
            current_appointments, exclude_appointment_id=appointment_id
        )
        results.append(duplicate_result)
        if not duplicate_result.is_valid:
            return None, results

        room = self.storage.get_room_by_number(appointment.room_number)
        if room:
            capacity_result = self.validation.validate_room_capacity(
                room, len(appointment.visitor_ids),
                current_appointments, new_start, new_end
            )
            results.append(capacity_result)
            if not capacity_result.is_valid:
                return None, results

        old_start = appointment.scheduled_start
        old_end = appointment.scheduled_end
        old_status = appointment.status

        appointment.scheduled_start = new_start
        appointment.scheduled_end = new_end
        appointment.status = AppointmentStatus.RESCHEDULED
        appointment.change_history.append(AppointmentChangeLog(
            changed_at=datetime.now(),
            changed_by=operator,
            old_status=old_status,
            new_status=AppointmentStatus.RESCHEDULED,
            old_time=old_start,
            new_time=new_start,
            reason=reason
        ))
        appointment.updated_at = datetime.now()

        self.storage.update_appointment(appointment)
        return appointment, results

    def add_health_declaration(
        self,
        appointment_id: str,
        visitor_id: str,
        temperature: float,
        has_fever: bool,
        has_cough: bool,
        has_other_symptoms: bool,
        symptoms_detail: Optional[str] = None,
        operator: str = "system"
    ) -> Tuple[Optional[HealthDeclaration], ValidationResult]:
        appointment = self.storage.get_appointment(appointment_id)
        if not appointment:
            return None, ValidationResult(False, "预约不存在", "APPOINTMENT_NOT_FOUND")

        if visitor_id not in appointment.visitor_ids:
            return None, ValidationResult(False, "探访人不在该预约中", "VISITOR_NOT_IN_APPOINTMENT")

        declaration = HealthDeclaration(
            id=f"HEALTH{uuid.uuid4().hex[:6].upper()}",
            visitor_id=visitor_id,
            appointment_id=appointment_id,
            temperature=temperature,
            has_fever=has_fever,
            has_cough=has_cough,
            has_other_symptoms=has_other_symptoms,
            symptoms_detail=symptoms_detail,
            declaration_time=datetime.now(),
            is_passed=True
        )

        health_result = self.validation.validate_health_declaration(declaration)
        declaration.is_passed = health_result.is_valid

        self.storage.add_health_declaration(declaration)
        appointment.health_declaration_ids.append(declaration.id)
        self.storage.update_appointment(appointment)

        return declaration, health_result
