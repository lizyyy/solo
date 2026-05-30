from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from ..models import (
    EstimationTask,
    TaskStatusLog,
    TaskStatus,
    STATUS_CATEGORY_MAP,
    TaskStatusCategory,
)

STATUS_DISPLAY_MAP = {
    TaskStatus.CREATED: "已创建",
    TaskStatus.MODEL_UPLOADED: "模型已上传",
    TaskStatus.ANALYZING: "分析中",
    TaskStatus.ANALYZED: "分析完成",
    TaskStatus.PARAMS_RECEIVED: "参数已接收",
    TaskStatus.ESTIMATING: "估算中",
    TaskStatus.ESTIMATED: "估算完成",
    TaskStatus.REPORT_GENERATING: "报告生成中",
    TaskStatus.REPORT_GENERATED: "报告已生成",
    TaskStatus.COMPLETED: "已完成",
    TaskStatus.FAILED: "失败",
}

ALLOWED_TRANSITIONS: Dict[TaskStatus, List[TaskStatus]] = {
    TaskStatus.CREATED: [TaskStatus.MODEL_UPLOADED, TaskStatus.FAILED],
    TaskStatus.MODEL_UPLOADED: [TaskStatus.ANALYZING, TaskStatus.PARAMS_RECEIVED, TaskStatus.FAILED],
    TaskStatus.ANALYZING: [TaskStatus.ANALYZED, TaskStatus.FAILED],
    TaskStatus.ANALYZED: [TaskStatus.PARAMS_RECEIVED, TaskStatus.ESTIMATING, TaskStatus.MODEL_UPLOADED, TaskStatus.FAILED],
    TaskStatus.PARAMS_RECEIVED: [TaskStatus.ANALYZING, TaskStatus.ESTIMATING, TaskStatus.MODEL_UPLOADED, TaskStatus.FAILED],
    TaskStatus.ESTIMATING: [TaskStatus.ESTIMATED, TaskStatus.FAILED],
    TaskStatus.ESTIMATED: [TaskStatus.REPORT_GENERATING, TaskStatus.ANALYZING, TaskStatus.PARAMS_RECEIVED, TaskStatus.FAILED],
    TaskStatus.REPORT_GENERATING: [TaskStatus.REPORT_GENERATED, TaskStatus.FAILED],
    TaskStatus.REPORT_GENERATED: [TaskStatus.COMPLETED, TaskStatus.ANALYZING, TaskStatus.PARAMS_RECEIVED, TaskStatus.FAILED],
    TaskStatus.COMPLETED: [TaskStatus.ANALYZING, TaskStatus.PARAMS_RECEIVED],
    TaskStatus.FAILED: [TaskStatus.MODEL_UPLOADED, TaskStatus.PARAMS_RECEIVED, TaskStatus.ANALYZING],
}


class StatusService:
    @staticmethod
    def get_status_display(status: str) -> str:
        return STATUS_DISPLAY_MAP.get(TaskStatus(status), status)

    @staticmethod
    def get_status_category(status: str) -> TaskStatusCategory:
        return STATUS_CATEGORY_MAP.get(TaskStatus(status), TaskStatusCategory.PENDING)

    @staticmethod
    def can_transition(current_status: str, target_status: str) -> tuple[bool, Optional[str]]:
        current = TaskStatus(current_status)
        target = TaskStatus(target_status)

        allowed = ALLOWED_TRANSITIONS.get(current, [])
        if target in allowed:
            return True, None

        reasons = {
            TaskStatus.CREATED: "任务刚创建，需要先上传模型",
            TaskStatus.MODEL_UPLOADED: "模型已上传，需要进行分析或设置参数",
            TaskStatus.ANALYZING: "分析进行中，请等待完成",
            TaskStatus.ANALYZED: "分析已完成，需要设置参数或开始估算",
            TaskStatus.PARAMS_RECEIVED: "参数已接收，需要进行分析或开始估算",
            TaskStatus.ESTIMATING: "估算进行中，请等待完成",
            TaskStatus.ESTIMATED: "估算已完成，可以生成报告或重新分析/设置参数",
            TaskStatus.FAILED: "任务失败，需要重新上传模型、设置参数或重新分析",
        }
        return False, reasons.get(current, f"不允许从 {current} 转换到 {target}")

    @staticmethod
    def transition(
        db: Session,
        task: EstimationTask,
        target_status: str,
        message: Optional[str] = None,
        triggered_by: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        force: bool = False,
    ) -> tuple[bool, Optional[str]]:
        if not force:
            allowed, reason = StatusService.can_transition(task.status, target_status)
            if not allowed:
                return False, reason

        previous_status = task.status
        task.status = target_status

        log = TaskStatusLog(
            task_id=task.id,
            previous_status=previous_status,
            new_status=target_status,
            message=message,
            triggered_by=triggered_by,
            meta_data=metadata or {},
        )
        db.add(log)
        db.flush()

        return True, None

    @staticmethod
    def get_status_history(db: Session, task_id: int) -> List[TaskStatusLog]:
        return (
            db.query(TaskStatusLog)
            .filter(TaskStatusLog.task_id == task_id)
            .order_by(TaskStatusLog.created_at)
            .all()
        )

    @staticmethod
    def get_current_status_info(task: EstimationTask) -> Dict[str, Any]:
        status = TaskStatus(task.status)
        return {
            "status": status,
            "status_category": StatusService.get_status_category(status),
            "status_display": StatusService.get_status_display(status),
        }
