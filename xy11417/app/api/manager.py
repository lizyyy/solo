from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import RoleChecker
from app.core.config import UserRole, TaskStatus, RetryCategory
from app.models import User
from app.schemas import ManagerDashboard
from app.services.report_service import ReportService

router = APIRouter(dependencies=[Depends(RoleChecker([UserRole.MANAGER]))])

@router.get("/dashboard", response_model=ManagerDashboard)
def get_manager_dashboard(
    current_user: User = Depends(RoleChecker([UserRole.MANAGER])),
    db: Session = Depends(get_db)
):
    service = ReportService(db)
    return service.get_manager_dashboard()

@router.get("/dead-letter-summary")
def get_dead_letter_summary(
    current_user: User = Depends(RoleChecker([UserRole.MANAGER])),
    db: Session = Depends(get_db)
):
    service = ReportService(db)
    return service.get_dead_letter_summary()

@router.get("/recovery-stats")
def get_recovery_stats(
    current_user: User = Depends(RoleChecker([UserRole.MANAGER])),
    db: Session = Depends(get_db)
):
    service = ReportService(db)
    return service.get_recovery_stats()

@router.post("/dead-letter/batch-retry")
async def batch_retry_dead_letter(
    category: RetryCategory = None,
    dry_run: bool = True,
    current_user: User = Depends(RoleChecker([UserRole.MANAGER])),
    db: Session = Depends(get_db)
):
    from app.models import RepairTask
    from datetime import datetime
    
    query = db.query(RepairTask).filter(
        RepairTask.status == TaskStatus.DEAD_LETTER.value
    )
    
    if category:
        query = query.filter(RepairTask.retry_category == category.value)
    
    tasks = query.all()
    
    if dry_run:
        return {
            "message": "Dry run completed",
            "tasks_to_retry": len(tasks),
            "category": category.value if category else "all",
            "task_ids": [t.task_id for t in tasks[:20]]
        }
    
    from main import queue_manager
    
    for task in tasks:
        task.status = TaskStatus.PENDING.value
        task.retry_count = 0
        task.next_retry_at = None
        task.manual_review_required = False
        await queue_manager.task_queue.put(task.task_id)
    
    db.commit()
    
    return {
        "message": f"Successfully queued {len(tasks)} tasks for retry",
        "tasks_retried": len(tasks),
        "category": category.value if category else "all"
    }

@router.post("/dead-letter/resolve")
def resolve_dead_letter_task(
    task_id: str,
    resolution_notes: str,
    current_user: User = Depends(RoleChecker([UserRole.MANAGER])),
    db: Session = Depends(get_db)
):
    from app.models import RepairTask, FailedRecord
    from datetime import datetime
    
    task = db.query(RepairTask).filter(RepairTask.task_id == task_id).first()
    if not task:
        return {"error": "Task not found"}
    
    task.status = TaskStatus.CLOSED.value
    task.closed_at = datetime.utcnow()
    task.closed_by = current_user.id
    
    failed_records = db.query(FailedRecord).filter(
        FailedRecord.task_id == task_id,
        FailedRecord.is_resolved == False
    ).all()
    
    for fr in failed_records:
        fr.is_resolved = True
        fr.resolved_at = datetime.utcnow()
        fr.resolved_by = current_user.id
        fr.resolution_notes = resolution_notes
    
    db.commit()
    
    return {
        "message": "Dead letter task resolved and closed",
        "task_id": task_id,
        "resolution_notes": resolution_notes
    }
