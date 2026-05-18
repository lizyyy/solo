from pydantic import BaseModel, Field
from datetime import date, time, datetime
from typing import Optional, List


class PatientBase(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None


class PatientCreate(PatientBase):
    pass


class Patient(PatientBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class DoctorBase(BaseModel):
    name: str
    department: Optional[str] = None
    title: Optional[str] = None
    phone: Optional[str] = None


class DoctorCreate(DoctorBase):
    pass


class Doctor(DoctorBase):
    id: int

    class Config:
        from_attributes = True


class DoctorScheduleBase(BaseModel):
    doctor_id: int
    schedule_date: date
    start_time: time
    end_time: time
    max_patients: int = 10
    is_available: bool = True


class DoctorScheduleCreate(DoctorScheduleBase):
    pass


class DoctorSchedule(DoctorScheduleBase):
    id: int
    booked_count: int

    class Config:
        from_attributes = True


class TreatmentPlanBase(BaseModel):
    patient_id: int
    doctor_id: Optional[int] = None
    treatment_name: str
    treatment_description: Optional[str] = None
    next_revisit_date: date
    revisit_type: Optional[str] = None
    status: str = "pending"


class TreatmentPlanCreate(TreatmentPlanBase):
    pass


class TreatmentPlan(TreatmentPlanBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ReminderRecordBase(BaseModel):
    patient_id: int
    treatment_plan_id: int
    schedule_id: Optional[int] = None
    reminder_date: date
    reminder_time: Optional[time] = None
    status: str = "pending"
    reminder_type: str = "auto"
    reminder_channel: str = "sms"
    notes: Optional[str] = None


class ReminderRecordCreate(ReminderRecordBase):
    pass


class ReminderRecord(ReminderRecordBase):
    id: int
    retry_count: int
    last_reminder_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MissedAppointmentBase(BaseModel):
    reminder_record_id: int
    miss_date: date
    reason_code: Optional[str] = None
    reason_description: Optional[str] = None
    reported_by: Optional[str] = None
    is_manual: bool = False


class MissedAppointmentCreate(MissedAppointmentBase):
    pass


class MissedAppointment(MissedAppointmentBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RevisitReportBase(BaseModel):
    patient_id: int
    reminder_record_id: Optional[int] = None
    treatment_plan_id: Optional[int] = None
    report_date: date
    doctor_name: Optional[str] = None
    diagnosis: Optional[str] = None
    treatment_result: Optional[str] = None
    next_revisit_date: Optional[date] = None
    created_by: Optional[str] = None


class RevisitReportCreate(RevisitReportBase):
    pass


class RevisitReport(RevisitReportBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ExceptionLogBase(BaseModel):
    operation_type: str
    original_input: str
    error_message: Optional[str] = None
    handler: Optional[str] = None
    conclusion: Optional[str] = None
    is_resolved: bool = False


class ExceptionLogCreate(ExceptionLogBase):
    pass


class ExceptionLog(ExceptionLogBase):
    id: int
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReminderMatchRequest(BaseModel):
    treatment_plan_id: int
    schedule_id: int


class StatusUpdateRequest(BaseModel):
    status: str
    notes: Optional[str] = None
    operator: Optional[str] = None


class ManualCorrectionRequest(BaseModel):
    reminder_date: Optional[date] = None
    reminder_time: Optional[time] = None
    schedule_id: Optional[int] = None
    notes: Optional[str] = None
    operator: str


class MissedAppointmentRequest(BaseModel):
    reason_code: Optional[str] = None
    reason_description: Optional[str] = None
    reported_by: Optional[str] = None


class ExportRequest(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    patient_id: Optional[int] = None


class ReminderStatusHistoryBase(BaseModel):
    reminder_record_id: int
    from_status: Optional[str] = None
    to_status: str
    changed_by: Optional[str] = None
    change_reason: Optional[str] = None


class ReminderStatusHistoryCreate(ReminderStatusHistoryBase):
    pass


class ReminderStatusHistory(ReminderStatusHistoryBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ReminderRecordWithHistory(ReminderRecord):
    status_histories: List[ReminderStatusHistory] = []
