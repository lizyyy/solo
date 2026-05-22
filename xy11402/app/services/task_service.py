import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from app.config import settings
from app.models.task import CompensationTask, OriginalEvidence, StatusLog
from app.models.enums import TaskStatus, OperationType, RetryCategory
from app.schemas.task import (
    CompensationTaskCreate,
    CompensationTaskUpdate,
    OriginalEvidenceCreate,
    StatusLogCreate,
    ReceiptSubmitRequest,
    ManualTakeoverRequest,
    CompensateRequest,
    CloseTaskRequest,
    RetryTaskRequest,
)


def generate_task_no() -> str:
    return f"CC{datetime.now().strftime('%Y%m%d')}{uuid.uuid4().hex[:8].upper()}"


def create_status_log(
    db: Session,
    task_id: int,
    from_status: Optional[str],
    to_status: str,
    operation_type: str,
    operator: Optional[str] = None,
    remark: Optional[str] = None,
) -> StatusLog:
    log = StatusLog(
        task_id=task_id,
        from_status=from_status,
        to_status=to_status,
        operation_type=operation_type,
        operator=operator,
        remark=remark,
    )
    db.add(log)
    return log


def get_task_by_idempotency_key(db: Session, idempotency_key: str) -> Optional[CompensationTask]:
    return db.query(CompensationTask).filter(CompensationTask.idempotency_key == idempotency_key).first()


def get_task_by_id(db: Session, task_id: int) -> Optional[CompensationTask]:
    return db.query(CompensationTask).filter(CompensationTask.id == task_id).first()


def get_task_by_task_no(db: Session, task_no: str) -> Optional[CompensationTask]:
    return db.query(CompensationTask).filter(CompensationTask.task_no == task_no).first()


def create_evidence(
    db: Session,
    task_id: int,
    evidence_data: OriginalEvidenceCreate,
) -> OriginalEvidence:
    evidence = OriginalEvidence(
        task_id=task_id,
        **evidence_data.model_dump(),
    )
    db.add(evidence)
    return evidence


def create_task(db: Session, task_data: CompensationTaskCreate) -> CompensationTask:
    existing_task = get_task_by_idempotency_key(db, task_data.idempotency_key)
    if existing_task:
        return existing_task

    task = CompensationTask(
        idempotency_key=task_data.idempotency_key,
        task_no=generate_task_no(),
        source=task_data.source,
        box_no=task_data.box_no,
        driver_id=task_data.driver_id,
        temperature_record_id=task_data.temperature_record_id,
        compensation_amount=task_data.compensation_amount,
        max_retry_count=task_data.max_retry_count,
        status=TaskStatus.PENDING,
    )
    db.add(task)
    db.flush()

    for evidence_data in task_data.evidences:
        create_evidence(db, task.id, evidence_data)

    create_status_log(
        db,
        task.id,
        None,
        TaskStatus.PENDING,
        OperationType.SUBMIT,
        remark="任务创建",
    )

    db.commit()
    db.refresh(task)
    return task


def submit_receipt(db: Session, request: ReceiptSubmitRequest) -> Tuple[CompensationTask, bool]:
    existing_task = get_task_by_idempotency_key(db, request.idempotency_key)
    if existing_task:
        return existing_task, False

    evidences = [
        OriginalEvidenceCreate(
            source_file=request.source_file,
            source_row_no=request.source_row_no,
            original_value=str(request.original_data),
            parsed_value=str(request.parsed_data) if request.parsed_data else None,
            field_name="full_data",
        )
    ]

    task_data = CompensationTaskCreate(
        idempotency_key=request.idempotency_key,
        source=request.source,
        box_no=request.box_no,
        driver_id=request.driver_id,
        temperature_record_id=request.temperature_record_id,
        compensation_amount=request.compensation_amount,
        evidences=evidences,
    )

    task = create_task(db, task_data)
    return task, True


def update_task_status(
    db: Session,
    task: CompensationTask,
    new_status: TaskStatus,
    operation_type: OperationType,
    operator: Optional[str] = None,
    remark: Optional[str] = None,
) -> CompensationTask:
    old_status = task.status
    task.status = new_status
    create_status_log(db, task.id, old_status, new_status, operation_type, operator, remark)
    db.commit()
    db.refresh(task)
    return task


def handle_processing_failure(
    db: Session,
    task: CompensationTask,
    error: str,
    retry_category: RetryCategory = RetryCategory.OTHER,
) -> CompensationTask:
    task.retry_count += 1
    task.last_error = error
    task.retry_category = retry_category

    if task.retry_count >= task.max_retry_count:
        new_status = TaskStatus.WAITING_MANUAL
        remark = f"重试次数已达上限({task.max_retry_count})，转人工处理"
    else:
        new_status = TaskStatus.WAITING_RETRY
        task.next_retry_at = datetime.now() + timedelta(minutes=settings.RETRY_INTERVAL_MINUTES)
        remark = f"处理失败，第{task.retry_count}次重试，下次重试时间: {task.next_retry_at}"

    return update_task_status(
        db,
        task,
        new_status,
        OperationType.PROCESS,
        remark=remark,
    )


def retry_task(db: Session, task: CompensationTask, request: RetryTaskRequest) -> CompensationTask:
    if task.status not in [TaskStatus.WAITING_RETRY, TaskStatus.WAITING_MANUAL]:
        raise ValueError(f"当前状态 {task.status} 不允许重试")

    task.next_retry_at = None
    return update_task_status(
        db,
        task,
        TaskStatus.PROCESSING,
        OperationType.RETRY,
        operator=request.operator,
        remark=request.remark or "手动重试",
    )


def manual_takeover(db: Session, task: CompensationTask, request: ManualTakeoverRequest) -> CompensationTask:
    if request.retry_category:
        task.retry_category = request.retry_category

    return update_task_status(
        db,
        task,
        request.new_status,
        OperationType.MANUAL_TAKE_OVER,
        operator=request.operator,
        remark=request.remark,
    )


def compensate_task(db: Session, task: CompensationTask, request: CompensateRequest) -> CompensationTask:
    if task.status not in [TaskStatus.WAITING_MANUAL, TaskStatus.PROCESSING]:
        raise ValueError(f"当前状态 {task.status} 不允许补偿入账")

    task.compensation_amount = request.compensation_amount
    task.processed_at = datetime.now()

    return update_task_status(
        db,
        task,
        TaskStatus.COMPENSATED,
        OperationType.COMPENSATE,
        operator=request.operator,
        remark=request.remark,
    )


def close_task(db: Session, task: CompensationTask, request: CloseTaskRequest) -> CompensationTask:
    if task.status == TaskStatus.CLOSED:
        return task

    task.closed_at = datetime.now()

    return update_task_status(
        db,
        task,
        TaskStatus.CLOSED,
        OperationType.CLOSE,
        operator=request.operator,
        remark=request.remark,
    )


def mark_permanent_failed(
    db: Session,
    task: CompensationTask,
    operator: Optional[str] = None,
    remark: Optional[str] = None,
) -> CompensationTask:
    return update_task_status(
        db,
        task,
        TaskStatus.PERMANENT_FAILED,
        OperationType.MANUAL_TAKE_OVER,
        operator=operator,
        remark=remark or "标记为永久失败",
    )


def list_tasks(
    db: Session,
    status: Optional[TaskStatus] = None,
    source: Optional[str] = None,
    box_no: Optional[str] = None,
    retry_category: Optional[RetryCategory] = None,
    skip: int = 0,
    limit: int = 100,
) -> Tuple[List[CompensationTask], int]:
    query = db.query(CompensationTask)

    if status:
        query = query.filter(CompensationTask.status == status)
    if source:
        query = query.filter(CompensationTask.source == source)
    if box_no:
        query = query.filter(CompensationTask.box_no == box_no)
    if retry_category:
        query = query.filter(CompensationTask.retry_category == retry_category)

    total = query.count()
    tasks = query.order_by(CompensationTask.created_at.desc()).offset(skip).limit(limit).all()

    return tasks, total


def get_tasks_for_retry(db: Session) -> List[CompensationTask]:
    now = datetime.now()
    return (
        db.query(CompensationTask)
        .filter(
            CompensationTask.status == TaskStatus.WAITING_RETRY,
            CompensationTask.next_retry_at <= now,
        )
        .all()
    )


def get_dead_letter_tasks(db: Session) -> List[CompensationTask]:
    return db.query(CompensationTask).filter(CompensationTask.status == TaskStatus.PERMANENT_FAILED).all()
