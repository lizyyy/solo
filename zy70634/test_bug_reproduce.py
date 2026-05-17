#!/usr/bin/env python3
"""
复现多订单缺货拆单问题的测试脚本
问题场景：两个订单同一SKU合计应拣30、实拣20，应该正确分配并触发缺货拆单
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, Wave, Order, OrderItem, PickTask, Location, SKUStock
from services import WaveService
from database import get_db
import uuid
from datetime import datetime

# 使用内存SQLite
engine = create_engine('sqlite:///:memory:')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_test_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # 创建库位
    loc = Location(location_code="A-01-01-01", aisle="A", rack="01", level=1, position=1, sort_order=1)
    db.add(loc)
    db.flush()

    # 创建SKU库存
    stock = SKUStock(sku_code="SKU001", sku_name="测试商品", location_id=loc.id, quantity=100)
    db.add(stock)

    # 创建两个订单，都要同一个SKU
    order1 = Order(
        order_code="TEST-ORDER-001",
        customer_name="客户A",
        status="pending"
    )
    db.add(order1)
    db.flush()

    item1 = OrderItem(
        order_id=order1.id,
        sku_code="SKU001",
        sku_name="测试商品",
        ordered_quantity=10
    )
    db.add(item1)

    order2 = Order(
        order_code="TEST-ORDER-002",
        customer_name="客户B",
        status="pending"
    )
    db.add(order2)
    db.flush()

    item2 = OrderItem(
        order_id=order2.id,
        sku_code="SKU001",
        sku_name="测试商品",
        ordered_quantity=20
    )
    db.add(item2)

    db.commit()
    print("✅ 测试数据初始化完成:")
    print(f"   订单1: SKU001 x10")
    print(f"   订单2: SKU001 x20")
    print(f"   合计: SKU001 x30")
    print()
    return db

def test_shortage_allocation():
    print("=" * 60)
    print("测试：多订单合并拣货缺货分配")
    print("=" * 60)

    db = init_test_db()

    # 1. 创建波次
    print("步骤1: 创建波次，合并两个订单")
    order_codes = ["TEST-ORDER-001", "TEST-ORDER-002"]
    wave = WaveService.create_wave(db, order_codes)
    print(f"✅ 波次创建成功: {wave.wave_code}")
    print(f"   订单数: {wave.total_orders}")
    print(f"   SKU数: {wave.total_skus}")
    print()

    # 2. 生成拣货任务
    print("步骤2: 生成拣货任务")
    tasks = WaveService.generate_pick_tasks(db, wave.id)
    print(f"✅ 拣货任务生成成功，共 {len(tasks)} 个任务")
    for task in tasks:
        print(f"   {task.task_code}: {task.sku_code} 应拣 {task.required_quantity}")
    print()

    # 3. 处理拣货任务 - 故意缺货（应拣30，实拣20）
    print("步骤3: 处理拣货任务 - 应拣30，实拣20（缺货10）")
    task = tasks[0]
    task_id = task.id
    actual_qty = 20

    processed_task, split_orders = WaveService.process_shortage(
        db, task_id, actual_qty, "拣货员测试"
    )

    print(f"   任务状态: {processed_task.status}")
    print(f"   应拣数量: {processed_task.required_quantity}")
    print(f"   实拣数量: {processed_task.picked_quantity}")
    print(f"   是否缺货: {processed_task.is_shortage}")
    print(f"   缺货数量: {processed_task.required_quantity - processed_task.picked_quantity}")
    print(f"   拆单数量: {len(split_orders)}")
    print()

    # 4. 检查订单拣货情况
    print("步骤4: 检查各订单的拣货分配")
    orders = db.query(Order).filter(Order.wave_id == wave.id).all()

    total_picked = 0
    total_ordered = 0
    total_shortage = 0
    shortage_items = 0

    for order in orders:
        print(f"   订单 {order.order_code}:")
        for item in order.items:
            picked = item.picked_quantity or 0
            ordered = item.ordered_quantity
            shortage = ordered - picked
            is_shortage = item.is_shortage or False

            total_picked += picked
            total_ordered += ordered
            if shortage > 0:
                total_shortage += shortage
                shortage_items += 1

            print(f"     {item.sku_code}: 订购{ordered}, 实拣{picked}, 缺货{shortage}, 标记缺货={is_shortage}")

    print()
    print("   统计汇总:")
    print(f"     总订购: {total_ordered}")
    print(f"     总实拣: {total_picked}")
    print(f"     总缺货: {total_shortage}")
    print(f"     缺货商品数: {shortage_items}")
    print(f"     拆单数: {len(split_orders)}")
    print()

    # 5. 验证问题
    print("=" * 60)
    print("验证结果:")
    print("-" * 60)

    errors = []

    # 问题1: 总实拣量不应超过实际拣货量
    if total_picked > actual_qty:
        errors.append(f"❌ 严重BUG: 总实拣量({total_picked}) > 实际拣货量({actual_qty})! 库存凭空增加了!")
    else:
        print(f"✅ 总实拣量正确: {total_picked} (实际拣货量: {actual_qty})")

    # 问题2: 缺货应正确标记
    expected_shortage = total_ordered - actual_qty
    if total_shortage != expected_shortage:
        errors.append(f"❌ BUG: 总缺货量应为 {expected_shortage}, 实际为 {total_shortage}")
    else:
        print(f"✅ 总缺货量正确: {total_shortage}")

    # 问题3: 缺货商品应标记
    if shortage_items == 0 and expected_shortage > 0:
        errors.append(f"❌ BUG: 缺货商品未被标记为缺货!")
    else:
        print(f"✅ 缺货商品标记: {shortage_items} 个商品标记为缺货")

    # 问题4: 应生成拆单
    if len(split_orders) == 0 and expected_shortage > 0:
        errors.append(f"❌ BUG: 缺货时未生成拆单!")
    else:
        print(f"✅ 拆单生成: {len(split_orders)} 个拆单")

    print()
    if errors:
        print("❌ 发现以下问题:")
        for err in errors:
            print(f"   {err}")
        return False
    else:
        print("✅ 分配逻辑验证通过!")
    print()

    # 6. 测试波次完成和报告生成
    print("步骤5: 测试波次完成（无复核差异时）")
    try:
        report = WaveService.complete_wave(db, wave.id)
        print(f"   报告生成成功: {report.report_code}")
        print(f"   总订单数: {report.total_orders}")
        print(f"   已完成订单: {report.completed_orders}")
        print(f"   拆单数: {report.split_orders}")
        print(f"   总商品数: {report.total_items}")
        print(f"   已拣商品数: {report.picked_items}")
        print(f"   缺货商品数: {report.shortage_items}")
    except Exception as e:
        print(f"   波次完成时出错: {e}")
        return False

    print()
    print("=" * 60)
    print("报告验证:")
    print("-" * 60)

    report_errors = []
    expected_split = len(split_orders)
    expected_shortage_items = shortage_items

    if report.split_orders != expected_split:
        report_errors.append(f"❌ BUG: 报告拆单数应为 {expected_split}, 实际为 {report.split_orders}")
    else:
        print(f"✅ 报告拆单数正确: {report.split_orders}")

    if report.shortage_items != expected_shortage_items:
        report_errors.append(f"❌ BUG: 报告缺货商品数应为 {expected_shortage_items}, 实际为 {report.shortage_items}")
    else:
        print(f"✅ 报告缺货商品数正确: {report.shortage_items}")

    if report.picked_items != total_picked:
        report_errors.append(f"❌ BUG: 报告已拣商品数应为 {total_picked}, 实际为 {report.picked_items}")
    else:
        print(f"✅ 报告已拣商品数正确: {report.picked_items}")

    print()
    if report_errors:
        print("❌ 报告统计发现以下问题:")
        for err in report_errors:
            print(f"   {err}")
        return False
    else:
        print("✅ 所有验证通过!")
        return True

if __name__ == "__main__":
    success = test_shortage_allocation()
    sys.exit(0 if success else 1)