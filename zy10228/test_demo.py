#!/usr/bin/env python3
"""
测试演示脚本 - 演示老年餐配送退餐系统的各种功能
"""

from datetime import datetime, date, timedelta
from elder_meal_cli.database import Database
from elder_meal_cli.models import Elder, MealPlan, OrderStatus, SubsidyType, CancellationReason
from elder_meal_cli.services import ElderMealService
import os

def run_demo():
    print("=" * 70)
    print("老年餐配送退餐系统 - 功能演示")
    print("=" * 70)
    
    db = Database(db_path="/tmp/test_elder_meal.db")
    service = ElderMealService(db)
    
    print("\n【1. 添加餐标】")
    meal1 = MealPlan(name="普通餐", price=15.0, subsidy_amount=5.0, description="标准午餐")
    meal_id1 = db.add_meal_plan(meal1)
    print(f"  - 添加: 普通餐 (ID: {meal_id1}) - 原价15元, 补贴5元, 自付10元")
    
    meal2 = MealPlan(name="软食餐", price=18.0, subsidy_amount=6.0, description="适合牙口不好")
    meal_id2 = db.add_meal_plan(meal2)
    print(f"  - 添加: 软食餐 (ID: {meal_id2}) - 原价18元, 补贴6元, 自付12元")
    
    print("\n【2. 添加老人信息】")
    elder1 = Elder(
        name="张大爷",
        phone="13800138001",
        id_card="110101195001010001",
        subsidy_type=SubsidyType.GENERAL.value,
        address="幸福小区1号楼1单元101",
        district="东区",
        route="路线A"
    )
    elder_id1 = service.add_elder(elder1).data
    print(f"  - 张大爷 (ID: {elder_id1}) - 普通补贴, 路线A")
    
    elder2 = Elder(
        name="李奶奶",
        phone="13800138002",
        id_card="110101195203040002",
        subsidy_type=SubsidyType.SPECIAL.value,
        address="幸福小区2号楼3单元202",
        district="东区",
        route="路线A"
    )
    elder_id2 = service.add_elder(elder2).data
    print(f"  - 李奶奶 (ID: {elder_id2}) - 特殊补贴, 路线A")
    
    elder3 = Elder(
        name="王爷爷",
        phone="13800138003",
        id_card="110101194805060003",
        subsidy_type=SubsidyType.GENERAL.value,
        address="阳光小区5号楼2单元301",
        district="西区",
        route="路线B"
    )
    elder_id3 = service.add_elder(elder3).data
    print(f"  - 王爷爷 (ID: {elder_id3}) - 普通补贴, 路线B")
    
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    
    print(f"\n【3. 创建订单 - 日期: {tomorrow}】")
    result = service.create_order(elder_id1, tomorrow, meal_id1, import_source="demo", import_id="test1")
    print(f"  - 张大爷 普通餐: {result.message}")
    
    result = service.create_order(elder_id2, tomorrow, meal_id2, import_source="demo", import_id="test2")
    print(f"  - 李奶奶 软食餐: {result.message}")
    
    result = service.create_order(elder_id3, tomorrow, meal_id1, import_source="demo", import_id="test3")
    print(f"  - 王爷爷 普通餐: {result.message}")
    
    print(f"\n【4. 测试重复下单 - 同一天同一位老人同类型餐】")
    result = service.create_order(elder_id1, tomorrow, meal_id1, import_source="demo", import_id="test4")
    print(f"  - 再次给张大爷订普通餐: {result.message}")
    print(f"    警告: {result.warnings}")
    
    print(f"\n【5. 测试重复导入 - 相同import_id】")
    result = service.create_order(elder_id1, tomorrow, meal_id1, import_source="demo", import_id="test1")
    print(f"  - 使用相同import_id导入: {result.message}")
    print(f"    警告: {result.warnings}")
    
    print("\n【6. 厨房备餐汇总】")
    summary = service.get_kitchen_prep_summary(tomorrow)
    print(f"  日期: {tomorrow}")
    print(f"  总备餐数: {summary['total_count']} 份")
    print(f"  总餐费: {summary['total_price']} 元")
    print(f"  总补贴: {summary['total_subsidy']} 元")
    print(f"  按餐标分类:")
    for name, data in summary['by_meal_plan'].items():
        print(f"    - {name}: {data['count']}份, 总价{data['total_price']}元, 补贴{data['total_subsidy']}元")
    
    print("\n【7. 配送路线汇总】")
    routes = service.get_delivery_routes(tomorrow)
    print(f"  路线数: {routes['total_routes']} 条")
    print(f"  总配送量: {routes['total_deliveries']} 份")
    for route_name, route_data in routes['routes'].items():
        print(f"  \n  【{route_name}】- {route_data['count']}份")
        for idx, o in enumerate(route_data['orders'], 1):
            print(f"    {idx}. {o.elder_name} - {o.delivery_address} - {o.meal_plan_name} - 自付{o.actual_payment}元")
    
    print("\n【8. 测试退餐 - 晚于截止时间】")
    orders = db.list_orders(meal_date=tomorrow)
    order1 = orders[0]
    
    cancel_time = datetime.now()
    result = service.cancel_order(order1.id, CancellationReason.ILLNESS.value, "身体不舒服", cancel_time)
    print(f"  订单 {order1.id} ({order1.elder_name}) 退餐结果:")
    print(f"    {result.message}")
    if result.warnings:
        print(f"    【异常拦截】:")
        for w in result.warnings:
            print(f"      ⚠ {w}")
    
    print("\n【9. 测试重复退餐】")
    result = service.cancel_order(order1.id, CancellationReason.ILLNESS.value)
    print(f"  再次退餐: {result.message}")
    print(f"    警告: {result.warnings}")
    
    print("\n【10. 测试配送后退餐】")
    order2 = orders[1]
    
    print(f"  先登记送达...")
    result = service.record_delivery(order2.id, "配送员小张", "李奶奶本人")
    print(f"    {result.message}")
    
    print(f"  然后尝试退餐...")
    result = service.cancel_order(order2.id, CancellationReason.OUTING.value, "外出")
    print(f"    {result.message}")
    if result.warnings:
        print(f"    【异常拦截】:")
        for w in result.warnings:
            print(f"      ⚠ {w}")
    
    print("\n【11. 退餐扣减汇总】")
    cancel_summary = service.get_cancellation_summary(yesterday, tomorrow)
    print(f"  退餐总数: {cancel_summary['total_count']} 条")
    print(f"  超时退餐: {cancel_summary['after_deadline_count']} 条")
    print(f"  配送后退餐: {cancel_summary['after_delivered_count']} 条")
    print(f"  退款总额: {cancel_summary['total_refund']} 元")
    print(f"  扣款总额: {cancel_summary['total_deduction']} 元")
    
    if cancel_summary['by_reason']:
        print(f"  按原因统计:")
        for reason, data in cancel_summary['by_reason'].items():
            print(f"    - {reason}: {data['count']}条, 扣款{data['deduction']}元")
    
    print("\n【12. 测试补贴变更】")
    result = service.update_subsidy_type(
        elder_id1, 
        SubsidyType.SPECIAL.value, 
        notes="高龄认证通过"
    )
    print(f"  张大爷补贴变更: {result.message}")
    
    print(f"\n  查看补贴历史:")
    history = db.list_subsidy_history(elder_id1)
    for h in history:
        print(f"    {h.old_subsidy_type} -> {h.new_subsidy_type} ({h.effective_date}) - {h.notes}")
    
    print("\n【13. 政府补贴汇总】")
    subsidy_summary = service.get_subsidy_summary(yesterday, tomorrow)
    print(f"  有效订单数: {subsidy_summary['total_orders']} 份")
    print(f"  餐费总额: {subsidy_summary['total_price']} 元")
    print(f"  补贴总额: {subsidy_summary['total_subsidy']} 元")
    print(f"  老人自付: {subsidy_summary['total_payment']} 元")
    
    if subsidy_summary['by_subsidy_type']:
        print(f"  按补贴类型统计:")
        for stype, data in subsidy_summary['by_subsidy_type'].items():
            print(f"    - {stype}: {data['count']}份, 补贴{data['total_subsidy']}元")
    
    print("\n" + "=" * 70)
    print("演示完成！")
    print("=" * 70)
    
    os.remove("/tmp/test_elder_meal.db")

if __name__ == '__main__':
    run_demo()
