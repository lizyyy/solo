from datetime import datetime
from typing import Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session

from app.models.enums import WorkOrderStatus, OperationType
from app.models.database import WorkOrder, StatusTransition, AuditLog
from app.services.audit import AuditService


class StateTransitionError(Exception):
    pass


class WorkOrderStateMachine:
    ALLOWED_TRANSITIONS: Dict[WorkOrderStatus, set] = {
        WorkOrderStatus.PENDING: {
            WorkOrderStatus.PROCESSING,
            WorkOrderStatus.FROZEN,
            WorkOrderStatus.WITHDRAWN,
        },
        WorkOrderStatus.PROCESSING: {
            WorkOrderStatus.PENDING_REVIEW,
            WorkOrderStatus.PENDING,
            WorkOrderStatus.FROZEN,
            WorkOrderStatus.WITHDRAWN,
        },
        WorkOrderStatus.PENDING_REVIEW: {
            WorkOrderStatus.REVIEWED,
            WorkOrderStatus.REJECTED,
            WorkOrderStatus.FROZEN,
        },
        WorkOrderStatus.REJECTED: {
            WorkOrderStatus.PENDING,
            WorkOrderStatus.FROZEN,
            WorkOrderStatus.ARCHIVED,
        },
        WorkOrderStatus.REVIEWED: {
            WorkOrderStatus.FROZEN,
            WorkOrderStatus.PENDING_REVIEW,
        },
        WorkOrderStatus.FROZEN: {
            WorkOrderStatus.REVIEWED,
            WorkOrderStatus.PENDING_REVIEW,
            WorkOrderStatus.PENDING,
            WorkOrderStatus.ARCHIVED,
        },
        WorkOrderStatus.WITHDRAWN: {
            WorkOrderStatus.PENDING,
            WorkOrderStatus.ARCHIVED,
        },
        WorkOrderStatus.ARCHIVED: set(),
    }

    def __init__(self, db: Session, work_order: WorkOrder):
        self.db = db
        self.work_order = work_order
        self.audit_service = AuditService(db)

    def can_transition_to(self, target_status: WorkOrderStatus) -> bool:
        current_status = WorkOrderStatus(self.work_order.status)
        return target_status in self.ALLOWED_TRANSITIONS.get(current_status, set())

    def transition(
        self,
        target_status: WorkOrderStatus,
        operator: str,
        reason: Optional[str] = None,
        remark: Optional[str] = None,
    ) -> Tuple[bool, str]:
        if not self.can_transition_to(target_status):
            raise StateTransitionError(
                f"无法从 {self.work_order.status} 转换到 {target_status}"
            )

        before_data = {
            "status": self.work_order.status,
            "status_before_freeze": self.work_order.status_before_freeze,
            "updated_at": self.work_order.updated_at.isoformat() if self.work_order.updated_at else None,
        }

        from_status = self.work_order.status

        if target_status == WorkOrderStatus.FROZEN:
            self.work_order.status_before_freeze = self.work_order.status
            self.work_order.fault_duration_before = self.work_order.fault_duration
            self.work_order.frozen_at = datetime.utcnow()
        elif self.work_order.status == WorkOrderStatus.FROZEN and target_status != WorkOrderStatus.ARCHIVED:
            self.work_order.frozen_at = None

        self.work_order.status = target_status.value
        self.work_order.updated_at = datetime.utcnow()

        transition = StatusTransition(
            work_order_id=self.work_order.id,
            from_status=from_status,
            to_status=target_status.value,
            transition_time=datetime.utcnow(),
            operator=operator,
            reason=reason,
            remark=remark,
        )
        self.db.add(transition)

        after_data = {
            "status": self.work_order.status,
            "status_before_freeze": self.work_order.status_before_freeze,
            "updated_at": self.work_order.updated_at.isoformat() if self.work_order.updated_at else None,
        }

        self.audit_service.log(
            operation_type=OperationType.STATUS_CHANGE,
            operator=operator,
            work_order_id=self.work_order.id,
            batch_id=self.work_order.batch_id,
            before_data=before_data,
            after_data=after_data,
            remark=f"状态变更: {from_status} -> {target_status.value}, 原因: {reason or '无'}",
        )

        self.db.commit()
        return True, "状态变更成功"

    def start_processing(self, operator: str, reason: Optional[str] = None) -> Tuple[bool, str]:
        return self.transition(WorkOrderStatus.PROCESSING, operator, reason or "开始处理")

    def submit_for_review(self, operator: str, reason: Optional[str] = None) -> Tuple[bool, str]:
        return self.transition(WorkOrderStatus.PENDING_REVIEW, operator, reason or "提交复核")

    def review(
        self,
        operator: str,
        approved: bool,
        review_reason: str,
        manual_reason: Optional[str] = None,
    ) -> Tuple[bool, str]:
        if self.work_order.status != WorkOrderStatus.PENDING_REVIEW.value:
            raise StateTransitionError("只有待复核状态的工单才能进行复核操作")

        self.work_order.reviewer = operator
        self.work_order.review_reason = review_reason
        if manual_reason:
            self.work_order.manual_reason = manual_reason

        if approved:
            return self.transition(WorkOrderStatus.REVIEWED, operator, f"复核通过: {review_reason}")
        else:
            return self.transition(WorkOrderStatus.REJECTED, operator, f"复核驳回: {review_reason}")

    def freeze(self, operator: str, reason: str) -> Tuple[bool, str]:
        if self.work_order.status == WorkOrderStatus.FROZEN.value:
            raise StateTransitionError("工单已经是冻结状态")

        return self.transition(WorkOrderStatus.FROZEN, operator, f"冻结结算: {reason}")

    def unfreeze(self, operator: str, reason: str) -> Tuple[bool, str]:
        if self.work_order.status != WorkOrderStatus.FROZEN.value:
            raise StateTransitionError("只有冻结状态的工单才能解冻")

        target_status = self.work_order.status_before_freeze or WorkOrderStatus.PENDING.value
        return self.transition(WorkOrderStatus(target_status), operator, f"解冻: {reason}")

    def withdraw(self, operator: str, reason: str) -> Tuple[bool, str]:
        return self.transition(WorkOrderStatus.WITHDRAWN, operator, f"撤回归档: {reason}")

    def archive(self, operator: str, reason: Optional[str] = None) -> Tuple[bool, str]:
        if self.work_order.status not in [
            WorkOrderStatus.FROZEN.value,
            WorkOrderStatus.WITHDRAWN.value,
            WorkOrderStatus.REJECTED.value,
        ]:
            raise StateTransitionError("只有冻结、撤回或驳回状态的工单才能归档")

        self.work_order.archived_at = datetime.utcnow()
        return self.transition(WorkOrderStatus.ARCHIVED, operator, reason or "归档")

    def handle_offline_recovery(self, operator: str, actual_fault_duration: float) -> Tuple[bool, str]:
        if self.work_order.status not in [
            WorkOrderStatus.PENDING.value,
            WorkOrderStatus.PROCESSING.value,
        ]:
            raise StateTransitionError("只有待处理或处理中的工单才能处理离线恢复")

        before_duration = self.work_order.fault_duration
        self.work_order.fault_duration = actual_fault_duration
        self.work_order.manual_reason = f"离线告警恢复，修正故障时长: {before_duration} -> {actual_fault_duration}"

        self.audit_service.log(
            operation_type=OperationType.UPDATE,
            operator=operator,
            work_order_id=self.work_order.id,
            batch_id=self.work_order.batch_id,
            before_data={"fault_duration": before_duration},
            after_data={"fault_duration": actual_fault_duration},
            remark="离线告警恢复，修正故障时长",
        )

        self.db.commit()
        return True, "离线告警恢复处理完成，已修正故障时长"
