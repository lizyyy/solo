import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from decimal import Decimal
from app.database import SessionLocal, Base, engine

from app.models.store import Store
from app.models.account import PrepaidAccount, BonusRule
from app.models.deposit import DepositOrder, DepositConsumption, DepositRefund
from app.models.consume import ConsumeOrder
from app.models.refund import RefundRequest, RefundOrder, RefundConsume
from app.models.settlement import StoreSettlement, SettlementDetail
from app.models.journal import AccountJournal, OperationHistory


def init_data():
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        existing_stores = db.query(Store).count()
        if existing_stores > 0:
            print("数据库已有数据，跳过初始化")
            return
        
        print("初始化门店...")
        stores = [
            Store(store_code="BJ001", store_name="北京朝阳店", city="北京", manager="张经理"),
            Store(store_code="SH001", store_name="上海浦东店", city="上海", manager="李经理"),
            Store(store_code="GZ001", store_name="广州天河店", city="广州", manager="王经理"),
        ]
        for s in stores:
            db.add(s)
        
        print("初始化赠金规则...")
        rules = [
            BonusRule(
                rule_name="充1000送100",
                min_deposit_amount=Decimal("1000"),
                max_deposit_amount=Decimal("1999.99"),
                bonus_amount=Decimal("100"),
                is_percentage=False
            ),
            BonusRule(
                rule_name="充2000送300",
                min_deposit_amount=Decimal("2000"),
                max_deposit_amount=Decimal("4999.99"),
                bonus_amount=Decimal("300"),
                is_percentage=False
            ),
            BonusRule(
                rule_name="充5000送10%",
                min_deposit_amount=Decimal("5000"),
                bonus_rate=Decimal("0.10"),
                is_percentage=True
            ),
        ]
        for r in rules:
            db.add(r)
        
        print("初始化测试账户...")
        accounts = [
            PrepaidAccount(
                account_no="TEST001",
                member_id="M001",
                member_name="张三",
                principal_balance=Decimal("0"),
                bonus_balance=Decimal("0")
            ),
            PrepaidAccount(
                account_no="TEST002",
                member_id="M002",
                member_name="李四",
                principal_balance=Decimal("0"),
                bonus_balance=Decimal("0")
            ),
        ]
        for a in accounts:
            db.add(a)
        
        db.commit()
        print("初始化完成！")
        print(f"- 门店: {len(stores)} 家")
        print(f"- 赠金规则: {len(rules)} 条")
        print(f"- 测试账户: {len(accounts)} 个")
        print("")
        print("测试账号:")
        for a in accounts:
            print(f"  - {a.account_no} ({a.member_name})")
        
    finally:
        db.close()


if __name__ == "__main__":
    init_data()
