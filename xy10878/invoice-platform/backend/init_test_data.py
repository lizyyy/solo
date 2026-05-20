#!/usr/bin/env python3
"""
用量计费发票台 - 测试数据初始化脚本
包含: 免费额度、超额调用、人工折扣、发票驳回的完整场景
"""

import sys
from datetime import datetime, timedelta
import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, Customer, PricingRule, CallDetail, BillingPeriod, Invoice

DB_URL = "sqlite:///./invoice_platform.db"

def generate_id():
    return str(uuid.uuid4())[:8]

def init_db():
    engine = create_engine(DB_URL)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()

def create_test_data(db):
    print("=" * 60)
    print("创建测试数据...")
    print("=" * 60)

    # 1. 创建客户
    print("\n1. 创建客户...")
    customer = Customer(
        id="CUST-SAAS-001",
        name="云端科技有限公司",
        contact="张三",
        email="zhangsan@cloudtech.com"
    )
    db.add(customer)
    db.commit()
    print(f"   ✓ 客户: {customer.name} ({customer.id})")

    # 2. 创建定价规则 (两个版本，模拟规则变更)
    print("\n2. 创建定价规则...")
    
    # 老版本规则 (v1.0) - 1000次免费，超出0.1元/次
    rule_v1 = PricingRule(
        id="PRICE-v1.0",
        version="v1.0",
        customer_id=customer.id,
        free_quota=1000,
        price_per_call=0.10,
        effective_date=datetime(2024, 1, 1),
        end_date=datetime(2024, 4, 1),
        description="标准版定价 - 1000次免费，超出0.1元/次"
    )
    db.add(rule_v1)
    print(f"   ✓ 规则v1.0: 免费{rule_v1.free_quota}次, {rule_v1.price_per_call}元/次")

    # 新版本规则 (v2.0) - 500次免费，超出0.15元/次 (模拟涨价)
    rule_v2 = PricingRule(
        id="PRICE-v2.0",
        version="v2.0",
        customer_id=customer.id,
        free_quota=500,
        price_per_call=0.15,
        effective_date=datetime(2024, 4, 1),
        description="升级版定价 - 500次免费，超出0.15元/次"
    )
    db.add(rule_v2)
    print(f"   ✓ 规则v2.0: 免费{rule_v2.free_quota}次, {rule_v2.price_per_call}元/次")
    db.commit()

    # 3. 创建调用明细 (跨两个规则版本)
    print("\n3. 创建API调用明细...")
    
    calls = []
    apis = ["get_user", "create_order", "query_data", "upload_file", "send_notification"]
    
    # 3月 (v1.0规则) - 1500次调用 (超额500次)
    base_date = datetime(2024, 3, 15)
    for i in range(1500):
        call_time = base_date + timedelta(
            days=i // 100,
            hours=(i % 100) // 4,
            minutes=(i % 4) * 15
        )
        call = CallDetail(
            id=f"CALL-MAR-{i:04d}",
            customer_id=customer.id,
            api_name=apis[i % len(apis)],
            call_time=call_time,
            response_time_ms=100 + (i % 50) * 10,
            status_code=200 if i % 20 != 0 else 500
        )
        calls.append(call)
    print(f"   ✓ 3月: 1500次调用 (v1.0规则，超额500次)")

    # 4月 (v2.0规则) - 800次调用 (超额300次)
    base_date = datetime(2024, 4, 10)
    for i in range(800):
        call_time = base_date + timedelta(
            days=i // 80,
            hours=(i % 80) // 4,
            minutes=(i % 4) * 15
        )
        call = CallDetail(
            id=f"CALL-APR-{i:04d}",
            customer_id=customer.id,
            api_name=apis[i % len(apis)],
            call_time=call_time,
            response_time_ms=120 + (i % 60) * 8,
            status_code=200 if i % 15 != 0 else 400
        )
        calls.append(call)
    print(f"   ✓ 4月: 800次调用 (v2.0规则，超额300次)")

    db.bulk_save_objects(calls)
    db.commit()
    print(f"   ✓ 总计: {len(calls)}条调用记录")

    # 4. 创建账期 (Q1 2024)
    print("\n4. 创建账期...")
    period = BillingPeriod(
        id="PERIOD-2024-Q1",
        customer_id=customer.id,
        period_start=datetime(2024, 1, 1),
        period_end=datetime(2024, 5, 1),
        is_locked=False
    )
    db.add(period)
    db.commit()
    print(f"   ✓ 账期: {period.id} (2024-01-01 至 2024-05-01)")

    print("\n" + "=" * 60)
    print("测试数据创建完成!")
    print("=" * 60)
    print(f"\n数据统计:")
    print(f"  客户数: {db.query(Customer).count()}")
    print(f"  定价规则数: {db.query(PricingRule).count()}")
    print(f"  调用明细数: {db.query(CallDetail).count()}")
    print(f"  账期数: {db.query(BillingPeriod).count()}")
    print(f"\n预期计费结果:")
    print(f"  v1.0规则(3月): 1500次调用")
    print(f"    - 免费额度: 1000次")
    print(f"    - 计费调用: 500次 × 0.10元 = 50.00元")
    print(f"  v2.0规则(4月): 800次调用")
    print(f"    - 免费额度: 500次")
    print(f"    - 计费调用: 300次 × 0.15元 = 45.00元")
    print(f"  基础合计: 95.00元")
    print(f"\n可测试的场景:")
    print(f"  1. 锁定账期 - 自动按规则聚合")
    print(f"  2. 人工折扣 - 调整金额生成差异记录")
    print(f"  3. 提交发票申请")
    print(f"  4. 驳回/审批发票")
    print(f"  5. 导出Excel明细")

def main():
    db = init_db()
    try:
        create_test_data(db)
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
