#!/usr/bin/env python3
"""
波次完成报告可复查性测试
验证：足量拣货和缺货拣货两种场景下，完成报告统计都正确
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, Order, OrderItem, PickTask, Location
from services import WaveService
import uuid

engine = create_engine('sqlite:///:memory:')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

def create_test_orders(db, order_codes, sku_code, quantities):
    """创建测试订单"""
    for i, order_code in enumerate(order_codes):
        order = Order(
            order_code=order_code,
            customer_name=f"测试客户{i+1}",
            status="pending"
        )
        db.add(order)
        db.flush()

        item = OrderItem(
            order_id=order.id,
            sku_code=sku_code,
            sku_name="测试商品",
            ordered_quantity=quantities[i]
        )
        db.add(item)
    db.commit()

def test_full_quantity_picking():
    """测试：足量拣货场景 - 报告统计应正确"""
    print("=" * 60)
    print("测试1：足量拣货场景（应拣30，实拣30）")
    print("=" * 60)

    db = SessionLocal()
    init_db()

    # 创建测试订单
    order_codes = ["FULL-TEST-001", "FULL-TEST-002"]
    create_test_orders(db, order_codes, "SKU001", [10, 20])
    print("✅ 创建测试订单: 订单1(10件) + 订单2(20件) = 合计30件")

    # 创建波次
    wave = WaveService.create_wave(db, order_codes, priority=1)
    print(f"✅ 创建波次: {wave.wave_code}")

    # 生成拣货任务
    tasks = WaveService.generate_pick_tasks(db, wave.id)
    task_id = tasks[0].id
    print(f"✅ 生成拣货任务: 应拣 {tasks[0].required_quantity} 件")

    # 足量拣货
    actual_qty = 30
    task, split_orders = WaveService.process_shortage(db, task_id, actual_qty, "测试拣货员")
    print(f"✅ 处理拣货任务: 实拣 {actual_qty} 件")
    print(f"   拆单数: {len(split_orders)}")

    # 检查订单拣货情况
    orders = db.query(Order).filter(Order.wave_id == wave.id).all()
    print("\n订单拣货详情:")
    total_picked = 0
    for order in orders:
        for item in order.items:
            total_picked += item.picked_quantity
            print(f"   {order.order_code}: 订购{item.ordered_quantity}, 实拣{item.picked_quantity}, 缺货标记={item.is_shortage}")

    # 完成波次并生成报告
    report = WaveService.complete_wave(db, wave.id)
    print("\n波次完成报告:")
    print(f"   总订单数: {report.total_orders}")
    print(f"   已完成订单: {report.completed_orders}")
    print(f"   拆单数: {report.split_orders}")
    print(f"   缺货商品数: {report.shortage_items}")
    print(f"   已拣商品数: {report.picked_items}")
    print(f"   总商品数: {report.total_items}")

    # 验证
    errors = []
    if total_picked != actual_qty:
        errors.append(f"❌ 订单实拣总量错误: {total_picked} (应为 {actual_qty})")
    if report.split_orders != 0:
        errors.append(f"❌ 报告拆单数错误: {report.split_orders} (应为 0)")
    if report.shortage_items != 0:
        errors.append(f"❌ 报告缺货商品数错误: {report.shortage_items} (应为 0)")
    if report.picked_items != actual_qty:
        errors.append(f"❌ 报告已拣商品数错误: {report.picked_items} (应为 {actual_qty})")

    if errors:
        print("\n验证失败:")
        for err in errors:
            print(f"   {err}")
        return False
    else:
        print("\n✅ 足量拣货场景验证通过!")
        return True

def test_shortage_picking():
    """测试：缺货拣货场景 - 报告统计应正确"""
    print("\n" + "=" * 60)
    print("测试2：缺货拣货场景（应拣30，实拣20）")
    print("=" * 60)

    db = SessionLocal()

    # 创建测试订单
    order_codes = ["SHORT-TEST-001", "SHORT-TEST-002"]
    create_test_orders(db, order_codes, "SKU001", [10, 20])
    print("✅ 创建测试订单: 订单1(10件) + 订单2(20件) = 合计30件")

    # 创建波次
    wave = WaveService.create_wave(db, order_codes, priority=1)
    print(f"✅ 创建波次: {wave.wave_code}")

    # 生成拣货任务
    tasks = WaveService.generate_pick_tasks(db, wave.id)
    task_id = tasks[0].id
    print(f"✅ 生成拣货任务: 应拣 {tasks[0].required_quantity} 件")

    # 缺货拣货
    actual_qty = 20
    task, split_orders = WaveService.process_shortage(db, task_id, actual_qty, "测试拣货员")
    print(f"✅ 处理拣货任务: 实拣 {actual_qty} 件")
    print(f"   拆单数: {len(split_orders)}")

    # 检查订单拣货情况
    orders = db.query(Order).filter(Order.wave_id == wave.id).all()
    print("\n订单拣货详情:")
    total_picked = 0
    shortage_count = 0
    for order in orders:
        for item in order.items:
            total_picked += item.picked_quantity
            if item.is_shortage:
                shortage_count += 1
            print(f"   {order.order_code}: 订购{item.ordered_quantity}, 实拣{item.picked_quantity}, 缺货标记={item.is_shortage}")

    # 完成波次并生成报告
    report = WaveService.complete_wave(db, wave.id)
    print("\n波次完成报告:")
    print(f"   总订单数: {report.total_orders}")
    print(f"   已完成订单: {report.completed_orders}")
    print(f"   拆单数: {report.split_orders}")
    print(f"   缺货商品数: {report.shortage_items}")
    print(f"   已拣商品数: {report.picked_items}")
    print(f"   总商品数: {report.total_items}")

    # 验证
    errors = []
    if total_picked != actual_qty:
        errors.append(f"❌ 订单实拣总量错误: {total_picked} (应为 {actual_qty})")
    if len(split_orders) == 0:
        errors.append(f"❌ 应生成拆单，但实际拆单数为 0")
    if report.split_orders != len(split_orders):
        errors.append(f"❌ 报告拆单数错误: {report.split_orders} (应为 {len(split_orders)})")
    if report.shortage_items != shortage_count:
        errors.append(f"❌ 报告缺货商品数错误: {report.shortage_items} (应为 {shortage_count})")
    if report.picked_items != actual_qty:
        errors.append(f"❌ 报告已拣商品数错误: {report.picked_items} (应为 {actual_qty})")

    if errors:
        print("\n验证失败:")
        for err in errors:
            print(f"   {err}")
        return False
    else:
        print("\n✅ 缺货拣货场景验证通过!")
        return True

def run_all_tests():
    print("波次完成报告可复查性测试")
    print()

    test1_passed = test_full_quantity_picking()
    test2_passed = test_shortage_picking()

    print("\n" + "=" * 60)
    print("测试总结:")
    print("-" * 60)
    passed = sum([test1_passed, test2_passed])
    print(f"通过: {passed} / 2")

    if test1_passed and test2_passed:
        print("✅ 波次完成报告可复查性验证通过!")
        print("   - 足量拣货场景: 订单明细正确，报告统计正确")
        print("   - 缺货拣货场景: 订单明细正确，报告统计正确")
        return True
    else:
        print("❌ 存在测试失败，请检查上述错误信息")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)