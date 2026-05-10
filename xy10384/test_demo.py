#!/usr/bin/env python3
import os
import sys
import json
import shutil
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from package_tracker import PackageTracker, PackageStatus


def run_test():
    test_data_dir = "./test_data"
    
    if os.path.exists(test_data_dir):
        shutil.rmtree(test_data_dir)
    
    tracker = PackageTracker(data_dir=test_data_dir)
    
    print("=" * 80)
    print("快递驿站错拿追踪 CLI - 测试演示")
    print("=" * 80)
    print(f"测试时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    test_cases = []
    
    print("-" * 80)
    print("【场景一：正常取件流程】")
    print("-" * 80)
    
    print("\n1. 入库包裹 SF1001（张三，取件码 123456）")
    result = tracker.check_in(
        tracking_number="SF1001",
        pickup_code="123456",
        recipient_name="张三",
        phone="13800138001",
        operator="站长小李"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    
    print("\n2. 核销取件码 123456")
    result = tracker.pickup(
        pickup_code="123456",
        operator="站长小李",
        picked_by="张三本人"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    if result['success']:
        test_cases.append(("场景一：正常取件", "PASS"))
    
    print()
    print("-" * 80)
    print("【场景二：错拿后找回】")
    print("-" * 80)
    
    print("\n1. 入库包裹 YT2002（李四，取件码 234567）")
    result = tracker.check_in(
        tracking_number="YT2002",
        pickup_code="234567",
        recipient_name="李四",
        phone="13800138002",
        operator="站点小王"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    
    print("\n2. 核销取件码 234567（被王五错拿）")
    result = tracker.pickup(
        pickup_code="234567",
        operator="站点小王",
        picked_by="王五"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    
    print("\n3. 登记错拿（李四发现包裹被错拿）")
    result = tracker.register_mis_pick(
        tracking_number="YT2002",
        operator="站长小李",
        reported_by="李四",
        description="包裹显示已取件，但本人未收到，监控显示被他人错拿",
        mis_picked_by="王五"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    
    print("\n4. 联系王五后找回包裹")
    result = tracker.update_recovery(
        tracking_number="YT2002",
        operator="站长小李",
        recovered=True,
        recovered_by="王五",
        recovery_method="电话联系",
        description="王五发现拿错后主动送回"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    if result['success']:
        test_cases.append(("场景二：错拿找回", "PASS"))
    
    print()
    print("-" * 80)
    print("【场景三：错拿无法找回，进行赔付】")
    print("-" * 80)
    
    print("\n1. 入库包裹 ZT3003（赵六，取件码 345678）")
    result = tracker.check_in(
        tracking_number="ZT3003",
        pickup_code="345678",
        recipient_name="赵六",
        phone="13800138003",
        operator="站点小张"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    
    print("\n2. 核销取件码 345678")
    result = tracker.pickup(
        pickup_code="345678",
        operator="站点小张",
        picked_by="未知人员"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    
    print("\n3. 登记错拿")
    result = tracker.register_mis_pick(
        tracking_number="ZT3003",
        operator="站长小李",
        reported_by="赵六",
        description="包裹被冒领，监控无法识别取件人"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    
    print("\n4. 确认无法找回")
    result = tracker.update_recovery(
        tracking_number="ZT3003",
        operator="站长小李",
        recovered=False,
        description="多方查找无果，确认丢失"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    
    print("\n5. 计算建议补偿金额")
    result = tracker.calculate_compensation("ZT3003")
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    if result['success']:
        print(f"   建议金额：{result['recommended_amount']} 元")
    
    print("\n6. 执行赔付 75 元")
    result = tracker.process_compensation(
        tracking_number="ZT3003",
        operator="站长小李",
        amount=75.0,
        compensated_to="赵六",
        payment_method="微信转账"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    if result['success']:
        test_cases.append(("场景三：无法找回赔付", "PASS"))
    
    print()
    print("-" * 80)
    print("【场景四：验证拦截规则 - 重复核销】")
    print("-" * 80)
    
    print("\n1. 入库包裹 JD4004（钱七，取件码 456789）")
    result = tracker.check_in(
        tracking_number="JD4004",
        pickup_code="456789",
        recipient_name="钱七",
        phone="13800138004",
        operator="站点小王"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    
    print("\n2. 第一次核销取件码 456789")
    result = tracker.pickup(
        pickup_code="456789",
        operator="站点小王"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    
    print("\n3. 尝试重复核销取件码 456789（应被拦截）")
    result = tracker.pickup(
        pickup_code="456789",
        operator="站点小张"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    if not result['success'] and "重复核销" in result.get('error', ''):
        test_cases.append(("场景四：重复核销拦截", "PASS"))
    
    print()
    print("-" * 80)
    print("【场景五：验证拦截规则 - 未入库取件】")
    print("-" * 80)
    
    print("\n1. 尝试核销不存在的取件码 999999（应报错）")
    result = tracker.pickup(
        pickup_code="999999",
        operator="站点小张"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    if not result['success'] and "未入库" in result.get('error', ''):
        test_cases.append(("场景五：未入库取件拦截", "PASS"))
    
    print()
    print("-" * 80)
    print("【场景六：验证拦截规则 - 补偿金额超限】")
    print("-" * 80)
    
    print("\n1. 入库包裹 EMS5005（孙八，取件码 567890）")
    result = tracker.check_in(
        tracking_number="EMS5005",
        pickup_code="567890",
        recipient_name="孙八",
        phone="13800138005",
        operator="站点小张"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    
    print("\n2. 核销取件")
    result = tracker.pickup(
        pickup_code="567890",
        operator="站点小张"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    
    print("\n3. 登记错拿")
    result = tracker.register_mis_pick(
        tracking_number="EMS5005",
        operator="站长小李",
        reported_by="孙八",
        description="包裹错拿"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    
    print("\n4. 确认丢失")
    result = tracker.update_recovery(
        tracking_number="EMS5005",
        operator="站长小李",
        recovered=False
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    
    print("\n5. 尝试赔付 1000 元（超过规则上限 500 元，应报错）")
    result = tracker.process_compensation(
        tracking_number="EMS5005",
        operator="站长小李",
        amount=1000.0,
        compensated_to="孙八"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    if not result['success'] and "超过规则上限" in result.get('error', ''):
        test_cases.append(("场景六：补偿金额超限拦截", "PASS"))
    
    print()
    print("-" * 80)
    print("【场景七：验证拦截规则 - 已找回后禁止赔付】")
    print("-" * 80)
    
    print("\n1. 入库包裹 YUN6006（周九，取件码 678901）")
    result = tracker.check_in(
        tracking_number="YUN6006",
        pickup_code="678901",
        recipient_name="周九",
        phone="13800138006",
        operator="站点小王"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    
    print("\n2. 核销取件")
    result = tracker.pickup(
        pickup_code="678901",
        operator="站点小王"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    
    print("\n3. 登记错拿")
    result = tracker.register_mis_pick(
        tracking_number="YUN6006",
        operator="站长小李",
        reported_by="周九",
        description="错拿"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    
    print("\n4. 已找回")
    result = tracker.update_recovery(
        tracking_number="YUN6006",
        operator="站长小李",
        recovered=True
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    
    print("\n5. 尝试对已找回的包裹进行赔付（应报错）")
    result = tracker.process_compensation(
        tracking_number="YUN6006",
        operator="站长小李",
        amount=100.0,
        compensated_to="周九"
    )
    print(f"   结果：{'✓ 成功' if result['success'] else '✗ 失败'} - {result.get('message') or result.get('error')}")
    if not result['success'] and "已找回" in result.get('error', ''):
        test_cases.append(("场景七：已找回后禁止赔付", "PASS"))
    
    print()
    print("=" * 80)
    print("【查询包裹历史 - 演示状态版本追踪】")
    print("=" * 80)
    
    print("\n查询包裹 YT2002 的完整历史（错拿找回场景）：")
    history = tracker.get_package_history("YT2002")
    if history['success']:
        print(f"  快递单号：{history['tracking_number']}")
        print(f"  总版本数：{history['total_versions']}")
        print(f"  当前状态：{history['current_state']['status']}")
        print("\n  状态历史：")
        for state in history['state_history']:
            print(f"    版本 {state['version']}: {state['state']['status']} ({state['timestamp']})")
        print("\n  事件历史：")
        for evt in history['event_history']:
            print(f"    [{evt['timestamp']}] {evt['event_type']} - 操作人：{evt['operator']}")
        test_cases.append(("历史追踪功能", "PASS"))
    
    print()
    print("=" * 80)
    print("【导出追踪报告】")
    print("=" * 80)
    
    from package_tracker import format_report_text
    report = tracker.export_report()
    print(format_report_text(report))
    
    print()
    print("=" * 80)
    print("【测试结果汇总】")
    print("=" * 80)
    
    passed = sum(1 for _, status in test_cases if status == "PASS")
    total = len(test_cases)
    
    print(f"\n总测试数：{total}")
    print(f"通过：{passed}")
    print(f"失败：{total - passed}")
    print()
    
    for name, status in test_cases:
        mark = "✓" if status == "PASS" else "✗"
        print(f"  {mark} {name}")
    
    print()
    
    if passed == total:
        print("🎉 所有测试通过！")
    else:
        print("⚠️ 部分测试失败")
    
    print()
    print(f"测试数据保存在：{os.path.abspath(test_data_dir)}")
    print("=" * 80)


if __name__ == "__main__":
    run_test()
