from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from app.models import Task, Escort, AuditLog, TaskStatus, ExceptionType


class StatsService:
    def __init__(self, db: Session):
        self.db = db

    def get_task_summary(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        escort_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        query = self.db.query(Task)

        if start_date:
            query = query.filter(Task.created_at >= start_date)
        if end_date:
            query = query.filter(Task.created_at <= end_date)
        if escort_id:
            query = query.filter(Task.assigned_escort_id == escort_id)

        total = query.count()
        pending = query.filter(Task.status == TaskStatus.PENDING).count()
        assigned = query.filter(Task.status == TaskStatus.ASSIGNED).count()
        accepted = query.filter(Task.status == TaskStatus.ACCEPTED).count()
        completed = query.filter(Task.status == TaskStatus.COMPLETED).count()
        cancelled = query.filter(Task.status == TaskStatus.CANCELLED).count()
        timeout = query.filter(Task.status == TaskStatus.TIMEOUT).count()
        has_exception = query.filter(Task.has_exception == True).count()

        avg_wait = self.db.query(func.avg(Task.wait_duration)).filter(
            Task.wait_duration.isnot(None)
        ).scalar()
        avg_service = self.db.query(func.avg(Task.service_duration)).filter(
            Task.service_duration.isnot(None)
        ).scalar()
        avg_total = self.db.query(func.avg(Task.total_duration)).filter(
            Task.total_duration.isnot(None)
        ).scalar()

        return {
            "total": total,
            "status": {
                "pending": pending,
                "assigned": assigned,
                "accepted": accepted,
                "completed": completed,
                "cancelled": cancelled,
                "timeout": timeout,
            },
            "has_exception": has_exception,
            "wait_times": {
                "avg_wait_minutes": round(avg_wait, 2) if avg_wait else 0,
                "avg_service_minutes": round(avg_service, 2) if avg_service else 0,
                "avg_total_minutes": round(avg_total, 2) if avg_total else 0,
            },
        }

    def get_escort_performance(
        self,
        escort_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        query = self.db.query(
            Escort.id,
            Escort.name,
            func.count(Task.id).label("total_tasks"),
            func.sum(case((Task.status == TaskStatus.COMPLETED, 1), else_=0)).label("completed_tasks"),
            func.sum(case((Task.has_exception == True, 1), else_=0)).label("exception_tasks"),
            func.avg(Task.wait_duration).label("avg_wait"),
            func.avg(Task.service_duration).label("avg_service"),
        ).join(Task, Task.assigned_escort_id == Escort.id, isouter=True)

        if escort_id:
            query = query.filter(Escort.id == escort_id)
        if start_date:
            query = query.filter(Task.created_at >= start_date)
        if end_date:
            query = query.filter(Task.created_at <= end_date)

        results = query.group_by(Escort.id, Escort.name).all()

        performance_list = []
        for row in results:
            total = row.total_tasks or 0
            completed = row.completed_tasks or 0
            completion_rate = (completed / total * 100) if total > 0 else 0

            performance_list.append({
                "escort_id": row.id,
                "escort_name": row.name,
                "total_tasks": total,
                "completed_tasks": completed,
                "exception_tasks": row.exception_tasks or 0,
                "completion_rate": round(completion_rate, 2),
                "avg_wait_minutes": round(row.avg_wait or 0, 2),
                "avg_service_minutes": round(row.avg_service or 0, 2),
            })

        return performance_list

    def get_daily_trends(
        self,
        days: int = 30,
    ) -> List[Dict[str, Any]]:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        query = self.db.query(
            func.date(Task.created_at).label("date"),
            func.count(Task.id).label("total"),
            func.sum(case((Task.status == TaskStatus.COMPLETED, 1), else_=0)).label("completed"),
            func.sum(case((Task.has_exception == True, 1), else_=0)).label("exceptions"),
            func.avg(Task.wait_duration).label("avg_wait"),
        ).filter(
            Task.created_at >= start_date
        ).group_by(
            func.date(Task.created_at)
        ).order_by(
            func.date(Task.created_at)
        )

        results = query.all()
        trends = []
        for row in results:
            trends.append({
                "date": str(row.date),
                "total_tasks": row.total,
                "completed_tasks": row.completed or 0,
                "exception_tasks": row.exceptions or 0,
                "avg_wait_minutes": round(row.avg_wait or 0, 2),
            })

        return trends

    def get_exception_summary(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        query = self.db.query(Task).filter(Task.has_exception == True)

        if start_date:
            query = query.filter(Task.created_at >= start_date)
        if end_date:
            query = query.filter(Task.created_at <= end_date)

        total_exceptions = query.count()

        type_counts = {}
        for exc_type in ExceptionType:
            count = self.db.query(Task).filter(
                Task.exception_type == exc_type.value
            ).count()
            type_counts[exc_type.value] = count

        return {
            "total_exceptions": total_exceptions,
            "by_type": type_counts,
        }

    def get_queue_summary(self) -> Dict[str, Any]:
        pending_tasks = self.db.query(Task).filter(
            Task.status.in_([TaskStatus.PENDING, TaskStatus.ASSIGNED])
        ).order_by(
            Task.priority.desc(),
            Task.created_at.asc()
        ).all()

        urgent_count = sum(1 for t in pending_tasks if t.priority == "urgent")
        emergency_count = sum(1 for t in pending_tasks if t.priority == "emergency")

        avg_wait_time = 0
        if pending_tasks:
            now = datetime.now()
            wait_times = []
            for task in pending_tasks:
                if task.created_at:
                    wait_minutes = (now - task.created_at).total_seconds() // 60
                    wait_times.append(wait_minutes)
            if wait_times:
                avg_wait_time = sum(wait_times) / len(wait_times)

        return {
            "pending_count": len(pending_tasks),
            "urgent_count": urgent_count,
            "emergency_count": emergency_count,
            "avg_wait_minutes": round(avg_wait_time, 2),
            "queue": [
                {
                    "task_id": t.id,
                    "request_id": t.request_id,
                    "priority": t.priority,
                    "queue_position": t.queue_position,
                    "wait_minutes": int((datetime.now() - t.created_at).total_seconds() // 60) if t.created_at else 0,
                }
                for t in pending_tasks[:20]
            ],
        }
