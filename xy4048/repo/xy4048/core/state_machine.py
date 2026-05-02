from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum

from config import CONFIG, TaskStatus
from database import (
    DatabaseManager, DeliveryTask, PackingItem, Attachment,
    AuditPackage, AuditLog, ExceptionRecord, ExceptionType,
    AttachmentType
)


class StateTransitionError(Exception):
    def __init__(self, message: str, from_status: TaskStatus, to_status: TaskStatus):
        super().__init__(message)
        self.from_status = from_status
        self.to_status = to_status
        self.message = message


VALID_TRANSITIONS: Dict[TaskStatus, List[TaskStatus]] = {
    TaskStatus.TO_PACK: [TaskStatus.IN_TRANSIT],
    TaskStatus.IN_TRANSIT: [TaskStatus.TO_SIGN, TaskStatus.NEED_REVIEW],
    TaskStatus.TO_SIGN: [TaskStatus.NEED_REVIEW, TaskStatus.ARCHIVED],
    TaskStatus.NEED_REVIEW: [TaskStatus.IN_TRANSIT, TaskStatus.TO_SIGN, TaskStatus.ARCHIVED],
    TaskStatus.ARCHIVED: [],
}


def can_transition(from_status: TaskStatus, to_status: TaskStatus) -> bool:
    if from_status not in VALID_TRANSITIONS:
        return False
    return to_status in VALID_TRANSITIONS[from_status]


def get_valid_transitions(status: TaskStatus) -> List[TaskStatus]:
    return VALID_TRANSITIONS.get(status, [])


class StateMachine:
    def __init__(self, db: DatabaseManager):
        self.db = db
        self.config = CONFIG
    
    def _log_audit(self, task: DeliveryTask, action: str, operator: str = "", details: str = ""):
        self.db.log_audit(
            task_id=task.id if task.id else 0,
            action=action,
            operator=operator,
            details=details
        )
    
    def check_can_start_transit(self, task: DeliveryTask) -> Tuple[bool, str]:
        packing_items = self.db.get_all(
            PackingItem,
            "task_id = ?",
            (task.id,)
        )
        
        if not packing_items:
            return False, "没有装箱清单，不能开始运输"
        
        return True, ""
    
    def check_can_sign(self, task: DeliveryTask) -> Tuple[bool, str]:
        if task.delivery_point_id is None:
            return False, "签收前必须有关联的收货点"
        
        attachments = self.db.get_all(
            Attachment,
            "task_id = ? AND attachment_type = ?",
            (task.id, AttachmentType.SIGNATURE.value)
        )
        
        if not attachments:
            return False, "签收前必须有签收附件"
        
        return True, ""
    
    def check_can_archive(self, task: DeliveryTask) -> Tuple[bool, str]:
        audit_package = self.db.get_by_field(
            AuditPackage,
            "task_id",
            task.id
        )
        
        if audit_package is None:
            return False, "归档前必须生成审计包"
        
        if not audit_package.temperature_risk:
            return False, "审计包缺少温度风险评估"
        
        if not audit_package.handling_opinion:
            return False, "审计包缺少处理意见"
        
        if not audit_package.attachments_hash:
            return False, "审计包缺少附件哈希"
        
        return True, ""
    
    def transition(
        self,
        task: DeliveryTask,
        to_status: TaskStatus,
        operator: str = "",
        notes: str = ""
    ) -> DeliveryTask:
        if task.status == to_status:
            return task
        
        if not can_transition(task.status, to_status):
            raise StateTransitionError(
                f"无法从 {task.status.value} 转换到 {to_status.value}",
                task.status,
                to_status
            )
        
        if to_status == TaskStatus.IN_TRANSIT:
            can_start, reason = self.check_can_start_transit(task)
            if not can_start:
                raise StateTransitionError(reason, task.status, to_status)
            
            task.departure_time = datetime.now()
        
        elif to_status == TaskStatus.TO_SIGN:
            task.arrival_time = datetime.now()
        
        elif to_status == TaskStatus.ARCHIVED:
            can_archive, reason = self.check_can_archive(task)
            if not can_archive:
                raise StateTransitionError(reason, task.status, to_status)
            
            task.archive_time = datetime.now()
        
        old_status = task.status
        task.status = to_status
        
        if notes:
            task.notes = (task.notes or "") + f"\n[{datetime.now().isoformat()}] {notes}"
        
        task = self.db.update(task)
        
        action = f"状态变更: {old_status.value} -> {to_status.value}"
        self._log_audit(task, action, operator, notes)
        
        return task
    
    def start_transit(self, task: DeliveryTask, operator: str = "") -> DeliveryTask:
        return self.transition(task, TaskStatus.IN_TRANSIT, operator, "开始运输")
    
    def complete_delivery(self, task: DeliveryTask, operator: str = "") -> DeliveryTask:
        return self.transition(task, TaskStatus.TO_SIGN, operator, "完成配送，待签收")
    
    def flag_for_review(
        self,
        task: DeliveryTask,
        reason: str,
        reading_ids: List[int] = None,
        operator: str = ""
    ) -> DeliveryTask:
        exception_details = f"连续超温触发复核: {reason}"
        
        if reading_ids:
            for reading_id in reading_ids:
                exception = ExceptionRecord(
                    task_id=task.id,
                    exception_type=ExceptionType.OVER_TEMPERATURE,
                    reading_id=reading_id,
                    details=exception_details,
                    is_resolved=False
                )
                self.db.create(exception)
        
        task = self.transition(task, TaskStatus.NEED_REVIEW, operator, reason)
        
        return task
    
    def resolve_review(
        self,
        task: DeliveryTask,
        resolution: str,
        target_status: TaskStatus,
        operator: str = ""
    ) -> DeliveryTask:
        exceptions = self.db.get_all(
            ExceptionRecord,
            "task_id = ? AND is_resolved = 0",
            (task.id,)
        )
        
        for exc in exceptions:
            exc.is_resolved = True
            exc.resolution_notes = resolution
            exc.resolved_at = datetime.now()
            self.db.update(exc)
        
        task = self.transition(task, target_status, operator, f"复核完成: {resolution}")
        
        return task
    
    def sign_task(self, task: DeliveryTask, operator: str = "") -> DeliveryTask:
        can_sign, reason = self.check_can_sign(task)
        if not can_sign:
            raise StateTransitionError(reason, task.status, TaskStatus.ARCHIVED)
        
        task.sign_time = datetime.now()
        
        return task
    
    def archive_task(self, task: DeliveryTask, operator: str = "") -> DeliveryTask:
        return self.transition(task, TaskStatus.ARCHIVED, operator, "任务已归档")
