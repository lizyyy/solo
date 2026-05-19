from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from database import get_db, init_db
from schemas import (
    PipelineTaskCreate, PipelineTaskUpdate, PipelineTaskResponse,
    WriteSummaryCreate, WriteSummaryResponse,
    ResumeCommandCreate, ResumeCommandResponse,
    PendingTasksResponse, ExportSummaryResponse,
    ErrorCode, TaskStatus
)
from service import PipelineService
from datetime import datetime

app = FastAPI(title="断点续跑水位保护API", version="1.0.0")


@app.on_event("startup")
def startup_event():
    init_db()


@app.post("/tasks/", response_model=PipelineTaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(task_create: PipelineTaskCreate, db: Session = Depends(get_db)):
    service = PipelineService(db)
    task, error = service.create_task(task_create)
    if error:
        if "overlap" in error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": ErrorCode.SHARD_OVERLAP,
                    "message": error,
                    "details": {"task_id": task.id if task else None}
                }
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": ErrorCode.MISSING_FIELD, "message": error}
        )
    return task


@app.get("/tasks/{task_id}", response_model=PipelineTaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    service = PipelineService(db)
    task = service.get_task(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": ErrorCode.MISSING_FIELD, "message": "Task not found"}
        )
    return task


@app.put("/tasks/{task_id}", response_model=PipelineTaskResponse)
def update_task(task_id: int, update: PipelineTaskUpdate, db: Session = Depends(get_db)):
    service = PipelineService(db)
    task, error = service.update_task_status(task_id, update)
    if error:
        if "already completed" in error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": ErrorCode.ALREADY_PROCESSED,
                    "message": error
                }
            )
        elif "Cannot modify skipped task" in error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": ErrorCode.ALREADY_PROCESSED,
                    "message": error
                }
            )
        elif "manual review" in error:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": ErrorCode.NEED_MANUAL_REVIEW,
                    "message": error
                }
            )
        elif "Watermark cannot go backward" in error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": ErrorCode.WATERMARK_CONFLICT,
                    "message": error
                }
            )
        elif "Invalid state transition" in error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error_code": ErrorCode.INVALID_STATUS, "message": error}
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": ErrorCode.INVALID_STATUS, "message": error}
        )
    return task


@app.get("/pipelines/{pipeline_name}/pending-tasks", response_model=PendingTasksResponse)
def get_pending_tasks(pipeline_name: str, min_watermark: int = 0, db: Session = Depends(get_db)):
    service = PipelineService(db)
    tasks = service.get_pending_tasks(pipeline_name, min_watermark)
    return {"tasks": tasks, "total": len(tasks)}


@app.post("/resume-commands/", response_model=PendingTasksResponse)
def execute_resume_command(cmd_create: ResumeCommandCreate, db: Session = Depends(get_db)):
    service = PipelineService(db)
    tasks, error = service.execute_resume_command(cmd_create)
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": ErrorCode.INVALID_STATUS, "message": error}
        )
    return {"tasks": tasks, "total": len(tasks)}


@app.post("/write-summaries/", response_model=WriteSummaryResponse, status_code=status.HTTP_201_CREATED)
def create_write_summary(summary_create: WriteSummaryCreate, db: Session = Depends(get_db)):
    service = PipelineService(db)
    summary = service.create_write_summary(summary_create)
    return summary


@app.get("/pipelines/{pipeline_name}/write-summaries", response_model=list[WriteSummaryResponse])
def get_write_summaries(pipeline_name: str, start_date: datetime = None, end_date: datetime = None,
                        db: Session = Depends(get_db)):
    service = PipelineService(db)
    summaries = service.get_write_summaries(pipeline_name, start_date, end_date)
    return summaries


@app.get("/pipelines/{pipeline_name}/export-summaries", response_model=ExportSummaryResponse)
def export_summaries(pipeline_name: str, start_date: datetime = None, end_date: datetime = None,
                     download: bool = False, db: Session = Depends(get_db)):
    service = PipelineService(db)
    filename, result = service.export_summaries_to_csv(pipeline_name, start_date, end_date)
    if not filename:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": ErrorCode.MISSING_FIELD, "message": "No summaries to export"}
        )
    if download:
        return Response(
            content=result["content"],
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    return {
        "file_name": filename,
        "export_count": result["export_count"],
        "total_writes": result["total_writes"],
        "total_updates": result["total_updates"],
        "total_skips": result["total_skips"],
        "total_errors": result["total_errors"]
    }


@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}
