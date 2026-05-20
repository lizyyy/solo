import uuid
import hashlib
import asyncio
import httpx
from datetime import datetime
from sqlalchemy.orm import Session
from models import UploadTask, FileChunk, StatusHistory, UploadStatus, ChunkStatus
from schemas import UploadTaskCreate, ChunkRegister


def generate_task_id():
    return f"task_{uuid.uuid4().hex[:16]}"


def generate_chunk_id(task_id: str, chunk_number: int):
    return f"{task_id}_chunk_{chunk_number}"


def add_status_history(db: Session, task_id: str, previous_status: str, new_status: str,
                       changed_by: str = "system", note: str = None):
    history = StatusHistory(
        task_id=task_id,
        previous_status=previous_status,
        new_status=new_status,
        changed_by=changed_by,
        note=note
    )
    db.add(history)
    db.commit()
    return history


def create_upload_task(db: Session, task_data: UploadTaskCreate) -> UploadTask:
    total_chunks = (task_data.file_size + task_data.chunk_size - 1) // task_data.chunk_size
    
    task = UploadTask(
        id=generate_task_id(),
        file_name=task_data.file_name,
        file_size=task_data.file_size,
        total_chunks=total_chunks,
        chunk_size=task_data.chunk_size,
        file_hash=task_data.file_hash,
        status=UploadStatus.INITIALIZED,
        callback_url=task_data.callback_url,
        max_retries=task_data.max_retries
    )
    
    db.add(task)
    add_status_history(db, task.id, None, UploadStatus.INITIALIZED, note="任务创建")
    
    for chunk_num in range(total_chunks):
        chunk = FileChunk(
            id=generate_chunk_id(task.id, chunk_num),
            task_id=task.id,
            chunk_number=chunk_num,
            chunk_size=min(task_data.chunk_size, task_data.file_size - chunk_num * task_data.chunk_size),
            chunk_hash="",
            status=ChunkStatus.PENDING
        )
        db.add(chunk)
    
    db.commit()
    db.refresh(task)
    return task


def get_upload_task(db: Session, task_id: str) -> UploadTask:
    return db.query(UploadTask).filter(UploadTask.id == task_id).first()


def list_upload_tasks(db: Session, skip: int = 0, limit: int = 100, status: str = None):
    query = db.query(UploadTask)
    if status:
        query = query.filter(UploadTask.status == status)
    return query.order_by(UploadTask.created_at.desc()).offset(skip).limit(limit).all()


def register_chunk(db: Session, chunk_data: ChunkRegister) -> FileChunk:
    chunk = db.query(FileChunk).filter(
        FileChunk.task_id == chunk_data.task_id,
        FileChunk.chunk_number == chunk_data.chunk_number
    ).first()
    
    if chunk:
        chunk.chunk_hash = chunk_data.chunk_hash
        chunk.chunk_size = chunk_data.chunk_size
        chunk.status = ChunkStatus.UPLOADING
        
        task = get_upload_task(db, chunk_data.task_id)
        if task.status != UploadStatus.UPLOADING:
            update_task_status(db, task, UploadStatus.UPLOADING, "开始上传分片")
    
    db.commit()
    if chunk:
        db.refresh(chunk)
    return chunk


def complete_chunk_upload(db: Session, chunk_id: str, received_hash: str) -> FileChunk:
    chunk = db.query(FileChunk).filter(FileChunk.id == chunk_id).first()
    if not chunk:
        return None
    
    expected_hash = chunk.chunk_hash
    if expected_hash and expected_hash != received_hash:
        chunk.error_message = f"哈希校验失败: 期望 {expected_hash}, 实际 {received_hash}"
        chunk.retry_count += 1
        
        task = get_upload_task(db, chunk.task_id)
        
        if chunk.retry_count < task.max_retries:
            chunk.status = ChunkStatus.RETRYING
            add_status_history(db, task.id, task.status, task.status,
                              note=f"分片 {chunk.chunk_number} 哈希校验失败，准备重试 (第{chunk.retry_count}次)")
        else:
            chunk.status = ChunkStatus.FAILED
            task.error_message = f"分片 {chunk.chunk_number} 超过最大重试次数 ({task.max_retries}次): {chunk.error_message}"
            update_task_status(db, task, UploadStatus.FAILED, task.error_message)
        
        db.commit()
        db.refresh(chunk)
        return chunk
    
    chunk.status = ChunkStatus.VERIFIED
    chunk.uploaded_at = datetime.utcnow()
    chunk.verified_at = datetime.utcnow()
    chunk.error_message = None
    
    task = get_upload_task(db, chunk.task_id)
    update_resume_point(db, task)
    
    all_verified = all(c.status == ChunkStatus.VERIFIED for c in task.chunks)
    if all_verified:
        update_task_status(db, task, UploadStatus.VERIFYING, "所有分片上传完成，开始整体校验")
        verify_entire_file(db, task)
    
    db.commit()
    db.refresh(chunk)
    return chunk


def update_resume_point(db: Session, task: UploadTask):
    sorted_chunks = sorted(task.chunks, key=lambda c: c.chunk_number)
    resume_point = 0
    for chunk in sorted_chunks:
        if chunk.status in [ChunkStatus.VERIFIED, ChunkStatus.UPLOADED]:
            resume_point = chunk.chunk_number + 1
        else:
            break
    task.resume_point = resume_point
    db.commit()


def update_task_status(db: Session, task: UploadTask, new_status: str, note: str = None):
    old_status = task.status
    task.status = new_status
    add_status_history(db, task.id, old_status, new_status, note=note)
    db.commit()


def verify_entire_file(db: Session, task: UploadTask):
    task.status = UploadStatus.COMPLETED
    task.completed_at = datetime.utcnow()
    add_status_history(db, task.id, UploadStatus.VERIFYING, UploadStatus.COMPLETED, note="文件上传完成")
    
    if task.callback_url:
        trigger_completion_callback(task)
    
    db.commit()


def trigger_completion_callback(task: UploadTask):
    callback_payload = {
        "task_id": task.id,
        "file_name": task.file_name,
        "file_size": task.file_size,
        "total_chunks": task.total_chunks,
        "file_hash": task.file_hash,
        "status": task.status,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "callback_type": "upload_completed"
    }
    
    async def send_callback():
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(task.callback_url, json=callback_payload)
                print(f"回调通知: {task.callback_url} - 任务 {task.id} - 状态码: {response.status_code}")
        except Exception as e:
            print(f"回调通知失败: {task.callback_url} - 任务 {task.id} - 错误: {str(e)}")
    
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(send_callback())
        else:
            loop.run_until_complete(send_callback())
    except RuntimeError:
        asyncio.run(send_callback())


def mark_chunk_failed(db: Session, chunk_id: str, error_message: str) -> FileChunk:
    chunk = db.query(FileChunk).filter(FileChunk.id == chunk_id).first()
    if not chunk:
        return None
    
    chunk.error_message = error_message
    chunk.retry_count += 1
    
    task = get_upload_task(db, chunk.task_id)
    
    if chunk.retry_count < task.max_retries:
        chunk.status = ChunkStatus.RETRYING
        add_status_history(db, task.id, task.status, task.status, 
                          note=f"分片 {chunk.chunk_number} 准备重试 (第{chunk.retry_count}次)")
    else:
        chunk.status = ChunkStatus.FAILED
        task.error_message = f"分片 {chunk.chunk_number} 超过最大重试次数 ({task.max_retries}次): {error_message}"
        update_task_status(db, task, UploadStatus.FAILED, task.error_message)
    
    db.commit()
    db.refresh(chunk)
    return chunk


def retry_task(db: Session, task_id: str, reviewer: str = "admin") -> UploadTask:
    task = get_upload_task(db, task_id)
    if not task:
        return None
    
    task.retry_count += 1
    task.error_message = None
    
    for chunk in task.chunks:
        if chunk.status in [ChunkStatus.FAILED, ChunkStatus.RETRYING]:
            chunk.status = ChunkStatus.PENDING
            chunk.error_message = None
    
    update_task_status(db, task, UploadStatus.UPLOADING, 
                      f"人工复核重试 (操作人: {reviewer})")
    
    db.commit()
    db.refresh(task)
    return task


def pause_task(db: Session, task_id: str, reviewer: str = "admin") -> UploadTask:
    task = get_upload_task(db, task_id)
    if not task:
        return None
    
    update_task_status(db, task, UploadStatus.PAUSED, 
                      f"人工暂停 (操作人: {reviewer})")
    
    db.commit()
    db.refresh(task)
    return task


def resume_task(db: Session, task_id: str, reviewer: str = "admin") -> UploadTask:
    task = get_upload_task(db, task_id)
    if not task:
        return None
    
    update_task_status(db, task, UploadStatus.UPLOADING, 
                      f"人工恢复 (操作人: {reviewer})")
    
    db.commit()
    db.refresh(task)
    return task


def export_task_data(db: Session, task_id: str) -> dict:
    task = get_upload_task(db, task_id)
    if not task:
        return None
    
    return {
        "task": {
            "id": task.id,
            "file_name": task.file_name,
            "file_size": task.file_size,
            "total_chunks": task.total_chunks,
            "status": task.status,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        },
        "chunks": [
            {
                "id": c.id,
                "number": c.chunk_number,
                "size": c.chunk_size,
                "status": c.status,
                "retry_count": c.retry_count,
                "error": c.error_message
            }
            for c in sorted(task.chunks, key=lambda x: x.chunk_number)
        ],
        "history": [
            {
                "time": h.changed_at.isoformat() if h.changed_at else None,
                "from": h.previous_status,
                "to": h.new_status,
                "by": h.changed_by,
                "note": h.note
            }
            for h in sorted(task.history, key=lambda x: x.changed_at)
        ]
    }
