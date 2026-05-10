from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models import Receipt, ReceiptStatus, Contract
from app.schemas import ReceiptCreate, MatchResult, MatchResultItem
from app.exceptions import (
    NotFoundError,
    DuplicateSubmissionError,
    InvalidOperationError,
    VersionConflictError,
)
from app.state_machine import ReceiptStateMachine
from app.services.base_service import BaseService


class ReceiptService(BaseService):
    def create(self, db: Session, data: ReceiptCreate) -> Receipt:
        existing = db.query(Receipt).filter(Receipt.receipt_no == data.receipt_no).first()
        if existing:
            raise DuplicateSubmissionError("收款流水", data.receipt_no, detail="收款流水号必须唯一")

        receipt = Receipt(
            receipt_no=data.receipt_no,
            amount=data.amount,
            paid_at=data.paid_at,
            payer_name=data.payer_name,
            payer_account=data.payer_account,
            payer_bank=data.payer_bank,
            remark=data.remark,
            status=ReceiptStatus.UNMATCHED,
            remaining_amount=data.amount,
        )
        db.add(receipt)
        db.flush()
        self.log_operation(db, "Receipt", receipt.id, "CREATE")
        db.commit()
        db.refresh(receipt)
        return receipt

    def get(self, db: Session, receipt_id: int) -> Receipt:
        receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
        if not receipt:
            raise NotFoundError("收款流水", entity_id=receipt_id)
        return receipt

    def list(self, db: Session, status: Optional[ReceiptStatus] = None) -> List[Receipt]:
        query = db.query(Receipt)
        if status:
            query = query.filter(Receipt.status == status)
        return query.order_by(Receipt.paid_at.desc()).all()

    def match_contracts(self, db: Session, receipt_id: int) -> MatchResult:
        receipt = self.get(db, receipt_id)
        contracts = db.query(Contract).all()

        matches = []
        for contract in contracts:
            score = 0.0
            reasons = []

            if receipt.payer_name and contract.customer_name:
                if receipt.payer_name == contract.customer_name:
                    score += 40
                    reasons.append("付款方名称与合同客户完全匹配")
                elif receipt.payer_name in contract.customer_name or contract.customer_name in receipt.payer_name:
                    score += 20
                    reasons.append("付款方名称与合同客户部分匹配")

            if receipt.remark:
                remark_upper = receipt.remark.upper()
                contract_no_upper = contract.contract_no.upper()
                if contract_no_upper in remark_upper:
                    score += 40
                    reasons.append("备注包含合同号")
                if contract.contract_name and contract.contract_name in receipt.remark:
                    score += 20
                    reasons.append("备注包含合同名称")

            remaining = contract.total_amount - contract.received_amount
            if remaining > 0 and receipt.amount <= remaining:
                score += 10
                reasons.append("金额不超过合同未收款")

            if score > 0:
                matches.append(
                    MatchResultItem(
                        contract_id=contract.id,
                        contract_no=contract.contract_no,
                        contract_name=contract.contract_name,
                        customer_name=contract.customer_name,
                        score=score,
                        match_reason="；".join(reasons),
                    )
                )

        matches.sort(key=lambda x: x.score, reverse=True)

        return MatchResult(
            receipt_id=receipt.id,
            receipt_no=receipt.receipt_no,
            matches=matches,
        )

    def mark_matched(self, db: Session, receipt_id: int, operator: str = None) -> Receipt:
        receipt = self.get(db, receipt_id)
        old_status = receipt.status
        ReceiptStateMachine.ensure_transition(receipt.id, old_status, ReceiptStatus.MATCHED)
        receipt.status = ReceiptStatus.MATCHED
        self.log_operation(db, "Receipt", receipt.id, "MARK_MATCHED", operator, from_status=old_status.value, to_status=ReceiptStatus.MATCHED.value)
        db.commit()
        db.refresh(receipt)
        return receipt

    def update_remaining_with_lock(
        self, db: Session, receipt_id: int, delta: Decimal, expected_version: int
    ) -> Receipt:
        receipt = self.get(db, receipt_id)
        if receipt.version != expected_version:
            raise VersionConflictError("收款流水", receipt_id)

        new_remaining = receipt.remaining_amount + delta
        if new_remaining < 0:
            raise InvalidOperationError(
                "收款流水", "更新余额", f"剩余金额不能为负（当前 {receipt.remaining_amount}，变更 {delta}）"
            )

        receipt.remaining_amount = new_remaining
        receipt.version += 1

        old_status = receipt.status
        if new_remaining == 0 and old_status != ReceiptStatus.REFUNDED:
            new_status = ReceiptStatus.CLAIMED
        elif new_remaining > 0 and new_remaining < receipt.amount:
            new_status = ReceiptStatus.PARTIAL_CLAIMED
        else:
            new_status = old_status

        if new_status != old_status:
            ReceiptStateMachine.ensure_transition(receipt.id, old_status, new_status)
            receipt.status = new_status
            self.log_operation(
                db, "Receipt", receipt.id, "STATUS_CHANGE",
                from_status=old_status.value, to_status=new_status.value,
                reason=f"余额变更: {delta}, 新余额: {new_remaining}"
            )

        db.flush()
        return receipt
