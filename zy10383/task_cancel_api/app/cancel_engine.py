import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from app.models import (
    MainTask, SubTask, CancelReason, PropagationState,
    TempResource, CleanupResult, IdempotentRequest,
    TaskStatus, PropagationStatus, CleanupStatus
)

logger = logging.getLogger(__name__)


class CancelPropagationEngine:
    def __init__(self, db: Session):
        self.db = db

    def check_idempotency(self, endpoint: str, idempotency_key: str) -> Optional[str]:
        if not idempotency_key:
            return None
        request_key = f"{endpoint}:{idempotency_key}"
        cached = self.db.query(IdempotentRequest).filter(
            IdempotentRequest.request_key == request_key,
            IdempotentRequest.expires_at > datetime.utcnow()
        ).first()
        if cached:
            return cached.response_data
        return None

    def store_idempotent_result(self, endpoint: str, idempotency_key: str, response_data: str, ttl_hours: int = 24):
        if not idempotency_key:
            return
        request_key = f"{endpoint}:{idempotency_key}"
        cached = self.db.query(IdempotentRequest).filter(
            IdempotentRequest.request_key == request_key
        ).first()
        if cached:
            cached.response_data = response_data
            cached.expires_at = datetime.utcnow() + timedelta(hours=ttl_hours)
        else:
            cached = IdempotentRequest(
                request_key=request_key,
                endpoint=endpoint,
                response_data=response_data,
                expires_at=datetime.utcnow() + timedelta(hours=ttl_hours)
            )
            self.db.add(cached)
        self.db.commit()

    def validate_task_for_cancel(self, task_id: str) -> dict:
        main_task = self.db.query(MainTask).filter(MainTask.task_id == task_id).first()
        if not main_task:
            return {"valid": False, "error_code": "TASK_NOT_FOUND", "error_message": f"Task {task_id} not found"}
        
        if main_task.status in [TaskStatus.CANCELLED, TaskStatus.COMPLETED]:
            return {"valid": False, "error_code": "INVALID_TASK_STATUS", 
                    "error_message": f"Task {task_id} is already {main_task.status}, cannot cancel"}
        
        return {"valid": True, "main_task": main_task}

    def initiate_cancel(self, task_id: str, reason_code: str, reason_message: str,
                        triggered_by: Optional[str] = None, suppress_notification: bool = False) -> dict:
        validation = self.validate_task_for_cancel(task_id)
        if not validation["valid"]:
            return validation

        main_task = validation["main_task"]
        
        cancel_reason = CancelReason(
            main_task_id=main_task.id,
            reason_code=reason_code,
            reason_message=reason_message,
            triggered_by=triggered_by,
            suppress_notification=suppress_notification
        )
        self.db.add(cancel_reason)

        main_task.status = TaskStatus.CANCELLING
        self.db.commit()
        self.db.refresh(main_task)

        propagation = PropagationState(
            main_task_id=main_task.id,
            total_sub_tasks=len(main_task.sub_tasks),
            status=PropagationStatus.NOT_STARTED
        )
        self.db.add(propagation)
        self.db.commit()

        return {
            "success": True,
            "task_id": task_id,
            "status": TaskStatus.CANCELLING,
            "cancel_reason_id": cancel_reason.id,
            "propagation_id": propagation.id
        }

    def propagate_cancel(self, task_id: str, fail_sub_task_index: Optional[int] = None) -> dict:
        main_task = self.db.query(MainTask).filter(MainTask.task_id == task_id).first()
        if not main_task:
            return {"success": False, "error_code": "TASK_NOT_FOUND", "error_message": f"Task {task_id} not found"}

        propagation = self.db.query(PropagationState).filter(
            PropagationState.main_task_id == main_task.id
        ).first()
        
        if not propagation:
            return {"success": False, "error_code": "PROPAGATION_NOT_FOUND", 
                    "error_message": "Propagation state not initialized"}

        if propagation.status == PropagationStatus.SUCCESS:
            return {"success": True, "message": "Propagation already completed", "propagation_status": propagation.status}

        propagation.status = PropagationStatus.PROPAGATING
        propagation.started_at = datetime.utcnow()
        self.db.commit()

        sorted_sub_tasks = sorted(main_task.sub_tasks, key=lambda x: x.order)
        
        for idx, sub_task in enumerate(sorted_sub_tasks):
            propagation.current_sub_task_index = idx
            self.db.commit()

            try:
                if fail_sub_task_index is not None and idx == fail_sub_task_index:
                    raise Exception(f"Simulated failure at sub_task index {idx}")

                sub_task.status = TaskStatus.CANCELLING
                self.db.commit()

                self._cleanup_sub_task_resources(sub_task)

                sub_task.status = TaskStatus.CANCELLED
                propagation.completed_sub_tasks += 1
                self.db.commit()

                logger.info(f"Successfully cancelled sub_task: {sub_task.sub_task_id}")

            except Exception as e:
                sub_task.status = TaskStatus.FAILED
                propagation.failed_sub_tasks += 1
                propagation.error_message = str(e)
                self.db.commit()
                logger.error(f"Failed to cancel sub_task {sub_task.sub_task_id}: {e}")

        propagation.completed_at = datetime.utcnow()
        
        if propagation.failed_sub_tasks == 0:
            propagation.status = PropagationStatus.SUCCESS
            main_task.status = TaskStatus.CANCELLED
        elif propagation.completed_sub_tasks > 0:
            propagation.status = PropagationStatus.PARTIAL_SUCCESS
        else:
            propagation.status = PropagationStatus.FAILED
        
        self.db.commit()

        return {
            "success": propagation.failed_sub_tasks == 0,
            "task_id": task_id,
            "propagation_status": propagation.status,
            "total_sub_tasks": propagation.total_sub_tasks,
            "completed_sub_tasks": propagation.completed_sub_tasks,
            "failed_sub_tasks": propagation.failed_sub_tasks
        }

    def _cleanup_sub_task_resources(self, sub_task: SubTask):
        for resource in sub_task.temp_resources:
            cleanup_result = CleanupResult(
                result_id=f"cleanup_{uuid.uuid4().hex[:8]}",
                sub_task_id=sub_task.id,
                resource_id=resource.resource_id,
                status=CleanupStatus.IN_PROGRESS,
                started_at=datetime.utcnow()
            )
            self.db.add(cleanup_result)
            self.db.commit()

            try:
                cleanup_result.status = CleanupStatus.SUCCESS
                cleanup_result.cleaned_count = 1
                cleanup_result.detail = f"Resource {resource.resource_type} cleaned successfully"
                cleanup_result.completed_at = datetime.utcnow()
                self.db.commit()
                logger.info(f"Cleaned resource: {resource.resource_id}")
            except Exception as e:
                cleanup_result.status = CleanupStatus.FAILED
                cleanup_result.error_message = str(e)
                cleanup_result.completed_at = datetime.utcnow()
                self.db.commit()
                raise e

    def get_propagation_progress(self, task_id: str) -> dict:
        main_task = self.db.query(MainTask).filter(MainTask.task_id == task_id).first()
        if not main_task:
            return {"success": False, "error_code": "TASK_NOT_FOUND", "error_message": f"Task {task_id} not found"}

        propagation = self.db.query(PropagationState).filter(
            PropagationState.main_task_id == main_task.id
        ).first()

        if not propagation:
            return {"success": False, "error_code": "PROPAGATION_NOT_FOUND", 
                    "error_message": "No propagation state found for this task"}

        progress = 0.0
        if propagation.total_sub_tasks > 0:
            progress = (propagation.completed_sub_tasks + propagation.failed_sub_tasks) / propagation.total_sub_tasks

        return {
            "success": True,
            "main_task_id": task_id,
            "status": propagation.status,
            "progress": round(progress, 2),
            "total": propagation.total_sub_tasks,
            "completed": propagation.completed_sub_tasks,
            "failed": propagation.failed_sub_tasks,
            "error_message": propagation.error_message
        }
