from typing import Set, Dict, List, Tuple
from app.models import BlastStatus, AuditAction
from app.exceptions import InvalidStatusException


class BlastStateMachine:
    ALLOWED_TRANSITIONS: Dict[BlastStatus, Set[BlastStatus]] = {
        BlastStatus.DRAFT: {
            BlastStatus.SUBMITTED,
        },
        BlastStatus.SUBMITTED: {
            BlastStatus.WIND_CHECK_FAILED,
            BlastStatus.RECEIPT_MISSING,
            BlastStatus.ZONE_CHANGED,
            BlastStatus.PENDING_REVIEW,
            BlastStatus.APPROVED,
        },
        BlastStatus.WIND_CHECK_FAILED: {
            BlastStatus.SUBMITTED,
            BlastStatus.PENDING_REVIEW,
            BlastStatus.REVIEWING,
            BlastStatus.REJECTED,
        },
        BlastStatus.RECEIPT_MISSING: {
            BlastStatus.SUBMITTED,
            BlastStatus.PENDING_REVIEW,
            BlastStatus.REVIEWING,
            BlastStatus.REJECTED,
        },
        BlastStatus.ZONE_CHANGED: {
            BlastStatus.SUBMITTED,
            BlastStatus.PENDING_REVIEW,
            BlastStatus.REVIEWING,
            BlastStatus.REJECTED,
        },
        BlastStatus.PENDING_REVIEW: {
            BlastStatus.REVIEWING,
            BlastStatus.REJECTED,
        },
        BlastStatus.REVIEWING: {
            BlastStatus.APPROVED,
            BlastStatus.REJECTED,
            BlastStatus.DRAFT,
        },
        BlastStatus.APPROVED: {
            BlastStatus.EXECUTED,
            BlastStatus.REJECTED,
        },
        BlastStatus.EXECUTED: {
            BlastStatus.ARCHIVED,
        },
        BlastStatus.ARCHIVED: set(),
        BlastStatus.REJECTED: {
            BlastStatus.DRAFT,
        },
    }

    STATUS_TO_ACTION: Dict[Tuple[BlastStatus, BlastStatus], AuditAction] = {
        (BlastStatus.DRAFT, BlastStatus.SUBMITTED): AuditAction.SUBMIT,
        (BlastStatus.SUBMITTED, BlastStatus.WIND_CHECK_FAILED): AuditAction.WIND_CHECK,
        (BlastStatus.SUBMITTED, BlastStatus.RECEIPT_MISSING): AuditAction.SEND_NOTICE,
        (BlastStatus.SUBMITTED, BlastStatus.ZONE_CHANGED): AuditAction.MODIFY_ZONE,
        (BlastStatus.SUBMITTED, BlastStatus.PENDING_REVIEW): AuditAction.REVIEW,
        (BlastStatus.SUBMITTED, BlastStatus.APPROVED): AuditAction.APPROVE,
        (BlastStatus.WIND_CHECK_FAILED, BlastStatus.SUBMITTED): AuditAction.UPDATE,
        (BlastStatus.WIND_CHECK_FAILED, BlastStatus.PENDING_REVIEW): AuditAction.REVIEW,
        (BlastStatus.WIND_CHECK_FAILED, BlastStatus.REVIEWING): AuditAction.REVIEW,
        (BlastStatus.WIND_CHECK_FAILED, BlastStatus.REJECTED): AuditAction.REJECT,
        (BlastStatus.RECEIPT_MISSING, BlastStatus.SUBMITTED): AuditAction.RECEIVE_RECEIPT,
        (BlastStatus.RECEIPT_MISSING, BlastStatus.PENDING_REVIEW): AuditAction.REVIEW,
        (BlastStatus.RECEIPT_MISSING, BlastStatus.REVIEWING): AuditAction.REVIEW,
        (BlastStatus.RECEIPT_MISSING, BlastStatus.REJECTED): AuditAction.REJECT,
        (BlastStatus.ZONE_CHANGED, BlastStatus.SUBMITTED): AuditAction.MODIFY_ZONE,
        (BlastStatus.ZONE_CHANGED, BlastStatus.PENDING_REVIEW): AuditAction.REVIEW,
        (BlastStatus.ZONE_CHANGED, BlastStatus.REVIEWING): AuditAction.REVIEW,
        (BlastStatus.ZONE_CHANGED, BlastStatus.REJECTED): AuditAction.REJECT,
        (BlastStatus.PENDING_REVIEW, BlastStatus.REVIEWING): AuditAction.REVIEW,
        (BlastStatus.PENDING_REVIEW, BlastStatus.REJECTED): AuditAction.REJECT,
        (BlastStatus.REVIEWING, BlastStatus.APPROVED): AuditAction.APPROVE,
        (BlastStatus.REVIEWING, BlastStatus.REJECTED): AuditAction.REJECT,
        (BlastStatus.REVIEWING, BlastStatus.DRAFT): AuditAction.REJECT,
        (BlastStatus.APPROVED, BlastStatus.EXECUTED): AuditAction.EXECUTE,
        (BlastStatus.APPROVED, BlastStatus.REJECTED): AuditAction.REJECT,
        (BlastStatus.EXECUTED, BlastStatus.ARCHIVED): AuditAction.ARCHIVE,
        (BlastStatus.REJECTED, BlastStatus.DRAFT): AuditAction.UPDATE,
    }

    @classmethod
    def can_transition(cls, current_status: BlastStatus, target_status: BlastStatus) -> bool:
        allowed_targets = cls.ALLOWED_TRANSITIONS.get(current_status, set())
        return target_status in allowed_targets

    @classmethod
    def validate_transition(cls, current_status: BlastStatus, target_status: BlastStatus) -> None:
        if not cls.can_transition(current_status, target_status):
            raise InvalidStatusException(
                message=f"无法从状态 [{current_status.value}] 转换到 [{target_status.value}]",
                error_details=[f"允许的目标状态: {[s.value for s in cls.ALLOWED_TRANSITIONS.get(current_status, [])]}"]
            )

    @classmethod
    def get_audit_action(cls, current_status: BlastStatus, target_status: BlastStatus) -> AuditAction:
        key = (current_status, target_status)
        return cls.STATUS_TO_ACTION.get(key, AuditAction.UPDATE)

    @classmethod
    def get_allowed_actions(cls, current_status: BlastStatus) -> List[str]:
        allowed_targets = cls.ALLOWED_TRANSITIONS.get(current_status, set())
        actions = []
        for target in allowed_targets:
            action = cls.get_audit_action(current_status, target)
            actions.append(f"{action.value} -> {target.value}")
        return actions

    @classmethod
    def is_modification_allowed(cls, status: BlastStatus) -> bool:
        return status in {
            BlastStatus.DRAFT,
            BlastStatus.WIND_CHECK_FAILED,
            BlastStatus.RECEIPT_MISSING,
            BlastStatus.ZONE_CHANGED,
            BlastStatus.REJECTED,
        }

    @classmethod
    def is_archived_or_executed(cls, status: BlastStatus) -> bool:
        return status in {BlastStatus.ARCHIVED, BlastStatus.EXECUTED}

    @classmethod
    def needs_attention(cls, status: BlastStatus) -> bool:
        return status in {
            BlastStatus.WIND_CHECK_FAILED,
            BlastStatus.RECEIPT_MISSING,
            BlastStatus.ZONE_CHANGED,
            BlastStatus.PENDING_REVIEW,
        }
