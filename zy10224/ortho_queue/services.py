from datetime import datetime, date, timedelta
from typing import List, Dict, Optional, Tuple
from sqlalchemy import and_, or_
from .database import get_session, Patient, Doctor, Appointment, RescheduleHistory, Reminder
from .config import DEFAULT_MIN_REVIEW_INTERVAL_DAYS

def generate_appointment_code(patient_id: str, appt_date: date, is_emergency: bool = False) -> str:
    prefix = "EMG" if is_emergency else "APT"
    return f"{prefix}-{patient_id}-{appt_date.strftime('%Y%m%d')}"

def get_or_create_doctor(session, name: str, max_daily: int = 8, specialty: str = "正畸") -> Doctor:
    doctor = session.query(Doctor).filter(Doctor.name == name).first()
    if not doctor:
        doctor = Doctor(name=name, max_daily=max_daily, specialty=specialty)
        session.add(doctor)
        session.commit()
        session.refresh(doctor)
    return doctor

def get_or_create_patient(session, patient_id: str, name: str, **kwargs) -> Patient:
    patient = session.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        patient = Patient(patient_id=patient_id, name=name, **kwargs)
        session.add(patient)
        session.commit()
        session.refresh(patient)
    return patient

def get_doctor_daily_appointments(session, doctor_id: int, appt_date: date, exclude_emergency: bool = False) -> List[Appointment]:
    query = session.query(Appointment).filter(
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_date == appt_date,
        Appointment.status.in_(["待确认", "已确认", "急诊"])
    )
    if exclude_emergency:
        query = query.filter(Appointment.is_emergency == False)
    return query.all()

def get_patient_last_appointment(session, patient_id: int) -> Optional[Appointment]:
    return session.query(Appointment).filter(
        Appointment.patient_id == patient_id,
        Appointment.status.in_(["已完成", "已取消", "已改约"])
    ).order_by(Appointment.appointment_date.desc()).first()

def check_conflicts(session, patient_id: int, doctor_id: int, appt_date: date, 
                    is_emergency: bool = False, existing_appt_id: Optional[int] = None) -> List[Dict]:
    conflicts = []
    
    patient = session.query(Patient).filter(Patient.id == patient_id).first()
    doctor = session.query(Doctor).filter(Doctor.id == doctor_id).first()
    
    if not patient or not doctor:
        return conflicts
    
    last_appt = get_patient_last_appointment(session, patient_id)
    if last_appt and not is_emergency:
        min_interval = patient.review_interval_days or DEFAULT_MIN_REVIEW_INTERVAL_DAYS
        days_since_last = (appt_date - last_appt.appointment_date).days
        if days_since_last < min_interval:
            conflicts.append({
                "type": "interval_too_short",
                "severity": "warning",
                "message": f"复诊间隔过短：距上次复诊仅 {days_since_last} 天，建议至少间隔 {min_interval} 天",
                "details": {
                    "last_date": last_appt.appointment_date,
                    "suggested_date": last_appt.appointment_date + timedelta(days=min_interval)
                }
            })
    
    daily_appointments = get_doctor_daily_appointments(session, doctor_id, appt_date)
    if existing_appt_id:
        daily_appointments = [a for a in daily_appointments if a.id != existing_appt_id]
    
    non_emergency_count = sum(1 for a in daily_appointments if not a.is_emergency)
    emergency_count = sum(1 for a in daily_appointments if a.is_emergency)
    
    max_regular = doctor.max_daily
    max_emergency = max(2, int(max_regular * 0.25))
    
    if is_emergency:
        if emergency_count >= max_emergency:
            conflicts.append({
                "type": "doctor_overflow_emergency",
                "severity": "error",
                "message": f"医生 {doctor.name} 当日急诊号已满（已排 {emergency_count} 个，最多 {max_emergency} 个）",
                "details": {"current_count": emergency_count, "max_count": max_emergency}
            })
    else:
        if non_emergency_count >= max_regular:
            conflicts.append({
                "type": "doctor_full",
                "severity": "error",
                "message": f"医生 {doctor.name} 当日号已满（已排 {non_emergency_count} 个，最多 {max_regular} 个）",
                "details": {"current_count": non_emergency_count, "max_count": max_regular}
            })
    
    if is_emergency:
        existing_emergency = session.query(Appointment).filter(
            Appointment.patient_id == patient_id,
            Appointment.appointment_date == appt_date,
            Appointment.is_emergency == True,
            Appointment.id != existing_appt_id if existing_appt_id else True
        ).first()
        if existing_emergency:
            conflicts.append({
                "type": "duplicate_emergency",
                "severity": "error",
                "message": f"该患者当日已有急诊预约（编码：{existing_emergency.appointment_code}）",
                "details": {"existing_code": existing_emergency.appointment_code}
            })
    
    existing_same_day = session.query(Appointment).filter(
        Appointment.patient_id == patient_id,
        Appointment.appointment_date == appt_date,
        Appointment.is_emergency == is_emergency,
        Appointment.status.in_(["待确认", "已确认", "急诊"]),
        Appointment.id != existing_appt_id if existing_appt_id else True
    ).first()
    if existing_same_day:
        conflicts.append({
            "type": "duplicate_appointment",
            "severity": "error",
            "message": f"该患者当日已有{('急诊' if is_emergency else '常规')}预约（编码：{existing_same_day.appointment_code}）",
            "details": {"existing_code": existing_same_day.appointment_code}
        })
    
    return conflicts

def suggest_reschedule_options(session, patient_id: int, doctor_id: int, 
                               original_date: date, is_emergency: bool = False,
                               days_look_ahead: int = 14) -> List[Dict]:
    suggestions = []
    doctor = session.query(Doctor).filter(Doctor.id == doctor_id).first()
    
    if not doctor:
        return suggestions
    
    patient = session.query(Patient).filter(Patient.id == patient_id).first()
    min_interval = patient.review_interval_days if patient else DEFAULT_MIN_REVIEW_INTERVAL_DAYS
    
    start_date = max(original_date + timedelta(days=1), 
                     date.today() + timedelta(days=1))
    
    for offset in range(days_look_ahead):
        check_date = start_date + timedelta(days=offset)
        conflicts = check_conflicts(session, patient_id, doctor_id, check_date, is_emergency)
        
        errors = [c for c in conflicts if c["severity"] == "error"]
        warnings = [c for c in conflicts if c["severity"] == "warning"]
        
        if not errors:
            suggestions.append({
                "date": check_date,
                "available": True,
                "warnings": warnings,
                "conflicts": conflicts
            })
        
        if len(suggestions) >= 3:
            break
    
    return suggestions

def create_appointment(session, patient_id: str, patient_name: str, doctor_name: str,
                       appt_date: date, is_emergency: bool = False,
                       emergency_reason: Optional[str] = None, status: str = "待确认",
                       notes: Optional[str] = None, **patient_kwargs) -> Tuple[Optional[Appointment], List[Dict], bool]:
    doctor = get_or_create_doctor(session, doctor_name)
    patient = get_or_create_patient(session, patient_id, patient_name, **patient_kwargs)
    
    appt_code = generate_appointment_code(patient.patient_id, appt_date, is_emergency)
    
    existing = session.query(Appointment).filter(Appointment.appointment_code == appt_code).first()
    if existing:
        return existing, [], True
    
    conflicts = check_conflicts(session, patient.id, doctor.id, appt_date, is_emergency)
    errors = [c for c in conflicts if c["severity"] == "error"]
    
    if errors:
        return None, conflicts, False
    
    appointment = Appointment(
        appointment_code=appt_code,
        patient_id=patient.id,
        doctor_id=doctor.id,
        appointment_date=appt_date,
        is_emergency=is_emergency,
        emergency_reason=emergency_reason,
        status=status if not is_emergency else "急诊",
        notes=notes
    )
    
    session.add(appointment)
    session.commit()
    session.refresh(appointment)
    
    return appointment, conflicts, False

def reschedule_appointment(session, appointment_code: str, new_date: date,
                           reason: Optional[str] = None) -> Tuple[Optional[Appointment], List[Dict]]:
    appointment = session.query(Appointment).filter(
        Appointment.appointment_code == appointment_code
    ).first()
    
    if not appointment:
        return None, [{"type": "not_found", "severity": "error", "message": "未找到该预约"}]
    
    if appointment.status in ["已完成", "已取消"]:
        return None, [{"type": "invalid_status", "severity": "error", 
                       "message": f"该预约状态为{appointment.status}，无法改约"}]
    
    conflicts = check_conflicts(session, appointment.patient_id, appointment.doctor_id, 
                                new_date, appointment.is_emergency, 
                                existing_appt_id=appointment.id)
    errors = [c for c in conflicts if c["severity"] == "error"]
    
    if errors:
        return None, conflicts
    
    history = RescheduleHistory(
        appointment_id=appointment.id,
        original_date=appointment.appointment_date,
        new_date=new_date,
        reason=reason
    )
    session.add(history)
    
    for reminder in appointment.reminders:
        if not reminder.is_withdrawn:
            reminder.is_withdrawn = True
            reminder.notes = f"预约改约，提醒已撤回" if not reminder.notes else reminder.notes + "；预约改约，提醒已撤回"
    
    appointment.appointment_date = new_date
    appointment.appointment_code = generate_appointment_code(
        appointment.patient.patient_id, new_date, appointment.is_emergency
    )
    if appointment.status not in ["急诊"]:
        appointment.status = "待确认"
    
    session.commit()
    session.refresh(appointment)
    
    return appointment, conflicts

def cancel_appointment(session, appointment_code: str, reason: Optional[str] = None) -> Tuple[Optional[Appointment], List[Dict]]:
    appointment = session.query(Appointment).filter(
        Appointment.appointment_code == appointment_code
    ).first()
    
    if not appointment:
        return None, [{"type": "not_found", "severity": "error", "message": "未找到该预约"}]
    
    if appointment.status == "已完成":
        return None, [{"type": "invalid_status", "severity": "error", 
                       "message": "该预约已完成，无法取消"}]
    
    for reminder in appointment.reminders:
        if not reminder.is_withdrawn:
            reminder.is_withdrawn = True
            reminder.notes = f"预约取消，提醒已撤回" if not reminder.notes else reminder.notes + "；预约取消，提醒已撤回"
    
    appointment.status = "已取消"
    if reason:
        appointment.notes = f"取消原因：{reason}" if not appointment.notes else appointment.notes + f"；取消原因：{reason}"
    
    session.commit()
    session.refresh(appointment)
    
    return appointment, []

def create_reminder(session, appointment_code: str, reminder_date: date,
                    reminder_type: str = "短信") -> Tuple[Optional[Reminder], List[Dict]]:
    appointment = session.query(Appointment).filter(
        Appointment.appointment_code == appointment_code
    ).first()
    
    if not appointment:
        return None, [{"type": "not_found", "severity": "error", "message": "未找到该预约"}]
    
    if appointment.status in ["已取消", "已完成"]:
        return None, [{"type": "invalid_status", "severity": "error", 
                       "message": f"该预约状态为{appointment.status}，无需创建提醒"}]
    
    existing = session.query(Reminder).filter(
        Reminder.appointment_id == appointment.id,
        Reminder.reminder_date == reminder_date,
        Reminder.reminder_type == reminder_type
    ).first()
    
    if existing:
        return existing, []
    
    reminder = Reminder(
        appointment_id=appointment.id,
        reminder_type=reminder_type,
        reminder_date=reminder_date
    )
    
    session.add(reminder)
    session.commit()
    session.refresh(reminder)
    
    return reminder, []

def get_today_queue(session, target_date: Optional[date] = None) -> Dict:
    target_date = target_date or date.today()
    
    appointments = session.query(Appointment).filter(
        Appointment.appointment_date == target_date,
        Appointment.status.in_(["待确认", "已确认", "急诊"])
    ).order_by(
        Appointment.is_emergency.desc(),
        Appointment.patient_id.asc()
    ).all()
    
    all_conflicts = []
    for appt in appointments:
        conflicts = check_conflicts(session, appt.patient_id, appt.doctor_id, 
                                    target_date, appt.is_emergency, 
                                    existing_appt_id=appt.id)
        if conflicts:
            all_conflicts.append({
                "appointment_code": appt.appointment_code,
                "patient_name": appt.patient.name,
                "doctor_name": appt.doctor.name,
                "is_emergency": appt.is_emergency,
                "conflicts": conflicts
            })
    
    doctors = session.query(Doctor).filter(Doctor.is_active == True).all()
    doctor_summary = []
    for doctor in doctors:
        daily = get_doctor_daily_appointments(session, doctor.id, target_date)
        regular_count = sum(1 for a in daily if not a.is_emergency)
        emergency_count = sum(1 for a in daily if a.is_emergency)
        doctor_summary.append({
            "doctor_name": doctor.name,
            "max_daily": doctor.max_daily,
            "regular_count": regular_count,
            "emergency_count": emergency_count,
            "total_count": len(daily),
            "is_full": regular_count >= doctor.max_daily
        })
    
    return {
        "date": target_date,
        "appointments": appointments,
        "conflicts": all_conflicts,
        "doctor_summary": doctor_summary
    }

def get_reminder_list(session, target_date: Optional[date] = None, 
                      include_withdrawn: bool = False) -> List[Dict]:
    target_date = target_date or date.today()
    
    query = session.query(Reminder).filter(
        Reminder.reminder_date == target_date
    )
    
    if not include_withdrawn:
        query = query.filter(Reminder.is_withdrawn == False)
    
    reminders = query.order_by(Reminder.reminder_type.asc()).all()
    
    result = []
    for r in reminders:
        appt = r.appointment
        patient = appt.patient
        result.append({
            "reminder_id": r.id,
            "appointment_code": appt.appointment_code,
            "patient_id": patient.patient_id,
            "patient_name": patient.name,
            "patient_phone": patient.phone,
            "reminder_type": r.reminder_type,
            "appointment_date": appt.appointment_date,
            "is_emergency": appt.is_emergency,
            "is_sent": r.is_sent,
            "is_withdrawn": r.is_withdrawn
        })
    
    return result
