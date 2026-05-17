from sqlalchemy.orm import Session
from typing import Optional
import uuid
import json

from models import ReportExportTask, TaskHistory, TaskStatus, OperationSource
from schemas import TaskCreate, TaskUpdateStatus, TaskRetry, BadRowImportRequest


def generate_task_no() -> str:
    return f"EXPORT-{uuid.uuid4().hex[:12].upper()}"


def create_task(db: Session, task_data: TaskCreate) -> ReportExportTask:
    task_no = generate_task_no()
    filter_conditions_str = json.dumps(task_data.filter_conditions, ensure_ascii=False)

    db_task = ReportExportTask(
        task_no=task_no,
        tenant_id=task_data.tenant_id,
        report_type=task_data.report_type,
        filter_conditions=filter_conditions_str,
        created_by=task_data.created_by,
        status=TaskStatus.QUEUED
    )
    db.add(db_task)
    db.flush()

    add_history_record(
        db=db,
        task_id=db_task.id,
        status=TaskStatus.QUEUED,
        operation_source=task_data.operation_source,
        operator=task_data.created_by,
        change_reason="任务创建，进入排队"
    )

    db.commit()
    db.refresh(db_task)
    return db_task


def detect_duplicate_tasks(db: Session, task_data: TaskCreate, window_minutes: int = 30) -> list[ReportExportTask]:
    signature = task_data.get_task_signature()
    filter_conditions_str = json.dumps(task_data.filter_conditions, ensure_ascii=False)

    duplicate_statuses = [TaskStatus.QUEUED, TaskStatus.GENERATING, TaskStatus.RETRYING]

    tasks = db.query(ReportExportTask).filter(
        ReportExportTask.tenant_id == task_data.tenant_id,
        ReportExportTask.report_type == task_data.report_type,
        ReportExportTask.filter_conditions == filter_conditions_str,
        ReportExportTask.status.in_(duplicate_statuses)
    ).order_by(ReportExportTask.created_at.desc()).all()

    return tasks


def add_history_record(
    db: Session,
    task_id: int,
    status: TaskStatus,
    operation_source: OperationSource,
    operator: str,
    change_reason: Optional[str] = None,
    file_size: Optional[int] = None
) -> TaskHistory:
    history = TaskHistory(
        task_id=task_id,
        status=status,
        operation_source=operation_source,
        operator=operator,
        change_reason=change_reason,
        file_size=file_size
    )
    db.add(history)
    return history


def get_task_by_no(db: Session, task_no: str) -> Optional[ReportExportTask]:
    return db.query(ReportExportTask).filter(ReportExportTask.task_no == task_no).first()


def update_task_status(db: Session, task_no: str, update_data: TaskUpdateStatus) -> Optional[ReportExportTask]:
    task = get_task_by_no(db, task_no)
    if not task:
        return None

    old_status = task.status
    task.status = update_data.status

    if update_data.file_size is not None:
        task.file_size = update_data.file_size
    if update_data.file_url is not None:
        task.file_url = update_data.file_url
    if update_data.error_message is not None:
        task.error_message = update_data.error_message

    add_history_record(
        db=db,
        task_id=task.id,
        status=update_data.status,
        operation_source=update_data.operation_source,
        operator=update_data.operator,
        change_reason=update_data.change_reason or f"状态变更: {old_status} -> {update_data.status}",
        file_size=update_data.file_size
    )

    db.commit()
    db.refresh(task)
    return task


def retry_task(db: Session, task_no: str, retry_data: TaskRetry) -> Optional[ReportExportTask]:
    task = get_task_by_no(db, task_no)
    if not task:
        return None

    if task.retry_count >= task.max_retries:
        raise ValueError(f"任务已达到最大重试次数 ({task.max_retries}次)")

    task.retry_count += 1
    task.status = TaskStatus.RETRYING
    task.error_message = None

    add_history_record(
        db=db,
        task_id=task.id,
        status=TaskStatus.RETRYING,
        operation_source=retry_data.operation_source,
        operator=retry_data.operator,
        change_reason=f"{retry_data.change_reason} (第{task.retry_count}次重试)"
    )

    db.commit()
    db.refresh(task)
    return task


def get_task_history(db: Session, task_no: str) -> Optional[list[TaskHistory]]:
    task = get_task_by_no(db, task_no)
    if not task:
        return None

    return db.query(TaskHistory).filter(
        TaskHistory.task_id == task.id
    ).order_by(TaskHistory.created_at.asc()).all()


def list_tasks(db: Session, tenant_id: Optional[str] = None, status: Optional[TaskStatus] = None, skip: int = 0, limit: int = 100) -> list[ReportExportTask]:
    query = db.query(ReportExportTask)
    if tenant_id:
        query = query.filter(ReportExportTask.tenant_id == tenant_id)
    if status:
        query = query.filter(ReportExportTask.status == status)
    return query.order_by(ReportExportTask.created_at.desc()).offset(skip).limit(limit).all()


def record_bad_row_import(db: Session, request: BadRowImportRequest) -> Optional[TaskHistory]:
    task = get_task_by_no(db, request.task_no)
    if not task:
        return None

    history = add_history_record(
        db=db,
        task_id=task.id,
        status=task.status,
        operation_source=OperationSource.SYSTEM,
        operator=request.operator,
        change_reason=f"坏行导入失败: {request.error_message}, 行数据: {json.dumps(request.row_data, ensure_ascii=False)}",
        file_size=task.file_size
    )
    db.commit()
    return history
