import uuid
import json
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from celery.result import AsyncResult

from app.database import get_db, init_db
from app.models import Task, TaskStatus, DeadLetter
from app.schemas import (
    TaskCreateRequest,
    TaskCreateResponse,
    TaskResponse,
    TaskCancelResponse,
    DeadLetterReplayResponse,
    TaskListResponse
)
from app.tasks import process_contract_task, replay_dead_letter_task
from app.celery_app import celery_app

app = FastAPI(title="Contract Scanner API", version="1.0.0")


@app.on_event("startup")
def startup_event():
    init_db()


@app.post("/tasks", response_model=TaskCreateResponse, status_code=201)
def create_task(
    request: TaskCreateRequest,
    db: Session = Depends(get_db)
):
    task_id = f"task_{uuid.uuid4().hex[:12]}"
    
    task = Task(
        id=task_id,
        contract_name=request.contract_name,
        status=TaskStatus.PENDING
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    
    celery_task = process_contract_task.apply_async(
        args=[task_id, request.contract_name, request.force_fail]
    )
    
    task.celery_task_id = celery_task.id
    db.commit()
    
    return TaskCreateResponse(
        task_id=task_id,
        celery_task_id=celery_task.id,
        message=f"Task {task_id} created and submitted to queue"
    )


@app.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: str,
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    return task


@app.get("/tasks", response_model=TaskListResponse)
def list_tasks(
    status: Optional[TaskStatus] = Query(None, description="Filter by task status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(Task)
    if status:
        query = query.filter(Task.status == status)
    
    total = query.count()
    tasks = query.order_by(Task.created_at.desc()).offset(skip).limit(limit).all()
    
    return TaskListResponse(tasks=tasks, total=total)


@app.delete("/tasks/{task_id}", response_model=TaskCancelResponse)
def cancel_task(
    task_id: str,
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    if task.status not in [TaskStatus.PENDING, TaskStatus.RETRYING]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel task with status: {task.status}. Only pending or retrying tasks can be cancelled."
        )
    
    if task.celery_task_id:
        try:
            celery_app.control.revoke(task.celery_task_id, terminate=True)
        except Exception:
            pass
    
    task.status = TaskStatus.CANCELLED
    db.commit()
    
    return TaskCancelResponse(
        task_id=task_id,
        status=TaskStatus.CANCELLED,
        message=f"Task {task_id} cancelled successfully"
    )


@app.get("/dead-letters")
def list_dead_letters(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    dead_letters = db.query(DeadLetter).order_by(DeadLetter.created_at.desc()).offset(skip).limit(limit).all()
    total = db.query(DeadLetter).count()
    
    return {
        "dead_letters": [
            {
                "id": dl.id,
                "task_id": dl.task_id,
                "contract_name": dl.task.contract_name,
                "reason": dl.reason,
                "last_error": dl.last_error,
                "created_at": dl.created_at,
                "replayed": dl.replayed
            }
            for dl in dead_letters
        ],
        "total": total
    }


@app.post("/dead-letters/{dead_letter_id}/replay", response_model=DeadLetterReplayResponse)
def replay_dead_letter(
    dead_letter_id: int,
    db: Session = Depends(get_db)
):
    dead_letter = db.query(DeadLetter).filter(DeadLetter.id == dead_letter_id).first()
    if not dead_letter:
        raise HTTPException(status_code=404, detail=f"Dead letter {dead_letter_id} not found")
    
    celery_task = replay_dead_letter_task.apply_async(args=[dead_letter_id])
    
    return DeadLetterReplayResponse(
        dead_letter_id=dead_letter_id,
        task_id=dead_letter.task_id,
        status="submitted",
        message=f"Dead letter {dead_letter_id} replayed. Celery task: {celery_task.id}"
    )


@app.get("/tasks/{task_id}/export/json")
def export_task_json(
    task_id: str,
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    export_data = {
        "task_id": task.id,
        "contract_name": task.contract_name,
        "status": task.status.value,
        "retry_count": task.retry_count,
        "max_retries": task.max_retries,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "updated_at": task.updated_at.isoformat() if task.updated_at else None,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "steps": [
            {
                "step_type": log.step_type.value,
                "status": log.status,
                "message": log.message,
                "duration_seconds": log.duration_seconds,
                "created_at": log.created_at.isoformat()
            }
            for log in sorted(task.step_logs, key=lambda x: x.created_at)
        ],
        "retries": [
            {
                "retry_number": retry.retry_number,
                "failed_step": retry.failed_step.value,
                "error_message": retry.error_message,
                "created_at": retry.created_at.isoformat()
            }
            for retry in sorted(task.retries, key=lambda x: x.created_at)
        ],
        "dead_letter": {
            "reason": task.dead_letter.reason,
            "last_error": task.dead_letter.last_error,
            "replayed": task.dead_letter.replayed,
            "created_at": task.dead_letter.created_at.isoformat()
        } if task.dead_letter else None
    }
    
    return export_data


@app.get("/tasks/{task_id}/export/markdown", response_class=PlainTextResponse)
def export_task_markdown(
    task_id: str,
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    lines = []
    lines.append(f"# 合同扫描任务报告")
    lines.append(f"")
    lines.append(f"## 基本信息")
    lines.append(f"")
    lines.append(f"| 字段 | 值 |")
    lines.append(f"|------|-----|")
    lines.append(f"| 任务ID | `{task.id}` |")
    lines.append(f"| 合同名称 | {task.contract_name} |")
    lines.append(f"| 当前状态 | **{task.status.value.upper()}** |")
    lines.append(f"| 重试次数 | {task.retry_count} / {task.max_retries} |")
    lines.append(f"| 创建时间 | {task.created_at.strftime('%Y-%m-%d %H:%M:%S UTC') if task.created_at else '-'} |")
    lines.append(f"| 更新时间 | {task.updated_at.strftime('%Y-%m-%d %H:%M:%S UTC') if task.updated_at else '-'} |")
    lines.append(f"| 完成时间 | {task.completed_at.strftime('%Y-%m-%d %H:%M:%S UTC') if task.completed_at else '-'} |")
    lines.append(f"")
    
    lines.append(f"## 执行步骤")
    lines.append(f"")
    if task.step_logs:
        lines.append(f"| 步骤 | 状态 | 消息 | 耗时 | 时间 |")
        lines.append(f"|------|------|------|------|------|")
        for log in sorted(task.step_logs, key=lambda x: x.created_at):
            status_icon = "✅" if log.status == "success" else "❌" if log.status == "failed" else "⏳"
            lines.append(f"| {log.step_type.value.upper()} | {status_icon} {log.status.upper()} | {log.message or '-'} | {log.duration_seconds}s | {log.created_at.strftime('%H:%M:%S')} |")
    else:
        lines.append(f"暂无步骤记录")
    lines.append(f"")
    
    if task.retries:
        lines.append(f"## 重试记录")
        lines.append(f"")
        for i, retry in enumerate(sorted(task.retries, key=lambda x: x.created_at), 1):
            lines.append(f"### 第 {retry.retry_number} 次重试")
            lines.append(f"")
            lines.append(f"- **失败步骤**: {retry.failed_step.value.upper()}")
            lines.append(f"- **错误信息**: {retry.error_message}")
            lines.append(f"- **时间**: {retry.created_at.strftime('%Y-%m-%d %H:%M:%S UTC')}")
            lines.append(f"")
    
    if task.dead_letter:
        lines.append(f"## 死信信息")
        lines.append(f"")
        lines.append(f"| 字段 | 值 |")
        lines.append(f"|------|-----|")
        lines.append(f"| 死信原因 | {task.dead_letter.reason} |")
        lines.append(f"| 最后错误 | {task.dead_letter.last_error} |")
        lines.append(f"| 已重放次数 | {task.dead_letter.replayed} |")
        lines.append(f"| 死信时间 | {task.dead_letter.created_at.strftime('%Y-%m-%d %H:%M:%S UTC')} |")
        lines.append(f"")
    
    lines.append(f"---")
    lines.append(f"*报告生成时间: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}*")
    
    return "\n".join(lines)


@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}
