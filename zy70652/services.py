from sqlalchemy.orm import Session
from datetime import datetime
import uuid
import json
from typing import List, Optional, Tuple

from database import (
    Order, Refund, Leader, CommissionRule, ServiceFee,
    Settlement, Adjustment, AuditLog
)
import schemas


def generate_no(prefix: str) -> str:
    return f"{prefix}{uuid.uuid4().hex[:8].upper()}"


class LeaderService:
    @staticmethod
    def create_leader(db: Session, leader: schemas.LeaderCreate) -> Leader:
        db_leader = Leader(
            leader_code=leader.leader_code,
            name=leader.name,
            phone=leader.phone,
            email=leader.email
        )
        db.add(db_leader)
        db.commit()
        db.refresh(db_leader)
        return db_leader
    
    @staticmethod
    def get_leader(db: Session, leader_id: int) -> Optional[Leader]:
        return db.query(Leader).filter(Leader.id == leader_id).first()
    
    @staticmethod
    def get_all_leaders(db: Session, skip: int = 0, limit: int = 100) -> List[Leader]:
        return db.query(Leader).offset(skip).limit(limit).all()


class CommissionRuleService:
    @staticmethod
    def create_rule(db: Session, rule: schemas.CommissionRuleCreate) -> CommissionRule:
        db_rule = CommissionRule(**rule.model_dump())
        db.add(db_rule)
        db.commit()
        db.refresh(db_rule)
        return db_rule
    
    @staticmethod
    def get_commission_rate(db: Session, amount: float, leader_id: Optional[int] = None) -> float:
        query = db.query(CommissionRule).filter(CommissionRule.is_active == True)
        
        if leader_id:
            leader_rules = query.filter(CommissionRule.leader_id == leader_id).all()
            if leader_rules:
                for rule in leader_rules:
                    if amount >= rule.tier_min and (rule.tier_max is None or amount < rule.tier_max):
                        return rule.commission_rate
        
        default_rules = query.filter(CommissionRule.leader_id == None).all()
        for rule in default_rules:
            if amount >= rule.tier_min and (rule.tier_max is None or amount < rule.tier_max):
                return rule.commission_rate
        
        return 0.1


class OrderService:
    @staticmethod
    def create_order(db: Session, order: schemas.OrderCreate) -> Tuple[Order, bool]:
        existing = db.query(Order).filter(Order.order_no == order.order_no).first()
        if existing:
            return existing, True
        
        duplicate_by_phone = None
        if order.user_phone:
            duplicate_by_phone = db.query(Order).filter(
                Order.leader_id == order.leader_id,
                Order.user_phone == order.user_phone,
                Order.total_amount == order.total_amount,
                Order.is_duplicate == False
            ).first()
        
        db_order = Order(**order.model_dump())
        if duplicate_by_phone:
            db_order.is_duplicate = True
            db_order.duplicate_of = duplicate_by_phone.id
        
        db.add(db_order)
        db.commit()
        db.refresh(db_order)
        return db_order, False
    
    @staticmethod
    def get_order(db: Session, order_id: int) -> Optional[Order]:
        return db.query(Order).filter(Order.id == order_id).first()
    
    @staticmethod
    def get_orders_by_leader_and_date(
        db: Session, leader_id: int, start_date: datetime, end_date: datetime
    ) -> List[Order]:
        return db.query(Order).filter(
            Order.leader_id == leader_id,
            Order.created_at >= start_date,
            Order.created_at <= end_date,
            Order.is_duplicate == False,
            Order.settlement_id == None
        ).all()


class RefundService:
    @staticmethod
    def create_refund(db: Session, refund: schemas.RefundCreate) -> Refund:
        existing = db.query(Refund).filter(Refund.refund_no == refund.refund_no).first()
        if existing:
            return existing
        
        db_refund = Refund(**refund.model_dump())
        db.add(db_refund)
        db.commit()
        db.refresh(db_refund)
        return db_refund
    
    @staticmethod
    def get_refunds_by_leader_and_date(
        db: Session, leader_id: int, start_date: datetime, end_date: datetime
    ) -> List[Refund]:
        return db.query(Refund).join(Order).filter(
            Order.leader_id == leader_id,
            Refund.created_at >= start_date,
            Refund.created_at <= end_date,
            Refund.status == "processed",
            Refund.settlement_id == None
        ).all()


class SettlementService:
    @staticmethod
    def create_settlement(db: Session, settlement: schemas.SettlementCreate) -> Settlement:
        settlement_no = generate_no("STL")
        db_settlement = Settlement(
            settlement_no=settlement_no,
            leader_id=settlement.leader_id,
            start_date=settlement.start_date,
            end_date=settlement.end_date
        )
        db.add(db_settlement)
        db.commit()
        db.refresh(db_settlement)
        return db_settlement
    
    @staticmethod
    def get_settlement(db: Session, settlement_id: int) -> Optional[Settlement]:
        return db.query(Settlement).filter(Settlement.id == settlement_id).first()
    
    @staticmethod
    def calculate_settlement(
        db: Session, settlement_id: int, processed_by: str
    ) -> Optional[Settlement]:
        settlement = db.query(Settlement).filter(Settlement.id == settlement_id).first()
        if not settlement or settlement.status != "draft":
            return None
        
        original_input = json.dumps({
            "settlement_id": settlement_id,
            "processed_by": processed_by,
            "before_status": settlement.status
        }, ensure_ascii=False)
        
        orders = OrderService.get_orders_by_leader_and_date(
            db, settlement.leader_id, settlement.start_date, settlement.end_date
        )
        
        refunds = RefundService.get_refunds_by_leader_and_date(
            db, settlement.leader_id, settlement.start_date, settlement.end_date
        )
        
        total_order_amount = sum(o.total_amount for o in orders)
        total_refund_amount = sum(r.refund_amount for r in refunds)
        net_order_amount = total_order_amount - total_refund_amount
        
        service_fee_rate = 0.05
        service_fee_config = db.query(ServiceFee).filter(ServiceFee.is_active == True).first()
        if service_fee_config:
            service_fee_rate = service_fee_config.fee_rate
        
        service_fee = net_order_amount * service_fee_rate
        if service_fee_config:
            if service_fee_config.min_fee and service_fee < service_fee_config.min_fee:
                service_fee = service_fee_config.min_fee
            if service_fee_config.max_fee and service_fee > service_fee_config.max_fee:
                service_fee = service_fee_config.max_fee
        
        commission_rate = CommissionRuleService.get_commission_rate(
            db, net_order_amount, settlement.leader_id
        )
        commission_amount = net_order_amount * commission_rate
        
        final_leader_amount = commission_amount - total_refund_amount
        if final_leader_amount < 0:
            final_leader_amount = 0
        
        settlement.total_order_amount = total_order_amount
        settlement.total_refund_amount = total_refund_amount
        settlement.net_order_amount = net_order_amount
        settlement.service_fee = service_fee
        settlement.commission_amount = commission_amount
        settlement.final_leader_amount = final_leader_amount
        settlement.status = "calculated"
        
        for order in orders:
            order.settlement_id = settlement.id
        for refund in refunds:
            refund.settlement_id = settlement.id
        
        audit_log = AuditLog(
            settlement_id=settlement.id,
            action="calculate",
            original_input=original_input,
            processed_by=processed_by,
            conclusion=json.dumps({
                "total_order_amount": total_order_amount,
                "total_refund_amount": total_refund_amount,
                "net_order_amount": net_order_amount,
                "commission_rate": commission_rate,
                "commission_amount": commission_amount,
                "service_fee": service_fee,
                "final_leader_amount": final_leader_amount
            }, ensure_ascii=False)
        )
        db.add(audit_log)
        
        db.commit()
        db.refresh(settlement)
        return settlement
    
    @staticmethod
    def process_settlement(
        db: Session, settlement_id: int, processed_by: str
    ) -> Optional[Settlement]:
        settlement = db.query(Settlement).filter(Settlement.id == settlement_id).first()
        if not settlement or settlement.status != "calculated":
            return None
        
        original_input = json.dumps({
            "settlement_id": settlement_id,
            "processed_by": processed_by,
            "before_status": settlement.status
        }, ensure_ascii=False)
        
        settlement.status = "processed"
        settlement.processed_at = datetime.utcnow()
        settlement.processed_by = processed_by
        
        audit_log = AuditLog(
            settlement_id=settlement.id,
            action="process",
            original_input=original_input,
            processed_by=processed_by,
            conclusion="Settlement processed successfully"
        )
        db.add(audit_log)
        
        db.commit()
        db.refresh(settlement)
        return settlement
    
    @staticmethod
    def close_settlement(
        db: Session, settlement_id: int, processed_by: str, close_reason: str
    ) -> Optional[Settlement]:
        settlement = db.query(Settlement).filter(Settlement.id == settlement_id).first()
        if not settlement or settlement.status == "closed":
            return None
        
        original_input = json.dumps({
            "settlement_id": settlement_id,
            "processed_by": processed_by,
            "close_reason": close_reason,
            "before_status": settlement.status
        }, ensure_ascii=False)
        
        for order in settlement.orders:
            order.settlement_id = None
        for refund in settlement.refunds:
            refund.settlement_id = None
        
        settlement.status = "closed"
        settlement.closed_at = datetime.utcnow()
        settlement.closed_by = processed_by
        settlement.close_reason = close_reason
        
        audit_log = AuditLog(
            settlement_id=settlement.id,
            action="close",
            original_input=original_input,
            processed_by=processed_by,
            conclusion=f"Settlement closed: {close_reason}"
        )
        db.add(audit_log)
        
        db.commit()
        db.refresh(settlement)
        return settlement


class AdjustmentService:
    @staticmethod
    def create_adjustment(
        db: Session, adjustment: schemas.AdjustmentCreate
    ) -> Optional[Adjustment]:
        settlement = db.query(Settlement).filter(
            Settlement.id == adjustment.settlement_id
        ).first()
        if not settlement or settlement.status not in ["calculated", "processed"]:
            return None
        
        original_input = json.dumps(adjustment.model_dump(), ensure_ascii=False)
        
        db_adjustment = Adjustment(**adjustment.model_dump())
        db.add(db_adjustment)
        
        if adjustment.adjustment_type == "add_commission":
            settlement.final_leader_amount += adjustment.amount
        elif adjustment.adjustment_type == "deduct_commission":
            settlement.final_leader_amount -= adjustment.amount
            if settlement.final_leader_amount < 0:
                settlement.final_leader_amount = 0
        elif adjustment.adjustment_type == "add_refund":
            settlement.total_refund_amount += adjustment.amount
            settlement.final_leader_amount -= adjustment.amount
            if settlement.final_leader_amount < 0:
                settlement.final_leader_amount = 0
        
        audit_log = AuditLog(
            settlement_id=settlement.id,
            action="adjustment",
            original_input=original_input,
            processed_by=adjustment.processed_by,
            conclusion=json.dumps({
                "adjustment_type": adjustment.adjustment_type,
                "amount": adjustment.amount,
                "new_final_amount": settlement.final_leader_amount
            }, ensure_ascii=False)
        )
        db.add(audit_log)
        
        db.commit()
        db.refresh(db_adjustment)
        return db_adjustment


class AuditLogService:
    @staticmethod
    def get_logs_by_settlement(db: Session, settlement_id: int) -> List[AuditLog]:
        return db.query(AuditLog).filter(AuditLog.settlement_id == settlement_id).all()
    
    @staticmethod
    def get_all_logs(db: Session, skip: int = 0, limit: int = 100) -> List[AuditLog]:
        return db.query(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
