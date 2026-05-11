#!/usr/bin/env python3
"""
测试Bug修复和新功能：
1. 配送后退餐重复记录的Bug
2. 收费登记和查询功能
"""

import os
from datetime import datetime, date, timedelta

from elder_meal_cli.database import Database
from elder_meal_cli.models import Elder, MealPlan, OrderStatus, SubsidyType, CancellationReason
from elder_meal_cli.services import ElderMealService

def run_test():
    print("=" * 70)
    print("测试：Bug修复和收费管理功能")
    print("=" * 70)
    
    db = Database(db_path="/tmp/test_fix.db")
    service = ElderMealService(db)
    
    # 清理旧数据
    os.remove("/tmp/test_fix.db")
    db = Database(db_path="/tmp/test_fix.db")
    service = ElderMealService(db)
    
    print("\n【1. 准备测试数据】")
    
    # 添加餐标
    meal1 = MealPlan(name="普通餐", price=15.0, subsidy_amount=5.0)
    meal_id1 = db.add_meal_plan(meal1)
    print(f"  - 普通餐 ID: {meal_id1}")
    
    # 添加老人
    elder1 = Elder(
        name="测试老人",
        id_card="110101195001019999",
        subsidy_type=SubsidyType.GENERAL.value,
        address="测试地址",
        route="测试路线"
    )
    elder_id1 = service.add_elder(elder1).data
    print(f"  - 测试老人 ID: {elder_id1}")
    
    # 创建订单
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    result = service.create_order(elder_id1, tomorrow, meal_id1, "test_fix", "order1")
    order_id = result.data
    print(f"  - 订单 ID: {order_id}")
    
    print("\n【2. 测试：配送后退餐重复记录Bug修复】")
    
    # 第一步：先登记送达
    result = service.record_delivery(order_id, "配送员小王", "测试老人本人")
    print(f"  步骤1 - 登记送达: {result.message}")
    
    # 验证订单状态
    order = db.get_order(order_id)
    print(f"  订单状态: {order.status}")
    
    # 第二步：第一次退餐（应该成功，扣款100%）
    cancel_time = datetime.now()
    result = service.cancel_order(order_id, CancellationReason.OUTING.value, "外出", cancel_time)
    print(f"\n  步骤2 - 第一次退餐: {result.message}")
    for w in result.warnings:
        print(f"    异常: {w}")
    
    # 验证订单状态
    order = db.get_order(order_id)
    print(f"  订单状态: {order.status}")
    
    # 验证退餐记录
    cancel = db.get_cancellation_by_order(order_id)
    print(f"  退餐记录ID: {cancel.id}, 扣款: {cancel.deduction_amount}元, 退款: {cancel.refund_amount}元")
    
    # 第三步：第二次退餐（应该提示已退餐，拦截重复）
    print(f"\n  步骤3 - 第二次退餐（应该被拦截）:")
    result = service.cancel_order(order_id, CancellationReason.OUTING.value, "外出", cancel_time)
    print(f"    {result.message}")
    for w in result.warnings:
        print(f"      {w}")
    
    # 验证退餐记录数量（应该只有1条）
    cancellations = db.list_cancellations(tomorrow, tomorrow)
    print(f"\n  退餐记录数量: {len(cancellations)} 条 (期望: 1条)")
    
    print("\n【3. 测试：收费登记和查询功能】")
    
    # 创建一个新订单用于测试收费（换个日期避免重复）
    day_after_tomorrow = (date.today() + timedelta(days=2)).isoformat()
    result = service.create_order(elder_id1, day_after_tomorrow, meal_id1, "test_fix", "order2")
    order_id2 = result.data
    print(f"  - 新订单 ID: {order_id2}")
    
    # 登记第一笔收款
    result = service.record_payment(order_id2, 5.0, "现金")
    print(f"  步骤1 - 登记第一笔收款: {result.message}")
    
    # 登记第二笔收款
    result = service.record_payment(order_id2, 5.0, "微信")
    print(f"  步骤2 - 登记第二笔收款: {result.message}")
    
    # 查询收费记录
    payments = db.get_payments_by_order(order_id2)
    order = db.get_order(order_id2)
    total_paid = sum(p.amount for p in payments)
    
    print(f"\n  订单应收: {order.actual_payment} 元")
    print(f"  已收金额: {total_paid} 元")
    print(f"  收费记录数: {len(payments)} 条")
    for idx, p in enumerate(payments, 1):
        print(f"    {idx}. {p.payment_method}: {p.amount}元 ({p.payment_time})")
    
    print("\n【4. 测试：重复退餐的扣款统计】")
    
    # 验证扣款金额不重复
    summary = service.get_cancellation_summary(tomorrow, tomorrow)
    print(f"  退餐扣款总额: {summary['total_deduction']} 元 (期望: 10元)")
    print(f"  退餐总数: {summary['total_count']} 条 (期望: 1条)")
    
    print("\n" + "=" * 70)
    print("测试完成！")
    print("=" * 70)
    
    os.remove("/tmp/test_fix.db")

if __name__ == '__main__':
    run_test()
