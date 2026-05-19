from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import Optional, List, Tuple
from datetime import datetime
import uuid
import os
import pandas as pd

from . import models, schemas


def check_idempotent_request(db: Session, request_id: str):
    return db.query(models.IdempotentRequest).filter(
        models.IdempotentRequest.request_id == request_id
    ).first()


def save_idempotent_response(db: Session, request_id: str, endpoint: str, request_data: dict, response_data: dict):
    db_request = models.IdempotentRequest(
        request_id=request_id,
        endpoint=endpoint,
        request_data=request_data,
        response_data=response_data,
        status="completed",
        completed_at=datetime.utcnow()
    )
    db.add(db_request)
    db.commit()
    return db_request


def log_operation(db: Session, operation_type: str, target_type: str, target_id: Optional[str],
                  old_value: Optional[dict], new_value: Optional[dict], error_message: Optional[str]):
    log = models.OperationLog(
        operation_type=operation_type,
        target_type=target_type,
        target_id=target_id,
        old_value=old_value,
        new_value=new_value,
        error_message=error_message,
        operator="system"
    )
    db.add(log)
    db.commit()
    return log


def create_student_progress(db: Session, progress_data: schemas.StudentProgressCreate):
    db_progress = models.StudentProgress(
        student_id=progress_data.student_id,
        student_name=progress_data.student_name,
        course_id=progress_data.course_id,
        course_name=progress_data.course_name,
        overall_progress=progress_data.overall_progress,
        total_chapters=progress_data.total_chapters,
        completed_chapters=progress_data.completed_chapters,
        total_quizzes=progress_data.total_quizzes,
        passed_quizzes=progress_data.passed_quizzes,
        start_date=progress_data.start_date,
        last_activity_date=progress_data.last_activity_date,
        expected_completion_date=progress_data.expected_completion_date,
        status=progress_data.status
    )
    db.add(db_progress)
    db.flush()
    
    for chapter in progress_data.chapters:
        db_chapter = models.ChapterUnlock(
            progress_id=db_progress.id,
            **chapter.model_dump()
        )
        db.add(db_chapter)
    
    for quiz in progress_data.quizzes:
        db_quiz = models.QuizScore(
            progress_id=db_progress.id,
            **quiz.model_dump()
        )
        db.add(db_quiz)
    
    for task in progress_data.remedial_tasks:
        db_task = models.RemedialTask(
            progress_id=db_progress.id,
            **task.model_dump()
        )
        db.add(db_task)
    
    db.commit()
    db.refresh(db_progress)
    return db_progress


def publish_student_progress(db: Session, progress_id: int, published_by: str, notes: str = None):
    progress = db.query(models.StudentProgress).filter(
        models.StudentProgress.id == progress_id
    ).first()
    
    if not progress:
        return None
    
    progress.status = "published"
    progress.updated_at = datetime.utcnow()
    
    log_operation(
        db, "publish", "progress", str(progress_id),
        None, {"published_by": published_by, "notes": notes}, None
    )
    
    db.commit()
    db.refresh(progress)
    return progress


def get_student_progress_list(
    db: Session,
    student_id: Optional[str],
    course_id: Optional[str],
    status: Optional[str],
    has_abnormal_tasks: Optional[bool],
    page: int,
    page_size: int
) -> Tuple[int, List[models.StudentProgress]]:
    query = db.query(models.StudentProgress)
    
    if student_id:
        query = query.filter(models.StudentProgress.student_id.contains(student_id))
    if course_id:
        query = query.filter(models.StudentProgress.course_id.contains(course_id))
    if status:
        query = query.filter(models.StudentProgress.status == status)
    if has_abnormal_tasks:
        query = query.filter(
            models.StudentProgress.remedial_tasks.any(models.RemedialTask.is_abnormal == has_abnormal_tasks)
        )
    
    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(models.StudentProgress.updated_at.desc()).offset(offset).limit(page_size).all()
    
    return total, items


def get_progress_by_id(db: Session, progress_id: int) -> Optional[models.StudentProgress]:
    return db.query(models.StudentProgress).filter(models.StudentProgress.id == progress_id).first()


def update_student_progress(db: Session, progress_id: int, update_data: schemas.StudentProgressUpdate):
    progress = db.query(models.StudentProgress).filter(models.StudentProgress.id == progress_id).first()
    if not progress:
        return None
    
    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(progress, key, value)
    
    progress.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(progress)
    return progress


def review_remedial_task(db: Session, review_data: schemas.ReviewRemedialTaskRequest):
    task = db.query(models.RemedialTask).filter(models.RemedialTask.id == review_data.task_id).first()
    if not task:
        return None
    
    task.status = review_data.status
    task.is_abnormal = review_data.is_abnormal
    task.abnormal_reason = review_data.abnormal_reason
    task.reviewed_by = review_data.reviewed_by
    task.review_notes = review_data.review_notes
    task.updated_at = datetime.utcnow()
    
    if review_data.status == "completed":
        task.completion_date = datetime.utcnow()
    
    db.commit()
    db.refresh(task)
    return task


def get_abnormal_remedial_tasks(db: Session, page: int, page_size: int) -> Tuple[int, List[models.RemedialTask]]:
    query = db.query(models.RemedialTask).filter(models.RemedialTask.is_abnormal == True)
    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(models.RemedialTask.updated_at.desc()).offset(offset).limit(page_size).all()
    return total, items


def create_certificate_eligibility(db: Session, certificate_data):
    eligibility = models.CertificateEligibility(
        student_id=certificate_data.student_id,
        student_name=certificate_data.student_name,
        course_id=certificate_data.course_id,
        course_name=certificate_data.course_name,
        is_eligible=certificate_data.is_eligible,
        eligibility_criteria=getattr(certificate_data, 'eligibility_criteria', None),
        manual_confirmation=getattr(certificate_data, 'manual_confirmation', False),
        confirmed_by=getattr(certificate_data, 'confirmed_by', None),
        confirmation_notes=getattr(certificate_data, 'confirmation_notes', None),
        certificate_issued=getattr(certificate_data, 'certificate_issued', False),
        certificate_number=getattr(certificate_data, 'certificate_number', None)
    )
    db.add(eligibility)
    db.commit()
    db.refresh(eligibility)
    return eligibility


def create_certificate_from_progress(db: Session, progress_id: int, confirmed_by: str = None):
    progress = db.query(models.StudentProgress).filter(
        models.StudentProgress.id == progress_id
    ).first()
    
    if not progress:
        return None
    
    existing = db.query(models.CertificateEligibility).filter(
        models.CertificateEligibility.student_id == progress.student_id,
        models.CertificateEligibility.course_id == progress.course_id
    ).first()
    
    if existing:
        return existing
    
    is_eligible = progress.overall_progress >= 100 and progress.passed_quizzes > 0
    
    eligibility = models.CertificateEligibility(
        student_id=progress.student_id,
        student_name=progress.student_name,
        course_id=progress.course_id,
        course_name=progress.course_name,
        is_eligible=is_eligible,
        eligibility_criteria={
            "overall_progress": progress.overall_progress,
            "completed_chapters": progress.completed_chapters,
            "total_chapters": progress.total_chapters,
            "passed_quizzes": progress.passed_quizzes,
            "total_quizzes": progress.total_quizzes
        },
        manual_confirmation=False,
        confirmed_by=confirmed_by
    )
    db.add(eligibility)
    db.commit()
    db.refresh(eligibility)
    return eligibility


def confirm_certificate_eligibility(db: Session, confirm_data: schemas.ConfirmCertificateRequest):
    eligibility = db.query(models.CertificateEligibility).filter(
        models.CertificateEligibility.id == confirm_data.eligibility_id
    ).first()
    
    if not eligibility:
        return None
    
    eligibility.is_eligible = confirm_data.is_eligible
    eligibility.manual_confirmation = True
    eligibility.confirmed_by = confirm_data.confirmed_by
    eligibility.confirmation_notes = confirm_data.confirmation_notes
    eligibility.confirmation_date = datetime.utcnow()
    eligibility.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(eligibility)
    return eligibility


def issue_certificate(db: Session, eligibility_id: int, certificate_number: str):
    eligibility = db.query(models.CertificateEligibility).filter(
        models.CertificateEligibility.id == eligibility_id
    ).first()
    
    if not eligibility:
        return None
    
    eligibility.certificate_issued = True
    eligibility.certificate_number = certificate_number
    eligibility.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(eligibility)
    return eligibility


def get_certificate_list(
    db: Session,
    student_id: Optional[str],
    course_id: Optional[str],
    is_eligible: Optional[bool],
    manual_confirmation: Optional[bool],
    page: int,
    page_size: int
) -> Tuple[int, List[models.CertificateEligibility]]:
    query = db.query(models.CertificateEligibility)
    
    if student_id:
        query = query.filter(models.CertificateEligibility.student_id.contains(student_id))
    if course_id:
        query = query.filter(models.CertificateEligibility.course_id.contains(course_id))
    if is_eligible is not None:
        query = query.filter(models.CertificateEligibility.is_eligible == is_eligible)
    if manual_confirmation is not None:
        query = query.filter(models.CertificateEligibility.manual_confirmation == manual_confirmation)
    
    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(models.CertificateEligibility.updated_at.desc()).offset(offset).limit(page_size).all()
    
    return total, items


def export_to_excel(db: Session, export_request: schemas.ExportRequest, report_id: str, exports_dir: str) -> str:
    export_type = export_request.export_type
    filters = export_request.filters or {}
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"{export_type}_{timestamp}.xlsx"
    file_path = os.path.join(exports_dir, filename)
    
    if export_type == "progress":
        _, progress_list = get_student_progress_list(
            db,
            student_id=filters.get('student_id'),
            course_id=filters.get('course_id'),
            status=filters.get('status'),
            has_abnormal_tasks=filters.get('has_abnormal_tasks'),
            page=1,
            page_size=10000
        )
        
        data = []
        for p in progress_list:
            data.append({
                '学员ID': p.student_id,
                '学员姓名': p.student_name,
                '课程ID': p.course_id,
                '课程名称': p.course_name,
                '总体进度': f"{p.overall_progress}%",
                '总章节数': p.total_chapters,
                '已完成章节': p.completed_chapters,
                '总测验数': p.total_quizzes,
                '已通过测验': p.passed_quizzes,
                '状态': p.status,
                '开始日期': p.start_date.strftime('%Y-%m-%d') if p.start_date else '',
                '创建时间': p.created_at.strftime('%Y-%m-%d %H:%M:%S')
            })
        
        df = pd.DataFrame(data)
        df.to_excel(file_path, index=False, sheet_name='学员进度')
    
    elif export_type == "remedial_tasks":
        _, tasks = get_abnormal_remedial_tasks(db, 1, 10000)
        
        data = []
        for t in tasks:
            progress = db.query(models.StudentProgress).filter(models.StudentProgress.id == t.progress_id).first()
            data.append({
                '任务ID': t.task_id,
                '任务名称': t.task_name,
                '任务类型': t.task_type,
                '学员ID': progress.student_id if progress else '',
                '学员姓名': progress.student_name if progress else '',
                '异常原因': t.abnormal_reason or '',
                '状态': t.status,
                '复核人': t.reviewed_by or '',
                '分配日期': t.assigned_date.strftime('%Y-%m-%d') if t.assigned_date else '',
                '截止日期': t.due_date.strftime('%Y-%m-%d') if t.due_date else ''
            })
        
        df = pd.DataFrame(data)
        df.to_excel(file_path, index=False, sheet_name='补学任务')
    
    elif export_type == "certificates":
        _, certificates = get_certificate_list(
            db,
            student_id=filters.get('student_id'),
            course_id=filters.get('course_id'),
            is_eligible=filters.get('is_eligible'),
            manual_confirmation=filters.get('manual_confirmation'),
            page=1,
            page_size=10000
        )
        
        data = []
        for c in certificates:
            data.append({
                '学员ID': c.student_id,
                '学员姓名': c.student_name,
                '课程ID': c.course_id,
                '课程名称': c.course_name,
                '是否符合资格': '是' if c.is_eligible else '否',
                '是否人工确认': '是' if c.manual_confirmation else '否',
                '确认人': c.confirmed_by or '',
                '确认日期': c.confirmation_date.strftime('%Y-%m-%d') if c.confirmation_date else '',
                '证书编号': c.certificate_number or '',
                '是否已颁发': '是' if c.certificate_issued else '否'
            })
        
        df = pd.DataFrame(data)
        df.to_excel(file_path, index=False, sheet_name='证书资格')
    
    else:
        raise ValueError(f"不支持的导出类型: {export_type}")
    
    return file_path


def create_learning_report(db: Session, report_id: str, report_type: str, report_name: str,
                           generated_by: str, file_path: str, filters_applied: Optional[dict]):
    file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
    
    report = models.LearningReport(
        report_id=report_id,
        report_type=report_type,
        report_name=report_name,
        generated_by=generated_by,
        generated_at=datetime.utcnow(),
        filters_applied=filters_applied,
        file_path=file_path,
        file_size=file_size,
        status="completed"
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def get_report_list(db: Session, report_type: Optional[str], page: int, page_size: int) -> Tuple[int, List[models.LearningReport]]:
    query = db.query(models.LearningReport)
    
    if report_type:
        query = query.filter(models.LearningReport.report_type == report_type)
    
    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(models.LearningReport.generated_at.desc()).offset(offset).limit(page_size).all()
    
    return total, items


def get_report_by_id(db: Session, report_id: str) -> Optional[models.LearningReport]:
    return db.query(models.LearningReport).filter(models.LearningReport.report_id == report_id).first()


def get_operation_logs(
    db: Session,
    operation_type: Optional[str],
    target_type: Optional[str],
    has_error: Optional[bool],
    page: int,
    page_size: int
) -> Tuple[int, List[models.OperationLog]]:
    query = db.query(models.OperationLog)
    
    if operation_type:
        query = query.filter(models.OperationLog.operation_type == operation_type)
    if target_type:
        query = query.filter(models.OperationLog.target_type == target_type)
    if has_error is True:
        query = query.filter(models.OperationLog.error_message.isnot(None))
    elif has_error is False:
        query = query.filter(models.OperationLog.error_message.is_(None))
    
    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(models.OperationLog.created_at.desc()).offset(offset).limit(page_size).all()
    
    return total, items


def get_statistics(db: Session) -> dict:
    total_students = db.query(models.StudentProgress).count()
    completed_count = db.query(models.StudentProgress).filter(models.StudentProgress.status == "completed").count()
    in_progress_count = db.query(models.StudentProgress).filter(models.StudentProgress.status == "in_progress").count()
    
    abnormal_tasks_count = db.query(models.RemedialTask).filter(models.RemedialTask.is_abnormal == True).count()
    pending_tasks_count = db.query(models.RemedialTask).filter(models.RemedialTask.status == "pending").count()
    
    eligible_certificates = db.query(models.CertificateEligibility).filter(models.CertificateEligibility.is_eligible == True).count()
    manually_confirmed = db.query(models.CertificateEligibility).filter(models.CertificateEligibility.manual_confirmation == True).count()
    
    total_reports = db.query(models.LearningReport).count()
    
    total_errors = db.query(models.OperationLog).filter(models.OperationLog.error_message.isnot(None)).count()
    
    return {
        "students": {
            "total": total_students,
            "completed": completed_count,
            "in_progress": in_progress_count
        },
        "remedial_tasks": {
            "abnormal": abnormal_tasks_count,
            "pending": pending_tasks_count
        },
        "certificates": {
            "eligible": eligible_certificates,
            "manually_confirmed": manually_confirmed
        },
        "reports": {
            "total": total_reports
        },
        "errors": total_errors
    }
