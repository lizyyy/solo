from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.services.task_service import TaskService
from app.models import TaskStatus, TaskPriority, Role


class BatchService:
    def __init__(self, db: Session):
        self.db = db
        self.task_service = TaskService(db)

    def batch_assign(
        self,
        task_ids: List[int],
        escort_id: int,
        operator_role: str,
        operator_name: str,
    ) -> Dict[str, Any]:
        success = []
        failed = []

        for task_id in task_ids:
            task, status = self.task_service.assign_task(
                task_id=task_id,
                escort_id=escort_id,
                operator_role=operator_role,
                operator_name=operator_name,
            )

            if task and status in ["assigned", "duplicate"]:
                success.append({
                    "task_id": task_id,
                    "status": status,
                })
            else:
                failed.append({
                    "task_id": task_id,
                    "error": status,
                })

        return {
            "total": len(task_ids),
            "success_count": len(success),
            "failed_count": len(failed),
            "success": success,
            "failed": failed,
        }

    def batch_complete(
        self,
        task_ids: List[int],
        operator_role: str,
        operator_name: str,
        completion_note: str = None,
    ) -> Dict[str, Any]:
        success = []
        failed = []

        for task_id in task_ids:
            task, status = self.task_service.complete_task(
                task_id=task_id,
                operator_role=operator_role,
                operator_name=operator_name,
                completion_note=completion_note,
            )

            if task and status in ["completed", "duplicate"]:
                success.append({
                    "task_id": task_id,
                    "status": status,
                })
            else:
                failed.append({
                    "task_id": task_id,
                    "error": status,
                })

        return {
            "total": len(task_ids),
            "success_count": len(success),
            "failed_count": len(failed),
            "success": success,
            "failed": failed,
        }

    def batch_cancel(
        self,
        task_ids: List[int],
        operator_role: str,
        operator_name: str,
        cancel_reason: str = None,
    ) -> Dict[str, Any]:
        success = []
        failed = []

        for task_id in task_ids:
            task, status = self.task_service.cancel_task(
                task_id=task_id,
                operator_role=operator_role,
                operator_name=operator_name,
                cancel_reason=cancel_reason,
            )

            if task and status in ["cancelled", "duplicate"]:
                success.append({
                    "task_id": task_id,
                    "status": status,
                })
            else:
                failed.append({
                    "task_id": task_id,
                    "error": status,
                })

        return {
            "total": len(task_ids),
            "success_count": len(success),
            "failed_count": len(failed),
            "success": success,
            "failed": failed,
        }

    def batch_update_priority(
        self,
        task_ids: List[int],
        new_priority: TaskPriority,
        operator_role: str,
        operator_name: str,
        note: str = None,
    ) -> Dict[str, Any]:
        success = []
        failed = []

        for task_id in task_ids:
            task, status = self.task_service.update_priority(
                task_id=task_id,
                new_priority=new_priority,
                operator_role=operator_role,
                operator_name=operator_name,
                note=note,
            )

            if task and status in ["priority_updated", "same_priority"]:
                success.append({
                    "task_id": task_id,
                    "status": status,
                })
            else:
                failed.append({
                    "task_id": task_id,
                    "error": status,
                })

        return {
            "total": len(task_ids),
            "success_count": len(success),
            "failed_count": len(failed),
            "success": success,
            "failed": failed,
        }

    def batch_check_timeout(self, task_ids: List[int]) -> Dict[str, Any]:
        success = []
        failed = []

        for task_id in task_ids:
            task, status = self.task_service.check_timeout(task_id=task_id)

            if task and status in ["timeout", "duplicate"]:
                success.append({
                    "task_id": task_id,
                    "status": status,
                })
            elif status in ["not_timeout", "invalid_status", "no_assign_time"]:
                success.append({
                    "task_id": task_id,
                    "status": status,
                })
            else:
                failed.append({
                    "task_id": task_id,
                    "error": status,
                })

        return {
            "total": len(task_ids),
            "success_count": len(success),
            "failed_count": len(failed),
            "success": success,
            "failed": failed,
        }
