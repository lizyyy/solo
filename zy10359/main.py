from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid

from database import engine, get_db, Base
from models import Task, TaskStatus
from schemas import TaskResponse, TaskCreate, ErrorResponse
from services import TaskService, ConversionService, PREVIEW_DIR

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="文件预览转换 API",
    description="一个小而完整的 API 状态闭环验证项目，实现文件预览转换的全流程管理",
    version="1.0.0"
)

templates = Jinja2Templates(directory="templates")


@app.get("/", response_class=HTMLResponse)
async def admin_page(request: Request, db: Session = Depends(get_db)):
    task_service = TaskService(db)
    tasks = task_service.get_all_tasks()
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "tasks": tasks, "TaskStatus": TaskStatus}
    )


@app.post("/api/tasks", response_model=TaskResponse, responses={400: {"model": ErrorResponse}})
async def create_task(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    handler: Optional[str] = Form("system"),
    db: Session = Depends(get_db)
):
    task_service = TaskService(db)
    task_id = str(uuid.uuid4())
    
    file_path, file_size, file_hash = await task_service.save_uploaded_file(file, task_id)
    
    task_data = TaskCreate(
        filename=file.filename,
        file_size=file_size,
        file_hash=file_hash,
        file_path=file_path,
        handler=handler
    )
    
    task = task_service.create_task(task_data)
    
    conversion_service = ConversionService(task_service)
    background_tasks.add_task(conversion_service.process_queue)
    
    return task


@app.get("/api/tasks", response_model=List[TaskResponse])
def list_tasks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    task_service = TaskService(db)
    return task_service.get_all_tasks(skip=skip, limit=limit)


@app.get("/api/tasks/{task_id}", response_model=TaskResponse, responses={404: {"model": ErrorResponse}})
def get_task(task_id: str, db: Session = Depends(get_db)):
    task_service = TaskService(db)
    task = task_service.get_task(task_id)
    if not task:
        raise HTTPException(
            status_code=404,
            detail={"message": "任务不存在", "code": "TASK_NOT_FOUND", "task_id": task_id}
        )
    return task


@app.post("/api/tasks/{task_id}/retry", response_model=TaskResponse, responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
async def retry_task(
    task_id: str,
    background_tasks: BackgroundTasks,
    handler: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    task_service = TaskService(db)
    task = task_service.get_task(task_id)
    
    if not task:
        raise HTTPException(
            status_code=404,
            detail={"message": "任务不存在", "code": "TASK_NOT_FOUND", "task_id": task_id}
        )
    
    try:
        task = task_service.retry_task(task_id, handler)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={"message": str(e), "code": "MAX_RETRIES_REACHED", "task_id": task_id}
        )
    
    conversion_service = ConversionService(task_service)
    background_tasks.add_task(conversion_service.process_queue)
    
    return task


@app.get("/api/tasks/{task_id}/preview", responses={404: {"model": ErrorResponse}, 400: {"model": ErrorResponse}})
def get_preview(task_id: str, db: Session = Depends(get_db)):
    task_service = TaskService(db)
    task = task_service.get_task(task_id)
    
    if not task:
        raise HTTPException(
            status_code=404,
            detail={"message": "任务不存在", "code": "TASK_NOT_FOUND", "task_id": task_id}
        )
    
    if task.status != TaskStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail={"message": "任务尚未完成，无法预览", "code": "TASK_NOT_COMPLETED", "task_id": task_id}
        )
    
    if not task.preview_path:
        raise HTTPException(
            status_code=404,
            detail={"message": "预览文件不存在", "code": "PREVIEW_NOT_FOUND", "task_id": task_id}
        )
    
    return FileResponse(task.preview_path, media_type="text/html")


@app.get("/api/previews/{filename}")
async def get_preview_file(filename: str):
    file_path = f"{PREVIEW_DIR}/{filename}"
    return FileResponse(file_path, media_type="text/html")


@app.get("/api/status/{task_id}")
async def get_task_status(task_id: str, db: Session = Depends(get_db)):
    task_service = TaskService(db)
    task = task_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {
        "task_id": task.id,
        "status": task.status.value,
        "status_text": {
            "PENDING": "排队中",
            "UPLOADED": "已上传",
            "PROCESSING": "转换中",
            "GENERATING_PREVIEW": "生成预览中",
            "COMPLETED": "已完成",
            "FAILED": "已失败"
        }.get(task.status.value, "未知"),
        "retry_count": task.retry_count,
        "max_retries": task.max_retries,
        "failed_stage": task.failed_stage.value if task.failed_stage else None,
        "error_message": task.error_message
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
