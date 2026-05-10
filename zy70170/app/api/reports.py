from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta

from app.database import get_db
from app.schemas import SchedulerReportOut, SchedulerLogOut
from app.models import GPU, Task, SchedulerLog, GPUStatus, TaskStatus
from sqlalchemy import func

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/scheduler", response_model=SchedulerReportOut)
def get_scheduler_report(db: Session = Depends(get_db)):
    total_gpus = db.query(GPU).count()
    available_gpus = db.query(GPU).filter(GPU.status == GPUStatus.AVAILABLE).count()
    occupied_gpus = db.query(GPU).filter(GPU.status == GPUStatus.OCCUPIED).count()
    maintenance_gpus = db.query(GPU).filter(GPU.status == GPUStatus.MAINTENANCE).count()
    
    total_tasks = db.query(Task).count()
    queued_tasks = db.query(Task).filter(Task.status == TaskStatus.QUEUED).count()
    running_tasks = db.query(Task).filter(Task.status == TaskStatus.RUNNING).count()
    succeeded_tasks = db.query(Task).filter(Task.status == TaskStatus.SUCCEEDED).count()
    failed_tasks = db.query(Task).filter(Task.status == TaskStatus.FAILED).count()
    timed_out_tasks = db.query(Task).filter(Task.status == TaskStatus.TIMED_OUT).count()
    cancelled_tasks = db.query(Task).filter(Task.status == TaskStatus.CANCELLED).count()
    
    queue_summary = []
    priority_groups = (
        db.query(Task.priority, func.count(Task.id))
        .filter(Task.status == TaskStatus.QUEUED)
        .group_by(Task.priority)
        .order_by(Task.priority.desc())
        .all()
    )
    for priority, count in priority_groups:
        queue_summary.append({"priority": priority, "count": count})
    
    recent_logs = (
        db.query(SchedulerLog)
        .order_by(SchedulerLog.id.desc())
        .limit(50)
        .all()
    )
    
    return SchedulerReportOut(
        generated_at=datetime.utcnow(),
        total_gpus=total_gpus,
        available_gpus=available_gpus,
        occupied_gpus=occupied_gpus,
        maintenance_gpus=maintenance_gpus,
        total_tasks=total_tasks,
        queued_tasks=queued_tasks,
        running_tasks=running_tasks,
        succeeded_tasks=succeeded_tasks,
        failed_tasks=failed_tasks,
        timed_out_tasks=timed_out_tasks,
        cancelled_tasks=cancelled_tasks,
        queue_summary=queue_summary,
        recent_activities=recent_logs
    )


@router.get("/scheduler-logs")
def get_scheduler_logs(
    event_type: Optional[str] = None,
    task_id: Optional[str] = None,
    gpu_id: Optional[str] = None,
    success: Optional[bool] = None,
    hours: int = Query(24, ge=1, le=720),
    limit: int = Query(200, ge=1, le=2000),
    db: Session = Depends(get_db)
):
    query = db.query(SchedulerLog)
    
    since = datetime.utcnow() - timedelta(hours=hours)
    query = query.filter(SchedulerLog.timestamp >= since)
    
    if event_type:
        query = query.filter(SchedulerLog.event_type == event_type)
    if task_id:
        query = query.filter(SchedulerLog.task_id == task_id)
    if gpu_id:
        query = query.filter(SchedulerLog.gpu_id == gpu_id)
    if success is not None:
        query = query.filter(SchedulerLog.success == success)
    
    logs = query.order_by(SchedulerLog.id.desc()).limit(limit).all()
    total = query.count()
    
    return {
        "total": total,
        "hours": hours,
        "logs": logs
    }


@router.get("/statistics")
def get_statistics(db: Session = Depends(get_db)):
    from app.models import Bill
    
    total_gpus = db.query(GPU).count()
    available_gpus = db.query(GPU).filter(GPU.status == GPUStatus.AVAILABLE).count()
    
    total_tasks = db.query(Task).count()
    running_tasks = db.query(Task).filter(Task.status == TaskStatus.RUNNING).count()
    queued_tasks = db.query(Task).filter(Task.status == TaskStatus.QUEUED).count()
    succeeded_tasks = db.query(Task).filter(Task.status == TaskStatus.SUCCEEDED).count()
    failed_tasks = db.query(Task).filter(
        (Task.status == TaskStatus.FAILED) |
        (Task.status == TaskStatus.TIMED_OUT)
    ).count()
    
    total_bills = db.query(Bill).count()
    total_seconds = db.query(func.sum(Bill.total_seconds)).scalar() or 0
    total_cost = db.query(func.sum(Bill.total_cost)).scalar() or 0
    
    success_rate = 0
    if (succeeded_tasks + failed_tasks) > 0:
        success_rate = round(succeeded_tasks / (succeeded_tasks + failed_tasks) * 100, 2)
    
    gpu_utilization = 0
    if total_gpus > 0:
        gpu_utilization = round(running_tasks / total_gpus * 100, 2)
    
    return {
        "gpu_statistics": {
            "total": total_gpus,
            "available": available_gpus,
            "occupied": running_tasks,
            "utilization_percent": gpu_utilization
        },
        "task_statistics": {
            "total": total_tasks,
            "running": running_tasks,
            "queued": queued_tasks,
            "succeeded": succeeded_tasks,
            "failed": failed_tasks,
            "success_rate_percent": success_rate
        },
        "billing_statistics": {
            "total_bills": total_bills,
            "total_seconds": int(total_seconds),
            "total_minutes": round(total_seconds / 60, 2),
            "total_cost": round(total_cost, 2)
        }
    }
