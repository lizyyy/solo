from decimal import Decimal
from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from ..models.store import Store
from ..models.deposit import DepositOrder
from ..models.consume import ConsumeOrder
from ..models.refund import RefundOrder
from ..models.settlement import StoreSettlement, SettlementDetail
from .id_generator import IdGenerator


class SettlementService:
    @staticmethod
    def calculate_store_settlement(
        db: Session,
        store_id: int,
        settlement_period: str,
        operator: Optional[str] = None
    ) -> StoreSettlement:
        store = db.query(Store).filter(Store.id == store_id).first()
        if not store:
            raise ValueError("门店不存在")
        
        year_month = settlement_period
        if len(year_month) != 7:
            raise ValueError("结算周期格式错误，应为 YYYY-MM")
        
        existing = db.query(StoreSettlement).filter(
            StoreSettlement.store_id == store_id,
            StoreSettlement.settlement_period == settlement_period
        ).first()
        if existing:
            return existing
        
        start_date = f"{year_month}-01"
        next_month = datetime.strptime(start_date, "%Y-%m-%d")
        if next_month.month == 12:
            end_year = next_month.year + 1
            end_month = 1
        else:
            end_year = next_month.year
            end_month = next_month.month + 1
        end_date = f"{end_year:04d}-{end_month:02d}-01"
        
        deposits = db.query(DepositOrder).filter(
            DepositOrder.store_id == store_id,
            DepositOrder.is_void == False,
            DepositOrder.created_at >= datetime.strptime(start_date, "%Y-%m-%d"),
            DepositOrder.created_at < datetime.strptime(end_date, "%Y-%m-%d")
        ).all()
        
        consumes = db.query(ConsumeOrder).filter(
            ConsumeOrder.store_id == store_id,
            ConsumeOrder.is_void == False,
            ConsumeOrder.consume_time >= datetime.strptime(start_date, "%Y-%m-%d"),
            ConsumeOrder.consume_time < datetime.strptime(end_date, "%Y-%m-%d")
        ).all()
        
        refunds = db.query(RefundOrder).filter(
            RefundOrder.store_id == store_id,
            RefundOrder.is_void == False,
            RefundOrder.refund_time >= datetime.strptime(start_date, "%Y-%m-%d"),
            RefundOrder.refund_time < datetime.strptime(end_date, "%Y-%m-%d")
        ).all()
        
        deposit_count = len(deposits)
        deposit_amount = sum(d.deposit_amount for d in deposits)
        
        consume_count = len(consumes)
        consume_amount = sum(c.principal_paid for c in consumes)
        
        refund_count = len(refunds)
        refund_amount = sum(r.principal_refund for r in refunds)
        
        net_amount = deposit_amount + consume_amount - refund_amount
        
        settlement = StoreSettlement(
            settlement_no=IdGenerator.settlement_no(),
            store_id=store_id,
            settlement_period=settlement_period,
            settlement_date=datetime.now().strftime("%Y-%m-%d"),
            deposit_count=deposit_count,
            deposit_amount=deposit_amount,
            consume_count=consume_count,
            consume_amount=consume_amount,
            refund_count=refund_count,
            refund_amount=refund_amount,
            net_amount=net_amount,
            status="completed",
            created_by=operator,
            updated_by=operator
        )
        db.add(settlement)
        db.flush()
        
        for d in deposits:
            detail = SettlementDetail(
                settlement_id=settlement.id,
                biz_type="deposit",
                order_no=d.order_no,
                order_id=d.id,
                principal_amount=d.deposit_amount,
                bonus_amount=d.bonus_amount,
                total_amount=d.deposit_amount + d.bonus_amount,
                remark="充值"
            )
            db.add(detail)
        
        for c in consumes:
            detail = SettlementDetail(
                settlement_id=settlement.id,
                biz_type="consume",
                order_no=c.order_no,
                order_id=c.id,
                principal_amount=c.principal_paid,
                bonus_amount=c.bonus_paid,
                total_amount=c.total_amount,
                remark="消费"
            )
            db.add(detail)
        
        for r in refunds:
            detail = SettlementDetail(
                settlement_id=settlement.id,
                biz_type="refund",
                order_no=r.order_no,
                order_id=r.id,
                principal_amount=-r.principal_refund,
                bonus_amount=-r.bonus_refund,
                total_amount=-r.total_refund,
                remark=f"退款(没收赠金:{r.bonus_forfeit})"
            )
            db.add(detail)
        
        db.flush()
        return settlement

    @staticmethod
    def get_settlement_details(
        db: Session,
        settlement_id: int
    ) -> List[SettlementDetail]:
        return db.query(SettlementDetail).filter(
            SettlementDetail.settlement_id == settlement_id
        ).order_by(SettlementDetail.id.asc()).all()
