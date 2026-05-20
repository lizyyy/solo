from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import json

from database import engine, get_db, Base
from models import UploadStatus, ChunkStatus
from schemas import (
    UploadTaskCreate, UploadTaskResponse, UploadTaskDetail,
    ChunkRegister, ChunkResponse, ChunkUploadComplete,
    TaskReview, SuccessResponse, ErrorResponse
)
import services

Base.metadata.create_all(bind=engine)

app = FastAPI(title="分片上传协调器", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return FileResponse("../frontend/index.html")


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "分片上传协调器"}


@app.post("/api/tasks", response_model=UploadTaskResponse, status_code=201)
async def create_task(task_data: UploadTaskCreate, db: Session = Depends(get_db)):
    task = services.create_upload_task(db, task_data)
    return task


@app.get("/api/tasks", response_model=List[UploadTaskResponse])
async def list_tasks(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    tasks = services.list_upload_tasks(db, skip, limit, status)
    return tasks


@app.get("/api/tasks/{task_id}", response_model=UploadTaskDetail)
async def get_task(task_id: str, db: Session = Depends(get_db)):
    task = services.get_upload_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@app.post("/api/chunks/register", response_model=ChunkResponse)
async def register_chunk(chunk_data: ChunkRegister, db: Session = Depends(get_db)):
    task = services.get_upload_task(db, chunk_data.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    chunk = services.register_chunk(db, chunk_data)
    if not chunk:
        raise HTTPException(status_code=404, detail="分片不存在")
    return chunk


@app.post("/api/chunks/complete", response_model=ChunkResponse)
async def complete_chunk(upload_data: ChunkUploadComplete, db: Session = Depends(get_db)):
    chunk = services.complete_chunk_upload(db, upload_data.chunk_id, upload_data.chunk_hash)
    if not chunk:
        raise HTTPException(status_code=404, detail="分片不存在")
    return chunk


@app.post("/api/chunks/{chunk_id}/fail", response_model=ChunkResponse)
async def mark_chunk_failed(chunk_id: str, error_data: dict, db: Session = Depends(get_db)):
    error_message = error_data.get("error_message", "未知错误")
    chunk = services.mark_chunk_failed(db, chunk_id, error_message)
    if not chunk:
        raise HTTPException(status_code=404, detail="分片不存在")
    return chunk


@app.post("/api/tasks/{task_id}/review", response_model=SuccessResponse)
async def review_task(task_id: str, review_data: TaskReview, db: Session = Depends(get_db)):
    task = services.get_upload_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    action = review_data.action.lower()
    
    if action == "retry":
        updated_task = services.retry_task(db, task_id, reviewer="admin")
        return SuccessResponse(
            success=True,
            message="任务已重试",
            data={"task_id": task_id, "new_status": updated_task.status}
        )
    elif action == "pause":
        updated_task = services.pause_task(db, task_id, reviewer="admin")
        return SuccessResponse(
            success=True,
            message="任务已暂停",
            data={"task_id": task_id, "new_status": updated_task.status}
        )
    elif action == "resume":
        updated_task = services.resume_task(db, task_id, reviewer="admin")
        return SuccessResponse(
            success=True,
            message="任务已恢复",
            data={"task_id": task_id, "new_status": updated_task.status}
        )
    else:
        raise HTTPException(status_code=400, detail=f"不支持的操作: {action}")


@app.get("/api/tasks/{task_id}/export")
async def export_task(task_id: str, db: Session = Depends(get_db)):
    data = services.export_task_data(db, task_id)
    if not data:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    return JSONResponse(
        content=data,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=task_{task_id}_export.json"}
    )


@app.get("/api/stats")
async def get_stats(db: Session = Depends(get_db)):
    from sqlalchemy import func
    from models import UploadTask, FileChunk
    
    stats = {
        "total_tasks": db.query(func.count(UploadTask.id)).scalar(),
        "tasks_by_status": {},
        "total_chunks": db.query(func.count(FileChunk.id)).scalar(),
        "failed_chunks": db.query(func.count(FileChunk.id)).filter(FileChunk.status == ChunkStatus.FAILED).scalar()
    }
    
    for status in UploadStatus:
        count = db.query(func.count(UploadTask.id)).filter(UploadTask.status == status.value).scalar()
        stats["tasks_by_status"][status.value] = count
    
    return stats


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
