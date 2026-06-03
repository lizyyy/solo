from typing import Optional
from .models import (
    ReviewRecord,
    TaxRateNote,
    CounterTransaction,
    BalanceChangeEntry,
)


class TraceLink:
    def __init__(
        self,
        record_id: str,
        display_type: str,
        display_id: str,
        label: str,
        back_ref_type: Optional[str] = None,
        back_ref_id: Optional[str] = None,
    ):
        self.record_id = record_id
        self.display_type = display_type
        self.display_id = display_id
        self.label = label
        self.back_ref_type = back_ref_type
        self.back_ref_id = back_ref_id


class TraceabilityService:
    def build_trace_links(self, record: ReviewRecord) -> list[TraceLink]:
        links: list[TraceLink] = []

        for tx in record.counter_transactions:
            linked_note_id = tx.linked_tax_note_id
            linked_note = None
            if linked_note_id:
                for n in record.tax_notes:
                    if n.id == linked_note_id:
                        linked_note = n
                        break

            links.append(TraceLink(
                record_id=record.id,
                display_type="counter_transaction",
                display_id=tx.id,
                label=f"流水尾号 {tx.tail_number}",
                back_ref_type="tax_rate_note" if linked_note else None,
                back_ref_id=linked_note.id if linked_note else None,
            ))

        for entry in record.balance_entries:
            linked_tx_id = entry.linked_counter_tx_id
            linked_tx = None
            if linked_tx_id:
                for t in record.counter_transactions:
                    if t.id == linked_tx_id:
                        linked_tx = t
                        break

            back_ref_type = "counter_transaction" if linked_tx else None
            back_ref_id = linked_tx.id if linked_tx else None

            indirect_note = None
            if linked_tx and linked_tx.linked_tax_note_id:
                for n in record.tax_notes:
                    if n.id == linked_tx.linked_tax_note_id:
                        indirect_note = n
                        break

            links.append(TraceLink(
                record_id=record.id,
                display_type="balance_entry",
                display_id=entry.id,
                label=f"余额变化 {entry.account} {entry.before_balance}->{entry.after_balance}",
                back_ref_type=back_ref_type,
                back_ref_id=back_ref_id,
            ))

        for note in record.tax_notes:
            links.append(TraceLink(
                record_id=record.id,
                display_type="tax_rate_note",
                display_id=note.id,
                label=f"税费率备注 {note.tax_category} {note.remark}",
                back_ref_type=None,
                back_ref_id=None,
            ))

        return links

    def trace_back(
        self, record: ReviewRecord, from_type: str, from_id: str
    ) -> Optional[TraceLink]:
        links = self.build_trace_links(record)
        for link in links:
            if link.display_type == from_type and link.display_id == from_id:
                return link
        return None

    def full_evidence_chain(
        self, record: ReviewRecord, from_type: str, from_id: str
    ) -> list[TraceLink]:
        chain: list[TraceLink] = []
        current = self.trace_back(record, from_type, from_id)
        while current:
            chain.append(current)
            if current.back_ref_type and current.back_ref_id:
                current = self.trace_back(record, current.back_ref_type, current.back_ref_id)
            else:
                current = None
        return chain

    def get_source_detail(
        self, record: ReviewRecord, item_type: str, item_id: str
    ) -> Optional[dict]:
        if item_type == "tax_rate_note":
            for n in record.tax_notes:
                if n.id == item_id:
                    return {
                        "type": "tax_rate_note",
                        "id": n.id,
                        "tax_category": n.tax_category,
                        "rate": n.rate,
                        "remark": n.remark,
                        "approver_name": n.approver_name,
                        "source_file": n.source_file,
                    }
        elif item_type == "counter_transaction":
            for tx in record.counter_transactions:
                if tx.id == item_id:
                    return {
                        "type": "counter_transaction",
                        "id": tx.id,
                        "tail_number": tx.tail_number,
                        "amount": tx.amount,
                        "description": tx.description,
                        "linked_tax_note_id": tx.linked_tax_note_id,
                    }
        elif item_type == "balance_entry":
            for e in record.balance_entries:
                if e.id == item_id:
                    return {
                        "type": "balance_entry",
                        "id": e.id,
                        "account": e.account,
                        "before_balance": e.before_balance,
                        "after_balance": e.after_balance,
                        "change_reason": e.change_reason,
                        "linked_counter_tx_id": e.linked_counter_tx_id,
                    }
        return None
