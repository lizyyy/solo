from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import uuid4
from sqlalchemy.orm import Session

from app.models import Claim, ClaimStatus, Receipt, Contract, ReceiptStatus
from app.schemas import ClaimCreate, ClaimApprove, ClaimReject
from app.exceptions import (
    NotFoundError,
    DuplicateSubmissionError,
    InvalidOperationError,
    AmountExceededError,
)
from app.state_machine import ClaimStateMachine, ReceiptStateMachine
from app.services.base_service import BaseService


class ClaimService(BaseService):
    def create(self, db: Session, data: ClaimCreate) -> Claim:
        receipt = db.query(Receipt).filter(Receipt.id == data.receipt_id).first()
        if not receipt:
            raise NotFoundError("收款流水", entity_id=data.receipt_id)

        contract = db.query(Contract).filter(Contract.id == data.contract_id).first()
        if not contract:
            raise NotFoundError("合同", entity_id=data.contract_id)

        if ReceiptStateMachine.is_terminal(receipt.status):
            raise InvalidOperationError(
                "收款流水", "创建认领", f"收款流水已处于终态 [{receipt.status.value}]"
            )

        if data.amount <= 0:
            raise InvalidOperationError("认领单", "创建", "认领金额必须大于0")

        if data.amount > receipt.remaining_amount:
            raise AmountExceededError(
                "收款流水",
                float(receipt.remaining_amount),
                float(data.amount),
                detail="认领金额不能超过收款流水剩余金额",
            )

        claim_no = f"CLM-{uuid4().hex[:12].upper()}"
        existing = db.query(Claim).filter(Claim.claim_no == claim_no).first()
        if existing:
            raise DuplicateSubmissionError("认领单", claim_no)

        old_status = receipt.status
        if old_status not in (ReceiptStatus.CLAIMING, ReceiptStatus.PARTIAL_CLAIMED):
            ReceiptStateMachine.ensure_transition(receipt.id, old_status, ReceiptStatus.CLAIMING)
            receipt.status = ReceiptStatus.CLAIMING
            self.log_operation(
                db, "Receipt", receipt.id, "STATUS_CHANGE",
                operator=data.applicant,
                from_status=old_status.value,
                to_status=ReceiptStatus.CLAIMING.value,
                reason=f"创建认领单 {claim_no}",
            )

        claim = Claim(
            claim_no=claim_no,
            receipt_id=data.receipt_id,
            contract_id=data.contract_id,
            amount=data.amount,
            status=ClaimStatus.PENDING,
            applicant=data.applicant,
            applicant_remark=data.applicant_remark,
        )
        db.add(claim)
        db.flush()
        self.log_operation(db, "Claim", claim.id, "CREATE", data.applicant)
        db.commit()
        db.refresh(claim)
        return claim

    def get(self, db: Session, claim_id: int) -> Claim:
        claim = db.query(Claim).filter(Claim.id == claim_id).first()
        if not claim:
            raise NotFoundError("认领单", entity_id=claim_id)
        return claim

    def list(
        self,
        db: Session,
        status: Optional[ClaimStatus] = None,
        receipt_id: Optional[int] = None,
    ) -> List[Claim]:
        query = db.query(Claim)
        if status:
            query = query.filter(Claim.status == status)
        if receipt_id:
            query = query.filter(Claim.receipt_id == receipt_id)
        return query.order_by(Claim.created_at.desc()).all()

    def approve(self, db: Session, claim_id: int, data: ClaimApprove) -> Claim:
        claim = self.get(db, claim_id)
        old_status = claim.status

        ClaimStateMachine.ensure_transition(claim.id, old_status, ClaimStatus.APPROVED)

        receipt = db.query(Receipt).filter(Receipt.id == claim.receipt_id).first()
        contract = db.query(Contract).filter(Contract.id == claim.contract_id).first()

        if receipt.remaining_amount < claim.amount:
            raise AmountExceededError(
                "收款流水",
                float(receipt.remaining_amount),
                float(claim.amount),
                detail="认领金额已超过收款流水剩余金额，请重新提交认领",
            )

        receipt.remaining_amount -= claim.amount
        contract.received_amount += claim.amount

        new_remaining = receipt.remaining_amount
        if new_remaining == 0:
            new_receipt_status = ReceiptStatus.CLAIMED
        elif new_remaining > 0:
            new_receipt_status = ReceiptStatus.PARTIAL_CLAIMED
        else:
            new_receipt_status = receipt.status

        if new_receipt_status != receipt.status:
            ReceiptStateMachine.ensure_transition(receipt.id, receipt.status, new_receipt_status)
            receipt_old_status = receipt.status
            receipt.status = new_receipt_status
            self.log_operation(
                db, "Receipt", receipt.id, "STATUS_CHANGE",
                operator=data.approver,
                from_status=receipt_old_status.value,
                to_status=new_receipt_status.value,
                reason=f"认领单 {claim.claim_no} 审批通过",
            )

        claim.status = ClaimStatus.APPROVED
        claim.approver = data.approver
        claim.approve_remark = data.approve_remark
        self.log_operation(
            db, "Claim", claim.id, "APPROVE",
            operator=data.approver,
            from_status=old_status.value,
            to_status=ClaimStatus.APPROVED.value,
            reason=data.approve_remark,
        )
        db.commit()
        db.refresh(claim)
        return claim

    def reject(self, db: Session, claim_id: int, data: ClaimReject) -> Claim:
        claim = self.get(db, claim_id)
        old_status = claim.status

        ClaimStateMachine.ensure_transition(claim.id, old_status, ClaimStatus.REJECTED)

        claim.status = ClaimStatus.REJECTED
        claim.approver = data.approver
        claim.approve_remark = data.approve_remark

        receipt = db.query(Receipt).filter(Receipt.id == claim.receipt_id).first()
        pending_claims = (
            db.query(Claim)
            .filter(Claim.receipt_id == claim.receipt_id, Claim.status == ClaimStatus.PENDING)
            .count()
        )
        if pending_claims == 0 and receipt.status == ReceiptStatus.CLAIMING:
            receipt_old_status = receipt.status
            receipt.status = ReceiptStatus.PENDING_CLAIM
            self.log_operation(
                db, "Receipt", receipt.id, "STATUS_CHANGE",
                operator=data.approver,
                from_status=receipt_old_status.value,
                to_status=ReceiptStatus.PENDING_CLAIM.value,
                reason=f"认领单 {claim.claim_no} 被拒绝，无其他待审批认领",
            )

        self.log_operation(
            db, "Claim", claim.id, "REJECT",
            operator=data.approver,
            from_status=old_status.value,
            to_status=ClaimStatus.REJECTED.value,
            reason=data.approve_remark,
        )
        db.commit()
        db.refresh(claim)
        return claim
