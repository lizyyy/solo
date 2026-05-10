from datetime import datetime
from decimal import Decimal
from typing import List
from uuid import uuid4
from sqlalchemy.orm import Session

from app.models import (
    Reconciliation,
    Claim,
    ClaimStatus,
    Invoice,
    InvoiceStatus,
    Contract,
)
from app.schemas import ReconciliationCreate, ReconciliationItem
from app.exceptions import (
    NotFoundError,
    InvalidOperationError,
    AmountExceededError,
)
from app.state_machine import InvoiceStateMachine, ClaimStateMachine
from app.services.base_service import BaseService


class ReconciliationService(BaseService):
    def reconcile(self, db: Session, data: ReconciliationCreate) -> List[Reconciliation]:
        claim = db.query(Claim).filter(Claim.id == data.claim_id).first()
        if not claim:
            raise NotFoundError("认领单", entity_id=data.claim_id)

        if claim.status != ClaimStatus.APPROVED:
            raise InvalidOperationError(
                "认领单",
                "核销",
                f"认领单状态为 [{claim.status.value}]，只有已批准的认领单才能核销",
            )

        total_amount = sum(item.amount for item in data.items)
        if total_amount != claim.amount:
            raise AmountExceededError(
                "认领单",
                float(claim.amount),
                float(total_amount),
                detail=f"核销金额总和必须等于认领单金额（{claim.amount}）",
            )

        contract = db.query(Contract).filter(Contract.id == claim.contract_id).first()

        reconciliations = []
        for item in data.items:
            invoice = db.query(Invoice).filter(Invoice.id == item.invoice_id).first()
            if not invoice:
                raise NotFoundError("发票", entity_id=item.invoice_id)

            if invoice.contract_id != contract.id:
                raise InvalidOperationError(
                    "发票",
                    "核销",
                    f"发票 #{invoice.id} 不属于认领单对应合同 #{contract.id}",
                )

            if invoice.status == InvoiceStatus.RECONCILED:
                raise InvalidOperationError(
                    "发票",
                    "核销",
                    f"发票 #{invoice.id} 已完全核销",
                )

            remaining = invoice.amount - invoice.reconciled_amount
            if item.amount > remaining:
                raise AmountExceededError(
                    "发票",
                    float(remaining),
                    float(item.amount),
                    detail=f"发票可核销余额不足（剩余 {remaining}，请求 {item.amount}）",
                )

            old_status = invoice.status
            invoice.reconciled_amount += item.amount

            new_remaining = invoice.amount - invoice.reconciled_amount
            if new_remaining == 0:
                new_status = InvoiceStatus.RECONCILED
            elif new_remaining > 0:
                new_status = InvoiceStatus.PARTIAL
            else:
                new_status = old_status

            if new_status != old_status:
                InvoiceStateMachine.ensure_transition(invoice.id, old_status, new_status)
                invoice.status = new_status
                self.log_operation(
                    db, "Invoice", invoice.id, "STATUS_CHANGE",
                    from_status=old_status.value,
                    to_status=new_status.value,
                    reason=f"核销金额 {item.amount}",
                )

            recon = Reconciliation(
                claim_id=claim.id,
                invoice_id=invoice.id,
                amount=item.amount,
            )
            db.add(recon)
            reconciliations.append(recon)

        db.flush()
        for recon in reconciliations:
            self.log_operation(db, "Reconciliation", recon.id, "CREATE")

        db.commit()
        for recon in reconciliations:
            db.refresh(recon)
        return reconciliations

    def list_by_claim(self, db: Session, claim_id: int) -> List[Reconciliation]:
        return db.query(Reconciliation).filter(Reconciliation.claim_id == claim_id).all()

    def list_by_invoice(self, db: Session, invoice_id: int) -> List[Reconciliation]:
        return db.query(Reconciliation).filter(Reconciliation.invoice_id == invoice_id).all()
