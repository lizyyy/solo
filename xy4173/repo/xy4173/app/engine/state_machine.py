from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, TypeVar, Generic

from sqlalchemy.orm import Session

from app.models import Bill, Reservation, Violation, AuditLog


class BillState(str, Enum):
    PENDING = "pending"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    PAID = "paid"
    WAIVED = "waived"
    DISPUTED = "disputed"
    CANCELLED = "cancelled"


class BillEvent(str, Enum):
    SUBMIT = "submit"
    APPROVE = "approve"
    REJECT = "reject"
    PAY = "pay"
    WAIVE = "waive"
    DISPUTE = "dispute"
    RESOLVE_DISPUTE = "resolve_dispute"
    CANCEL = "cancel"


class ReservationState(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    NO_SHOW = "no_show"
    CANCELLED = "cancelled"


class ReservationEvent(str, Enum):
    SUBMIT = "submit"
    APPROVE = "approve"
    REJECT = "reject"
    CONFIRM = "confirm"
    START_USE = "start_use"
    END_USE = "end_use"
    MARK_NO_SHOW = "mark_no_show"
    CANCEL = "cancel"


class ViolationState(str, Enum):
    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    CONFIRMED = "confirmed"
    DISMISSED = "dismissed"
    APPEALED = "appealed"
    RESOLVED = "resolved"


class ViolationEvent(str, Enum):
    SUBMIT = "submit"
    START_REVIEW = "start_review"
    CONFIRM = "confirm"
    DISMISS = "dismiss"
    APPEAL = "appeal"
    RESOLVE = "resolve"
    CANCEL = "cancel"


TState = TypeVar('TState', bound=Enum)
TEvent = TypeVar('TEvent', bound=Enum)


@dataclass
class TransitionResult:
    success: bool = True
    from_state: Optional[str] = None
    to_state: Optional[str] = None
    event: Optional[str] = None
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)


class StateMachine(ABC, Generic[TState, TEvent]):
    
    def __init__(self, initial_state: TState):
        self.current_state: TState = initial_state
        self.transitions: Dict[TState, Dict[TEvent, TState]] = {}
        self.before_transition_hooks: List[Callable] = []
        self.after_transition_hooks: List[Callable] = []
        self._setup_transitions()
    
    @abstractmethod
    def _setup_transitions(self):
        pass
    
    def add_transition(self, from_state: TState, event: TEvent, to_state: TState):
        if from_state not in self.transitions:
            self.transitions[from_state] = {}
        self.transitions[from_state][event] = to_state
    
    def can_transition(self, event: TEvent) -> bool:
        return (
            self.current_state in self.transitions and
            event in self.transitions[self.current_state]
        )
    
    def get_next_state(self, event: TEvent) -> Optional[TState]:
        if self.can_transition(event):
            return self.transitions[self.current_state][event]
        return None
    
    def transition(self, event: TEvent, context: Dict[str, Any] = None) -> TransitionResult:
        result = TransitionResult(
            from_state=self.current_state.value,
            event=event.value
        )
        
        if not self.can_transition(event):
            result.success = False
            result.message = f"无法从状态 {self.current_state.value} 通过事件 {event.value} 进行转换"
            return result
        
        for hook in self.before_transition_hooks:
            hook(self.current_state, event, context)
        
        old_state = self.current_state
        new_state = self.transitions[self.current_state][event]
        self.current_state = new_state
        
        result.to_state = new_state.value
        result.success = True
        result.message = f"状态从 {old_state.value} 转换为 {new_state.value}"
        
        for hook in self.after_transition_hooks:
            hook(old_state, new_state, event, context)
        
        return result
    
    def add_before_transition_hook(self, hook: Callable):
        self.before_transition_hooks.append(hook)
    
    def add_after_transition_hook(self, hook: Callable):
        self.after_transition_hooks.append(hook)


class BillStateMachine(StateMachine[BillState, BillEvent]):
    
    def __init__(self, initial_state: BillState = BillState.PENDING):
        super().__init__(initial_state)
    
    def _setup_transitions(self):
        self.add_transition(BillState.PENDING, BillEvent.SUBMIT, BillState.PENDING_REVIEW)
        self.add_transition(BillState.PENDING, BillEvent.CANCEL, BillState.CANCELLED)
        
        self.add_transition(BillState.PENDING_REVIEW, BillEvent.APPROVE, BillState.APPROVED)
        self.add_transition(BillState.PENDING_REVIEW, BillEvent.REJECT, BillState.PENDING)
        self.add_transition(BillState.PENDING_REVIEW, BillEvent.CANCEL, BillState.CANCELLED)
        
        self.add_transition(BillState.APPROVED, BillEvent.PAY, BillState.PAID)
        self.add_transition(BillState.APPROVED, BillEvent.WAIVE, BillState.WAIVED)
        self.add_transition(BillState.APPROVED, BillEvent.DISPUTE, BillState.DISPUTED)
        
        self.add_transition(BillState.DISPUTED, BillEvent.RESOLVE_DISPUTE, BillState.APPROVED)
        self.add_transition(BillState.DISPUTED, BillEvent.CANCEL, BillState.CANCELLED)
        
        self.add_transition(BillState.PAID, BillEvent.CANCEL, BillState.CANCELLED)
        self.add_transition(BillState.WAIVED, BillEvent.CANCEL, BillState.CANCELLED)


class ReservationStateMachine(StateMachine[ReservationState, ReservationEvent]):
    
    def __init__(self, initial_state: ReservationState = ReservationState.DRAFT):
        super().__init__(initial_state)
    
    def _setup_transitions(self):
        self.add_transition(ReservationState.DRAFT, ReservationEvent.SUBMIT, ReservationState.PENDING)
        self.add_transition(ReservationState.DRAFT, ReservationEvent.CANCEL, ReservationState.CANCELLED)
        
        self.add_transition(ReservationState.PENDING, ReservationEvent.APPROVE, ReservationState.APPROVED)
        self.add_transition(ReservationState.PENDING, ReservationEvent.REJECT, ReservationState.DRAFT)
        self.add_transition(ReservationState.PENDING, ReservationEvent.CANCEL, ReservationState.CANCELLED)
        
        self.add_transition(ReservationState.APPROVED, ReservationEvent.CONFIRM, ReservationState.CONFIRMED)
        self.add_transition(ReservationState.APPROVED, ReservationEvent.CANCEL, ReservationState.CANCELLED)
        
        self.add_transition(ReservationState.CONFIRMED, ReservationEvent.START_USE, ReservationState.IN_PROGRESS)
        self.add_transition(ReservationState.CONFIRMED, ReservationEvent.CANCEL, ReservationState.CANCELLED)
        
        self.add_transition(ReservationState.IN_PROGRESS, ReservationEvent.END_USE, ReservationState.COMPLETED)
        
        self.add_transition(ReservationState.CONFIRMED, ReservationEvent.MARK_NO_SHOW, ReservationState.NO_SHOW)
        self.add_transition(ReservationState.APPROVED, ReservationEvent.MARK_NO_SHOW, ReservationState.NO_SHOW)


class ViolationStateMachine(StateMachine[ViolationState, ViolationEvent]):
    
    def __init__(self, initial_state: ViolationState = ViolationState.PENDING):
        super().__init__(initial_state)
    
    def _setup_transitions(self):
        self.add_transition(ViolationState.PENDING, ViolationEvent.START_REVIEW, ViolationState.UNDER_REVIEW)
        self.add_transition(ViolationState.PENDING, ViolationEvent.DISMISS, ViolationState.DISMISSED)
        
        self.add_transition(ViolationState.UNDER_REVIEW, ViolationEvent.CONFIRM, ViolationState.CONFIRMED)
        self.add_transition(ViolationState.UNDER_REVIEW, ViolationEvent.DISMISS, ViolationState.DISMISSED)
        
        self.add_transition(ViolationState.CONFIRMED, ViolationEvent.APPEAL, ViolationState.APPEALED)
        self.add_transition(ViolationState.CONFIRMED, ViolationEvent.RESOLVE, ViolationState.RESOLVED)
        
        self.add_transition(ViolationState.APPEALED, ViolationEvent.RESOLVE, ViolationState.RESOLVED)
        self.add_transition(ViolationState.APPEALED, ViolationEvent.DISMISS, ViolationState.DISMISSED)


def transition_bill_state(db: Session, bill: Bill, event: BillEvent,
                           operator_id: str = None, operator_name: str = None,
                           comments: str = None) -> TransitionResult:
    try:
        current_state = BillState(bill.status)
    except ValueError:
        current_state = BillState.PENDING
    
    sm = BillStateMachine(current_state)
    
    context = {
        "bill": bill,
        "operator_id": operator_id,
        "operator_name": operator_name,
        "comments": comments
    }
    
    def audit_hook(old_state: BillState, new_state: BillState, 
                   event: BillEvent, ctx: Dict[str, Any]):
        bill_obj = ctx.get("bill")
        op_id = ctx.get("operator_id")
        op_name = ctx.get("operator_name")
        cmts = ctx.get("comments")
        
        if bill_obj:
            audit_log = AuditLog(
                log_code=f"AUDIT_{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
                action=f"BILL_{event.value.upper()}",
                action_type="STATE_TRANSITION",
                user_id=op_id,
                user_name=op_name,
                resource_type="BILL",
                resource_id=bill_obj.id,
                resource_code=bill_obj.bill_code,
                old_value=old_state.value,
                new_value=new_state.value,
                details=cmts,
                is_success="success"
            )
            db.add(audit_log)
    
    sm.add_after_transition_hook(audit_hook)
    
    result = sm.transition(event, context)
    
    if result.success:
        bill.status = result.to_state
        db.commit()
    
    return result


def transition_reservation_state(db: Session, reservation: Reservation, 
                                   event: ReservationEvent,
                                   operator_id: str = None, 
                                   operator_name: str = None,
                                   comments: str = None) -> TransitionResult:
    try:
        current_state = ReservationState(reservation.status)
    except ValueError:
        current_state = ReservationState.DRAFT
    
    sm = ReservationStateMachine(current_state)
    
    context = {
        "reservation": reservation,
        "operator_id": operator_id,
        "operator_name": operator_name,
        "comments": comments
    }
    
    def audit_hook(old_state: ReservationState, new_state: ReservationState, 
                   event: ReservationEvent, ctx: Dict[str, Any]):
        res_obj = ctx.get("reservation")
        op_id = ctx.get("operator_id")
        op_name = ctx.get("operator_name")
        cmts = ctx.get("comments")
        
        if res_obj:
            audit_log = AuditLog(
                log_code=f"AUDIT_{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
                action=f"RESERVATION_{event.value.upper()}",
                action_type="STATE_TRANSITION",
                user_id=op_id,
                user_name=op_name,
                resource_type="RESERVATION",
                resource_id=res_obj.id,
                resource_code=res_obj.reservation_code,
                old_value=old_state.value,
                new_value=new_state.value,
                details=cmts,
                is_success="success"
            )
            db.add(audit_log)
    
    sm.add_after_transition_hook(audit_hook)
    
    result = sm.transition(event, context)
    
    if result.success:
        reservation.status = result.to_state
        db.commit()
    
    return result


def transition_violation_state(db: Session, violation: Violation, 
                                 event: ViolationEvent,
                                 operator_id: str = None, 
                                 operator_name: str = None,
                                 comments: str = None) -> TransitionResult:
    try:
        current_state = ViolationState(violation.status)
    except ValueError:
        current_state = ViolationState.PENDING
    
    sm = ViolationStateMachine(current_state)
    
    context = {
        "violation": violation,
        "operator_id": operator_id,
        "operator_name": operator_name,
        "comments": comments
    }
    
    def audit_hook(old_state: ViolationState, new_state: ViolationState, 
                   event: ViolationEvent, ctx: Dict[str, Any]):
        vio_obj = ctx.get("violation")
        op_id = ctx.get("operator_id")
        op_name = ctx.get("operator_name")
        cmts = ctx.get("comments")
        
        if vio_obj:
            audit_log = AuditLog(
                log_code=f"AUDIT_{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
                action=f"VIOLATION_{event.value.upper()}",
                action_type="STATE_TRANSITION",
                user_id=op_id,
                user_name=op_name,
                resource_type="VIOLATION",
                resource_id=vio_obj.id,
                resource_code=vio_obj.violation_code,
                old_value=old_state.value,
                new_value=new_state.value,
                details=cmts,
                is_success="success"
            )
            db.add(audit_log)
    
    sm.add_after_transition_hook(audit_hook)
    
    result = sm.transition(event, context)
    
    if result.success:
        violation.status = result.to_state
        if event == ViolationEvent.RESOLVE:
            violation.is_resolved = True
            violation.resolved_by = operator_id
            violation.resolved_at = datetime.now()
            violation.resolution_notes = comments
        db.commit()
    
    return result
