from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
import models, schemas
from datetime import datetime
import json


def get_or_create_student(db: Session, student_id: str, name: str = None):
    student = db.query(models.Student).filter(models.Student.student_id == student_id).first()
    if not student:
        student = models.Student(student_id=student_id, name=name or student_id)
        db.add(student)
        db.commit()
        db.refresh(student)
    return student


def get_or_create_session(db: Session, session_code: str, course_name: str = None):
    session = db.query(models.CourseSession).filter(models.CourseSession.session_code == session_code).first()
    if not session:
        session = models.CourseSession(
            session_code=session_code,
            course_name=course_name or session_code,
            session_date=datetime.utcnow()
        )
        db.add(session)
        db.commit()
        db.refresh(session)
    return session


def create_attendance_record(db: Session, attendance: schemas.AttendanceRecordCreate):
    student = get_or_create_student(db, attendance.student_id)
    course_session = get_or_create_session(db, attendance.session_code)
    
    db_attendance = models.AttendanceRecord(
        session_id=course_session.id,
        student_id=student.id,
        sign_in_time=attendance.sign_in_time,
        sign_out_time=attendance.sign_out_time,
        status=attendance.status,
        source=attendance.source
    )
    db.add(db_attendance)
    db.commit()
    db.refresh(db_attendance)
    
    check_and_create_conflict(db, course_session.id, student.id)
    
    db_attendance = db.query(models.AttendanceRecord).options(
        joinedload(models.AttendanceRecord.session),
        joinedload(models.AttendanceRecord.student)
    ).filter(models.AttendanceRecord.id == db_attendance.id).first()
    
    return db_attendance


def create_makeup_sign(db: Session, makeup: schemas.MakeUpSignCreate):
    student = get_or_create_student(db, makeup.student_id)
    course_session = get_or_create_session(db, makeup.session_code)
    
    db_makeup = models.MakeUpSign(
        session_id=course_session.id,
        student_id=student.id,
        teacher_id=makeup.teacher_id,
        teacher_name=makeup.teacher_name,
        reason=makeup.reason,
        sign_date=makeup.sign_date,
        status=makeup.status
    )
    db.add(db_makeup)
    db.commit()
    db.refresh(db_makeup)
    
    check_and_create_conflict(db, course_session.id, student.id)
    
    db_makeup = db.query(models.MakeUpSign).options(
        joinedload(models.MakeUpSign.session),
        joinedload(models.MakeUpSign.student)
    ).filter(models.MakeUpSign.id == db_makeup.id).first()
    
    return db_makeup


def check_and_create_conflict(db: Session, session_id: int, student_id: int):
    attendance = db.query(models.AttendanceRecord).filter(
        and_(
            models.AttendanceRecord.session_id == session_id,
            models.AttendanceRecord.student_id == student_id
        )
    ).first()
    
    makeup = db.query(models.MakeUpSign).filter(
        and_(
            models.MakeUpSign.session_id == session_id,
            models.MakeUpSign.student_id == student_id
        )
    ).first()
    
    if not attendance or not makeup:
        return None
    
    existing_conflict = db.query(models.ConflictRecord).filter(
        and_(
            models.ConflictRecord.session_id == session_id,
            models.ConflictRecord.student_id == student_id,
            models.ConflictRecord.status == "pending"
        )
    ).first()
    
    if existing_conflict:
        return existing_conflict
    
    conflict_type, conflict_reason = determine_conflict_type(attendance, makeup)
    
    db_conflict = models.ConflictRecord(
        session_id=session_id,
        student_id=student_id,
        attendance_record_id=attendance.id,
        make_up_sign_id=makeup.id,
        conflict_type=conflict_type,
        conflict_reason=conflict_reason,
        status="pending",
        original_attendance_data=json.dumps({
            "sign_in_time": attendance.sign_in_time.isoformat() if attendance.sign_in_time else None,
            "sign_out_time": attendance.sign_out_time.isoformat() if attendance.sign_out_time else None,
            "status": attendance.status,
            "source": attendance.source
        }),
        original_makeup_data=json.dumps({
            "teacher_id": makeup.teacher_id,
            "teacher_name": makeup.teacher_name,
            "reason": makeup.reason,
            "sign_date": makeup.sign_date.isoformat() if makeup.sign_date else None,
            "status": makeup.status
        })
    )
    db.add(db_conflict)
    db.commit()
    db.refresh(db_conflict)
    
    return db_conflict


def determine_conflict_type(attendance: models.AttendanceRecord, makeup: models.MakeUpSign):
    if attendance.status == "absent" and makeup.status in ["pending", "approved"]:
        return "absent_vs_makeup", "签到机显示缺勤但老师已补签"
    
    if attendance.status == "present" and makeup.status in ["pending", "approved"]:
        return "present_vs_makeup", "签到机显示已签到但老师也补签了"
    
    if attendance.status == "late" and makeup.status in ["pending", "approved"]:
        return "late_vs_makeup", "签到机显示迟到但老师已补签"
    
    return "general_conflict", "签到记录与补签表存在冲突需要人工确认"


def resolve_conflict(db: Session, conflict_id: int, resolve_data: schemas.ConflictResolve):
    conflict = db.query(models.ConflictRecord).filter(models.ConflictRecord.id == conflict_id).first()
    if not conflict:
        return None
    
    conflict.status = "resolved"
    conflict.resolved_by = resolve_data.resolved_by
    conflict.resolved_at = datetime.utcnow()
    conflict.resolution = resolve_data.resolution
    
    if resolve_data.choose_makeup and conflict.make_up_sign_id:
        makeup = db.query(models.MakeUpSign).filter(models.MakeUpSign.id == conflict.make_up_sign_id).first()
        if makeup:
            makeup.status = "approved"
        if conflict.attendance_record_id:
            attendance = db.query(models.AttendanceRecord).filter(models.AttendanceRecord.id == conflict.attendance_record_id).first()
            if attendance:
                attendance.status = "makeup"
    else:
        if conflict.attendance_record_id:
            attendance = db.query(models.AttendanceRecord).filter(models.AttendanceRecord.id == conflict.attendance_record_id).first()
            if attendance:
                attendance.status = "present"
        if conflict.make_up_sign_id:
            makeup = db.query(models.MakeUpSign).filter(models.MakeUpSign.id == conflict.make_up_sign_id).first()
            if makeup:
                makeup.status = "rejected"
    
    db.commit()
    db.refresh(conflict)
    return conflict


def merge_attendance_records(db: Session, session_id: int, student_id: int):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    course_session = db.query(models.CourseSession).filter(models.CourseSession.id == session_id).first()
    
    attendance = db.query(models.AttendanceRecord).filter(
        and_(
            models.AttendanceRecord.session_id == session_id,
            models.AttendanceRecord.student_id == student_id
        )
    ).first()
    
    makeup = db.query(models.MakeUpSign).filter(
        and_(
            models.MakeUpSign.session_id == session_id,
            models.MakeUpSign.student_id == student_id
        )
    ).first()
    
    conflict = db.query(models.ConflictRecord).filter(
        and_(
            models.ConflictRecord.session_id == session_id,
            models.ConflictRecord.student_id == student_id,
            models.ConflictRecord.status == "pending"
        )
    ).first()
    
    final_status = "unknown"
    message = ""
    conflict_detected = False
    
    if makeup and makeup.status == "approved":
        final_status = "makeup"
        message = "以补签记录为准"
    elif attendance:
        final_status = attendance.status
        message = "以签到机记录为准"
    elif makeup and makeup.status == "pending":
        final_status = "pending"
        message = "补签待审核"
    else:
        final_status = "absent"
        message = "无有效签到记录"
    
    if conflict:
        conflict_detected = True
        message += " - 存在待处理冲突"
    
    return schemas.MergeResult(
        student_id=student.student_id if student else "",
        session_code=course_session.session_code if course_session else "",
        final_status=final_status,
        conflict_detected=conflict_detected,
        conflict_id=conflict.id if conflict else None,
        message=message
    )


def calculate_attendance_stats(db: Session, session_code: str = None, student_id: str = None):
    query = db.query(models.Student)
    if student_id:
        query = query.filter(models.Student.student_id == student_id)
    
    students = query.all()
    stats_list = []
    
    for student in students:
        total_sessions = db.query(models.CourseSession).count()
        
        machine_attended = db.query(models.AttendanceRecord).filter(
            and_(
                models.AttendanceRecord.student_id == student.id,
                models.AttendanceRecord.status == "present"
            )
        ).count()
        
        makeup_attended = db.query(models.MakeUpSign).filter(
            and_(
                models.MakeUpSign.student_id == student.id,
                models.MakeUpSign.status == "approved"
            )
        ).count()
        
        conflict_count = db.query(models.ConflictRecord).filter(
            models.ConflictRecord.student_id == student.id
        ).count()
        
        total_attended = machine_attended + makeup_attended
        attendance_rate = total_attended / total_sessions if total_sessions > 0 else 0
        
        is_eligible = attendance_rate >= 0.8
        
        stats = schemas.AttendanceStats(
            student_id=student.student_id,
            student_name=student.name,
            total_sessions=total_sessions,
            machine_attended=machine_attended,
            makeup_attended=makeup_attended,
            total_attended=total_attended,
            attendance_rate=round(attendance_rate, 2),
            conflict_count=conflict_count,
            is_eligible=is_eligible
        )
        stats_list.append(stats)
    
    return stats_list


def generate_graduation_report(db: Session, generate_data: schemas.GraduationReportGenerate):
    session_code = generate_data.session_code
    student_id = generate_data.student_id
    
    course_session = None
    if session_code:
        course_session = db.query(models.CourseSession).filter(
            models.CourseSession.session_code == session_code
        ).first()
    
    student_query = db.query(models.Student)
    if student_id:
        student_query = student_query.filter(models.Student.student_id == student_id)
    students = student_query.all()
    
    reports = []
    
    for student in students:
        total_sessions = db.query(models.CourseSession).count()
        
        attended_query = db.query(models.AttendanceRecord).filter(
            models.AttendanceRecord.student_id == student.id,
            models.AttendanceRecord.status == "present"
        )
        
        if course_session:
            attended_query = attended_query.filter(models.AttendanceRecord.session_id == course_session.id)
        
        attended_sessions = attended_query.count()
        
        makeup_query = db.query(models.MakeUpSign).filter(
            models.MakeUpSign.student_id == student.id,
            models.MakeUpSign.status == "approved"
        )
        if course_session:
            makeup_query = makeup_query.filter(models.MakeUpSign.session_id == course_session.id)
        
        makeup_count = makeup_query.count()
        total_attended = attended_sessions + makeup_count
        
        conflict_query = db.query(models.ConflictRecord).filter(
            models.ConflictRecord.student_id == student.id
        )
        if course_session:
            conflict_query = conflict_query.filter(models.ConflictRecord.session_id == course_session.id)
        conflict_count = conflict_query.count()
        
        attendance_rate = total_attended / total_sessions if total_sessions > 0 else 0
        
        is_eligible = attendance_rate >= 0.8
        
        if is_eligible:
            eligibility_reason = f"出勤率{attendance_rate:.1%}，达到80%要求"
        else:
            eligibility_reason = f"出勤率{attendance_rate:.1%}，未达到80%要求"
        
        report = models.GraduationReport(
            session_id=course_session.id if course_session else None,
            student_id=student.id,
            total_sessions=total_sessions,
            attended_sessions=attended_sessions,
            attendance_rate=attendance_rate,
            make_up_count=makeup_count,
            conflict_count=conflict_count,
            is_eligible=is_eligible,
            eligibility_reason=eligibility_reason,
            generated_by=generate_data.generated_by
        )
        db.add(report)
        reports.append(report)
    
    db.commit()
    
    report_ids = [report.id for report in reports]
    reports = db.query(models.GraduationReport).options(
        joinedload(models.GraduationReport.session),
        joinedload(models.GraduationReport.student)
    ).filter(models.GraduationReport.id.in_(report_ids)).all()
    
    return reports


def log_exception(db: Session, exception_data: schemas.ExceptionLogCreate):
    db_exception = models.ExceptionLog(
        operation_type=exception_data.operation_type,
        original_input=exception_data.original_input,
        handler=exception_data.handler,
        conclusion=exception_data.conclusion,
        error_message=exception_data.error_message
    )
    db.add(db_exception)
    db.commit()
    db.refresh(db_exception)
    return db_exception


def get_pending_conflicts(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.ConflictRecord).filter(
        models.ConflictRecord.status == "pending"
    ).offset(skip).limit(limit).all()


def withdraw_makeup(db: Session, makeup_id: int):
    makeup = db.query(models.MakeUpSign).filter(models.MakeUpSign.id == makeup_id).first()
    if not makeup:
        return None
    
    makeup.status = "withdrawn"
    
    conflicts = db.query(models.ConflictRecord).filter(
        and_(
            models.ConflictRecord.make_up_sign_id == makeup_id,
            models.ConflictRecord.status == "pending"
        )
    ).all()
    
    for conflict in conflicts:
        conflict.status = "closed"
        conflict.resolution = "补签已撤回"
    
    db.commit()
    
    makeup = db.query(models.MakeUpSign).options(
        joinedload(models.MakeUpSign.session),
        joinedload(models.MakeUpSign.student)
    ).filter(models.MakeUpSign.id == makeup_id).first()
    
    return makeup


def close_conflict(db: Session, conflict_id: int, resolved_by: str):
    conflict = db.query(models.ConflictRecord).filter(models.ConflictRecord.id == conflict_id).first()
    if not conflict:
        return None
    
    conflict.status = "closed"
    conflict.resolved_by = resolved_by
    conflict.resolved_at = datetime.utcnow()
    conflict.resolution = "人工关闭"
    
    db.commit()
    db.refresh(conflict)
    return conflict
