from typing import Optional, Dict, List, Set
from sqlalchemy.orm import Session

from app.models.models import (
    AbnormalReceipt,
    StatusHistory,
    ReceiptStatus,
    User,
    UserRole
)


class StateTransitionError(Exception):
    pass


class PermissionError(Exception):
    pass


class StateMachine:
    VALID_TRANSITIONS: Dict[ReceiptStatus, Set[ReceiptStatus]] = {
        ReceiptStatus.DRAFT: {
            ReceiptStatus.PENDING_REVIEW,
            ReceiptStatus.ARCHIVED
        },
        ReceiptStatus.PENDING_REVIEW: {
            ReceiptStatus.APPROVED,
            ReceiptStatus.REJECTED,
            ReceiptStatus.DRAFT,
            ReceiptStatus.FROZEN
        },
        ReceiptStatus.APPROVED: {
            ReceiptStatus.REJECTED,
            ReceiptStatus.SETTLED,
            ReceiptStatus.FROZEN,
            ReceiptStatus.ARCHIVED
        },
        ReceiptStatus.REJECTED: {
            ReceiptStatus.DRAFT,
            ReceiptStatus.FROZEN,
            ReceiptStatus.ARCHIVED
        },
        ReceiptStatus.FROZEN: {
            ReceiptStatus.DRAFT,
            ReceiptStatus.PENDING_REVIEW,
            ReceiptStatus.APPROVED,
            ReceiptStatus.REJECTED
        },
        ReceiptStatus.SETTLED: {
            ReceiptStatus.FROZEN,
            ReceiptStatus.ARCHIVED
        },
        ReceiptStatus.ARCHIVED: set()
    }

    @classmethod
    def can_transition(cls, from_status: ReceiptStatus, to_status: ReceiptStatus) -> bool:
        return to_status in cls.VALID_TRANSITIONS.get(from_status, set())

    @classmethod
    def get_valid_transitions(cls, current_status: ReceiptStatus) -> Set[ReceiptStatus]:
        return cls.VALID_TRANSITIONS.get(current_status, set())

    @staticmethod
    def check_permission(user: User, target_status: ReceiptStatus) -> bool:
        role_permissions = {
            UserRole.ADMIN: {status for status in ReceiptStatus},
            UserRole.COLLEGE_SECRETARY: {
                ReceiptStatus.PENDING_REVIEW,
                ReceiptStatus.APPROVED,
                ReceiptStatus.REJECTED,
                ReceiptStatus.FROZEN,
                ReceiptStatus.SETTLED,
                ReceiptStatus.ARCHIVED
            },
            UserRole.TEACHER: {
                ReceiptStatus.DRAFT,
                ReceiptStatus.PENDING_REVIEW
            },
            UserRole.AUDITOR: {
                ReceiptStatus.FROZEN,
                ReceiptStatus.ARCHIVED
            },
            UserRole.SUPPLIER: set()
        }
        return target_status in role_permissions.get(user.role, set())

    @classmethod
    def transition(
        cls,
        db: Session,
        receipt: AbnormalReceipt,
        to_status: ReceiptStatus,
        user: User,
        change_reason: Optional[str] = None,
        manual_reason: Optional[str] = None
    ) -> AbnormalReceipt:
        from_status = receipt.status

        if not cls.can_transition(from_status, to_status):
            raise StateTransitionError(
                f"无效的状态转换: {from_status.value} -> {to_status.value}"
            )

        if not cls.check_permission(user, to_status):
            raise PermissionError(
                f"用户 {user.real_name} (角色: {user.role.value}) 无权执行此状态转换"
            )

        if to_status == ReceiptStatus.FROZEN:
            receipt.frozen_before_status = from_status

        receipt.previous_status = from_status
        receipt.status = to_status

        history = StatusHistory(
            receipt_id=receipt.id,
            from_status=from_status,
            to_status=to_status,
            changed_by=user.id,
            change_reason=change_reason,
            manual_reason=manual_reason
        )
        db.add(history)

        if to_status in [ReceiptStatus.APPROVED, ReceiptStatus.REJECTED]:
            receipt.reviewed_by = user.id
            from datetime import datetime
            receipt.reviewed_at = datetime.utcnow()
            receipt.review_comment = change_reason

        if to_status == ReceiptStatus.ARCHIVED:
            receipt.is_archived = True

        db.add(receipt)
        db.flush()

        return receipt

    @classmethod
    def unfreeze(
        cls,
        db: Session,
        receipt: AbnormalReceipt,
        target_status: ReceiptStatus,
        user: User,
        change_reason: Optional[str] = None,
        manual_reason: Optional[str] = None
    ) -> AbnormalReceipt:
        if receipt.status != ReceiptStatus.FROZEN:
            raise StateTransitionError("只有冻结状态的回执才能解冻")

        return cls.transition(
            db=db,
            receipt=receipt,
            to_status=target_status,
            user=user,
            change_reason=change_reason,
            manual_reason=manual_reason
        )

    @classmethod
    def batch_freeze(
        cls,
        db: Session,
        receipts: List[AbnormalReceipt],
        user: User,
        change_reason: Optional[str] = None
    ) -> List[AbnormalReceipt]:
        results = []
        for receipt in receipts:
            if receipt.status != ReceiptStatus.FROZEN:
                try:
                    updated = cls.transition(
                        db=db,
                        receipt=receipt,
                        to_status=ReceiptStatus.FROZEN,
                        user=user,
                        change_reason=change_reason
                    )
                    results.append(updated)
                except (StateTransitionError, PermissionError):
                    continue
        return results

    @classmethod
    def get_status_history(
        cls,
        db: Session,
        receipt_id: int
    ) -> List[StatusHistory]:
        return (
            db.query(StatusHistory)
            .filter(StatusHistory.receipt_id == receipt_id)
            .order_by(StatusHistory.created_at.desc())
            .all()
        )
