import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, init_db
from app.models import (
    RedPacketActivity, RedPacket, Payment, ClaimRequest,
    RedPacketStatus, PacketStatus, PaymentStatus
)
from app.services import generate_id


def create_seed_data():
    db = SessionLocal()
    
    try:
        init_db()
        
        merchant_id = "merchant_001"
        
        activity1 = RedPacketActivity(
            activity_id="act_seed_001",
            name="新年红包活动",
            description="春节期间的红包活动，共100个红包，总金额500元",
            total_amount=500.0,
            total_count=100,
            remaining_amount=500.0,
            remaining_count=100,
            status=RedPacketStatus.DRAFT.value,
            rule_type="random",
            merchant_id=merchant_id,
            merchant_name="测试商家",
            start_time=datetime.utcnow() - timedelta(days=1),
            end_time=datetime.utcnow() + timedelta(days=30)
        )
        db.add(activity1)
        
        activity2 = RedPacketActivity(
            activity_id="act_seed_002",
            name="周年庆红包活动",
            description="公司周年庆固定金额红包",
            total_amount=1000.0,
            total_count=50,
            remaining_amount=1000.0,
            remaining_count=50,
            status=RedPacketStatus.ACTIVE.value,
            rule_type="fixed",
            merchant_id=merchant_id,
            merchant_name="测试商家",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(days=7)
        )
        db.add(activity2)
        
        for i in range(50):
            packet = RedPacket(
                packet_id=generate_id("pkt"),
                activity_id="act_seed_002",
                amount=20.0,
                status=PacketStatus.PENDING.value
            )
            db.add(packet)
        
        payment = Payment(
            payment_id="pay_seed_001",
            activity_id="act_seed_002",
            amount=1000.0,
            status=PaymentStatus.SUCCESS.value,
            merchant_id=merchant_id,
            payment_method="mock",
            external_order_id="ext_123456",
            callback_received=True
        )
        db.add(payment)
        
        claimed_packet = RedPacket(
            packet_id="pkt_seed_001",
            activity_id="act_seed_002",
            amount=20.0,
            status=PacketStatus.CLAIMED.value,
            receiver_id="user_001",
            receiver_name="测试用户1",
            claimed_at=datetime.utcnow()
        )
        db.add(claimed_packet)
        
        claim_request = ClaimRequest(
            request_id="req_seed_001",
            packet_id="pkt_seed_001",
            user_id="user_001",
            user_name="测试用户1",
            status="success",
            is_success=True,
            claimed_amount=20.0
        )
        db.add(claim_request)
        
        db.commit()
        print("Seed data created successfully!")
        print(f"\nCreated activities:")
        print(f"  - act_seed_001: 新年红包活动 (DRAFT)")
        print(f"  - act_seed_002: 周年庆红包活动 (ACTIVE)")
        print(f"\nMerchant ID: {merchant_id}")
        print(f"\nUse this data for testing the API endpoints.")
        
    except Exception as e:
        db.rollback()
        print(f"Error creating seed data: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_seed_data()
