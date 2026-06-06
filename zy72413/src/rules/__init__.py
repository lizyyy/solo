from typing import List, Tuple, Optional
from datetime import datetime
import uuid

from ..models import (
    Batch,
    BatchStatus,
    Ticket,
    TicketType,
    DJShow,
    ModificationRecord,
    ReviewDecision,
)


class BoundaryRuleEngine:
    @staticmethod
    def check_batch_mixed(batch: Batch) -> Tuple[bool, str]:
        if not batch.tickets:
            return False, "批次为空"
        
        counts = batch.ticket_counts
        has_paid = TicketType.PAID in counts
        has_complimentary = TicketType.COMPLIMENTARY in counts
        
        if has_paid and has_complimentary:
            detail = (
                f"批次 [{batch.name}] 存在混票: "
                f"售票 {counts.get(TicketType.PAID, 0)} 张, "
                f"赠票 {counts.get(TicketType.COMPLIMENTARY, 0)} 张"
            )
            return True, detail
        return False, "批次正常"

    @staticmethod
    def scan_all_batches(show: DJShow) -> List[Tuple[str, str]]:
        issues = []
        for batch in show.batches:
            is_mixed, detail = BoundaryRuleEngine.check_batch_mixed(batch)
            if is_mixed:
                batch.status = BatchStatus.MIXED
                batch.mixed_issue_found = True
                issues.append((batch.id, detail))
        return issues

    @staticmethod
    def flag_for_review(batch: Batch, reviewer: str, note: str = "") -> Batch:
        batch.status = BatchStatus.PENDING_REVIEW
        batch.review_note = note
        return batch

    @staticmethod
    def split_mixed_batch(
        batch: Batch,
        operator: str,
        show: DJShow,
    ) -> Tuple[Batch, Batch]:
        paid_tickets = [t for t in batch.tickets if t.type == TicketType.PAID]
        comp_tickets = [t for t in batch.tickets if t.type == TicketType.COMPLIMENTARY]
        unknown_tickets = [t for t in batch.tickets if t.type == TicketType.UNKNOWN]

        paid_batch = Batch(
            id=f"batch_{uuid.uuid4().hex[:8]}",
            name=f"{batch.name}_售票",
            show_id=batch.show_id,
            tickets=paid_tickets + unknown_tickets,
            status=BatchStatus.NORMAL,
        )

        comp_batch = Batch(
            id=f"batch_{uuid.uuid4().hex[:8]}",
            name=f"{batch.name}_赠票",
            show_id=batch.show_id,
            tickets=comp_tickets,
            status=BatchStatus.NORMAL,
        )

        batch.status = BatchStatus.RESOLVED
        batch.resolved_at = datetime.now()

        ModificationRecord(
            id=f"mod_{uuid.uuid4().hex[:8]}",
            show_id=show.id,
            entity_type="batch",
            entity_id=batch.id,
            field_name="split",
            old_value=batch.name,
            new_value=f"{paid_batch.name}, {comp_batch.name}",
            modified_by=operator,
            reason="拆分混票批次",
        )

        return paid_batch, comp_batch

    @staticmethod
    def rollback_batch(
        batch: Batch,
        operator: str,
        show: DJShow,
        reason: str = "",
    ) -> Batch:
        old_status = batch.status
        batch.status = BatchStatus.ROLLED_BACK
        batch.rolled_back_at = datetime.now()

        show.modification_history.append(
            ModificationRecord(
                id=f"mod_{uuid.uuid4().hex[:8]}",
                show_id=show.id,
                entity_type="batch",
                entity_id=batch.id,
                field_name="status",
                old_value=old_status.value,
                new_value=BatchStatus.ROLLED_BACK.value,
                modified_by=operator,
                reason=reason or "批次回滚",
            )
        )
        return batch

    @staticmethod
    def resolve_batch(
        batch: Batch,
        operator: str,
        show: DJShow,
        approved: bool,
        resolution: str = "",
    ) -> ReviewDecision:
        decision = ReviewDecision(
            id=f"review_{uuid.uuid4().hex[:8]}",
            batch_id=batch.id,
            show_id=show.id,
            decided_by=operator,
            is_approved=approved,
            resolution=resolution,
        )

        if approved:
            batch.status = BatchStatus.RESOLVED
            batch.resolved_at = datetime.now()
        else:
            batch.status = BatchStatus.PENDING_REVIEW

        show.review_decisions.append(decision)
        return decision

    @staticmethod
    def get_mixed_batches(show: DJShow) -> List[Batch]:
        return [
            b for b in show.batches
            if b.status in (BatchStatus.MIXED, BatchStatus.PENDING_REVIEW)
        ]
