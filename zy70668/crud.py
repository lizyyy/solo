from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
import models, schemas
import json
from datetime import datetime


def get_student_by_student_id(db: Session, student_id: str):
    return db.query(models.Student).filter(models.Student.student_id == student_id).first()


def create_student(db: Session, student: schemas.StudentCreate):
    db_student = models.Student(**student.model_dump())
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    return db_student


def get_activity_type_by_code(db: Session, code: str):
    return db.query(models.ActivityType).filter(models.ActivityType.code == code).first()


def create_activity_type(db: Session, activity_type: schemas.ActivityTypeCreate):
    db_activity_type = models.ActivityType(**activity_type.model_dump())
    db.add(db_activity_type)
    db.commit()
    db.refresh(db_activity_type)
    return db_activity_type


def check_duplicate_application(db: Session, student_id: int, activity_type_id: int, activity_name: str):
    return db.query(models.CreditApplication).filter(
        models.CreditApplication.student_id == student_id,
        models.CreditApplication.activity_type_id == activity_type_id,
        models.CreditApplication.activity_name == activity_name,
        models.CreditApplication.status != "withdrawn"
    ).first()


def create_credit_application(db: Session, application: schemas.CreditApplicationCreate):
    student = get_student_by_student_id(db, application.student_id)
    if not student:
        return None
    
    activity_type = get_activity_type_by_code(db, application.activity_type_code)
    if not activity_type:
        return None
    
    app_data = application.model_dump()
    app_data.pop("student_id")
    app_data.pop("activity_type_code")
    app_data["student_id"] = student.id
    app_data["activity_type_id"] = activity_type.id
    
    duplicate = check_duplicate_application(db, student.id, activity_type.id, application.activity_name)
    
    db_application = models.CreditApplication(**app_data)
    if duplicate:
        db_application.is_duplicate = True
        db_application.duplicate_of = duplicate.id
        db_application.status = "rejected"
    
    db.add(db_application)
    db.commit()
    db.refresh(db_application)
    
    if duplicate:
        rejection = models.RejectionReason(
            application_id=db_application.id,
            reason="重复活动申请",
            handler="system",
            original_input=json.dumps(application.model_dump(), ensure_ascii=False),
            conclusion=f"检测到与申请ID={duplicate.id}重复，已自动驳回"
        )
        db.add(rejection)
        db.commit()
    
    audit_log = models.AuditLog(
        application_id=db_application.id,
        action="create",
        handler="student",
        previous_status=None,
        new_status=db_application.status,
        original_data=json.dumps(application.model_dump(), ensure_ascii=False)
    )
    db.add(audit_log)
    db.commit()
    
    return db_application


def get_credit_application(db: Session, application_id: int):
    return db.query(models.CreditApplication).filter(models.CreditApplication.id == application_id).first()


def get_credit_applications_by_student(db: Session, student_id: str, skip: int = 0, limit: int = 100):
    student = get_student_by_student_id(db, student_id)
    if not student:
        return []
    return db.query(models.CreditApplication).filter(
        models.CreditApplication.student_id == student.id
    ).offset(skip).limit(limit).all()


def update_application_status(db: Session, application_id: int, status_update: schemas.StatusUpdate):
    application = get_credit_application(db, application_id)
    if not application:
        return None
    
    previous_status = application.status
    application.status = status_update.new_status
    
    audit_log = models.AuditLog(
        application_id=application_id,
        action="status_update",
        handler=status_update.handler,
        previous_status=previous_status,
        new_status=status_update.new_status,
        comment=status_update.comment
    )
    db.add(audit_log)
    
    if status_update.new_status == "rejected" and status_update.rejection_reason:
        rejection = models.RejectionReason(
            application_id=application_id,
            reason=status_update.rejection_reason,
            handler=status_update.handler,
            conclusion=f"人工审核驳回，处理人：{status_update.handler}"
        )
        db.add(rejection)
    
    db.commit()
    db.refresh(application)
    return application


def manual_correct_credit(db: Session, application_id: int, correction: schemas.ManualCorrection):
    application = get_credit_application(db, application_id)
    if not application:
        return None
    
    original_credit = application.credit
    application.credit = correction.new_credit
    
    audit_log = models.AuditLog(
        application_id=application_id,
        action="manual_correction",
        handler=correction.handler,
        previous_status=application.status,
        new_status=application.status,
        comment=correction.comment,
        original_data=json.dumps({
            "original_credit": original_credit,
            "new_credit": correction.new_credit,
            "original_input": correction.original_input
        }, ensure_ascii=False)
    )
    db.add(audit_log)
    db.commit()
    db.refresh(application)
    return application


def withdraw_application(db: Session, application_id: int, handler: str):
    application = get_credit_application(db, application_id)
    if not application:
        return None
    
    previous_status = application.status
    application.status = "withdrawn"
    
    audit_log = models.AuditLog(
        application_id=application_id,
        action="withdraw",
        handler=handler,
        previous_status=previous_status,
        new_status="withdrawn"
    )
    db.add(audit_log)
    db.commit()
    db.refresh(application)
    return application


def calculate_student_credit(db: Session, student_id: str):
    student = get_student_by_student_id(db, student_id)
    if not student:
        return None
    
    applications = db.query(models.CreditApplication).filter(
        models.CreditApplication.student_id == student.id,
        models.CreditApplication.status == "approved",
        models.CreditApplication.is_duplicate == False
    ).all()
    
    lecture_type = get_activity_type_by_code(db, "lecture")
    competition_type = get_activity_type_by_code(db, "competition")
    volunteer_type = get_activity_type_by_code(db, "volunteer")
    
    lecture_credit = 0.0
    competition_credit = 0.0
    volunteer_credit = 0.0
    
    for app in applications:
        if app.activity_type_id == lecture_type.id:
            lecture_credit += app.credit
        elif app.activity_type_id == competition_type.id:
            competition_credit += app.credit
        elif app.activity_type_id == volunteer_type.id:
            volunteer_credit += app.credit
    
    lecture_max = lecture_type.max_credit if lecture_type else 0
    competition_max = competition_type.max_credit if competition_type else 0
    volunteer_max = volunteer_type.max_credit if volunteer_type else 0
    
    lecture_credit = min(lecture_credit, lecture_max)
    competition_credit = min(competition_credit, competition_max)
    volunteer_credit = min(volunteer_credit, volunteer_max)
    
    all_apps = db.query(models.CreditApplication).filter(
        models.CreditApplication.student_id == student.id
    ).all()
    
    pending_count = sum(1 for a in all_apps if a.status == "pending")
    approved_count = sum(1 for a in all_apps if a.status == "approved")
    rejected_count = sum(1 for a in all_apps if a.status == "rejected")
    
    return schemas.StudentCreditSummary(
        student_id=student.student_id,
        student_name=student.name,
        lecture_credit=lecture_credit,
        lecture_max=lecture_max,
        competition_credit=competition_credit,
        competition_max=competition_max,
        volunteer_credit=volunteer_credit,
        volunteer_max=volunteer_max,
        total_credit=lecture_credit + competition_credit + volunteer_credit,
        total_max=lecture_max + competition_max + volunteer_max,
        pending_count=pending_count,
        approved_count=approved_count,
        rejected_count=rejected_count
    )


def generate_credit_report(db: Session, report_create: schemas.CreditReportCreate):
    student = get_student_by_student_id(db, report_create.student_id)
    if not student:
        return None
    
    summary = calculate_student_credit(db, report_create.student_id)
    
    report = models.CreditReport(
        student_id=student.id,
        lecture_credit=summary.lecture_credit,
        competition_credit=summary.competition_credit,
        volunteer_credit=summary.volunteer_credit,
        total_credit=summary.total_credit,
        status="final",
        generated_by=report_create.generated_by
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    
    applications = db.query(models.CreditApplication).filter(
        models.CreditApplication.student_id == student.id
    ).all()
    
    for app in applications:
        rejection_reason = app.rejection.reason if app.rejection else None
        detail = models.ReportDetail(
            report_id=report.id,
            activity_type_id=app.activity_type_id,
            activity_name=app.activity_name,
            credit=app.credit,
            status=app.status,
            rejection_reason=rejection_reason
        )
        db.add(detail)
    
    db.commit()
    db.refresh(report)
    return report


def get_report(db: Session, report_id: int):
    return db.query(models.CreditReport).filter(models.CreditReport.id == report_id).first()


def get_reports_by_student(db: Session, student_id: str):
    student = get_student_by_student_id(db, student_id)
    if not student:
        return []
    return db.query(models.CreditReport).filter(models.CreditReport.student_id == student.id).all()


def get_audit_logs(db: Session, application_id: int):
    return db.query(models.AuditLog).filter(models.AuditLog.application_id == application_id).all()
