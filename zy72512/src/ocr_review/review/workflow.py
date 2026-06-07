from dataclasses import dataclass
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum

from ..models.ticket import Ticket, TicketStatus, TicketField
from ..models.rule import MaskRule, RuleStatus
from ..storage.store import DataStore
from ..utils.mask import mask_phone


class ReviewAction(str, Enum):
    ADD_RULE_NOTE = "add_rule_note"
    ADD_ALGORITHM_NOTE = "add_algorithm_note"
    MARK_FIELD_MASKED = "mark_field_masked"
    ESCALATE_TO_ALGORITHM = "escalate_to_algorithm"
    RESOLVE = "resolve"
    CLOSE = "close"
    REOPEN = "reopen"


@dataclass
class ReviewResult:
    success: bool
    action: ReviewAction
    ticket_id: str
    message: str
    previous_status: TicketStatus
    new_status: TicketStatus
    timestamp: str


class ReviewWorkflow:
    def __init__(self, store: DataStore):
        self.store = store

    def operation_review(self, ticket_id: str, rule_notes: List[Dict[str, str]], reviewer: str = "老唐") -> ReviewResult:
        ticket = self.store.load_ticket(ticket_id)
        if not ticket:
            return ReviewResult(
                success=False,
                action=ReviewAction.ADD_RULE_NOTE,
                ticket_id=ticket_id,
                message=f"工单 {ticket_id} 不存在",
                previous_status=TicketStatus.IMPORTED,
                new_status=TicketStatus.IMPORTED,
                timestamp=datetime.now().isoformat(),
            )

        prev_status = ticket.status

        for note_item in rule_notes:
            field_name = note_item.get("field_name")
            note = note_item.get("note", "")
            ticket.add_rule_note(note, reviewer, field_name)

            if field_name:
                field = next((f for f in ticket.fields if f.field_name == field_name), None)
                if field and field.leak_detected:
                    if "已补充脱敏规则" in note or "已配置" in note:
                        field.is_masked = True
                        field.mask_pattern = mask_phone(field.field_value)
                        field.leak_note = field.leak_note + f" | 运营备注: {note}"

        if ticket.has_leaks():
            unmasked_leaks = [f for f in ticket.get_leaking_fields() if not f.is_masked]
            if unmasked_leaks:
                ticket.set_status(TicketStatus.REVIEW_PENDING, assignee="algorithm")
                new_status = TicketStatus.REVIEW_PENDING
                message = f"运营已补充备注，仍有 {len(unmasked_leaks)} 个字段需算法同事复核"
            else:
                ticket.set_status(TicketStatus.REVIEWED_BY_OPERATION, assignee=None)
                new_status = TicketStatus.REVIEWED_BY_OPERATION
                message = "运营已完成复核，所有泄露字段已标记脱敏"
        else:
            ticket.set_status(TicketStatus.REVIEWED_BY_OPERATION, assignee=None)
            new_status = TicketStatus.REVIEWED_BY_OPERATION
            message = "运营已复核，无敏感数据泄露"

        self.store.save_ticket(ticket)

        return ReviewResult(
            success=True,
            action=ReviewAction.ADD_RULE_NOTE,
            ticket_id=ticket_id,
            message=message,
            previous_status=prev_status,
            new_status=new_status,
            timestamp=datetime.now().isoformat(),
        )

    def algorithm_review(self, ticket_id: str, algorithm_notes: List[Dict[str, str]], reviewer: str) -> ReviewResult:
        ticket = self.store.load_ticket(ticket_id)
        if not ticket:
            return ReviewResult(
                success=False,
                action=ReviewAction.ADD_ALGORITHM_NOTE,
                ticket_id=ticket_id,
                message=f"工单 {ticket_id} 不存在",
                previous_status=TicketStatus.IMPORTED,
                new_status=TicketStatus.IMPORTED,
                timestamp=datetime.now().isoformat(),
            )

        prev_status = ticket.status

        for note_item in algorithm_notes:
            field_name = note_item.get("field_name")
            note = note_item.get("note", "")
            ticket.add_algorithm_note(note, reviewer, field_name)

            if field_name:
                field = next((f for f in ticket.fields if f.field_name == field_name), None)
                if field and field.leak_detected:
                    if "算法已修复" in note or "已调整OCR" in note:
                        field.is_masked = True
                        field.mask_pattern = mask_phone(field.field_value)
                        field.leak_note = field.leak_note + f" | 算法备注: {note}"

        if ticket.has_leaks():
            unmasked_leaks = [f for f in ticket.get_leaking_fields() if not f.is_masked]
            if unmasked_leaks:
                ticket.set_status(TicketStatus.REVIEW_PENDING, assignee="algorithm")
                new_status = TicketStatus.REVIEW_PENDING
                message = f"算法已备注，仍有 {len(unmasked_leaks)} 个字段待处理"
            else:
                ticket.set_status(TicketStatus.REVIEWED_BY_ALGORITHM, assignee=None)
                new_status = TicketStatus.REVIEWED_BY_ALGORITHM
                message = "算法已完成复核，所有问题已处理"
        else:
            ticket.set_status(TicketStatus.REVIEWED_BY_ALGORITHM, assignee=None)
            new_status = TicketStatus.REVIEWED_BY_ALGORITHM
            message = "算法已复核确认"

        self.store.save_ticket(ticket)

        return ReviewResult(
            success=True,
            action=ReviewAction.ADD_ALGORITHM_NOTE,
            ticket_id=ticket_id,
            message=message,
            previous_status=prev_status,
            new_status=new_status,
            timestamp=datetime.now().isoformat(),
        )

    def escalate_to_algorithm(self, ticket_id: str, reason: str, operator: str = "老唐") -> ReviewResult:
        ticket = self.store.load_ticket(ticket_id)
        if not ticket:
            return ReviewResult(
                success=False,
                action=ReviewAction.ESCALATE_TO_ALGORITHM,
                ticket_id=ticket_id,
                message=f"工单 {ticket_id} 不存在",
                previous_status=TicketStatus.IMPORTED,
                new_status=TicketStatus.IMPORTED,
                timestamp=datetime.now().isoformat(),
            )

        prev_status = ticket.status
        ticket.add_rule_note(f"升级原因: {reason}", operator)
        ticket.set_status(TicketStatus.REVIEW_PENDING, assignee="algorithm")
        self.store.save_ticket(ticket)

        return ReviewResult(
            success=True,
            action=ReviewAction.ESCALATE_TO_ALGORITHM,
            ticket_id=ticket_id,
            message=f"已升级给算法同事处理: {reason}",
            previous_status=prev_status,
            new_status=TicketStatus.REVIEW_PENDING,
            timestamp=datetime.now().isoformat(),
        )

    def resolve_ticket(self, ticket_id: str, resolver: str) -> ReviewResult:
        ticket = self.store.load_ticket(ticket_id)
        if not ticket:
            return ReviewResult(
                success=False,
                action=ReviewAction.RESOLVE,
                ticket_id=ticket_id,
                message=f"工单 {ticket_id} 不存在",
                previous_status=TicketStatus.IMPORTED,
                new_status=TicketStatus.IMPORTED,
                timestamp=datetime.now().isoformat(),
            )

        prev_status = ticket.status

        if ticket.has_leaks():
            unmasked = [f for f in ticket.get_leaking_fields() if not f.is_masked]
            if unmasked:
                return ReviewResult(
                    success=False,
                    action=ReviewAction.RESOLVE,
                    ticket_id=ticket_id,
                    message=f"仍有 {len(unmasked)} 个泄露字段未处理，无法结单",
                    previous_status=prev_status,
                    new_status=prev_status,
                    timestamp=datetime.now().isoformat(),
                )

        ticket.set_status(TicketStatus.RESOLVED, assignee=None)
        self.store.save_ticket(ticket)

        return ReviewResult(
            success=True,
            action=ReviewAction.RESOLVE,
            ticket_id=ticket_id,
            message="工单已解决",
            previous_status=prev_status,
            new_status=TicketStatus.RESOLVED,
            timestamp=datetime.now().isoformat(),
        )

    def get_ticket_review_history(self, ticket_id: str) -> Dict[str, Any]:
        ticket = self.store.load_ticket(ticket_id)
        if not ticket:
            return {}

        return {
            "ticket_id": ticket_id,
            "current_status": ticket.status.value,
            "assignee": ticket.assignee,
            "rule_notes": ticket.rule_notes,
            "algorithm_notes": ticket.algorithm_notes,
            "leaking_fields": [
                {
                    "field_name": f.field_name,
                    "leak_note": f.leak_note,
                    "is_masked": f.is_masked,
                    "mask_pattern": f.mask_pattern,
                    "ocr_confidence": f.ocr_confidence,
                }
                for f in ticket.get_leaking_fields()
            ],
        }

    def list_tickets_for_role(self, role: str) -> List[Dict[str, Any]]:
        if role == "operation":
            statuses = [TicketStatus.DETECTED_LEAK]
        elif role == "algorithm":
            statuses = [TicketStatus.REVIEW_PENDING]
        else:
            statuses = list(TicketStatus)

        tickets = []
        for status in statuses:
            tickets.extend(self.store.list_tickets(status=status))

        return [
            {
                "ticket_id": t.ticket_id,
                "title": t.title,
                "status": t.status.value,
                "assignee": t.assignee,
                "has_leaks": t.has_leaks(),
                "leak_count": len(t.get_leaking_fields()),
                "created_at": t.created_at.isoformat(),
                "ocr_confidence": t.ocr_confidence_score,
            }
            for t in tickets
        ]
