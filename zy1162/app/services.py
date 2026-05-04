import random
import uuid
import json
from datetime import datetime, timedelta
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models import (
    RedPacketActivity, RedPacket, ClaimRequest, Payment, 
    LedgerTransaction, RiskRecord, AuditLog,
    RedPacketStatus, PacketStatus, TransactionType, 
    PaymentStatus, RiskAction
)
from app.schemas import (
    CreateRedPacketActivityRequest, LockBudgetRequest,
    ClaimPacketRequest, PaymentCallbackRequest, RiskActionRequest,
    AuditExportRequest
)


def generate_id(prefix: str = "rp") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


class RedPacketService:
    def __init__(self, db: Session):
        self.db = db

    def create_activity(self, request: CreateRedPacketActivityRequest) -> RedPacketActivity:
        activity_id = generate_id("act")
        
        activity = RedPacketActivity(
            activity_id=activity_id,
            name=request.name,
            description=request.description,
            total_amount=request.total_amount,
            total_count=request.total_count,
            remaining_amount=request.total_amount,
            remaining_count=request.total_count,
            status=RedPacketStatus.DRAFT.value,
            rule_type=request.rule_type,
            merchant_id=request.merchant_id,
            merchant_name=request.merchant_name,
            start_time=request.start_time,
            end_time=request.end_time
        )
        
        self.db.add(activity)
        self.db.flush()
        
        self._create_audit_log(
            action="create_activity",
            module="red_packet",
            merchant_id=request.merchant_id,
            activity_id=activity_id,
            new_value=json.dumps({
                "name": request.name,
                "total_amount": request.total_amount,
                "total_count": request.total_count
            })
        )
        
        self.db.commit()
        return activity

    def lock_budget(self, request: LockBudgetRequest) -> Tuple[RedPacketActivity, Payment]:
        activity = self.db.query(RedPacketActivity).filter(
            RedPacketActivity.activity_id == request.activity_id,
            RedPacketActivity.merchant_id == request.merchant_id
        ).first()
        
        if not activity:
            raise ValueError("Activity not found")
        
        if activity.status != RedPacketStatus.DRAFT.value:
            raise ValueError(f"Cannot lock budget from status: {activity.status}")
        
        self._split_packets(activity)
        
        activity.status = RedPacketStatus.PENDING_PAYMENT.value
        
        payment_id = generate_id("pay")
        payment = Payment(
            payment_id=payment_id,
            activity_id=activity.activity_id,
            amount=activity.total_amount,
            status=PaymentStatus.PENDING.value,
            merchant_id=activity.merchant_id,
            payment_method="mock"
        )
        
        self.db.add(payment)
        
        self._create_audit_log(
            action="lock_budget",
            module="red_packet",
            merchant_id=request.merchant_id,
            activity_id=activity.activity_id,
            old_value=json.dumps({"status": RedPacketStatus.DRAFT.value}),
            new_value=json.dumps({"status": RedPacketStatus.PENDING_PAYMENT.value})
        )
        
        self.db.commit()
        return activity, payment

    def _split_packets(self, activity: RedPacketActivity):
        existing_packets = self.db.query(RedPacket).filter(
            RedPacket.activity_id == activity.activity_id
        ).first()
        
        if existing_packets:
            return
        
        total_amount = activity.total_amount
        total_count = activity.total_count
        
        if activity.rule_type == "fixed":
            amount_per_packet = round(total_amount / total_count, 2)
            packets = [amount_per_packet] * total_count
        else:
            packets = self._random_split(total_amount, total_count)
        
        for i, amount in enumerate(packets):
            packet = RedPacket(
                packet_id=generate_id("pkt"),
                activity_id=activity.activity_id,
                amount=amount,
                status=PacketStatus.PENDING.value
            )
            self.db.add(packet)
        
        self._create_transaction(
            transaction_type=TransactionType.CREATE_PACKET,
            merchant_id=activity.merchant_id,
            amount=total_amount,
            activity_id=activity.activity_id,
            description=f"创建红包活动: {activity.name}, 总金额: {total_amount}元, 共{total_count}个"
        )

    def _random_split(self, total_amount: float, total_count: int) -> List[float]:
        if total_count == 1:
            return [round(total_amount, 2)]
        
        amounts = []
        remaining_amount = total_amount
        remaining_count = total_count
        
        for i in range(total_count - 1):
            min_amount = 0.01
            max_amount = remaining_amount / remaining_count * 2
            
            amount = random.uniform(min_amount, max_amount)
            amount = round(amount, 2)
            
            amounts.append(amount)
            remaining_amount -= amount
            remaining_count -= 1
        
        amounts.append(round(remaining_amount, 2))
        
        actual_sum = sum(amounts)
        if abs(actual_sum - total_amount) > 0.001:
            diff = round(total_amount - actual_sum, 2)
            amounts[-1] = round(amounts[-1] + diff, 2)
        
        random.shuffle(amounts)
        return amounts

    def claim_packet(self, request: ClaimPacketRequest) -> ClaimRequest:
        existing_request = self.db.query(ClaimRequest).filter(
            ClaimRequest.request_id == request.request_id
        ).first()
        
        if existing_request:
            return existing_request
        
        activity = self.db.query(RedPacketActivity).filter(
            RedPacketActivity.activity_id == request.activity_id
        ).first()
        
        if not activity:
            return self._create_failed_claim(request, "Activity not found")
        
        if activity.status != RedPacketStatus.ACTIVE.value:
            return self._create_failed_claim(request, f"Activity not active: {activity.status}")
        
        now = datetime.utcnow()
        if activity.start_time and now < activity.start_time:
            return self._create_failed_claim(request, "Activity not started yet")
        if activity.end_time and now > activity.end_time:
            return self._create_failed_claim(request, "Activity has ended")
        
        user_existing = self.db.query(ClaimRequest).join(
            RedPacket, ClaimRequest.packet_id == RedPacket.packet_id
        ).filter(
            ClaimRequest.user_id == request.user_id,
            RedPacket.activity_id == request.activity_id,
            ClaimRequest.is_success == True
        ).first()
        
        if user_existing:
            return self._create_failed_claim(request, "User has already claimed a packet in this activity")
        
        packet = self.db.query(RedPacket).filter(
            RedPacket.activity_id == request.activity_id,
            RedPacket.status == PacketStatus.PENDING.value
        ).with_for_update().first()
        
        if not packet:
            return self._create_failed_claim(request, "No available packets")
        
        packet.status = PacketStatus.LOCKED.value
        packet.lock_expire_at = now + timedelta(seconds=30)
        
        claim_request = ClaimRequest(
            request_id=request.request_id,
            packet_id=packet.packet_id,
            user_id=request.user_id,
            user_name=request.user_name,
            status="processing",
            is_success=False
        )
        
        self.db.add(claim_request)
        self.db.flush()
        
        try:
            packet.receiver_id = request.user_id
            packet.receiver_name = request.user_name
            packet.status = PacketStatus.CLAIMED.value
            packet.claimed_at = now
            
            activity.remaining_amount = round(activity.remaining_amount - packet.amount, 2)
            activity.remaining_count -= 1
            
            if activity.remaining_count == 0:
                activity.status = RedPacketStatus.COMPLETED.value
            
            claim_request.status = "success"
            claim_request.is_success = True
            claim_request.claimed_amount = packet.amount
            
            self._create_transaction(
                transaction_type=TransactionType.CLAIM_PACKET,
                merchant_id=activity.merchant_id,
                user_id=request.user_id,
                amount=packet.amount,
                activity_id=activity.activity_id,
                packet_id=packet.packet_id,
                description=f"用户 {request.user_id} 领取红包 {packet.packet_id}, 金额: {packet.amount}元"
            )
            
            self._create_audit_log(
                action="claim_packet",
                module="red_packet",
                merchant_id=activity.merchant_id,
                user_id=request.user_id,
                activity_id=activity.activity_id,
                packet_id=packet.packet_id,
                request_id=request.request_id,
                new_value=json.dumps({"amount": packet.amount})
            )
            
        except Exception as e:
            self.db.rollback()
            packet.status = PacketStatus.PENDING.value
            packet.lock_expire_at = None
            
            claim_request.status = "failed"
            claim_request.is_success = False
            claim_request.error_message = str(e)
            self.db.commit()
            return claim_request
        
        self.db.commit()
        return claim_request

    def _create_failed_claim(self, request: ClaimPacketRequest, error_message: str) -> ClaimRequest:
        claim_request = ClaimRequest(
            request_id=request.request_id,
            packet_id="",
            user_id=request.user_id,
            user_name=request.user_name,
            status="failed",
            is_success=False,
            error_message=error_message
        )
        self.db.add(claim_request)
        self.db.commit()
        return claim_request

    def process_payment_callback(self, request: PaymentCallbackRequest) -> Payment:
        payment = self.db.query(Payment).filter(
            Payment.payment_id == request.payment_id
        ).first()
        
        if not payment:
            raise ValueError("Payment not found")
        
        if payment.status != PaymentStatus.PENDING.value:
            return payment
        
        activity = self.db.query(RedPacketActivity).filter(
            RedPacketActivity.activity_id == payment.activity_id
        ).first()
        
        if not activity:
            raise ValueError("Activity not found")
        
        payment.callback_received = True
        payment.callback_data = request.callback_data
        payment.callback_at = datetime.utcnow()
        payment.external_order_id = request.external_order_id
        
        if request.status == "success":
            payment.status = PaymentStatus.SUCCESS.value
            activity.status = RedPacketStatus.ACTIVE.value
            
            self._create_transaction(
                transaction_type=TransactionType.RECHARGE,
                merchant_id=activity.merchant_id,
                amount=payment.amount,
                activity_id=activity.activity_id,
                payment_id=payment.payment_id,
                description=f"支付成功: {payment.payment_id}, 金额: {payment.amount}元"
            )
            
            self._create_audit_log(
                action="payment_success",
                module="payment",
                merchant_id=activity.merchant_id,
                activity_id=activity.activity_id,
                payment_id=payment.payment_id,
                new_value=json.dumps({
                    "payment_id": payment.payment_id,
                    "amount": payment.amount,
                    "status": "success"
                })
            )
        else:
            payment.status = PaymentStatus.FAILED.value
            activity.status = RedPacketStatus.DRAFT.value
            
            self._create_audit_log(
                action="payment_failed",
                module="payment",
                merchant_id=activity.merchant_id,
                activity_id=activity.activity_id,
                payment_id=payment.payment_id,
                new_value=json.dumps({
                    "payment_id": payment.payment_id,
                    "amount": payment.amount,
                    "status": "failed"
                })
            )
        
        self.db.commit()
        return payment

    def process_risk_action(self, request: RiskActionRequest) -> RiskRecord:
        activity = self.db.query(RedPacketActivity).filter(
            RedPacketActivity.activity_id == request.activity_id,
            RedPacketActivity.merchant_id == request.merchant_id
        ).first()
        
        if not activity:
            raise ValueError("Activity not found")
        
        record_id = generate_id("risk")
        
        risk_record = RiskRecord(
            record_id=record_id,
            activity_id=request.activity_id,
            packet_id=request.packet_id,
            merchant_id=request.merchant_id,
            user_id=request.user_id,
            risk_type="manual_review",
            risk_level="high" if request.action == RiskAction.FREEZE else "medium",
            action=request.action.value,
            reason=request.reason,
            is_resolved=request.action == RiskAction.UNFREEZE
        )
        
        if request.action == RiskAction.FREEZE:
            activity.status = RedPacketStatus.FROZEN.value
            
            if request.packet_id:
                packet = self.db.query(RedPacket).filter(
                    RedPacket.packet_id == request.packet_id,
                    RedPacket.activity_id == request.activity_id
                ).first()
                if packet and packet.status == PacketStatus.PENDING.value:
                    packet.status = PacketStatus.FROZEN.value
            
            self._create_transaction(
                transaction_type=TransactionType.FROZEN,
                merchant_id=request.merchant_id,
                amount=0,
                activity_id=request.activity_id,
                packet_id=request.packet_id,
                user_id=request.user_id,
                description=f"风控冻结: {request.reason}"
            )
            
        elif request.action == RiskAction.UNFREEZE:
            activity.status = RedPacketStatus.ACTIVE.value
            risk_record.is_resolved = True
            risk_record.resolved_at = datetime.utcnow()
            
            if request.packet_id:
                packet = self.db.query(RedPacket).filter(
                    RedPacket.packet_id == request.packet_id,
                    RedPacket.activity_id == request.activity_id
                ).first()
                if packet and packet.status == PacketStatus.FROZEN.value:
                    packet.status = PacketStatus.PENDING.value
            
            self._create_transaction(
                transaction_type=TransactionType.UNFROZEN,
                merchant_id=request.merchant_id,
                amount=0,
                activity_id=request.activity_id,
                packet_id=request.packet_id,
                user_id=request.user_id,
                description=f"风控解冻: {request.reason}"
            )
        
        self.db.add(risk_record)
        
        self._create_audit_log(
            action=f"risk_{request.action.value}",
            module="risk",
            merchant_id=request.merchant_id,
            user_id=request.user_id,
            activity_id=request.activity_id,
            packet_id=request.packet_id,
            new_value=json.dumps({
                "action": request.action.value,
                "reason": request.reason
            })
        )
        
        self.db.commit()
        return risk_record

    def retry_failed_claims(self, activity_id: str = None) -> int:
        query = self.db.query(ClaimRequest).filter(
            ClaimRequest.status == "failed",
            ClaimRequest.retry_count < ClaimRequest.max_retries
        )
        
        if activity_id:
            query = query.join(
                RedPacket, ClaimRequest.packet_id == RedPacket.packet_id
            ).filter(
                RedPacket.activity_id == activity_id
            )
        
        failed_claims = query.all()
        retried_count = 0
        
        for claim in failed_claims:
            claim.retry_count += 1
            
            request = ClaimPacketRequest(
                activity_id=claim.packet.activity_id if claim.packet else "",
                user_id=claim.user_id,
                user_name=claim.user_name,
                request_id=f"{claim.request_id}_retry_{claim.retry_count}"
            )
            
            try:
                result = self.claim_packet(request)
                if result.is_success:
                    retried_count += 1
            except Exception:
                continue
        
        return retried_count

    def get_ledger_transactions(self, merchant_id: str, start_time: datetime = None, 
                                 end_time: datetime = None, transaction_type: str = None) -> List[LedgerTransaction]:
        query = self.db.query(LedgerTransaction).filter(
            LedgerTransaction.merchant_id == merchant_id
        )
        
        if start_time:
            query = query.filter(LedgerTransaction.created_at >= start_time)
        if end_time:
            query = query.filter(LedgerTransaction.created_at <= end_time)
        if transaction_type:
            query = query.filter(LedgerTransaction.transaction_type == transaction_type)
        
        return query.order_by(LedgerTransaction.created_at.desc()).all()

    def export_audit_logs(self, request: AuditExportRequest) -> List[AuditLog]:
        query = self.db.query(AuditLog).filter(
            AuditLog.merchant_id == request.merchant_id,
            AuditLog.created_at >= request.start_time,
            AuditLog.created_at <= request.end_time
        )
        
        if request.action:
            query = query.filter(AuditLog.action == request.action)
        if request.module:
            query = query.filter(AuditLog.module == request.module)
        
        return query.order_by(AuditLog.created_at.desc()).all()

    def _create_transaction(self, transaction_type: TransactionType, merchant_id: str, 
                           amount: float, activity_id: str = None, packet_id: str = None,
                           payment_id: str = None, user_id: str = None, description: str = None):
        transaction = LedgerTransaction(
            transaction_id=generate_id("txn"),
            transaction_type=transaction_type.value,
            merchant_id=merchant_id,
            user_id=user_id,
            amount=amount,
            activity_id=activity_id,
            packet_id=packet_id,
            payment_id=payment_id,
            description=description
        )
        self.db.add(transaction)

    def _create_audit_log(self, action: str, module: str, merchant_id: str = None,
                          user_id: str = None, activity_id: str = None, packet_id: str = None,
                          transaction_id: str = None, payment_id: str = None, request_id: str = None,
                          old_value: str = None, new_value: str = None,
                          ip_address: str = None, user_agent: str = None):
        audit_log = AuditLog(
            log_id=generate_id("log"),
            action=action,
            module=module,
            merchant_id=merchant_id,
            user_id=user_id,
            activity_id=activity_id,
            packet_id=packet_id,
            transaction_id=transaction_id,
            payment_id=payment_id,
            request_id=request_id,
            old_value=old_value,
            new_value=new_value,
            ip_address=ip_address,
            user_agent=user_agent
        )
        self.db.add(audit_log)
