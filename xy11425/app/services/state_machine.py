from typing import Dict, List, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from ..models import (
    Batch,
    BatchStatus,
    StateChange,
    VisitorRecord,
    AuditLog,
)


class StateTransitionError(Exception):
    pass


class VisitorStateMachine:
    VALID_TRANSITIONS: Dict[BatchStatus, List[BatchStatus]] = {
        BatchStatus.DRAFT: [
            BatchStatus.CREATED,
            BatchStatus.CANCELLED,
        ],
        BatchStatus.CREATED: [
            BatchStatus.MATERIALS_UPLOADED,
            BatchStatus.CANCELLED,
        ],
        BatchStatus.MATERIALS_UPLOADED: [
            BatchStatus.UNDER_REVIEW,
            BatchStatus.FROZEN,
            BatchStatus.CANCELLED,
        ],
        BatchStatus.UNDER_REVIEW: [
            BatchStatus.REVIEW_PASSED,
            BatchStatus.REVIEW_REJECTED,
            BatchStatus.FROZEN,
        ],
        BatchStatus.REVIEW_PASSED: [
            BatchStatus.SETTLED,
            BatchStatus.FROZEN,
            BatchStatus.UNDER_REVIEW,
        ],
        BatchStatus.REVIEW_REJECTED: [
            BatchStatus.UNDER_REVIEW,
            BatchStatus.CANCELLED,
            BatchStatus.FROZEN,
        ],
        BatchStatus.FROZEN: [
            BatchStatus.UNDER_REVIEW,
            BatchStatus.SETTLED,
            BatchStatus.ARCHIVED,
            BatchStatus.CANCELLED,
        ],
        BatchStatus.SETTLED: [
            BatchStatus.ARCHIVED,
            BatchStatus.FROZEN,
        ],
        BatchStatus.ARCHIVED: [
            BatchStatus.FROZEN,
        ],
        BatchStatus.CANCELLED: [
            BatchStatus.FROZEN,
        ],
    }

    @classmethod
    def can_transition(cls, from_status: BatchStatus, to_status: BatchStatus) -> bool:
        valid_next_states = cls.VALID_TRANSITIONS.get(from_status, [])
        return to_status in valid_next_states

    @classmethod
    def transition(
        cls,
        db: Session,
        batch: Batch,
        to_status: BatchStatus,
        changed_by: str,
        reason: str,
        metadata: Optional[Dict] = None,
    ) -> Tuple[Batch, StateChange]:
        from_status = BatchStatus(batch.status) if batch.status else None
        
        if from_status and not cls.can_transition(from_status, to_status):
            raise StateTransitionError(
                f"Cannot transition from {from_status} to {to_status}. "
                f"Valid transitions: {cls.VALID_TRANSITIONS.get(from_status, [])}"
            )

        state_change = StateChange(
            batch_id=batch.id,
            from_status=from_status.value if from_status else None,
            to_status=to_status.value,
            changed_by=changed_by,
            reason=reason,
            metadata=metadata or {},
        )
        db.add(state_change)

        batch.status = to_status.value
        
        if to_status == BatchStatus.SETTLED:
            batch.settled_at = datetime.utcnow()
        elif to_status == BatchStatus.ARCHIVED:
            batch.archived_at = datetime.utcnow()

        db.commit()
        db.refresh(batch)
        db.refresh(state_change)

        return batch, state_change

    @classmethod
    def get_state_history(cls, db: Session, batch_id: int) -> List[Dict]:
        state_changes = (
            db.query(StateChange)
            .filter(StateChange.batch_id == batch_id)
            .order_by(StateChange.changed_at)
            .all()
        )
        return [
            {
                "id": sc.id,
                "from_status": sc.from_status,
                "to_status": sc.to_status,
                "changed_by": sc.changed_by,
                "changed_at": sc.changed_at,
                "reason": sc.reason,
                "extra_metadata": sc.extra_metadata,
            }
            for sc in state_changes
        ]

    @classmethod
    def get_freeze_info(cls, db: Session, batch_id: int) -> Dict:
        state_changes = (
            db.query(StateChange)
            .filter(StateChange.batch_id == batch_id)
            .order_by(StateChange.changed_at)
            .all()
        )
        
        freeze_info = {
            "was_frozen": False,
            "freeze_time": None,
            "frozen_by": None,
            "freeze_reason": None,
            "status_before_freeze": None,
            "status_after_freeze": None,
            "freeze_count": 0,
        }

        for sc in state_changes:
            if sc.to_status == BatchStatus.FROZEN:
                freeze_info["was_frozen"] = True
                freeze_info["freeze_count"] += 1
                freeze_info["status_before_freeze"] = sc.from_status
                freeze_info["freeze_time"] = sc.changed_at
                freeze_info["frozen_by"] = sc.changed_by
                freeze_info["freeze_reason"] = sc.reason
            elif freeze_info["was_frozen"] and sc.from_status == BatchStatus.FROZEN:
                freeze_info["status_after_freeze"] = sc.to_status

        return freeze_info
