from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import date, datetime, timedelta
import json
import models
import schemas


REMINDER_WINDOW_DAYS = 7
MAX_RETRY_COUNT = 3


def log_exception(db: Session, operation_type: str, original_input: dict, error_message: str = None):
    exception_log = models.ExceptionLog(
        operation_type=operation_type,
        original_input=json.dumps(original_input, ensure_ascii=False),
        error_message=error_message
    )
    db.add(exception_log)
    db.commit()
    db.refresh(exception_log)
    return exception_log


def resolve_exception(db: Session, exception_id: int, handler: str, conclusion: str):
    exception_log = db.query(models.ExceptionLog).filter(models.ExceptionLog.id == exception_id).first()
    if exception_log:
        exception_log.handler = handler
        exception_log.conclusion = conclusion
        exception_log.is_resolved = True
        exception_log.resolved_at = datetime.now()
        db.commit()
        db.refresh(exception_log)
    return exception_log


def create_patient(db: Session, patient: schemas.PatientCreate):
    try:
        db_patient = models.Patient(**patient.model_dump())
        db.add(db_patient)
        db.commit()
        db.refresh(db_patient)
        return db_patient
    except Exception as e:
        log_exception(db, "create_patient", patient.model_dump(), str(e))
        raise


def get_patient(db: Session, patient_id: int):
    return db.query(models.Patient).filter(models.Patient.id == patient_id).first()


def get_patients(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Patient).offset(skip).limit(limit).all()


def create_doctor(db: Session, doctor: schemas.DoctorCreate):
    db_doctor = models.Doctor(**doctor.model_dump())
    db.add(db_doctor)
    db.commit()
    db.refresh(db_doctor)
    return db_doctor


def get_doctor(db: Session, doctor_id: int):
    return db.query(models.Doctor).filter(models.Doctor.id == doctor_id).first()


def get_doctors(db: Session):
    return db.query(models.Doctor).all()


def create_doctor_schedule(db: Session, schedule: schemas.DoctorScheduleCreate):
    try:
        existing = db.query(models.DoctorSchedule).filter(
            and_(
                models.DoctorSchedule.doctor_id == schedule.doctor_id,
                models.DoctorSchedule.schedule_date == schedule.schedule_date
            )
        ).first()
        if existing:
            raise ValueError("该医生当日已有排班")
        
        db_schedule = models.DoctorSchedule(**schedule.model_dump(), booked_count=0)
        db.add(db_schedule)
        db.commit()
        db.refresh(db_schedule)
        return db_schedule
    except Exception as e:
        log_exception(db, "create_doctor_schedule", schedule.model_dump(), str(e))
        raise


def get_available_schedules(db: Session, target_date: date = None, doctor_id: int = None):
    query = db.query(models.DoctorSchedule).filter(models.DoctorSchedule.is_available == True)
    if target_date:
        query = query.filter(models.DoctorSchedule.schedule_date == target_date)
    if doctor_id:
        query = query.filter(models.DoctorSchedule.doctor_id == doctor_id)
    query = query.filter(models.DoctorSchedule.booked_count < models.DoctorSchedule.max_patients)
    return query.all()


def create_treatment_plan(db: Session, plan: schemas.TreatmentPlanCreate):
    try:
        db_plan = models.TreatmentPlan(**plan.model_dump())
        db.add(db_plan)
        db.commit()
        db.refresh(db_plan)
        return db_plan
    except Exception as e:
        log_exception(db, "create_treatment_plan", plan.model_dump(), str(e))
        raise


def get_treatment_plan(db: Session, plan_id: int):
    return db.query(models.TreatmentPlan).filter(models.TreatmentPlan.id == plan_id).first()


def get_pending_treatment_plans(db: Session):
    today = date.today()
    window_end = today + timedelta(days=REMINDER_WINDOW_DAYS)
    return db.query(models.TreatmentPlan).filter(
        and_(
            models.TreatmentPlan.next_revisit_date >= today,
            models.TreatmentPlan.next_revisit_date <= window_end,
            models.TreatmentPlan.status == "pending"
        )
    ).all()


def check_duplicate_reminder(db: Session, treatment_plan_id: int, reminder_date: date):
    return db.query(models.ReminderRecord).filter(
        and_(
            models.ReminderRecord.treatment_plan_id == treatment_plan_id,
            models.ReminderRecord.reminder_date == reminder_date,
            models.ReminderRecord.status.in_([
                models.ReminderStatus.PENDING,
                models.ReminderStatus.SCHEDULED,
                models.ReminderStatus.SENT,
                models.ReminderStatus.CONFIRMED
            ])
        )
    ).first()


def match_schedule_for_reminder(db: Session, treatment_plan_id: int, schedule_id: int):
    plan = get_treatment_plan(db, treatment_plan_id)
    if not plan:
        raise ValueError("治疗计划不存在")
    
    schedule = db.query(models.DoctorSchedule).filter(models.DoctorSchedule.id == schedule_id).first()
    if not schedule:
        raise ValueError("排班不存在")
    
    if not schedule.is_available:
        raise ValueError("该排班已不可用")
    
    if schedule.booked_count >= schedule.max_patients:
        raise ValueError("该排班级已满")
    
    if check_duplicate_reminder(db, treatment_plan_id, schedule.schedule_date):
        raise ValueError("该治疗计划在该日期已有提醒")
    
    reminder = schemas.ReminderRecordCreate(
        patient_id=plan.patient_id,
        treatment_plan_id=treatment_plan_id,
        schedule_id=schedule_id,
        reminder_date=schedule.schedule_date,
        reminder_time=schedule.start_time,
        status=models.ReminderStatus.SCHEDULED,
        reminder_type="auto"
    )
    
    schedule.booked_count += 1
    db.commit()
    
    return create_reminder_record(db, reminder)


def create_reminder_record(db: Session, reminder: schemas.ReminderRecordCreate):
    try:
        if check_duplicate_reminder(db, reminder.treatment_plan_id, reminder.reminder_date):
            raise ValueError("该治疗计划在该日期已有有效提醒")
        
        db_reminder = models.ReminderRecord(**reminder.model_dump(), retry_count=0)
        db.add(db_reminder)
        db.commit()
        db.refresh(db_reminder)
        return db_reminder
    except Exception as e:
        log_exception(db, "create_reminder_record", reminder.model_dump(), str(e))
        raise


def get_reminder_record(db: Session, reminder_id: int):
    return db.query(models.ReminderRecord).filter(models.ReminderRecord.id == reminder_id).first()


def get_reminder_records(db: Session, patient_id: int = None, status: str = None, 
                         start_date: date = None, end_date: date = None):
    query = db.query(models.ReminderRecord)
    if patient_id:
        query = query.filter(models.ReminderRecord.patient_id == patient_id)
    if status:
        query = query.filter(models.ReminderRecord.status == status)
    if start_date:
        query = query.filter(models.ReminderRecord.reminder_date >= start_date)
    if end_date:
        query = query.filter(models.ReminderRecord.reminder_date <= end_date)
    return query.all()


def update_reminder_status(db: Session, reminder_id: int, status: str, notes: str = None, operator: str = None):
    try:
        reminder = get_reminder_record(db, reminder_id)
        if not reminder:
            raise ValueError("提醒记录不存在")
        
        valid_statuses = [
            models.ReminderStatus.PENDING,
            models.ReminderStatus.SCHEDULED,
            models.ReminderStatus.SENT,
            models.ReminderStatus.CONFIRMED,
            models.ReminderStatus.CANCELLED,
            models.ReminderStatus.MISSED,
            models.ReminderStatus.COMPLETED
        ]
        if status not in valid_statuses:
            raise ValueError(f"无效状态: {status}")
        
        reminder.status = status
        if notes:
            reminder.notes = (reminder.notes or "") + f"\n[{operator or 'system'}] {notes}"
        
        if status == models.ReminderStatus.CONFIRMED:
            reminder.confirmed_at = datetime.now()
        
        if status == models.ReminderStatus.SENT:
            reminder.last_reminder_at = datetime.now()
            reminder.retry_count += 1
        
        db.commit()
        db.refresh(reminder)
        
        if status == models.ReminderStatus.MISSED:
            create_missed_appointment(db, schemas.MissedAppointmentCreate(
                reminder_record_id=reminder_id,
                miss_date=reminder.reminder_date,
                reported_by=operator or "system"
            ))
        
        return reminder
    except Exception as e:
        log_exception(db, "update_reminder_status", 
                     {"reminder_id": reminder_id, "status": status, "notes": notes, "operator": operator}, 
                     str(e))
        raise


def manual_correct_reminder(db: Session, reminder_id: int, correction: schemas.ManualCorrectionRequest):
    try:
        reminder = get_reminder_record(db, reminder_id)
        if not reminder:
            raise ValueError("提醒记录不存在")
        
        if correction.reminder_date:
            reminder.reminder_date = correction.reminder_date
        if correction.reminder_time:
            reminder.reminder_time = correction.reminder_time
        
        if correction.schedule_id and correction.schedule_id != reminder.schedule_id:
            if reminder.schedule_id:
                old_schedule = db.query(models.DoctorSchedule).filter(
                    models.DoctorSchedule.id == reminder.schedule_id
                ).first()
                if old_schedule:
                    old_schedule.booked_count = max(0, old_schedule.booked_count - 1)
            
            new_schedule = db.query(models.DoctorSchedule).filter(
                models.DoctorSchedule.id == correction.schedule_id
            ).first()
            if not new_schedule or not new_schedule.is_available:
                raise ValueError("新排班不可用")
            if new_schedule.booked_count >= new_schedule.max_patients:
                raise ValueError("新排班级已满")
            
            new_schedule.booked_count += 1
            reminder.schedule_id = correction.schedule_id
            reminder.reminder_date = new_schedule.schedule_date
            reminder.reminder_time = new_schedule.start_time
        
        if correction.notes:
            reminder.notes = (reminder.notes or "") + f"\n[人工修正 by {correction.operator}] {correction.notes}"
        
        reminder.reminder_type = "manual"
        db.commit()
        db.refresh(reminder)
        return reminder
    except Exception as e:
        log_exception(db, "manual_correct_reminder", 
                     {"reminder_id": reminder_id, **correction.model_dump()}, 
                     str(e))
        raise


def cancel_reminder(db: Session, reminder_id: int, operator: str = None, reason: str = None):
    reminder = get_reminder_record(db, reminder_id)
    if not reminder:
        raise ValueError("提醒记录不存在")
    
    if reminder.schedule_id:
        schedule = db.query(models.DoctorSchedule).filter(
            models.DoctorSchedule.id == reminder.schedule_id
        ).first()
        if schedule:
            schedule.booked_count = max(0, schedule.booked_count - 1)
    
    return update_reminder_status(db, reminder_id, models.ReminderStatus.CANCELLED, 
                                 reason or "撤回提醒", operator)


def create_missed_appointment(db: Session, missed: schemas.MissedAppointmentCreate):
    db_missed = models.MissedAppointment(**missed.model_dump())
    db.add(db_missed)
    db.commit()
    db.refresh(db_missed)
    return db_missed


def get_missed_appointments(db: Session, patient_id: int = None, start_date: date = None, end_date: date = None):
    query = db.query(models.MissedAppointment).join(models.ReminderRecord)
    if patient_id:
        query = query.filter(models.ReminderRecord.patient_id == patient_id)
    if start_date:
        query = query.filter(models.MissedAppointment.miss_date >= start_date)
    if end_date:
        query = query.filter(models.MissedAppointment.miss_date <= end_date)
    return query.all()


def create_revisit_report(db: Session, report: schemas.RevisitReportCreate):
    db_report = models.RevisitReport(**report.model_dump())
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    
    if report.reminder_record_id:
        update_reminder_status(db, report.reminder_record_id, models.ReminderStatus.COMPLETED, 
                              "已完成复诊", report.created_by)
    
    if report.treatment_plan_id and report.next_revisit_date:
        plan = get_treatment_plan(db, report.treatment_plan_id)
        if plan:
            plan.next_revisit_date = report.next_revisit_date
            plan.status = "pending"
            db.commit()
    
    return db_report


def get_revisit_reports(db: Session, patient_id: int = None, start_date: date = None, end_date: date = None):
    query = db.query(models.RevisitReport)
    if patient_id:
        query = query.filter(models.RevisitReport.patient_id == patient_id)
    if start_date:
        query = query.filter(models.RevisitReport.report_date >= start_date)
    if end_date:
        query = query.filter(models.RevisitReport.report_date <= end_date)
    return query.all()


def export_reminder_data(db: Session, start_date: date = None, end_date: date = None, 
                        status: str = None, patient_id: int = None):
    reminders = get_reminder_records(db, patient_id, status, start_date, end_date)
    result = []
    for r in reminders:
        patient = get_patient(db, r.patient_id)
        schedule = db.query(models.DoctorSchedule).filter(models.DoctorSchedule.id == r.schedule_id).first() if r.schedule_id else None
        doctor = get_doctor(db, schedule.doctor_id) if schedule else None
        
        result.append({
            "id": r.id,
            "patient_name": patient.name if patient else "",
            "patient_phone": patient.phone if patient else "",
            "reminder_date": str(r.reminder_date),
            "reminder_time": str(r.reminder_time) if r.reminder_time else "",
            "status": r.status,
            "doctor_name": doctor.name if doctor else "",
            "retry_count": r.retry_count,
            "created_at": str(r.created_at)
        })
    return result
