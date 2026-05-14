import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.core.database import engine, SessionLocal
from app.models.models import PointBatch, FrozenBalance, PointTransaction, BalanceSnapshot

def init_data():
    db = SessionLocal()
    
    try:
        print("开始初始化数据...")
        
        batch = PointBatch(
            batch_no="BATCH202401010001",
            member_id="MEMBER001",
            points=10000,
            source="年终奖励",
            status="active",
            created_at=datetime.now() - timedelta(days=30)
        )
        db.add(batch)
        db.flush()
        
        frozen = FrozenBalance(
            member_id="MEMBER001",
            batch_id=batch.id,
            frozen_points=2000,
            reason="风控冻结",
            status="frozen",
            created_at=datetime.now() - timedelta(days=25),
            operator="system"
        )
        db.add(frozen)
        
        tx1 = PointTransaction(
            tx_no="TX202401050001",
            member_id="MEMBER001",
            batch_id=batch.id,
            tx_type="consume",
            points=1500,
            before_balance=10000,
            after_balance=8500,
            status="completed",
            is_reviewed=True,
            reviewed_by="admin",
            reviewed_at=datetime.now() - timedelta(days=20),
            created_at=datetime.now() - timedelta(days=20),
            operator="user"
        )
        db.add(tx1)
        
        tx2 = PointTransaction(
            tx_no="TX202401100002",
            member_id="MEMBER001",
            batch_id=batch.id,
            tx_type="expire",
            points=500,
            before_balance=8500,
            after_balance=8000,
            status="completed",
            is_reviewed=False,
            created_at=datetime.now() - timedelta(days=15),
            operator="system"
        )
        db.add(tx2)
        
        tx3 = PointTransaction(
            tx_no="TX202401150003",
            member_id="MEMBER001",
            batch_id=batch.id,
            tx_type="consume",
            points=1000,
            before_balance=8000,
            after_balance=7000,
            status="completed",
            is_reviewed=False,
            created_at=datetime.now() - timedelta(days=10),
            operator="user"
        )
        db.add(tx3)
        
        tx4 = PointTransaction(
            tx_no="TX202401200004",
            member_id="MEMBER001",
            batch_id=batch.id,
            tx_type="refund",
            points=300,
            before_balance=7000,
            after_balance=7300,
            related_tx_id=tx3.id,
            status="completed",
            is_reviewed=False,
            created_at=datetime.now() - timedelta(days=5),
            operator="cs"
        )
        db.add(tx4)
        
        snapshot = BalanceSnapshot(
            snapshot_date=datetime.now(),
            member_id="MEMBER001",
            total_points=10000,
            available_points=6800,
            frozen_points=2000,
            expired_points=500,
            consumed_points=2500,
            refunded_points=300,
            batch_count=1,
            tx_count=4,
            is_consistent=True,
            created_at=datetime.now()
        )
        db.add(snapshot)
        
        db.commit()
        
        print("数据初始化完成!")
        print(f"- 创建批次: {batch.batch_no} (积分: {batch.points})")
        print(f"- 冻结记录: {frozen.frozen_points} 积分")
        print(f"- 交易记录: 4 笔 (消费、过期、退款)")
        print(f"- 余额快照: 已创建")
        
    except Exception as e:
        db.rollback()
        print(f"初始化失败: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    init_data()
