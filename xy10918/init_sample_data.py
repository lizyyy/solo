#!/usr/bin/env python3
"""
农资赊销回款API - 样例数据初始化脚本
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine, Base
from app.models import Customer, CreditOrder, CreditOrderItem, ReturnRecord, Payment
from datetime import datetime, timedelta
import uuid


def init_sample_data():
    """初始化样例数据"""
    
    db = SessionLocal()
    
    try:
        if os.path.exists('agri_credit.db'):
            print("清除原有数据库...")
            db.close()
            os.remove('agri_credit.db')
        
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        
        print("创建样例客户...")
        customers = [
            Customer(
                name="张大爷",
                phone="13800138001",
                address="东村村一组12号",
                id_card="320101196001011234",
                is_active=True,
                remark="老客户，信誉良好"
            ),
            Customer(
                name="李婶",
                phone="13800138002",
                address="西村村二组30号",
                id_card="320101196502025678",
                is_active=True,
                remark="经常买化肥"
            ),
            Customer(
                name="王三哥",
                phone="13800138003",
                address="南村村三组45号",
                id_card="320101197003039012",
                is_active=True,
                remark="种粮大户"
            ),
            Customer(
                name="赵四姐",
                phone="13800138004",
                address="北村村四组18号",
                id_card="320101197504043456",
                is_active=True,
                remark="蔬菜种植户"
            ),
        ]
        db.add_all(customers)
        db.flush()
        
        print("创建赊销单和商品...")
        
        order_date1 = datetime.now() - timedelta(days=30)
        order1 = CreditOrder(
            order_no=f"SO{order_date1.strftime('%Y%m%d%H%M%S')}",
            customer_id=customers[0].id,
            order_date=order_date1,
            total_amount=1250.0,
            discount_amount=50.0,
            return_amount=0.0,
            paid_amount=0.0,
            debt_amount=1200.0,
            status="pending",
            remark="春耕化肥",
            idempotency_key=str(uuid.uuid4())
        )
        db.add(order1)
        db.flush()
        
        order1_items = [
            CreditOrderItem(
                order_id=order1.id,
                product_batch="HF2024001",
                product_name="尿素",
                quantity=10,
                unit_price=80.0,
                total_price=800.0,
                unit="袋",
                specification="50kg/袋",
                return_quantity=0
            ),
            CreditOrderItem(
                order_id=order1.id,
                product_batch="HF2024002",
                product_name="复合肥",
                quantity=5,
                unit_price=90.0,
                total_price=450.0,
                unit="袋",
                specification="40kg/袋",
                return_quantity=0
            ),
        ]
        db.add_all(order1_items)
        
        order_date2 = datetime.now() - timedelta(days=20)
        order2 = CreditOrder(
            order_no=f"SO{order_date2.strftime('%Y%m%d%H%M%S')}",
            customer_id=customers[1].id,
            order_date=order_date2,
            total_amount=860.0,
            discount_amount=0.0,
            return_amount=120.0,
            paid_amount=300.0,
            debt_amount=440.0,
            status="partial",
            remark="农药和种子",
            idempotency_key=str(uuid.uuid4())
        )
        db.add(order2)
        db.flush()
        
        order2_items = [
            CreditOrderItem(
                order_id=order2.id,
                product_batch="NY2024001",
                product_name="草甘膦",
                quantity=20,
                unit_price=25.0,
                total_price=500.0,
                unit="瓶",
                specification="1L/瓶",
                return_quantity=4
            ),
            CreditOrderItem(
                order_id=order2.id,
                product_batch="ZZ2024001",
                product_name="水稻种子",
                quantity=12,
                unit_price=30.0,
                total_price=360.0,
                unit="斤",
                specification="杂交稻",
                return_quantity=0
            ),
        ]
        db.add_all(order2_items)
        
        order_date3 = datetime.now() - timedelta(days=10)
        order3 = CreditOrder(
            order_no=f"SO{order_date3.strftime('%Y%m%d%H%M%S')}",
            customer_id=customers[2].id,
            order_date=order_date3,
            total_amount=3200.0,
            discount_amount=200.0,
            return_amount=0.0,
            paid_amount=3000.0,
            debt_amount=0.0,
            status="paid",
            remark="大户批量采购",
            idempotency_key=str(uuid.uuid4())
        )
        db.add(order3)
        db.flush()
        
        order3_items = [
            CreditOrderItem(
                order_id=order3.id,
                product_batch="HF2024003",
                product_name="复合肥",
                quantity=40,
                unit_price=80.0,
                total_price=3200.0,
                unit="袋",
                specification="50kg/袋",
                return_quantity=0
            ),
        ]
        db.add_all(order3_items)
        
        print("创建退货记录...")
        return1 = ReturnRecord(
            return_no=f"RT{datetime.now().strftime('%Y%m%d%H%M%S')}",
            order_id=order2.id,
            return_date=order_date2 + timedelta(days=3),
            product_batch="NY2024001",
            product_name="草甘膦",
            quantity=4,
            unit_price=30.0,
            total_amount=120.0,
            reason="买多了，未开封",
            idempotency_key=str(uuid.uuid4())
        )
        db.add(return1)
        
        print("创建回款记录...")
        payment1 = Payment(
            payment_no=f"PY{datetime.now().strftime('%Y%m%d%H%M%S')}01",
            customer_id=customers[1].id,
            order_id=order2.id,
            payment_date=order_date2 + timedelta(days=7),
            amount=300.0,
            payment_method="现金",
            status="confirmed",
            remark="先付一部分"
        )
        db.add(payment1)
        
        payment2 = Payment(
            payment_no=f"PY{datetime.now().strftime('%Y%m%d%H%M%S')}02",
            customer_id=customers[2].id,
            order_id=order3.id,
            payment_date=order_date3 + timedelta(days=2),
            amount=3000.0,
            payment_method="微信转账",
            status="confirmed",
            remark="全款支付"
        )
        db.add(payment2)
        
        db.commit()
        
        print("\n" + "="*50)
        print("样例数据初始化完成！")
        print("="*50)
        print(f"客户数量: {len(customers)}")
        print(f"赊销单数量: 3")
        print(f"  - 待付款: 1")
        print(f"  - 部分付款: 1")
        print(f"  - 已结清: 1")
        print(f"退货记录: 1")
        print(f"回款记录: 2")
        print("\n数据库文件: agri_credit.db")
        print("启动服务: python -m uvicorn app.main:app --reload")
        print("API文档: http://localhost:8000/docs")
        print("="*50)
        
    except Exception as e:
        db.rollback()
        print(f"初始化失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    init_sample_data()
