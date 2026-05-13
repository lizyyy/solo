import os
import hashlib
import asyncio
from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session
from fastapi import UploadFile
import aiofiles

from models import Task, TaskStatus, ConversionStage
from schemas import TaskCreate, TaskUpdate


UPLOAD_DIR = "uploads"
PREVIEW_DIR = "previews"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PREVIEW_DIR, exist_ok=True)


class TaskService:
    def __init__(self, db: Session):
        self.db = db

    def calculate_file_hash(self, file_content: bytes) -> str:
        return hashlib.sha256(file_content).hexdigest()

    def get_existing_task(self, file_hash: str, filename: str) -> Optional[Task]:
        return self.db.query(Task).filter(
            Task.file_hash == file_hash,
            Task.filename == filename
        ).first()

    async def save_uploaded_file(self, file: UploadFile, task_id: str) -> tuple[str, int, str]:
        ext = os.path.splitext(file.filename)[1]
        safe_filename = f"{task_id}{ext}"
        file_path = os.path.join(UPLOAD_DIR, safe_filename)
        
        file_content = await file.read()
        file_size = len(file_content)
        file_hash = self.calculate_file_hash(file_content)
        
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(file_content)
        
        return file_path, file_size, file_hash

    def create_task(self, task_data: TaskCreate) -> Task:
        existing_task = self.get_existing_task(task_data.file_hash, task_data.filename)
        if existing_task:
            return existing_task
        
        task = Task(
            filename=task_data.filename,
            file_hash=task_data.file_hash,
            file_size=task_data.file_size,
            file_path=task_data.file_path,
            handler=task_data.handler,
            status=TaskStatus.PENDING
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def get_task(self, task_id: str) -> Optional[Task]:
        return self.db.query(Task).filter(Task.id == task_id).first()

    def get_all_tasks(self, skip: int = 0, limit: int = 100) -> List[Task]:
        return self.db.query(Task).order_by(Task.created_at.desc()).offset(skip).limit(limit).all()

    def update_task(self, task_id: str, task_update: TaskUpdate) -> Optional[Task]:
        task = self.get_task(task_id)
        if not task:
            return None
        
        update_data = task_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(task, key, value)
        
        self.db.commit()
        self.db.refresh(task)
        return task

    def update_task_status(self, task: Task, status: TaskStatus):
        task.status = status
        task.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(task)

    def mark_task_failed(self, task: Task, stage: ConversionStage, error_message: str):
        task.status = TaskStatus.FAILED
        task.failed_stage = stage
        task.error_message = error_message
        task.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(task)

    def mark_task_completed(self, task: Task, preview_url: str, preview_path: str):
        task.status = TaskStatus.COMPLETED
        task.preview_url = preview_url
        task.preview_path = preview_path
        task.completed_at = datetime.utcnow()
        task.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(task)

    def retry_task(self, task_id: str, handler: Optional[str] = None) -> Optional[Task]:
        task = self.get_task(task_id)
        if not task:
            return None
        
        if task.retry_count >= task.max_retries:
            raise ValueError("已达到最大重试次数")
        
        task.retry_count += 1
        task.status = TaskStatus.PENDING
        task.error_message = None
        task.failed_stage = None
        if handler:
            task.handler = handler
        task.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(task)
        return task

    def get_tasks_by_status(self, status: TaskStatus) -> List[Task]:
        return self.db.query(Task).filter(Task.status == status).order_by(Task.created_at).all()


class ConversionService:
    def __init__(self, task_service: TaskService):
        self.task_service = task_service
        self._processing = False

    async def simulate_conversion(self, task: Task) -> tuple[bool, Optional[str]]:
        filename = task.filename.lower()
        
        try:
            self.task_service.update_task_status(task, TaskStatus.UPLOADED)
            await asyncio.sleep(0.5)
            
            self.task_service.update_task_status(task, TaskStatus.PROCESSING)
            await asyncio.sleep(1)
            
            if filename.endswith('.fail'):
                raise Exception("模拟转换失败：文件格式不支持")
            
            if filename.endswith('.slow'):
                await asyncio.sleep(2)
            
            self.task_service.update_task_status(task, TaskStatus.GENERATING_PREVIEW)
            await asyncio.sleep(0.5)
            
            preview_filename = f"{task.id}_preview.html"
            preview_path = os.path.join(PREVIEW_DIR, preview_filename)
            
            async with aiofiles.open(preview_path, 'w', encoding='utf-8') as f:
                await f.write(f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>预览 - {task.filename}</title>
    <style>
        body {{ font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5; }}
        .preview-container {{ background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        h1 {{ color: #333; }}
        .meta {{ color: #666; margin: 20px 0; }}
        .content {{ border: 2px dashed #ccc; padding: 40px; text-align: center; color: #999; }}
    </style>
</head>
<body>
    <div class="preview-container">
        <h1>📄 {task.filename}</h1>
        <div class="meta">
            <p>任务 ID: {task.id}</p>
            <p>文件大小: {task.file_size} bytes</p>
            <p>处理人: {task.handler}</p>
            <p>处理时间: {datetime.utcnow().isoformat()}</p>
        </div>
        <div class="content">
            <h2>这是模拟的文件预览内容</h2>
            <p>实际应用中这里会显示转换后的文件内容</p>
        </div>
    </div>
</body>
</html>
                """)
            
            preview_url = f"/api/previews/{preview_filename}"
            return True, preview_url, preview_path
            
        except Exception as e:
            return False, str(e), None

    async def process_task(self, task: Task):
        try:
            success, result, preview_path = await self.simulate_conversion(task)
            if success:
                self.task_service.mark_task_completed(task, result, preview_path)
            else:
                self.task_service.mark_task_failed(
                    task, 
                    ConversionStage.TRANSFORMATION,
                    result
                )
                
                if task.retry_count < task.max_retries - 1:
                    await asyncio.sleep(1)
                    self.task_service.retry_task(task.id)
                    await self.process_task(self.task_service.get_task(task.id))
                    
        except Exception as e:
            self.task_service.mark_task_failed(
                task,
                ConversionStage.TRANSFORMATION,
                str(e)
            )

    async def process_queue(self):
        if self._processing:
            return
        
        self._processing = True
        try:
            pending_tasks = self.task_service.get_tasks_by_status(TaskStatus.PENDING)
            for task in pending_tasks:
                await self.process_task(task)
        finally:
            self._processing = False
