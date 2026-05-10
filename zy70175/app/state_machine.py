from typing import Dict, Set, Tuple, Optional
from app.models import ReceiptStatus, ClaimStatus, InvoiceStatus, RefundStatus
from app.exceptions import StateTransitionError


class ReceiptStateMachine:
    ALLOWED_TRANSITIONS: Dict[ReceiptStatus, Set[ReceiptStatus]] = {
        ReceiptStatus.UNMATCHED: {
            ReceiptStatus.MATCHED,
            ReceiptStatus.PENDING_CLAIM,
            ReceiptStatus.CLAIMING,
            ReceiptStatus.PARTIAL_CLAIMED,
            ReceiptStatus.CLAIMED,
            ReceiptStatus.REFUNDED,
        },
        ReceiptStatus.MATCHED: {
            ReceiptStatus.UNMATCHED,
            ReceiptStatus.PENDING_CLAIM,
            ReceiptStatus.CLAIMING,
            ReceiptStatus.PARTIAL_CLAIMED,
            ReceiptStatus.CLAIMED,
            ReceiptStatus.REFUNDED,
        },
        ReceiptStatus.PENDING_CLAIM: {
            ReceiptStatus.MATCHED,
            ReceiptStatus.UNMATCHED,
            ReceiptStatus.CLAIMING,
            ReceiptStatus.PARTIAL_CLAIMED,
            ReceiptStatus.CLAIMED,
            ReceiptStatus.REFUNDED,
        },
        ReceiptStatus.CLAIMING: {
            ReceiptStatus.PENDING_CLAIM,
            ReceiptStatus.MATCHED,
            ReceiptStatus.UNMATCHED,
            ReceiptStatus.CLAIMED,
            ReceiptStatus.PARTIAL_CLAIMED,
            ReceiptStatus.REFUNDED,
        },
        ReceiptStatus.CLAIMED: {
            ReceiptStatus.PARTIAL_CLAIMED,
            ReceiptStatus.REFUNDED,
        },
        ReceiptStatus.PARTIAL_CLAIMED: {
            ReceiptStatus.CLAIMED,
            ReceiptStatus.REFUNDED,
        },
        ReceiptStatus.REFUNDED: set(),
    }

    TERMINAL_STATES = {ReceiptStatus.REFUNDED}

    @classmethod
    def can_transition(cls, from_state: ReceiptStatus, to_state: ReceiptStatus) -> bool:
        if to_state == from_state:
            return True
        return to_state in cls.ALLOWED_TRANSITIONS.get(from_state, set())

    @classmethod
    def ensure_transition(cls, receipt_id: int, from_state: ReceiptStatus, to_state: ReceiptStatus, detail: str = None):
        if not cls.can_transition(from_state, to_state):
            raise StateTransitionError(
                entity="收款流水",
                entity_id=receipt_id,
                from_state=from_state.value,
                to_state=to_state.value,
                detail=detail
            )

    @classmethod
    def is_terminal(cls, state: ReceiptStatus) -> bool:
        return state in cls.TERMINAL_STATES


class ClaimStateMachine:
    ALLOWED_TRANSITIONS: Dict[ClaimStatus, Set[ClaimStatus]] = {
        ClaimStatus.PENDING: {ClaimStatus.APPROVED, ClaimStatus.REJECTED},
        ClaimStatus.APPROVED: set(),
        ClaimStatus.REJECTED: set(),
    }

    @classmethod
    def can_transition(cls, from_state: ClaimStatus, to_state: ClaimStatus) -> bool:
        if to_state == from_state:
            return True
        return to_state in cls.ALLOWED_TRANSITIONS.get(from_state, set())

    @classmethod
    def ensure_transition(cls, claim_id: int, from_state: ClaimStatus, to_state: ClaimStatus, detail: str = None):
        if not cls.can_transition(from_state, to_state):
            raise StateTransitionError(
                entity="认领单",
                entity_id=claim_id,
                from_state=from_state.value,
                to_state=to_state.value,
                detail=detail
            )


class InvoiceStateMachine:
    ALLOWED_TRANSITIONS: Dict[InvoiceStatus, Set[InvoiceStatus]] = {
        InvoiceStatus.UNRECONCILED: {InvoiceStatus.PARTIAL, InvoiceStatus.RECONCILED},
        InvoiceStatus.PARTIAL: {InvoiceStatus.RECONCILED, InvoiceStatus.UNRECONCILED},
        InvoiceStatus.RECONCILED: set(),
    }

    @classmethod
    def can_transition(cls, from_state: InvoiceStatus, to_state: InvoiceStatus) -> bool:
        if to_state == from_state:
            return True
        return to_state in cls.ALLOWED_TRANSITIONS.get(from_state, set())

    @classmethod
    def ensure_transition(cls, invoice_id: int, from_state: InvoiceStatus, to_state: InvoiceStatus, detail: str = None):
        if not cls.can_transition(from_state, to_state):
            raise StateTransitionError(
                entity="发票",
                entity_id=invoice_id,
                from_state=from_state.value,
                to_state=to_state.value,
                detail=detail
            )


class RefundStateMachine:
    ALLOWED_TRANSITIONS: Dict[RefundStatus, Set[RefundStatus]] = {
        RefundStatus.PENDING: {RefundStatus.PROCESSED, RefundStatus.FAILED},
        RefundStatus.PROCESSED: set(),
        RefundStatus.FAILED: {RefundStatus.PENDING},
    }

    @classmethod
    def can_transition(cls, from_state: RefundStatus, to_state: RefundStatus) -> bool:
        if to_state == from_state:
            return True
        return to_state in cls.ALLOWED_TRANSITIONS.get(from_state, set())

    @classmethod
    def ensure_transition(cls, refund_id: int, from_state: RefundStatus, to_state: RefundStatus, detail: str = None):
        if not cls.can_transition(from_state, to_state):
            raise StateTransitionError(
                entity="退款单",
                entity_id=refund_id,
                from_state=from_state.value,
                to_state=to_state.value,
                detail=detail
            )

    @classmethod
    def is_retryable(cls, state: RefundStatus) -> bool:
        return state == RefundStatus.FAILED
