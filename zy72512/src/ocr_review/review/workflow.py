from dataclasses import dataclass
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum

from ..models.ticket import Ticket, TicketStatus, TicketField
from ..models.rule import MaskRule, RuleStatus
from ..storage.store import DataStore
from ..utils.mask import mask_text

OCR_LOW_CONFIDENCE_THRESHOLD = 0.7


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
    escalated_to_algorithm: bool = False


class ReviewWorkflow:
    def __init__(self, store: DataStore):
        self.store = store

    def _has_low_confidence_unreviewed(self, ticket: Ticket) -> bool:
        for f in ticket.fields:
            if f.leak_detected and f.ocr_confidence is not None and f.ocr_confidence < OCR_LOW_CONFIDENCE_THRESHOLD:
                algo_reviewed = any(
                    n.get("field_name") == f.field_name
                    for n in ticket.algorithm_notes
                )
                if not algo_reviewed:
                    return True
        return False

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
                        field.mask_pattern = mask_text(field.field_value)
                        field.leak_note = (field.leak_note or "") + f" | 运营备注: {note}"

        needs_algorithm = self._has_low_confidence_unreviewed(ticket)

        if needs_algorithm:
            ticket.set_status(TicketStatus.REVIEWED_BY_OPERATION, assignee="algorithm")
            new_status = TicketStatus.REVIEWED_BY_OPERATION
            low_conf_fields = [
                f.field_name for f in ticket.fields
                if f.leak_detected and f.ocr_confidence is not None and f.ocr_confidence < OCR_LOW_CONFIDENCE_THRESHOLD
            ]
            message = f"运营已补充备注，但 OCR低置信度字段 {', '.join(low_conf_fields)} 需算法同事复核，已自动升级"
            escalated = True
        elif ticket.has_leaks():
            unmasked_leaks = [f for f in ticket.get_leaking_fields() if not f.is_masked]
            if unmasked_leaks:
                ticket.set_status(TicketStatus.REVIEW_PENDING, assignee="algorithm")
                new_status = TicketStatus.REVIEW_PENDING
                message = f"运营已补充备注，仍有 {len(unmasked_leaks)} 个字段需算法同事复核"
                escalated = True
            else:
                ticket.set_status(TicketStatus.REVIEWED_BY_OPERATION, assignee=None)
                new_status = TicketStatus.REVIEWED_BY_OPERATION
                message = "运营已完成复核，所有泄露字段已标记脱敏"
                escalated = False
        else:
            ticket.set_status(TicketStatus.REVIEWED_BY_OPERATION, assignee=None)
            new_status = TicketStatus.REVIEWED_BY_OPERATION
            message = "运营已复核，无敏感数据泄露"
            escalated = False

        self.store.save_ticket(ticket)

        return ReviewResult(
            success=True,
            action=ReviewAction.ADD_RULE_NOTE,
            ticket_id=ticket_id,
            message=message,
            previous_status=prev_status,
            new_status=new_status,
            timestamp=datetime.now().isoformat(),
            escalated_to_algorithm=escalated,
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
                    if "算法已修复" in note or "已调整OCR" in note or "确认识别" in note:
                        field.is_masked = True
                        field.mask_pattern = mask_text(field.field_value)
                        field.leak_note = (field.leak_note or "") + f" | 算法备注: {note}"

        still_needs_algorithm = self._has_low_confidence_unreviewed(ticket)

        if still_needs_algorithm:
            ticket.set_status(TicketStatus.REVIEWED_BY_ALGORITHM, assignee="algorithm")
            new_status = TicketStatus.REVIEWED_BY_ALGORITHM
            low_conf_fields = [
                f.field_name for f in ticket.fields
                if f.leak_detected and f.ocr_confidence is not None and f.ocr_confidence < OCR_LOW_CONFIDENCE_THRESHOLD
                and not any(n.get("field_name") == f.field_name for n in ticket.algorithm_notes)
            ]
            message = f"算法已备注部分字段，但 {', '.join(low_conf_fields)} 仍需算法复核"
        elif ticket.has_leaks():
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

            low_conf_unreviewed = [
                f for f in ticket.get_leaking_fields()
                if f.ocr_confidence is not None and f.ocr_confidence < OCR_LOW_CONFIDENCE_THRESHOLD
                and not any(n.get("field_name") == f.field_name for n in ticket.algorithm_notes)
            ]
            if low_conf_unreviewed:
                return ReviewResult(
                    success=False,
                    action=ReviewAction.RESOLVE,
                    ticket_id=ticket_id,
                    message=f"OCR低置信度字段 {', '.join(f.field_name for f in low_conf_unreviewed)} 未经算法复核，无法结单",
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
                    "needs_algorithm": (
                        f.ocr_confidence is not None
                        and f.ocr_confidence < OCR_LOW_CONFIDENCE_THRESHOLD
                        and not any(n.get("field_name") == f.field_name for n in ticket.algorithm_notes)
                    ),
                }
                for f in ticket.get_leaking_fields()
            ],
        }

    def list_tickets_for_role(self, role: str) -> List[Dict[str, Any]]:
        if role == "operation":
            statuses = [TicketStatus.DETECTED_LEAK]
        elif role == "algorithm":
            statuses = [TicketStatus.REVIEW_PENDING, TicketStatus.REVIEWED_BY_OPERATION]
        else:
            statuses = list(TicketStatus)

        tickets = []
        for status in statuses:
            tickets.extend(self.store.list_tickets(status=status))

        if role == "algorithm":
            all_tickets = self.store.list_tickets()
            ticket_ids = {t.ticket_id for t in tickets}
            for t in all_tickets:
                if t.ticket_id not in ticket_ids and t.assignee == "algorithm":
                    tickets.append(t)

        result = []
        for t in tickets:
            missing = []
            low_conf_fields = []
            for f in t.fields:
                if f.leak_detected:
                    if f.ocr_confidence and f.ocr_confidence < OCR_LOW_CONFIDENCE_THRESHOLD:
                        low_conf_fields.append(f.field_name)
                        algo_reviewed = any(
                            n.get("field_name") == f.field_name
                            for n in t.algorithm_notes
                        )
                        if not algo_reviewed:
                            missing.append(f"{f.field_name}需算法同事OCR复核(置信度{f.ocr_confidence:.2f})")
                    if not f.last_reviewed_by and f.ocr_confidence and f.ocr_confidence >= OCR_LOW_CONFIDENCE_THRESHOLD:
                        if not f.mask_pattern:
                            missing.append(f"{f.field_name}需脱敏规则配置")
            result.append({
                "ticket_id": t.ticket_id,
                "title": t.title,
                "status": t.status.value,
                "assignee": t.assignee,
                "has_leaks": t.has_leaks(),
                "leak_count": len(t.get_leaking_fields()),
                "created_at": t.created_at.isoformat(),
                "ocr_confidence": t.ocr_confidence_score,
                "missing_materials": missing,
                "low_confidence_fields": low_conf_fields,
            })
        return result
