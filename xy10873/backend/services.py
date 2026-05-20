import uuid
import hmac
import hashlib
import json
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from . import models, schemas
from .models import SubmissionStatus, ExceptionType

CALLBACK_SECRET = "grading_callback_secret_2024"


def generate_id() -> str:
    return str(uuid.uuid4())


def verify_signature(payload: str, signature: str, secret: str = CALLBACK_SECRET) -> bool:
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected_signature, signature)


def create_submission(db: Session, submission: schemas.SubmissionCreate) -> models.Submission:
    db_submission = models.Submission(
        submission_id=submission.submission_id,
        student_id=submission.student_id,
        assignment_id=submission.assignment_id,
        course_id=submission.course_id,
        status=SubmissionStatus.PENDING
    )
    db.add(db_submission)
    db.commit()
    db.refresh(db_submission)
    return db_submission


def get_submission(db: Session, submission_id: str) -> Optional[models.Submission]:
    return db.query(models.Submission).filter(models.Submission.submission_id == submission_id).first()


def get_submissions(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: Optional[SubmissionStatus] = None,
    course_id: Optional[str] = None
) -> List[models.Submission]:
    query = db.query(models.Submission)
    if status:
        query = query.filter(models.Submission.status == status)
    if course_id:
        query = query.filter(models.Submission.course_id == course_id)
    return query.order_by(models.Submission.created_at.desc()).offset(skip).limit(limit).all()


def update_submission_status(
    db: Session,
    submission_id: str,
    new_status: SubmissionStatus,
    updated_by: str
) -> Optional[models.Submission]:
    submission = get_submission(db, submission_id)
    if not submission:
        return None
    
    old_status = submission.status
    submission.status = new_status
    submission.updated_at = datetime.now()
    
    retry_record = models.RetryRecord(
        retry_id=generate_id(),
        submission_id=submission_id,
        retry_type="status_update",
        previous_status=old_status,
        new_status=new_status,
        triggered_by=updated_by,
        success=1
    )
    db.add(retry_record)
    db.commit()
    db.refresh(submission)
    return submission


def create_grading_task(db: Session, task: schemas.GradingTaskCreate) -> models.GradingTask:
    db_task = models.GradingTask(
        task_id=task.task_id,
        submission_id=task.submission_id,
        grader_type=task.grader_type
    )
    db.add(db_task)
    
    submission = get_submission(db, task.submission_id)
    if submission:
        submission.status = SubmissionStatus.GRADING
    
    db.commit()
    db.refresh(db_task)
    return db_task


def complete_grading_task(
    db: Session,
    task_id: str,
    score: float,
    details: str
) -> Optional[models.GradingTask]:
    task = db.query(models.GradingTask).filter(models.GradingTask.task_id == task_id).first()
    if not task:
        return None
    
    task.completed_at = datetime.now()
    task.raw_score = score
    task.grading_details = details
    
    submission = get_submission(db, task.submission_id)
    if submission:
        submission.status = SubmissionStatus.GRADED
        submission.final_score = score
    
    db.commit()
    db.refresh(task)
    return task


def create_callback_payload(db: Session, payload: schemas.CallbackPayloadCreate) -> models.CallbackPayload:
    is_valid = verify_signature(payload.raw_payload, payload.signature)
    
    try:
        payload_data = json.loads(payload.raw_payload)
        score = payload_data.get("score")
    except:
        score = None
    
    db_payload = models.CallbackPayload(
        payload_id=payload.payload_id,
        submission_id=payload.submission_id,
        raw_payload=payload.raw_payload,
        signature=payload.signature,
        is_signature_valid=1 if is_valid else 0,
        score=score
    )
    db.add(db_payload)
    
    submission = get_submission(db, payload.submission_id)
    if submission:
        if is_valid:
            submission.status = SubmissionStatus.CALLBACK_PENDING
        else:
            submission.status = SubmissionStatus.CALLBACK_FAILED
            log_exception(
                db,
                submission.submission_id,
                ExceptionType.SIGNATURE_VERIFICATION_FAILED,
                "Callback signature verification failed"
            )
    
    db.commit()
    db.refresh(db_payload)
    return db_payload


def verify_callback_payload(db: Session, payload_id: str) -> Optional[models.CallbackPayload]:
    payload = db.query(models.CallbackPayload).filter(models.CallbackPayload.payload_id == payload_id).first()
    if not payload:
        return None
    
    is_valid = verify_signature(payload.raw_payload, payload.signature)
    payload.is_signature_valid = 1 if is_valid else 0
    
    if not is_valid:
        log_exception(
            db,
            payload.submission_id,
            ExceptionType.SIGNATURE_VERIFICATION_FAILED,
            "Manual signature verification failed"
        )
    
    db.commit()
    db.refresh(payload)
    return payload


def write_grade(db: Session, payload_id: str, score: float) -> Optional[models.CallbackPayload]:
    payload = db.query(models.CallbackPayload).filter(models.CallbackPayload.payload_id == payload_id).first()
    if not payload:
        return None
    
    payload.score = score
    payload.grade_written = 1
    payload.grade_written_at = datetime.now()
    
    submission = get_submission(db, payload.submission_id)
    if submission:
        submission.final_score = score
        submission.status = SubmissionStatus.SUCCESS
    
    db.commit()
    db.refresh(payload)
    return payload


def log_exception(
    db: Session,
    submission_id: str,
    exception_type: ExceptionType,
    error_message: str,
    stack_trace: Optional[str] = None
) -> models.ExceptionLog:
    db_exception = models.ExceptionLog(
        exception_id=generate_id(),
        submission_id=submission_id,
        exception_type=exception_type,
        error_message=error_message,
        stack_trace=stack_trace
    )
    db.add(db_exception)
    
    submission = get_submission(db, submission_id)
    if submission:
        submission.status = SubmissionStatus.CALLBACK_FAILED
    
    db.commit()
    db.refresh(db_exception)
    return db_exception


def resolve_exception(db: Session, exception_id: str, resolved_by: str) -> Optional[models.ExceptionLog]:
    exception = db.query(models.ExceptionLog).filter(models.ExceptionLog.exception_id == exception_id).first()
    if not exception:
        return None
    
    exception.resolved = 1
    exception.resolved_at = datetime.now()
    exception.resolved_by = resolved_by
    
    db.commit()
    db.refresh(exception)
    return exception


def retry_callback(db: Session, submission_id: str, retry_type: str, triggered_by: str) -> Optional[models.RetryRecord]:
    submission = get_submission(db, submission_id)
    if not submission:
        return None
    
    previous_status = submission.status
    retry_count = db.query(models.RetryRecord).filter(models.RetryRecord.submission_id == submission_id).count() + 1
    
    if retry_type == "callback":
        new_status = SubmissionStatus.CALLBACK_PENDING
    elif retry_type == "grade_write":
        new_status = SubmissionStatus.SUCCESS
    else:
        new_status = SubmissionStatus.MANUAL_REVIEW
    
    submission.status = new_status
    
    retry_record = models.RetryRecord(
        retry_id=generate_id(),
        submission_id=submission_id,
        retry_count=retry_count,
        retry_type=retry_type,
        previous_status=previous_status,
        new_status=new_status,
        triggered_by=triggered_by,
        success=1
    )
    db.add(retry_record)
    db.commit()
    db.refresh(retry_record)
    return retry_record


def get_statistics(db: Session) -> schemas.StatisticsResponse:
    total_submissions = db.query(func.count(models.Submission.id)).scalar()
    
    status_counts = {}
    for status in SubmissionStatus:
        count = db.query(func.count(models.Submission.id)).filter(models.Submission.status == status).scalar()
        status_counts[status.value] = count
    
    total_exceptions = db.query(func.count(models.ExceptionLog.id)).scalar()
    unresolved_exceptions = db.query(func.count(models.ExceptionLog.id)).filter(models.ExceptionLog.resolved == 0).scalar()
    
    return schemas.StatisticsResponse(
        total_submissions=total_submissions,
        pending=status_counts.get("pending", 0),
        grading=status_counts.get("grading", 0),
        callback_pending=status_counts.get("callback_pending", 0),
        callback_failed=status_counts.get("callback_failed", 0),
        success=status_counts.get("success", 0),
        manual_review=status_counts.get("manual_review", 0),
        total_exceptions=total_exceptions,
        unresolved_exceptions=unresolved_exceptions
    )


def get_exceptions(db: Session, unresolved_only: bool = False) -> List[models.ExceptionLog]:
    query = db.query(models.ExceptionLog)
    if unresolved_only:
        query = query.filter(models.ExceptionLog.resolved == 0)
    return query.order_by(models.ExceptionLog.occurred_at.desc()).all()
