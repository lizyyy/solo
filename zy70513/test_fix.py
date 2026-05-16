#!/usr/bin/env python3
"""测试修复验证脚本"""

from models import ConfigReceiptCreate, ReceiptStatus, DiffType
from service import ConfigReceiptService


def test_diff_report_accuracy():
    """测试差异报告统计准确性"""
    print("=" * 60)
    print("测试1: 差异报告统计准确性")
    print("=" * 60)
    
    service = ConfigReceiptService()
    
    # 创建一个有多种类型差异的配置
    expected = {
        "db.host": "localhost",
        "db.port": 3306,
        "log.level": "info",
        "timeout": 30
    }
    actual = {
        "db.host": "192.168.1.100",
        "db.port": "3306",
        "log.level": "debug",
        "extra.key": "should_not_exist"
    }
    
    create_data = ConfigReceiptCreate(
        service_name="order-service",
        config_version="v1.0.0",
        snapshot_version="20240115-001",
        instance_id="order-service-01",
        expected_config=expected,
        actual_config=actual
    )
    
    receipt = service.create_receipt(create_data)
    report = receipt.report
    
    print(f"总差异数: {report.diff_count}")
    print(f"差异类型分布: {report.details['diff_types']}")
    
    # 验证统计准确性
    type_count = len(report.details['diff_types'])
    total_counted = sum(report.details['diff_types'].values())
    
    print(f"\n验证结果:")
    print(f"  - 差异种类数: {type_count} (预期: 至少3种)")
    print(f"  - 统计总数: {total_counted}")
    print(f"  - 实际差异数: {len(receipt.diffs)}")
    print(f"  - 统计一致性: {'✓ 通过' if total_counted == len(receipt.diffs) else '✗ 失败'}")
    
    # 验证每种差异类型计数正确
    actual_types = {}
    for d in receipt.diffs:
        actual_types[d.diff_type] = actual_types.get(d.diff_type, 0) + 1
    
    match = actual_types == report.details['diff_types']
    print(f"  - 差异类型统计正确: {'✓ 通过' if match else '✗ 失败'}")
    
    if not match:
        print(f"    实际统计: {actual_types}")
        print(f"    报告统计: {report.details['diff_types']}")
    
    return match and total_counted == len(receipt.diffs)


def test_timeout_route_logic():
    """测试超时提醒逻辑"""
    print("\n" + "=" * 60)
    print("测试2: 超时提醒逻辑")
    print("=" * 60)
    
    service = ConfigReceiptService()
    
    # 创建正常的待处理记录
    create_data1 = ConfigReceiptCreate(
        service_name="payment-service",
        config_version="v2.0.0",
        snapshot_version="20240115-001",
        instance_id="payment-service-01"
    )
    receipt1 = service.create_receipt(create_data1)
    print(f"创建签收记录: {receipt1.id[:8]}... 状态: {receipt1.status}")
    
    # 手动创建一个已超时的记录
    from datetime import datetime, timedelta
    create_data2 = ConfigReceiptCreate(
        service_name="payment-service",
        config_version="v2.0.0",
        snapshot_version="20240115-001",
        instance_id="payment-service-02"
    )
    receipt2 = service.create_receipt(create_data2)
    receipt2.timeout_at = datetime.now() - timedelta(hours=1)  # 设为已超时
    
    # 查询超时记录
    timeouts = service.get_timeout_receipts()
    print(f"\n超时记录数: {len(timeouts)}")
    
    for t in timeouts:
        print(f"  - {t.instance_id}: 超时时间={t.timeout_at}")
    
    expected_count = 1
    match = len(timeouts) == expected_count
    print(f"\n验证结果:")
    print(f"  - 超时记录数正确: {'✓ 通过' if match else '✗ 失败'}")
    
    return match


def test_route_order_simulation():
    """模拟FastAPI路由顺序匹配测试"""
    print("\n" + "=" * 60)
    print("测试3: 路由顺序验证（逻辑验证）")
    print("=" * 60)
    
    # 验证路由定义顺序
    with open('/Users/lzy/pro/solo/workspaces/zy70513/main.py', 'r') as f:
        content = f.read()
    
    # 查找两个路由的位置
    timeout_pos = content.find('/api/receipts/timeout')
    receipt_id_pos = content.find('/api/receipts/{receipt_id}')
    
    print(f"'/api/receipts/timeout' 位置: {timeout_pos}")
    print(f"'/api/receipts/{{receipt_id}}' 位置: {receipt_id_pos}")
    
    correct_order = timeout_pos < receipt_id_pos and timeout_pos > 0 and receipt_id_pos > 0
    print(f"\n验证结果:")
    print(f"  - 路由顺序正确（timeout在receipt_id之前）: {'✓ 通过' if correct_order else '✗ 失败'}")
    
    return correct_order


def main():
    print("\n配置快照签收API - 问题修复验证\n")
    
    results = []
    results.append(("差异报告统计准确性", test_diff_report_accuracy()))
    results.append(("超时提醒逻辑", test_timeout_route_logic()))
    results.append(("路由顺序验证", test_route_order_simulation()))
    
    print("\n" + "=" * 60)
    print("验证总结")
    print("=" * 60)
    
    all_passed = True
    for name, passed in results:
        status = "✓ 通过" if passed else "✗ 失败"
        print(f"  {name}: {status}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✓ 所有测试通过！问题修复成功。")
    else:
        print("✗ 部分测试失败，请检查修复。")
    print("=" * 60)
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    exit(main())
