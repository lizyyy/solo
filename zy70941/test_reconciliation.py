#!/usr/bin/env python3
"""
物流调度核对系统 - 测试脚本
用于验证核心功能是否正常工作
"""

import sys
import json
from datetime import datetime

sys.path.insert(0, '/Users/lzy/pro/solo/workspaces/zy70941')

from app.services import ReconciliationService
from app.utils import parse_waybill_csv, parse_tracks_json, parse_rules_json, read_file_content


def test_reconciliation():
    print("=" * 60)
    print("物流调度核对系统 - 功能测试")
    print("=" * 60)
    print()

    service = ReconciliationService()

    waybill_content = read_file_content("./samples/waybills.csv")
    track_content = read_file_content("./samples/tracks.json")
    rules_content = read_file_content("./samples/rules.json")

    waybills = parse_waybill_csv(waybill_content)
    tracks = parse_tracks_json(track_content)
    rules = parse_rules_json(rules_content)

    print(f"📊 数据加载完成:")
    print(f"   - 运单数量: {len(waybills)}")
    print(f"   - 轨迹数量: {len(tracks)}")
    print(f"   - 规则数量: {len(rules)}")
    print()

    batch_id = "BATCH_TEST_001"
    print(f"🚀 开始处理批次: {batch_id}")
    print("-" * 60)

    result = service.process_batch(batch_id, waybills, tracks, rules)

    print(f"✅ 处理完成:")
    print(f"   - 状态: {result.status}")
    print(f"   - 正常: {result.normal_count} 条")
    print(f"   - 待确认: {result.pending_count} 条")
    print(f"   - 失败: {result.failed_count} 条")
    print()

    print("=" * 60)
    print("📋 正常项明细")
    print("=" * 60)
    for item in result.normal_items:
        print(f"  ✅ {item['waybill_no']}: {item.get('remark', '')}")
    print()

    print("=" * 60)
    print("⚠️  待确认项明细")
    print("=" * 60)
    for item in result.pending_items:
        print(f"  ⏳ {item['waybill_no']}: {item.get('remark', '')}")
        print(f"     原因: {item.get('pending_reason', '')}")
        print(f"     建议: 人工核对中转节点状态记录，补全缺失的签收/发运信息")
    print()

    print("=" * 60)
    print("❌ 失败项明细（含原始字段和建议处理方式）")
    print("=" * 60)
    for item in result.failed_items:
        print(f"  ❌ {item.waybill_no}")
        print(f"     失败原因: {item.failure_reason}")
        print(f"     适用规则: {item.rule_applied}")
        print(f"     建议金额: {item.penalty_amount} 元" if item.penalty_amount else "     建议金额: 待确认")
        print(f"     处理建议: {item.suggested_action}")
        print(f"     原始字段预览: 发件人={item.original_data.get('sender')}, 收件人={item.original_data.get('receiver')}")
        print()

    print("=" * 60)
    print("🔄 幂等性测试（重复提交同批次）")
    print("=" * 60)
    result2 = service.process_batch(batch_id, waybills, tracks, rules)
    print(f"   重复提交结果: {result2.status}")
    print(f"   消息: {result2.message}")
    print()

    print("=" * 60)
    print("📦 中转节点信息展示")
    print("=" * 60)
    for wb in waybills[:3]:
        print(f"  运单 {wb.waybill_no}:")
        for node in wb.transit_nodes:
            arr = node.arrival_time.strftime("%m-%d %H:%M") if node.arrival_time else "N/A"
            dep = node.departure_time.strftime("%m-%d %H:%M") if node.departure_time else "N/A"
            print(f"     {node.node_name} ({node.node_code}): 到达 {arr}, 出发 {dep}, 状态: {node.status}")
    print()

    print("=" * 60)
    print("🎯 测试总结")
    print("=" * 60)
    all_passed = (
        result.status == "success"
        and result.normal_count == 4
        and result.pending_count == 1
        and result.failed_count == 2
        and result2.status == "duplicate"
    )
    if all_passed:
        print("✅ 所有测试通过！")
    else:
        print("❌ 部分测试未通过，请检查数据")
        print(f"   预期: 正常4, 待确认1, 失败2")
        print(f"   实际: 正常{result.normal_count}, 待确认{result.pending_count}, 失败{result.failed_count}")
        print()
        print("📋 详细校验:")
        print(f"   状态: {'✅' if result.status == 'success' else '❌'} {result.status}")
        print(f"   正常项: {'✅' if result.normal_count == 4 else '❌'} {result.normal_count} (预期4)")
        print(f"   待确认项: {'✅' if result.pending_count == 1 else '❌'} {result.pending_count} (预期1)")
        print(f"   失败项: {'✅' if result.failed_count == 2 else '❌'} {result.failed_count} (预期2)")
        print(f"   幂等性: {'✅' if result2.status == 'duplicate' else '❌'} {result2.status}")
    print()
    return all_passed


if __name__ == "__main__":
    success = test_reconciliation()
    sys.exit(0 if success else 1)
