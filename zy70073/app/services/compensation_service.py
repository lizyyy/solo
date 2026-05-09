from datetime import datetime
from typing import Callable, Dict, Any, Optional, List, Tuple

from sqlalchemy.orm import Session

from app.models.enums import CompensationStatus, CompensationType
from app.models.models import CompensationTask, WarningRecord, Contract
from app.config import settings


class CompensationHandler:
    def __init__(self, db: Session):
        self.db = db
        self._handlers: Dict[CompensationType, Callable] = {
            CompensationType.SEND_NOTIFICATION: self._handle_send_notification,
            CompensationType.UPDATE_CONTRACT_STATUS: self._handle_update_contract_status,
            CompensationType.APPLY_PENALTY: self._handle_apply_penalty,
            CompensationType.REGENERATE_WARNING: self._handle_regenerate_warning,
        }

    def register_handler(self, task_type: CompensationType, handler: Callable):
        self._handlers[task_type] = handler

    def create_compensation_task(
        self,
        contract_id: int,
        task_type: CompensationType,
        task_data: Dict[str, Any],
        warning_id: Optional[int] = None,
        max_retries: Optional[int] = None,
    ) -> CompensationTask:
        task = CompensationTask(
            warning_id=warning_id,
            contract_id=contract_id,
            task_type=task_type,
            task_data=task_data,
            status=CompensationStatus.PENDING,
            retry_count=0,
            max_retries=max_retries or settings.MAX_COMPENSATION_RETRIES,
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def get_task(self, task_id: int) -> Optional[CompensationTask]:
        return self.db.query(CompensationTask).filter(CompensationTask.id == task_id).first()

    def get_pending_tasks(self) -> List[CompensationTask]:
        return (
            self.db.query(CompensationTask)
            .filter(
                CompensationTask.status.in_([
                    CompensationStatus.PENDING,
                    CompensationStatus.RETRYABLE,
                ])
            )
            .order_by(CompensationTask.created_at)
            .all()
        )

    def get_failed_tasks(self) -> List[CompensationTask]:
        return (
            self.db.query(CompensationTask)
            .filter(CompensationTask.status == CompensationStatus.FAILED)
            .order_by(CompensationTask.updated_at.desc())
            .all()
        )

    def mark_for_retry(self, task_id: int) -> Optional[CompensationTask]:
        task = self.get_task(task_id)
        if not task:
            return None

        if task.status == CompensationStatus.SUCCESS:
            return task

        if task.retry_count >= task.max_retries:
            return None

        task.status = CompensationStatus.RETRYABLE
        self.db.commit()
        self.db.refresh(task)
        return task

    def retry_task(self, task_id: int) -> Tuple[bool, str]:
        task = self.get_task(task_id)
        if not task:
            return False, "任务不存在"

        if task.retry_count >= task.max_retries:
            task.status = CompensationStatus.FAILED
            task.error_message = "已达到最大重试次数"
            self.db.commit()
            return False, "已达到最大重试次数"

        return self.execute_task(task)

    def execute_task(self, task: CompensationTask) -> Tuple[bool, str]:
        task.status = CompensationStatus.RUNNING
        task.last_run_at = datetime.utcnow()
        self.db.commit()

        handler = self._handlers.get(task.task_type)
        if not handler:
            error_msg = f"未找到任务类型 {task.task_type} 的处理器"
            self._handle_failure(task, error_msg)
            return False, error_msg

        try:
            success, message = handler(task.task_data, self.db)
            if success:
                task.status = CompensationStatus.SUCCESS
                task.error_message = None
                self.db.commit()
                return True, message
            else:
                self._handle_failure(task, message)
                return False, message
        except Exception as e:
            error_msg = f"执行异常: {str(e)}"
            self._handle_failure(task, error_msg)
            return False, error_msg

    def _handle_failure(self, task: CompensationTask, error_msg: str):
        task.retry_count += 1
        task.error_message = error_msg

        if task.retry_count >= task.max_retries:
            task.status = CompensationStatus.FAILED
        else:
            task.status = CompensationStatus.RETRYABLE

        self.db.commit()

    def execute_all_pending(self) -> Dict[str, Any]:
        tasks = self.get_pending_tasks()
        results = {
            "total": len(tasks),
            "success": 0,
            "failed": 0,
            "retryable": 0,
            "details": [],
        }

        for task in tasks:
            success, message = self.execute_task(task)
            if success:
                results["success"] += 1
            elif task.status == CompensationStatus.RETRYABLE:
                results["retryable"] += 1
            else:
                results["failed"] += 1
            results["details"].append({
                "task_id": task.id,
                "task_type": task.task_type.value,
                "success": success,
                "message": message,
            })

        return results

    def _handle_send_notification(
        self, data: Dict[str, Any], db: Session
    ) -> Tuple[bool, str]:
        message = data.get("message", "履约预警通知")
        print(f"[模拟发送通知] 消息: {message}")
        return True, "通知已发送"

    def _handle_update_contract_status(
        self, data: Dict[str, Any], db: Session
    ) -> Tuple[bool, str]:
        contract_id = data.get("contract_id")
        new_status = data.get("new_status")

        if not contract_id or not new_status:
            return False, "缺少必要参数"

        contract = db.query(Contract).filter(Contract.id == contract_id).first()
        if not contract:
            return False, f"合同 {contract_id} 不存在"

        contract.status = new_status
        db.commit()
        return True, f"合同状态已更新为 {new_status}"

    def _handle_apply_penalty(
        self, data: Dict[str, Any], db: Session
    ) -> Tuple[bool, str]:
        from app.services.penalty_service import PenaltyService

        delivery_plan_id = data.get("delivery_plan_id")
        if not delivery_plan_id:
            return False, "缺少 delivery_plan_id"

        penalty_service = PenaltyService(db)
        penalties = penalty_service.process_delivery_penalties(delivery_plan_id)

        if penalties:
            return True, f"生成 {len(penalties)} 条违约金记录"
        return True, "无需生成违约金记录"

    def _handle_regenerate_warning(
        self, data: Dict[str, Any], db: Session
    ) -> Tuple[bool, str]:
        from app.services.warning_service import WarningService
        from datetime import date

        reference_date = data.get("reference_date")
        if reference_date:
            ref_date = date.fromisoformat(reference_date)
        else:
            ref_date = None

        warning_service = WarningService(db)
        results = warning_service.run_all_checks(ref_date)
        return True, f"重新生成 {results['total']} 条预警"
