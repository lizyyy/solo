from decimal import Decimal
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass

from sqlalchemy.orm import Session

from ..models.account import PrepaidAccount
from ..models.deposit import DepositOrder, DepositConsumption, DepositRefund
from ..models.consume import ConsumeOrder
from ..models.refund import (
    RefundRequest,
    RefundOrder,
    RefundConsume
)
from ..models.journal import OperationHistory
from .id_generator import IdGenerator
from .journal_service import JournalService


@dataclass
class RefundCalculationResult:
    total_refund: Decimal
    principal_refund: Decimal
    bonus_refund: Decimal
    bonus_forfeit: Decimal
    consume_refunds: List[Dict]
    deposit_refunds: List[Dict]


class RefundCalculationService:
    @staticmethod
    def calculate_refund(
        db: Session,
        account: PrepaidAccount,
        request_amount: Decimal
    ) -> RefundCalculationResult:
        refund_orders = db.query(RefundOrder).filter(
            RefundOrder.account_id == account.id,
            RefundOrder.is_void == False
        ).all()
        refunded_order_ids = {r.id for r in refund_orders}
        existing_refund_consumes = db.query(RefundConsume).filter(
            RefundConsume.refund_order_id.in_(refunded_order_ids)
        ).all()
        refunded_consume_amounts: Dict[int, Decimal] = {}
        for rc in existing_refund_consumes:
            refunded_consume_amounts[rc.consume_order_id] = (
                refunded_consume_amounts.get(rc.consume_order_id, Decimal("0.00")) + rc.amount
            )
        
        consume_orders = db.query(ConsumeOrder).filter(
            ConsumeOrder.account_id == account.id,
            ConsumeOrder.is_void == False,
            ConsumeOrder.is_refundable == True
        ).order_by(ConsumeOrder.id.desc()).all()
        
        remaining = request_amount
        consume_refunds: List[Dict] = []
        total_principal_return = Decimal("0.00")
        total_bonus_return = Decimal("0.00")
        
        for consume in consume_orders:
            if remaining <= 0:
                break
            
            already_refunded = refunded_consume_amounts.get(consume.id, Decimal("0.00"))
            available_for_refund = consume.total_amount - already_refunded
            
            if available_for_refund <= 0:
                continue
            
            refund_from_this = min(available_for_refund, remaining)
            
            total_consumed_in_order = consume.principal_paid + consume.bonus_paid
            if total_consumed_in_order == 0:
                continue
            
            principal_ratio = consume.principal_paid / total_consumed_in_order
            bonus_ratio = consume.bonus_paid / total_consumed_in_order
            
            principal_return = (refund_from_this * principal_ratio).quantize(Decimal("0.01"))
            bonus_return = (refund_from_this * bonus_ratio).quantize(Decimal("0.01"))
            
            rounding_diff = refund_from_this - principal_return - bonus_return
            if rounding_diff != 0:
                principal_return += rounding_diff
            
            consume_refunds.append({
                "consume_order_id": consume.id,
                "consume_order_no": consume.order_no,
                "amount": refund_from_this,
                "principal_return": principal_return,
                "bonus_return": bonus_return
            })
            
            total_principal_return += principal_return
            total_bonus_return += bonus_return
            remaining -= refund_from_this
        
        if remaining > 0:
            raise ValueError(f"可退金额不足，请求退款: {request_amount}，最多可退: {request_amount - remaining}")
        
        deposit_refunds = RefundCalculationService._restore_to_deposits(
            db, account, total_principal_return, total_bonus_return
        )
        
        actual_principal_refund = sum(dr["principal_refund"] for dr in deposit_refunds)
        actual_bonus_refund = sum(dr["bonus_refund"] for dr in deposit_refunds)
        actual_bonus_forfeit = sum(dr["bonus_forfeit"] for dr in deposit_refunds)
        
        return RefundCalculationResult(
            total_refund=actual_principal_refund + actual_bonus_refund,
            principal_refund=actual_principal_refund,
            bonus_refund=actual_bonus_refund,
            bonus_forfeit=actual_bonus_forfeit,
            consume_refunds=consume_refunds,
            deposit_refunds=deposit_refunds
        )
    
    @staticmethod
    def _restore_to_deposits(
        db: Session,
        account: PrepaidAccount,
        total_principal: Decimal,
        total_bonus: Decimal
    ) -> List[Dict]:
        result = []
        
        refunded_deposit_ids = set()
        existing_refunds = db.query(DepositRefund).all()
        for dr in existing_refunds:
            refunded_deposit_ids.add(dr.deposit_order_id)
        
        deposits = db.query(DepositOrder).filter(
            DepositOrder.account_id == account.id,
            DepositOrder.is_void == False
        ).order_by(DepositOrder.id.desc()).all()
        
        principal_remaining = total_principal
        bonus_remaining = total_bonus
        
        for deposit in deposits:
            if principal_remaining <= 0 and bonus_remaining <= 0:
                break
            
            orig_principal = deposit.deposit_amount
            orig_bonus = deposit.bonus_amount
            consumed_principal = orig_principal - deposit.principal_remaining
            consumed_bonus = orig_bonus - deposit.bonus_remaining
            
            if consumed_principal <= 0 and consumed_bonus <= 0:
                continue
            
            dr_entry = {
                "deposit_order_id": deposit.id,
                "deposit_order_no": deposit.order_no,
                "principal_refund": Decimal("0.00"),
                "bonus_refund": Decimal("0.00"),
                "bonus_forfeit": Decimal("0.00")
            }
            
            if consumed_principal > 0 and principal_remaining > 0:
                restore_principal = min(consumed_principal, principal_remaining)
                dr_entry["principal_refund"] = restore_principal
                principal_remaining -= restore_principal
            
            if consumed_bonus > 0 and bonus_remaining > 0:
                restore_bonus = min(consumed_bonus, bonus_remaining)
                forfeit_bonus = consumed_bonus - restore_bonus
                dr_entry["bonus_refund"] = restore_bonus
                dr_entry["bonus_forfeit"] = forfeit_bonus
                bonus_remaining -= restore_bonus
            elif consumed_bonus > 0:
                dr_entry["bonus_forfeit"] = consumed_bonus
            
            if dr_entry["principal_refund"] > 0 or dr_entry["bonus_refund"] > 0 or dr_entry["bonus_forfeit"] > 0:
                result.append(dr_entry)
        
        if principal_remaining > 0:
            if result:
                result[-1]["principal_refund"] += principal_remaining
            else:
                result.append({
                    "deposit_order_id": 0,
                    "deposit_order_no": "UNMAPPED",
                    "principal_refund": principal_remaining,
                    "bonus_refund": Decimal("0.00"),
                    "bonus_forfeit": Decimal("0.00")
                })
        
        if bonus_remaining > 0:
            if result:
                result[-1]["bonus_refund"] += bonus_remaining
            else:
                result.append({
                    "deposit_order_id": 0,
                    "deposit_order_no": "UNMAPPED",
                    "principal_refund": Decimal("0.00"),
                    "bonus_refund": bonus_remaining,
                    "bonus_forfeit": Decimal("0.00")
                })
        
        return result


class RefundRequestService:
    @staticmethod
    def create_request(
        db: Session,
        account: PrepaidAccount,
        store_id: int,
        requested_amount: Decimal,
        reason_type: Optional[str] = None,
        reason_detail: Optional[str] = None,
        operator: Optional[str] = None
    ) -> RefundRequest:
        calculation = RefundCalculationService.calculate_refund(db, account, requested_amount)
        
        request = RefundRequest(
            request_no=IdGenerator.refund_request_no(),
            account_id=account.id,
            store_id=store_id,
            requested_amount=calculation.total_refund,
            reason_type=reason_type,
            reason_detail=reason_detail,
            status="pending",
            created_by=operator,
            updated_by=operator
        )
        
        db.add(request)
        db.flush()
        return request

    @staticmethod
    def approve_request(
        db: Session,
        request: RefundRequest,
        approver: Optional[str] = None,
        approval_remark: Optional[str] = None
    ) -> RefundOrder:
        if request.status != "pending":
            raise ValueError(f"申请状态不正确，当前状态: {request.status}")
        if request.is_withdrawn:
            raise ValueError("申请已撤回")
        
        account = db.query(PrepaidAccount).filter(PrepaidAccount.id == request.account_id).first()
        if not account:
            raise ValueError("账户不存在")
        
        calculation = RefundCalculationService.calculate_refund(db, account, request.requested_amount)
        
        refund_order = RefundOrder(
            order_no=IdGenerator.refund_order_no(),
            request_id=request.id,
            account_id=account.id,
            store_id=request.store_id,
            total_refund=calculation.total_refund,
            principal_refund=calculation.principal_refund,
            bonus_refund=calculation.bonus_refund,
            bonus_forfeit=calculation.bonus_forfeit,
            refund_time=datetime.utcnow(),
            status="completed",
            created_by=approver,
            updated_by=approver,
            remark=approval_remark
        )
        db.add(refund_order)
        db.flush()
        
        for cr in calculation.consume_refunds:
            rc = RefundConsume(
                refund_order_id=refund_order.id,
                consume_order_id=cr["consume_order_id"],
                amount=cr["amount"],
                principal_return=cr["principal_return"],
                bonus_return=cr["bonus_return"],
                refund_time=datetime.utcnow()
            )
            db.add(rc)
            
            consume = db.query(ConsumeOrder).filter(ConsumeOrder.id == cr["consume_order_id"]).first()
            if consume:
                consume.refunded_amount += cr["amount"]
        
        for dr in calculation.deposit_refunds:
            if dr["deposit_order_id"] > 0:
                dr_entry = DepositRefund(
                    refund_order_id=refund_order.id,
                    deposit_order_id=dr["deposit_order_id"],
                    principal_refund=dr["principal_refund"],
                    bonus_refund=dr["bonus_refund"],
                    bonus_forfeit=dr["bonus_forfeit"],
                    refund_time=datetime.utcnow()
                )
                db.add(dr_entry)
                
                deposit = db.query(DepositOrder).filter(DepositOrder.id == dr["deposit_order_id"]).first()
                if deposit:
                    deposit.principal_remaining += dr["principal_refund"]
        
        account.total_refunded += calculation.total_refund
        
        JournalService.record_journal(
            db=db,
            account=account,
            biz_type="refund",
            biz_order_no=refund_order.order_no,
            direction="out",
            principal_delta=-calculation.principal_refund,
            bonus_delta=-calculation.bonus_refund,
            operator=approver,
            remark=f"退款审批通过，没收赠金: {calculation.bonus_forfeit}",
            commit=False
        )
        
        request.status = "approved"
        request.approver_id = approver
        request.approval_time = datetime.utcnow()
        request.approval_remark = approval_remark
        request.refund_order_id = refund_order.id
        
        db.flush()
        return refund_order

    @staticmethod
    def reject_request(
        db: Session,
        request: RefundRequest,
        reject_reason: str,
        operator: Optional[str] = None
    ) -> RefundRequest:
        if request.status != "pending":
            raise ValueError(f"申请状态不正确，当前状态: {request.status}")
        if request.is_withdrawn:
            raise ValueError("申请已撤回")
        
        request.status = "rejected"
        request.reject_reason = reject_reason
        request.reject_time = datetime.utcnow()
        request.updated_by = operator
        
        db.flush()
        return request

    @staticmethod
    def withdraw_request(
        db: Session,
        request: RefundRequest,
        withdraw_reason: str,
        operator: Optional[str] = None
    ) -> RefundRequest:
        if request.status != "pending":
            raise ValueError(f"申请状态不正确，当前状态: {request.status}")
        if request.is_withdrawn:
            raise ValueError("申请已撤回")
        
        request.is_withdrawn = True
        request.withdraw_reason = withdraw_reason
        request.withdraw_at = datetime.utcnow()
        request.withdraw_by = operator
        request.status = "withdrawn"
        
        history = OperationHistory(
            biz_type="refund_request",
            biz_id=request.id,
            operation_type="withdraw",
            operator=operator,
            reason=withdraw_reason
        )
        db.add(history)
        
        db.flush()
        return request


class RefundVoidService:
    @staticmethod
    def void_refund(
        db: Session,
        refund_order: RefundOrder,
        void_reason: str,
        operator: Optional[str] = None
    ) -> RefundOrder:
        if refund_order.is_void:
            raise ValueError("该退款已作废")
        
        account = db.query(PrepaidAccount).filter(PrepaidAccount.id == refund_order.account_id).first()
        if not account:
            raise ValueError("账户不存在")
        
        refund_consumes = db.query(RefundConsume).filter(
            RefundConsume.refund_order_id == refund_order.id
        ).all()
        for rc in refund_consumes:
            consume = db.query(ConsumeOrder).filter(ConsumeOrder.id == rc.consume_order_id).first()
            if consume:
                consume.refunded_amount -= rc.amount
        
        deposit_refunds = db.query(DepositRefund).filter(
            DepositRefund.refund_order_id == refund_order.id
        ).all()
        for dr in deposit_refunds:
            deposit = db.query(DepositOrder).filter(DepositOrder.id == dr.deposit_order_id).first()
            if deposit:
                deposit.principal_remaining -= dr.principal_refund
        
        account.total_refunded -= refund_order.total_refund
        
        JournalService.record_journal(
            db=db,
            account=account,
            biz_type="refund_void",
            biz_order_no=refund_order.order_no,
            direction="in",
            principal_delta=refund_order.principal_refund,
            bonus_delta=refund_order.bonus_refund,
            operator=operator,
            remark=f"撤销退款，原退款单号: {refund_order.order_no}",
            commit=False
        )
        
        refund_order.is_void = True
        refund_order.void_reason = void_reason
        refund_order.void_at = datetime.utcnow()
        refund_order.void_by = operator
        
        history = OperationHistory(
            biz_type="refund_order",
            biz_id=refund_order.id,
            operation_type="void",
            operator=operator,
            reason=void_reason
        )
        db.add(history)
        
        db.flush()
        return refund_order
