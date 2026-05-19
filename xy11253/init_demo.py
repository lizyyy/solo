#!/usr/bin/env python3
from datetime import date, datetime, timedelta
from database import SessionLocal, init_db
from models import Order, OrderItem

init_db()
db = SessionLocal()

print("初始化演示数据...")

for i in range(1, 4):
    order = Order(
        order_no=f"DEMO{str(i).zfill(6)}",
        customer_id=f"CUST{str(i).zfill(4)}",
        customer_name=f"客户{i}",
        customer_phone=f"138{str(1234567 + i).zfill(8)}",
        total_amount=100.0 + i * 50,
        delivery_date=date.today() + timedelta(days=i)
    )
    db.add(order)
    db.flush()
    
    for j in range(1, 4):
        item = OrderItem(
            order_id=order.id,
            product_id=f"P{str(j).zfill(4)}",
            product_name=f"产品{j}",
            quantity=j + 1,
            unit_price=20.0 + j * 10,
            subtotal=(j + 1) * (20.0 + j * 10)
        )
        db.add(item)

db.commit()
print("演示数据初始化完成！")
print("创建了3个订单，每个订单包含3个商品")
print("\n订单号:")
for i in range(1, 4):
    print(f"  DEMO{str(i).zfill(6)}")
