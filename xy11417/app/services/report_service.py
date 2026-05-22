from datetime import datetime, timedelta
from typing import List, Dict, Any
from sqlalchemy import func, and_
from sqlalchemy.orm import Session
from app.models import RepairTask, FailedRecord, ProcessLog, SourceData
from app.core.config import TaskStatus, RetryCategory, SourceType
from app.schemas.reports import (
    TaskSummaryReport, RetryCategoryStats, DeadLetterSummary,
    RecoveryStats, ManagerDashboard
)

class ReportService:
    def __init__(self, db: Session):
        self.db = db
    
    def get_task_summary(self) -> TaskSummaryReport:
        status_counts = self.db.query(
            RepairTask.status,
            func.count(RepairTask.id)
        ).group_by(RepairTask.status).all()
        
        status_map = {s: 0 for s in TaskStatus}
        for status, count in status_counts:
            status_map[status] = count
        
        total_tasks = sum(status_map.values())
        success_tasks = status_map.get(TaskStatus.SUCCESS.value, 0)
        success_rate = (success_tasks / total_tasks * 100) if total_tasks > 0 else 0.0
        
        avg_retry_result = self.db.query(
            func.avg(RepairTask.retry_count)
        ).filter(RepairTask.status == TaskStatus.SUCCESS.value).scalar()
        
        total_compensation = self.db.query(
            func.sum(RepairTask.compensation_amount)
        ).scalar() or 0.0
        
        return TaskSummaryReport(
            total_tasks=total_tasks,
            pending_tasks=status_map.get(TaskStatus.PENDING.value, 0),
            processing_tasks=status_map.get(TaskStatus.PROCESSING.value, 0),
            retrying_tasks=status_map.get(TaskStatus.RETRYING.value, 0),
            success_tasks=success_tasks,
            failed_tasks=status_map.get(TaskStatus.FAILED.value, 0),
            dead_letter_tasks=status_map.get(TaskStatus.DEAD_LETTER.value, 0),
            manual_review_tasks=status_map.get(TaskStatus.MANUAL_REVIEW.value, 0),
            compensated_tasks=status_map.get(TaskStatus.COMPENSATED.value, 0),
            closed_tasks=status_map.get(TaskStatus.CLOSED.value, 0),
            overall_success_rate=round(success_rate, 2),
            avg_retry_count=round(avg_retry_result or 0, 2),
            total_compensation_amount=total_compensation
        )
    
    def get_retry_category_stats(self) -> List[RetryCategoryStats]:
        results = []
        
        for category in RetryCategory:
            tasks = self.db.query(RepairTask).filter(
                RepairTask.retry_category == category.value
            ).all()
            
            if not tasks:
                continue
            
            total = len(tasks)
            success = sum(1 for t in tasks if t.status == TaskStatus.SUCCESS.value)
            success_rate = (success / total * 100) if total > 0 else 0.0
            avg_retries = sum(t.retry_count for t in tasks) / total
            
            results.append(RetryCategoryStats(
                category=category.value,
                count=total,
                success_rate=round(success_rate, 2),
                avg_retry_count=round(avg_retries, 2)
            ))
        
        return sorted(results, key=lambda x: x.count, reverse=True)
    
    def get_dead_letter_summary(self) -> DeadLetterSummary:
        deadline_24h = datetime.utcnow() - timedelta(hours=24)
        
        dead_letter_tasks = self.db.query(RepairTask).filter(
            RepairTask.status == TaskStatus.DEAD_LETTER.value
        ).all()
        
        by_category = {}
        for task in dead_letter_tasks:
            cat = task.retry_category or "unknown"
            by_category[cat] = by_category.get(cat, 0) + 1
        
        waiting_for_review = self.db.query(RepairTask).filter(
            RepairTask.status == TaskStatus.DEAD_LETTER.value,
            RepairTask.manual_review_required == True
        ).count()
        
        resolved_last_24h = self.db.query(FailedRecord).filter(
            FailedRecord.is_resolved == True,
            FailedRecord.resolved_at >= deadline_24h
        ).count()
        
        return DeadLetterSummary(
            total_dead_letter=len(dead_letter_tasks),
            by_category=by_category,
            waiting_for_review=waiting_for_review,
            resolved_last_24h=resolved_last_24h
        )
    
    def get_recovery_stats(self) -> RecoveryStats:
        deadline_30d = datetime.utcnow() - timedelta(days=30)
        
        recovered_tasks = self.db.query(RepairTask).filter(
            RepairTask.status == TaskStatus.SUCCESS.value,
            RepairTask.retry_count > 0,
            RepairTask.created_at >= deadline_30d
        ).all()
        
        total_recovered = len(recovered_tasks)
        
        manual_recovery = self.db.query(ProcessLog).filter(
            ProcessLog.action == "manual_retry",
            ProcessLog.performed_at >= deadline_30d
        ).count()
        
        auto_recovery = total_recovered - manual_recovery
        
        failed_tasks = self.db.query(RepairTask).filter(
            RepairTask.status.in_([
                TaskStatus.DEAD_LETTER.value,
                TaskStatus.FAILED.value
            ]),
            RepairTask.created_at >= deadline_30d
        ).count()
        
        total_with_retries = total_recovered + failed_tasks
        recovery_rate = (total_recovered / total_with_retries * 100) if total_with_retries > 0 else 0.0
        
        return RecoveryStats(
            total_recovered=total_recovered,
            manual_recovery=manual_recovery,
            auto_recovery=auto_recovery,
            recovery_rate=round(recovery_rate, 2),
            avg_time_to_recovery_minutes=0.0
        )
    
    def get_top_errors(self, limit: int = 10) -> List[Dict[str, Any]]:
        errors = self.db.query(
            FailedRecord.error_message,
            FailedRecord.error_category,
            func.count(FailedRecord.id).label('count')
        ).group_by(
            FailedRecord.error_message,
            FailedRecord.error_category
        ).order_by(
            func.count(FailedRecord.id).desc()
        ).limit(limit).all()
        
        return [
            {
                "error_message": err.error_message,
                "category": err.error_category,
                "count": err.count
            }
            for err in errors
        ]
    
    def get_recent_activities(self, limit: int = 20) -> List[Dict[str, Any]]:
        logs = self.db.query(ProcessLog).order_by(
            ProcessLog.performed_at.desc()
        ).limit(limit).all()
        
        return [
            {
                "task_id": log.task_id,
                "action": log.action,
                "status_before": log.status_before,
                "status_after": log.status_after,
                "performed_at": log.performed_at,
                "performed_by": log.performed_by
            }
            for log in logs
        ]
    
    def get_data_sources_stability(self) -> Dict[str, Dict[str, int]]:
        result = {}
        
        for source_type in SourceType:
            sources = self.db.query(SourceData).filter(
                SourceData.source_type == source_type.value
            ).all()
            
            total = len(sources)
            valid = sum(1 for s in sources if s.is_valid)
            invalid = total - valid
            
            result[source_type.value] = {
                "total": total,
                "valid": valid,
                "invalid": invalid,
                "success_rate": round((valid / total * 100) if total > 0 else 0, 2)
            }
        
        return result
    
    def get_manager_dashboard(self) -> ManagerDashboard:
        return ManagerDashboard(
            task_summary=self.get_task_summary(),
            retry_category_stats=self.get_retry_category_stats(),
            dead_letter_summary=self.get_dead_letter_summary(),
            recovery_stats=self.get_recovery_stats(),
            top_errors=self.get_top_errors(),
            recent_activities=self.get_recent_activities(),
            data_sources_stability=self.get_data_sources_stability()
        )
    
    def get_failed_records(self, skip: int = 0, limit: int = 100, 
                          category: str = None, resolved: bool = None) -> List[FailedRecord]:
        query = self.db.query(FailedRecord)
        
        if category:
            query = query.filter(FailedRecord.error_category == category)
        if resolved is not None:
            query = query.filter(FailedRecord.is_resolved == resolved)
        
        return query.order_by(FailedRecord.created_at.desc()).offset(skip).limit(limit).all()
