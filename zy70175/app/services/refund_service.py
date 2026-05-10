from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import uuid4
from sqlalchemy.orm import Session

from app.models import Refund, RefundStatus, Receipt, ReceiptStatus, Claim, ClaimStatus
from app.schemas import RefundCreate, RefundProcess
from app.exceptions import (
    NotFoundError,
    InvalidOperationError,
    AmountExceededError,
)
from app.state_machine import RefundStateMachine, ReceiptStateMachine
from app.services.base_service import BaseService


class RefundService(BaseService):
    def create(self, db: Session, data: RefundCreate) -> Refund:
        receipt = db.query(Receipt).filter(Receipt.id == data.receipt_id).first()
        if not receipt:
            raise NotFoundError("收款流水", entity_id=data.receipt_id)

        if ReceiptStateMachine.is_terminal(receipt.status):
            raise InvalidOperationError(
                "收款流水",
                "退款",
                f"收款流水已处于终态 [{receipt.status.value}]",
            )

        if data.amount <= 0:
            raise InvalidOperationError("退款单", "创建", "退款金额必须大于0")

        if data.amount > receipt.remaining_amount:
            raise AmountExceededError(
                "收款流水",
                float(receipt.remaining_amount),
                float(data.amount),
                detail="退款金额不能超过收款流水剩余金额",
            )

        refund_no = f"RF-{uuid4().hex[:12].upper()}"
        refund = Refund(
            refund_no=refund_no,
            receipt_id=data.receipt_id,
            amount=data.amount,
            reason=data.reason,
            status=RefundStatus.PENDING,
            operator=data.operator,
        )
        db.add(refund)
        db.flush()
        self.log_operation(db, "Refund", refund.id, "CREATE", data.operator)
        db.commit()
        db.refresh(refund)
        return refund

    def get(self, db: Session, refund_id: int) -> Refund:
        refund = db.query(Refund).filter(Refund.id == refund_id).first()
        if not refund:
            raise NotFoundError("退款单", entity_id=refund_id)
        return refund

    def list(
        self,
        db: Session,
        status: Optional[RefundStatus] = None,
        receipt_id: Optional[int] = None,
    ) -> List[Refund]:
        query = db.query(Refund)
        if status:
            query = query.filter(Refund.status == status)
        if receipt_id:
            query = query.filter(Refund.receipt_id == receipt_id)
        return query.order_by(Refund.created_at.desc()).all()

    def process(self, db: Session, refund_id: int, data: RefundProcess) -> Refund:
        refund = self.get(db, refund_id)
        old_status = refund.status

        new_status = RefundStatus.PROCESSED if data.success else RefundStatus.FAILED
        RefundStateMachine.ensure_transition(refund.id, old_status, new_status)

        refund.status = new_status
        refund.processed_at = datetime.utcnow()

        if data.success:
            receipt = db.query(Receipt).filter(Receipt.id == refund.receipt_id).first()
            receipt.remaining_amount -= refund.amount

            receipt_old_status = receipt.status
            if receipt.remaining_amount == 0:
                new_receipt_status = ReceiptStatus.REFUNDED
            else:
                new_receipt_status = receipt.status

            if new_receipt_status != receipt_old_status:
                ReceiptStateMachine.ensure_transition(receipt.id, receipt_old_status, new_receipt_status)
                receipt.status = new_receipt_status
                self.log_operation(
                    db, "Receipt", receipt.id, "STATUS_CHANGE",
                    operator=data.operator,
                    from_status=receipt_old_status.value,
                    to_status=new_receipt_status.value,
                    reason=f"退款单 {refund.refund_no} 处理成功",
                )

        self.log_operation(
            db, "Refund", refund.id, "PROCESS",
            operator=data.operator,
            from_status=old_status.value,
            to_status=new_status.value,
        )
        db.commit()
        db.refresh(refund)
        return refund

    def retry(self, db: Session, refund_id: int, operator: str) -> Refund:
        refund = self.get(db, refund_id)
        old_status = refund.status

        if not RefundStateMachine.is_retryable(old_status):
            raise InvalidOperationError(
                "退款单",
                "重试",
                f"只有状态为 FAILED 的退款单才能重试（当前状态: {old_status.value}）",
            )

        RefundStateMachine.ensure_transition(refund.id, old_status, RefundStatus.PENDING)
        refund.status = RefundStatus.PENDING
        refund.processed_at = None

        self.log_operation(
            db, "Refund", refund.id, "RETRY",
            operator=operator,
            from_status=old_status.value,
            to_status=RefundStatus.PENDING.value,
        )
        db.commit()
        db.refresh(refund)
        return refund
