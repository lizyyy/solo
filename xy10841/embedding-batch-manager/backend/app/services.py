from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
import json
import hashlib
from typing import List, Optional, Dict, Any
from . import models, schemas
from .models import BatchStatus, TaskStatus


class IdempotencyService:
    _request_cache: Dict[str, Any] = {}

    @classmethod
    def check_request(cls, request_id: str) -> Optional[Any]:
        return cls._request_cache.get(request_id)

    @classmethod
    def store_result(cls, request_id: str, result: Any, ttl_hours: int = 24):
        cls._request_cache[request_id] = {
            "result": result,
            "expires_at": datetime.now() + timedelta(hours=ttl_hours)
        }

    @classmethod
    def cleanup_expired(cls):
        now = datetime.now()
        expired_keys = [
            k for k, v in cls._request_cache.items()
            if v["expires_at"] < now
        ]
        for k in expired_keys:
            del cls._request_cache[k]


def get_chunk_strategy(db: Session, strategy_id: int):
    return db.query(models.ChunkStrategy).filter(models.ChunkStrategy.id == strategy_id).first()


def get_chunk_strategy_by_name(db: Session, name: str):
    return db.query(models.ChunkStrategy).filter(models.ChunkStrategy.name == name).first()


def get_chunk_strategies(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.ChunkStrategy).offset(skip).limit(limit).all()


def create_chunk_strategy(db: Session, strategy: schemas.ChunkStrategyCreate):
    db_strategy = models.ChunkStrategy(**strategy.dict())
    db.add(db_strategy)
    db.commit()
    db.refresh(db_strategy)
    return db_strategy


def get_document_batch(db: Session, batch_id: int):
    return db.query(models.DocumentBatch).filter(models.DocumentBatch.id == batch_id).first()


def get_document_batches(db: Session, skip: int = 0, limit: int = 100, status: Optional[BatchStatus] = None, search: Optional[str] = None):
    query = db.query(models.DocumentBatch)
    if status:
        query = query.filter(models.DocumentBatch.status == status)
    if search:
        query = query.filter(models.DocumentBatch.batch_name.ilike(f"%{search}%"))
    return query.order_by(models.DocumentBatch.created_at.desc()).offset(skip).limit(limit).all()


def create_document_batch(db: Session, batch: schemas.DocumentBatchCreate):
    metadata_json = json.dumps(batch.metadata) if batch.metadata else None
    db_batch = models.DocumentBatch(
        batch_name=batch.batch_name,
        source_type=batch.source_type,
        total_documents=batch.total_documents,
        total_chunks=batch.total_chunks,
        strategy_id=batch.strategy_id,
        metadata_=metadata_json
    )
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch


def update_document_batch(db: Session, batch_id: int, batch_update: schemas.DocumentBatchUpdate):
    db_batch = get_document_batch(db, batch_id)
    if not db_batch:
        return None
    
    update_data = batch_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_batch, key, value)
    
    db.commit()
    db.refresh(db_batch)
    return db_batch


def start_batch_processing(db: Session, batch_id: int):
    db_batch = get_document_batch(db, batch_id)
    if not db_batch:
        return None
    
    db_batch.status = BatchStatus.RUNNING
    db_batch.started_at = datetime.now()
    db.commit()
    db.refresh(db_batch)
    return db_batch


def pause_batch_processing(db: Session, batch_id: int):
    db_batch = get_document_batch(db, batch_id)
    if not db_batch:
        return None
    
    db_batch.status = BatchStatus.PAUSED
    db.commit()
    db.refresh(db_batch)
    return db_batch


def resume_batch_processing(db: Session, batch_id: int):
    db_batch = get_document_batch(db, batch_id)
    if not db_batch:
        return None
    
    db_batch.status = BatchStatus.RUNNING
    db.commit()
    db.refresh(db_batch)
    return db_batch


def complete_batch_processing(db: Session, batch_id: int):
    db_batch = get_document_batch(db, batch_id)
    if not db_batch:
        return None
    
    db_batch.status = BatchStatus.COMPLETED
    db_batch.progress = 100.0
    db_batch.completed_at = datetime.now()
    db.commit()
    db.refresh(db_batch)
    return db_batch


def fail_batch_processing(db: Session, batch_id: int, error_message: str):
    db_batch = get_document_batch(db, batch_id)
    if not db_batch:
        return None
    
    db_batch.status = BatchStatus.FAILED
    db_batch.error_message = error_message
    db_batch.completed_at = datetime.now()
    db.commit()
    db.refresh(db_batch)
    return db_batch


def get_batch_detail(db: Session, batch_id: int) -> Optional[schemas.DocumentBatchDetail]:
    db_batch = get_document_batch(db, batch_id)
    if not db_batch:
        return None
    
    task_count = db.query(models.VectorTask).filter(models.VectorTask.batch_id == batch_id).count()
    failed_count = db.query(models.VectorTask).filter(
        and_(models.VectorTask.batch_id == batch_id, models.VectorTask.status == TaskStatus.FAILED)
    ).count()
    completed_count = db.query(models.VectorTask).filter(
        and_(models.VectorTask.batch_id == batch_id, models.VectorTask.status == TaskStatus.COMPLETED)
    ).count()
    retry_count = db.query(models.RetryQueue).filter(models.RetryQueue.batch_id == batch_id).count()
    
    metadata = json.loads(db_batch.metadata_) if db_batch.metadata_ else None
    
    return schemas.DocumentBatchDetail(
        id=db_batch.id,
        batch_name=db_batch.batch_name,
        source_type=db_batch.source_type,
        total_documents=db_batch.total_documents,
        total_chunks=db_batch.total_chunks,
        strategy_id=db_batch.strategy_id,
        metadata=metadata,
        status=db_batch.status,
        progress=db_batch.progress,
        error_message=db_batch.error_message,
        started_at=db_batch.started_at,
        completed_at=db_batch.completed_at,
        created_at=db_batch.created_at,
        updated_at=db_batch.updated_at,
        chunk_strategy=db_batch.chunk_strategy,
        task_count=task_count,
        failed_count=failed_count,
        completed_count=completed_count,
        retry_count=retry_count
    )


def create_vector_task(db: Session, task: schemas.VectorTaskCreate):
    db_task = models.VectorTask(**task.dict())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    _update_batch_progress(db, task.batch_id)
    return db_task


def create_vector_tasks_bulk(db: Session, tasks: List[schemas.VectorTaskCreate], batch_id: int):
    db_tasks = []
    for task in tasks:
        db_task = models.VectorTask(**task.dict())
        db.add(db_task)
        db_tasks.append(db_task)
    
    db.commit()
    for db_task in db_tasks:
        db.refresh(db_task)
    
    _update_batch_progress(db, batch_id)
    return db_tasks


def get_vector_task(db: Session, task_id: int):
    return db.query(models.VectorTask).filter(models.VectorTask.id == task_id).first()


def get_vector_tasks_by_batch(db: Session, batch_id: int, skip: int = 0, limit: int = 100, status: Optional[TaskStatus] = None):
    query = db.query(models.VectorTask).filter(models.VectorTask.batch_id == batch_id)
    if status:
        query = query.filter(models.VectorTask.status == status)
    return query.offset(skip).limit(limit).all()


def update_vector_task(db: Session, task_id: int, task_update: schemas.VectorTaskUpdate):
    db_task = get_vector_task(db, task_id)
    if not db_task:
        return None
    
    update_data = task_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_task, key, value)
    
    db.commit()
    db.refresh(db_task)
    
    _update_batch_progress(db, db_task.batch_id)
    return db_task


def complete_vector_task(db: Session, task_id: int):
    db_task = get_vector_task(db, task_id)
    if not db_task:
        return None
    
    db_task.status = TaskStatus.COMPLETED
    db_task.processing_completed_at = datetime.now()
    db.commit()
    db.refresh(db_task)
    
    _update_batch_progress(db, db_task.batch_id)
    return db_task


def fail_vector_task(db: Session, task_id: int, error_message: str, error_type: str = "Unknown", error_traceback: str = None):
    db_task = get_vector_task(db, task_id)
    if not db_task:
        return None
    
    db_task.status = TaskStatus.FAILED
    db_task.error_message = error_message
    db_task.processing_completed_at = datetime.now()
    db.commit()
    db.refresh(db_task)
    
    create_failed_chunk(db, schemas.FailedChunkCreate(
        batch_id=db_task.batch_id,
        task_id=task_id,
        document_id=db_task.document_id,
        chunk_index=db_task.chunk_index,
        chunk_text=db_task.chunk_text,
        error_type=error_type,
        error_message=error_message,
        error_traceback=error_traceback
    ))
    
    _update_batch_progress(db, db_task.batch_id)
    return db_task


def retry_vector_task(db: Session, task_id: int):
    db_task = get_vector_task(db, task_id)
    if not db_task:
        return None
    
    if db_task.retry_count >= db_task.max_retries:
        return None
    
    db_task.status = TaskStatus.RETRYING
    db_task.retry_count += 1
    db.commit()
    db.refresh(db_task)
    
    add_to_retry_queue(db, schemas.RetryQueueCreate(
        batch_id=db_task.batch_id,
        task_id=task_id,
        priority=1
    ))
    
    return db_task


def _update_batch_progress(db: Session, batch_id: int):
    db_batch = get_document_batch(db, batch_id)
    if not db_batch:
        return
    
    total_tasks = db.query(models.VectorTask).filter(models.VectorTask.batch_id == batch_id).count()
    if total_tasks == 0:
        return
    
    completed_tasks = db.query(models.VectorTask).filter(
        and_(models.VectorTask.batch_id == batch_id, models.VectorTask.status == TaskStatus.COMPLETED)
    ).count()
    
    db_batch.progress = (completed_tasks / total_tasks) * 100
    
    failed_tasks = db.query(models.VectorTask).filter(
        and_(models.VectorTask.batch_id == batch_id, models.VectorTask.status == TaskStatus.FAILED)
    ).count()
    
    if completed_tasks == total_tasks:
        db_batch.status = BatchStatus.COMPLETED
        db_batch.completed_at = datetime.now()
    elif failed_tasks > 0 and completed_tasks + failed_tasks == total_tasks:
        db_batch.status = BatchStatus.PARTIAL
    
    db.commit()


def create_failed_chunk(db: Session, failed_chunk: schemas.FailedChunkCreate):
    db_failed = models.FailedChunk(**failed_chunk.dict())
    db.add(db_failed)
    db.commit()
    db.refresh(db_failed)
    return db_failed


def get_failed_chunks_by_batch(db: Session, batch_id: int, resolved: Optional[bool] = None):
    query = db.query(models.FailedChunk).filter(models.FailedChunk.batch_id == batch_id)
    if resolved is not None:
        query = query.filter(models.FailedChunk.resolved == resolved)
    return query.all()


def resolve_failed_chunk(db: Session, failed_chunk_id: int):
    db_failed = db.query(models.FailedChunk).filter(models.FailedChunk.id == failed_chunk_id).first()
    if not db_failed:
        return None
    
    db_failed.resolved = True
    db_failed.resolved_at = datetime.now()
    db.commit()
    db.refresh(db_failed)
    return db_failed


def add_to_retry_queue(db: Session, retry_item: schemas.RetryQueueCreate):
    db_retry = models.RetryQueue(**retry_item.dict())
    db.add(db_retry)
    db.commit()
    db.refresh(db_retry)
    return db_retry


def get_retry_queue_by_batch(db: Session, batch_id: int, status: Optional[str] = None):
    query = db.query(models.RetryQueue).filter(models.RetryQueue.batch_id == batch_id)
    if status:
        query = query.filter(models.RetryQueue.status == status)
    return query.order_by(models.RetryQueue.priority.desc()).all()


def process_retry_queue(db: Session, batch_id: int):
    retry_items = get_retry_queue_by_batch(db, batch_id, status="pending")
    results = []
    
    for item in retry_items:
        db_task = get_vector_task(db, item.task_id)
        if db_task and db_task.retry_count < db_task.max_retries:
            db_task.status = TaskStatus.PENDING
            item.status = "processed"
            item.retry_count += 1
            db.commit()
            results.append({"task_id": item.task_id, "status": "queued_for_retry"})
        else:
            item.status = "exhausted"
            db.commit()
    
    return results


def create_index_result(db: Session, index_result: schemas.IndexResultCreate):
    db_index = models.IndexResult(**index_result.dict())
    db.add(db_index)
    db.commit()
    db.refresh(db_index)
    return db_index


def get_index_results_by_batch(db: Session, batch_id: int, verified: Optional[bool] = None):
    query = db.query(models.IndexResult).filter(models.IndexResult.batch_id == batch_id)
    if verified is not None:
        query = query.filter(models.IndexResult.verified == verified)
    return query.all()


def verify_index_result(db: Session, index_id: int, is_valid: bool, error_message: Optional[str] = None):
    db_index = db.query(models.IndexResult).filter(models.IndexResult.id == index_id).first()
    if not db_index:
        return None
    
    db_index.verified = True
    db_index.verified_at = datetime.now()
    if not is_valid:
        db_index.verification_error = error_message
    db.commit()
    db.refresh(db_index)
    return db_index


def verify_batch_indexes(db: Session, batch_id: int) -> Dict[str, Any]:
    tasks = get_vector_tasks_by_batch(db, batch_id, status=TaskStatus.COMPLETED)
    task_ids = {t.id for t in tasks}
    
    index_results = get_index_results_by_batch(db, batch_id)
    indexed_task_ids = {r.task_id for r in index_results}
    
    missing_indexes = task_ids - indexed_task_ids
    verified_count = sum(1 for r in index_results if r.verified)
    
    return {
        "batch_id": batch_id,
        "total_tasks": len(tasks),
        "indexed_count": len(index_results),
        "verified_count": verified_count,
        "missing_indexes": list(missing_indexes),
        "has_missing": len(missing_indexes) > 0,
        "verification_complete": verified_count == len(index_results)
    }


def generate_batch_report(db: Session, batch_id: int) -> Optional[schemas.BatchReport]:
    db_batch = get_document_batch(db, batch_id)
    if not db_batch:
        return None
    
    total_tasks = db.query(models.VectorTask).filter(models.VectorTask.batch_id == batch_id).count()
    completed_tasks = db.query(models.VectorTask).filter(
        and_(models.VectorTask.batch_id == batch_id, models.VectorTask.status == TaskStatus.COMPLETED)
    ).count()
    failed_tasks = db.query(models.VectorTask).filter(
        and_(models.VectorTask.batch_id == batch_id, models.VectorTask.status == TaskStatus.FAILED)
    ).count()
    pending_tasks = total_tasks - completed_tasks - failed_tasks
    
    failed_chunks = get_failed_chunks_by_batch(db, batch_id, resolved=False)
    retry_count = db.query(models.RetryQueue).filter(models.RetryQueue.batch_id == batch_id).count()
    
    return schemas.BatchReport(
        batch_id=db_batch.id,
        batch_name=db_batch.batch_name,
        status=db_batch.status,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        failed_tasks=failed_tasks,
        pending_tasks=pending_tasks,
        progress=db_batch.progress,
        started_at=db_batch.started_at,
        completed_at=db_batch.completed_at,
        failed_chunks=failed_chunks,
        retry_queue_count=retry_count
    )


def export_batch_data(db: Session, batch_id: int) -> Dict[str, Any]:
    db_batch = get_document_batch(db, batch_id)
    if not db_batch:
        return None
    
    tasks = get_vector_tasks_by_batch(db, batch_id, limit=10000)
    failed_chunks = get_failed_chunks_by_batch(db, batch_id)
    index_results = get_index_results_by_batch(db, batch_id)
    
    return {
        "batch": {
            "id": db_batch.id,
            "name": db_batch.batch_name,
            "status": db_batch.status,
            "progress": db_batch.progress,
            "created_at": db_batch.created_at.isoformat() if db_batch.created_at else None,
            "started_at": db_batch.started_at.isoformat() if db_batch.started_at else None,
            "completed_at": db_batch.completed_at.isoformat() if db_batch.completed_at else None,
        },
        "tasks": [
            {
                "id": t.id,
                "document_id": t.document_id,
                "status": t.status,
                "retry_count": t.retry_count,
                "error_message": t.error_message
            }
            for t in tasks
        ],
        "failed_chunks": [
            {
                "id": f.id,
                "task_id": f.task_id,
                "error_type": f.error_type,
                "error_message": f.error_message,
                "failed_at": f.failed_at.isoformat() if f.failed_at else None
            }
            for f in failed_chunks
        ],
        "index_results": [
            {
                "id": i.id,
                "task_id": i.task_id,
                "vector_id": i.vector_id,
                "verified": i.verified,
                "indexed_at": i.indexed_at.isoformat() if i.indexed_at else None
            }
            for i in index_results
        ]
    }


def cleanup_dirty_data(db: Session, batch_id: Optional[int] = None) -> Dict[str, int]:
    cleaned = {
        "orphaned_tasks": 0,
        "stuck_processing": 0,
        "duplicate_indexes": 0
    }
    
    existing_batch_ids = {b.id for b in db.query(models.DocumentBatch).all()}
    
    if batch_id:
        batches = [get_document_batch(db, batch_id)]
    else:
        batches = db.query(models.DocumentBatch).all()
    
    for batch in batches:
        if not batch:
            continue
        
        cutoff_time = datetime.now() - timedelta(hours=2)
        stuck_tasks = db.query(models.VectorTask).filter(
            and_(
                models.VectorTask.batch_id == batch.id,
                models.VectorTask.status == TaskStatus.PROCESSING,
                models.VectorTask.processing_started_at < cutoff_time
            )
        ).all()
        
        for task in stuck_tasks:
            task.status = TaskStatus.PENDING
            cleaned["stuck_processing"] += 1
        
        db.commit()
        
        index_results = db.query(models.IndexResult).filter(
            models.IndexResult.batch_id == batch.id
        ).all()
        
        seen_task_ids = set()
        seen_vector_ids = set()
        for idx in index_results:
            is_duplicate = False
            if idx.task_id and idx.task_id in seen_task_ids:
                is_duplicate = True
            if idx.vector_id and idx.vector_id in seen_vector_ids:
                is_duplicate = True
            
            if is_duplicate:
                db.delete(idx)
                cleaned["duplicate_indexes"] += 1
            else:
                if idx.task_id:
                    seen_task_ids.add(idx.task_id)
                if idx.vector_id:
                    seen_vector_ids.add(idx.vector_id)
        
        db.commit()
    
    if not batch_id:
        orphaned_tasks = db.query(models.VectorTask).filter(
            ~models.VectorTask.batch_id.in_(existing_batch_ids)
        ).all()
        
        for task in orphaned_tasks:
            db.delete(task)
            cleaned["orphaned_tasks"] += 1
        
        db.commit()
    
    return cleaned


def delete_document_batch(db: Session, batch_id: int) -> bool:
    db_batch = get_document_batch(db, batch_id)
    if not db_batch:
        return False
    
    db.delete(db_batch)
    db.commit()
    return True
