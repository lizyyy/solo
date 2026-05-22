from datetime import datetime
from typing import Optional, Tuple, List, Dict
from sqlalchemy.orm import Session
from .models import (
    Receipt, ReceiptStatus, StatusTransition, AuditLog,
    Batch, DuplicateAction
)


class StateMachineError(Exception):
    pass


class InvalidTransitionError(StateMachineError):
    pass


class ReceiptStateMachine:
    VALID_TRANSITIONS: Dict[ReceiptStatus, List[ReceiptStatus]] = {
        ReceiptStatus.DRAFT: [
            ReceiptStatus.PENDING_REVIEW,
            ReceiptStatus.ARCHIVED
        ],
        ReceiptStatus.PENDING_REVIEW: [
            ReceiptStatus.APPROVED,
            ReceiptStatus.REJECTED,
            ReceiptStatus.DRAFT,
            ReceiptStatus.FROZEN
        ],
        ReceiptStatus.APPROVED: [
            ReceiptStatus.FROZEN,
            ReceiptStatus.ARCHIVED,
            ReceiptStatus.PENDING_REVIEW
        ],
        ReceiptStatus.REJECTED: [
            ReceiptStatus.PENDING_REVIEW,
            ReceiptStatus.ARCHIVED
        ],
        ReceiptStatus.FROZEN: [
            ReceiptStatus.APPROVED,
            ReceiptStatus.PENDING_REVIEW,
            ReceiptStatus.ARCHIVED
        ],
        ReceiptStatus.ARCHIVED: [
            ReceiptStatus.DRAFT
        ]
    }

    def __init__(self, receipt: Receipt):
        self.receipt = receipt

    def can_transition_to(self, target_status: ReceiptStatus) -> bool:
        valid_targets = self.VALID_TRANSITIONS.get(self.receipt.status, [])
        return target_status in valid_targets

    def transition(
        self,
        db: Session,
        target_status: ReceiptStatus,
        actor: str,
        reason: Optional[str] = None
    ) -> Tuple[Receipt, StatusTransition]:
        if not self.can_transition_to(target_status):
            raise InvalidTransitionError(
                f"无法从 {self.receipt.status} 转换到 {target_status}"
            )

        old_status = self.receipt.status
        self.receipt.previous_status = old_status
        self.receipt.status = target_status
        self.receipt.version += 1

        transition = StatusTransition(
            receipt_id=self.receipt.id,
            from_status=old_status,
            to_status=target_status,
            transitioned_by=actor,
            reason=reason
        )
        db.add(transition)

        audit_log = AuditLog(
            receipt_id=self.receipt.id,
            batch_id=self.receipt.batch_id,
            action=f"状态变更: {old_status} -> {target_status}",
            actor=actor,
            old_value={"status": old_status},
            new_value={"status": target_status},
            reason=reason
        )
        db.add(audit_log)

        return self.receipt, transition

    def submit_for_review(
        self,
        db: Session,
        actor: str,
        reason: Optional[str] = None
    ) -> Tuple[Receipt, StatusTransition]:
        return self.transition(db, ReceiptStatus.PENDING_REVIEW, actor, reason)

    def approve(
        self,
        db: Session,
        actor: str,
        reason: Optional[str] = None
    ) -> Tuple[Receipt, StatusTransition]:
        self.receipt.review_by = actor
        self.receipt.review_at = datetime.now()
        self.receipt.review_reason = reason
        return self.transition(db, ReceiptStatus.APPROVED, actor, reason)

    def reject(
        self,
        db: Session,
        actor: str,
        reason: str
    ) -> Tuple[Receipt, StatusTransition]:
        self.receipt.review_by = actor
        self.receipt.review_at = datetime.now()
        self.receipt.review_reason = reason
        return self.transition(db, ReceiptStatus.REJECTED, actor, reason)

    def freeze(
        self,
        db: Session,
        actor: str,
        reason: str
    ) -> Tuple[Receipt, StatusTransition]:
        self.receipt.freeze_reason = reason
        return self.transition(db, ReceiptStatus.FROZEN, actor, reason)

    def unfreeze(
        self,
        db: Session,
        actor: str,
        reason: Optional[str] = None,
        target_status: ReceiptStatus = ReceiptStatus.APPROVED
    ) -> Tuple[Receipt, StatusTransition]:
        return self.transition(db, target_status, actor, reason)

    def archive(
        self,
        db: Session,
        actor: str,
        reason: Optional[str] = None
    ) -> Tuple[Receipt, StatusTransition]:
        return self.transition(db, ReceiptStatus.ARCHIVED, actor, reason)

    def restore(
        self,
        db: Session,
        actor: str,
        reason: Optional[str] = None
    ) -> Tuple[Receipt, StatusTransition]:
        return self.transition(db, ReceiptStatus.DRAFT, actor, reason)


def handle_duplicate_receipt(
    db: Session,
    existing_receipt: Receipt,
    new_data: Dict,
    action: DuplicateAction,
    actor: str
) -> Tuple[Receipt, str]:
    if action == DuplicateAction.IGNORE:
        return existing_receipt, "ignored"

    if action == DuplicateAction.OVERWRITE:
        old_values = {
            "medicine_name": existing_receipt.medicine_name,
            "quantity": existing_receipt.quantity,
            "original_price": existing_receipt.original_price,
            "adjusted_price": existing_receipt.adjusted_price,
        }

        for key, value in new_data.items():
            if hasattr(existing_receipt, key) and key not in ["id", "created_at", "version"]:
                setattr(existing_receipt, key, value)

        existing_receipt.version += 1

        audit_log = AuditLog(
            receipt_id=existing_receipt.id,
            batch_id=existing_receipt.batch_id,
            action="覆盖更新",
            actor=actor,
            old_value=old_values,
            new_value={k: new_data.get(k) for k in old_values.keys()},
            reason="重复请求-覆盖模式"
        )
        db.add(audit_log)

        return existing_receipt, "overwritten"

    if action == DuplicateAction.APPEND:
        existing_receipt.quantity += new_data.get("quantity", 0)
        existing_receipt.version += 1

        audit_log = AuditLog(
            receipt_id=existing_receipt.id,
            batch_id=existing_receipt.batch_id,
            action="追加数量",
            actor=actor,
            old_value={"quantity": existing_receipt.quantity - new_data.get("quantity", 0)},
            new_value={"quantity": existing_receipt.quantity},
            reason="重复请求-追加模式"
        )
        db.add(audit_log)

        return existing_receipt, "appended"

    return existing_receipt, "unchanged"


def batch_state_summary(batch: Batch) -> Dict:
    status_counts = {}
    for receipt in batch.receipts:
        status = receipt.status.value
        status_counts[status] = status_counts.get(status, 0) + 1

    return {
        "batch_id": batch.id,
        "pharmacy_name": batch.pharmacy_name,
        "status": batch.status,
        "total_receipts": batch.total_receipts,
        "status_breakdown": status_counts,
        "frozen_at": batch.frozen_at,
        "frozen_by": batch.frozen_by,
        "created_at": batch.created_at,
    }
