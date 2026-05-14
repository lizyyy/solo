import uuid
import traceback
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc
from app.models.models import TranscodeTask, ErrorLog, IdempotencyKey, ExportRecord
from app.schemas.schemas import TranscodeTaskCreate, TranscodeTaskUpdate, TaskFilter
from app.core.config import settings
import pandas as pd
import os
import json


def generate_request_id() -> str:
    return f"task_{uuid.uuid4().hex[:16]}"


def check_idempotency(db: Session, idempotency_key: str) -> Optional[dict]:
    if not idempotency_key:
        return None
    
    record = db.query(IdempotencyKey).filter(
        and_(
            IdempotencyKey.key == idempotency_key,
            IdempotencyKey.expires_at > datetime.now()
        )
    ).first()
    
    if record:
        return record.response_data
    return None


def save_idempotency_result(db: Session, idempotency_key: str, task_id: int, response_data: dict):
    if not idempotency_key:
        return
    
    record = IdempotencyKey(
        key=idempotency_key,
        task_id=task_id,
        response_data=response_data,
        expires_at=datetime.now() + timedelta(hours=24)
    )
    db.add(record)
    db.commit()


def create_task(db: Session, task_data: TranscodeTaskCreate) -> TranscodeTask:
    if task_data.idempotency_key:
        cached = check_idempotency(db, task_data.idempotency_key)
        if cached:
            return db.query(TranscodeTask).filter(TranscodeTask.id == cached["id"]).first()
    
    request_id = generate_request_id()
    
    watermark_dict = None
    if task_data.watermark_config:
        watermark_dict = task_data.watermark_config.dict()
    
    task = TranscodeTask(
        request_id=request_id,
        original_image_url=task_data.original_image_url,
        original_image_name=task_data.original_image_name,
        original_width=task_data.original_width,
        original_height=task_data.original_height,
        original_size=task_data.original_size,
        original_format=task_data.original_format,
        target_width=task_data.target_width,
        target_height=task_data.target_height,
        target_format=task_data.target_format,
        target_quality=task_data.target_quality,
        watermark_config=watermark_dict,
        priority=task_data.priority,
        max_retries=task_data.max_retries,
        created_by=task_data.created_by
    )
    
    db.add(task)
    db.commit()
    db.refresh(task)
    
    update_queue_positions(db)
    
    if task_data.idempotency_key:
        save_idempotency_result(db, task_data.idempotency_key, task.id, {
            "id": task.id,
            "request_id": task.request_id,
            "status": task.status
        })
    
    return task


def update_queue_positions(db: Session):
    pending_tasks = db.query(TranscodeTask).filter(
        TranscodeTask.status.in_(["pending", "queued"])
    ).order_by(desc(TranscodeTask.priority), TranscodeTask.created_at).all()
    
    for idx, task in enumerate(pending_tasks, 1):
        task.queue_position = idx
    
    db.commit()


def get_task_by_id(db: Session, task_id: int) -> Optional[TranscodeTask]:
    return db.query(TranscodeTask).filter(TranscodeTask.id == task_id).first()


def get_tasks(db: Session, filters: TaskFilter) -> tuple[List[TranscodeTask], int]:
    query = db.query(TranscodeTask)
    
    if filters.status:
        query = query.filter(TranscodeTask.status == filters.status)
    
    if filters.created_by:
        query = query.filter(TranscodeTask.created_by == filters.created_by)
    
    if filters.search:
        search_pattern = f"%{filters.search}%"
        query = query.filter(
            or_(
                TranscodeTask.request_id.like(search_pattern),
                TranscodeTask.original_image_name.like(search_pattern),
                TranscodeTask.last_error.like(search_pattern)
            )
        )
    
    total = query.count()
    
    offset = (filters.page - 1) * filters.page_size
    tasks = query.order_by(desc(TranscodeTask.created_at))\
        .offset(offset).limit(filters.page_size).all()
    
    return tasks, total


def get_task_versions(db: Session, parent_task_id: int) -> List[TranscodeTask]:
    return db.query(TranscodeTask).filter(
        or_(
            TranscodeTask.parent_task_id == parent_task_id,
            TranscodeTask.id == parent_task_id
        )
    ).order_by(TranscodeTask.version).all()


def confirm_watermark(db: Session, task_id: int) -> Optional[TranscodeTask]:
    task = get_task_by_id(db, task_id)
    if not task:
        return None
    
    task.watermark_confirmed = True
    if task.status == "pending":
        task.status = "queued"
    
    db.commit()
    db.refresh(task)
    return task


def approve_task(db: Session, task_id: int, approved_by: str) -> Optional[TranscodeTask]:
    task = get_task_by_id(db, task_id)
    if not task:
        return None
    
    task.approved_by = approved_by
    task.approved_at = datetime.now()
    task.status = "processing"
    
    db.commit()
    db.refresh(task)
    return task


def retry_task(db: Session, task_id: int) -> Optional[TranscodeTask]:
    task = get_task_by_id(db, task_id)
    if not task:
        return None
    
    if task.retry_count >= task.max_retries:
        return None
    
    task.retry_count += 1
    task.status = "queued"
    task.last_error = None
    
    db.commit()
    db.refresh(task)
    update_queue_positions(db)
    
    return task


def rollback_task(db: Session, task_id: int, target_version: int) -> Optional[TranscodeTask]:
    task = get_task_by_id(db, task_id)
    if not task:
        return None
    
    versions = get_task_versions(db, task.parent_task_id or task_id)
    
    target_task = None
    for v in versions:
        if v.version == target_version:
            target_task = v
            break
    
    if not target_task:
        return None
    
    new_task = TranscodeTask(
        request_id=generate_request_id(),
        original_image_url=target_task.original_image_url,
        original_image_name=target_task.original_image_name,
        original_width=target_task.original_width,
        original_height=target_task.original_height,
        original_size=target_task.original_size,
        original_format=target_task.original_format,
        target_width=target_task.target_width,
        target_height=target_task.target_height,
        target_format=target_task.target_format,
        target_quality=target_task.target_quality,
        watermark_config=target_task.watermark_config,
        watermark_confirmed=target_task.watermark_confirmed,
        priority=target_task.priority,
        max_retries=target_task.max_retries,
        created_by=target_task.created_by,
        version=task.version + 1,
        parent_task_id=task.parent_task_id or task.id
    )
    
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    update_queue_positions(db)
    
    return new_task


def log_error(db: Session, task_id: int, error_message: str, error_stack: str = None, retry_attempt: int = 0):
    error_log = ErrorLog(
        task_id=task_id,
        error_message=error_message,
        error_stack=error_stack or traceback.format_exc(),
        retry_attempt=retry_attempt
    )
    db.add(error_log)
    
    task = get_task_by_id(db, task_id)
    if task:
        task.last_error = error_message
        task.status = "failed"
    
    db.commit()


def get_task_errors(db: Session, task_id: int) -> List[ErrorLog]:
    return db.query(ErrorLog).filter(ErrorLog.task_id == task_id).order_by(desc(ErrorLog.created_at)).all()


def export_tasks(db: Session, export_request) -> str:
    query = db.query(TranscodeTask)
    
    if export_request.status:
        query = query.filter(TranscodeTask.status == export_request.status)
    if export_request.created_by:
        query = query.filter(TranscodeTask.created_by == export_request.created_by)
    if export_request.start_date:
        query = query.filter(TranscodeTask.created_at >= export_request.start_date)
    if export_request.end_date:
        query = query.filter(TranscodeTask.created_at <= export_request.end_date)
    
    tasks = query.order_by(desc(TranscodeTask.created_at)).all()
    
    export_data = []
    for task in tasks:
        export_data.append({
            "任务ID": task.id,
            "请求ID": task.request_id,
            "原图名称": task.original_image_name,
            "原图URL": task.original_image_url,
            "原图尺寸": f"{task.original_width or 0}x{task.original_height or 0}",
            "原图格式": task.original_format,
            "目标尺寸": f"{task.target_width or 0}x{task.target_height or 0}",
            "目标格式": task.target_format,
            "质量": task.target_quality,
            "水印配置": json.dumps(task.watermark_config, ensure_ascii=False) if task.watermark_config else "",
            "水印确认": "是" if task.watermark_confirmed else "否",
            "状态": task.status,
            "重试次数": task.retry_count,
            "最后错误": task.last_error,
            "产物URL": task.output_url,
            "创建人": task.created_by,
            "审批人": task.approved_by,
            "创建时间": task.created_at.strftime("%Y-%m-%d %H:%M:%S") if task.created_at else "",
            "完成时间": task.completed_at.strftime("%Y-%m-%d %H:%M:%S") if task.completed_at else "",
            "版本": task.version
        })
    
    os.makedirs(settings.EXPORT_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_name = f"transcode_tasks_{timestamp}.xlsx"
    file_path = os.path.join(settings.EXPORT_DIR, file_name)
    
    df = pd.DataFrame(export_data)
    df.to_excel(file_path, index=False, engine="openpyxl")
    
    file_size = os.path.getsize(file_path)
    
    export_record = ExportRecord(
        export_type="tasks",
        filters=export_request.dict(),
        file_path=file_path,
        file_name=file_name,
        record_count=len(tasks),
        file_size=file_size,
        created_by=export_request.created_by or "system"
    )
    db.add(export_record)
    db.commit()
    
    return file_path


def get_export_records(db: Session) -> List[ExportRecord]:
    return db.query(ExportRecord).order_by(desc(ExportRecord.created_at)).limit(20).all()