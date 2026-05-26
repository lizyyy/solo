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

    # ============================================================
    # 测试1：基于 batch_id 的幂等性
    # ============================================================
    print("=" * 60)
    print("🔄 测试1：基于 batch_id 的幂等性")
    print("=" * 60)
    batch_id = "BATCH_TEST_001"
    print(f"🚀 首次提交批次: {batch_id}")

    result = service.process_batch(batch_id, waybills, tracks, rules)

    print(f"✅ 首次处理完成:")
    print(f"   - 状态: {result.status}")
    print(f"   - 正常: {result.normal_count} 条")
    print(f"   - 待确认: {result.pending_count} 条")
    print(f"   - 失败: {result.failed_count} 条")
    print()

    print(f"🔄 重复提交同一 batch_id: {batch_id}")
    result2 = service.process_batch(batch_id, waybills, tracks, rules)
    print(f"   重复提交结果: {result2.status}")
    print(f"   消息: {result2.message}")
    print()

    test1_pass = result.status == "success" and result2.status == "duplicate"
    print(f"   测试1结果: {'✅ 通过' if test1_pass else '❌ 失败'}")
    print()

    # ============================================================
    # 测试2：基于内容哈希的去重
    # ============================================================
    print("=" * 60)
    print("� 测试2：基于内容哈希的去重")
    print("=" * 60)

    content_hash = service.generate_content_hash(waybill_content, track_content, rules_content)
    print(f"📝 生成内容哈希: {content_hash[:16]}...")
    print()

    service2 = ReconciliationService()

    print(f"🚀 首次提交（不指定 batch_id，使用内容哈希去重）")
    auto_batch_id = service2.generate_batch_id()
    result3 = service2.process_batch(auto_batch_id, waybills, tracks, rules)
    service2.register_content_hash(content_hash, auto_batch_id)
    print(f"   生成批次ID: {auto_batch_id}")
    print(f"   状态: {result3.status}")
    print()

    print(f"🔄 再次提交相同内容（检查内容哈希）")
    existing_batch = service2.get_batch_by_content_hash(content_hash)
    print(f"   内容哈希匹配的批次: {existing_batch}")
    print()

    test2_pass = existing_batch == auto_batch_id
    print(f"   测试2结果: {'✅ 通过' if test2_pass else '❌ 失败'}")
    print()

    # ============================================================
    # 测试3：核对逻辑验证
    # ============================================================
    print("=" * 60)
    print("📋 测试3：核对逻辑验证")
    print("=" * 60)
    print()

    print("📋 正常项明细:")
    for item in result.normal_items:
        print(f"  ✅ {item['waybill_no']}: {item.get('remark', '')}")
    print()

    print("⚠️  待确认项明细:")
    for item in result.pending_items:
        print(f"  ⏳ {item['waybill_no']}: {item.get('remark', '')}")
        print(f"     原因: {item.get('pending_reason', '')}")
    print()

    print("❌ 失败项明细:")
    for item in result.failed_items:
        print(f"  ❌ {item.waybill_no}")
        print(f"     失败原因: {item.failure_reason[:60]}...")
        print(f"     建议金额: {item.penalty_amount} 元" if item.penalty_amount else "     建议金额: 待确认")
    print()

    test3_pass = (
        result.normal_count == 4
        and result.pending_count == 1
        and result.failed_count == 2
    )
    print(f"   测试3结果: {'✅ 通过' if test3_pass else '❌ 失败'}")
    print(f"   预期: 正常4, 待确认1, 失败2")
    print(f"   实际: 正常{result.normal_count}, 待确认{result.pending_count}, 失败{result.failed_count}")
    print()

    # ============================================================
    # 测试4：中转节点信息
    # ============================================================
    print("=" * 60)
    print("📦 测试4：中转节点信息展示")
    print("=" * 60)
    for wb in waybills[:3]:
        print(f"  运单 {wb.waybill_no}:")
        for node in wb.transit_nodes:
            arr = node.arrival_time.strftime("%m-%d %H:%M") if node.arrival_time else "N/A"
            dep = node.departure_time.strftime("%m-%d %H:%M") if node.departure_time else "N/A"
            print(f"     {node.node_name} ({node.node_code}): 到达 {arr}, 出发 {dep}, 状态: {node.status}")
    print()

    # ============================================================
    # 测试总结
    # ============================================================
    print("=" * 60)
    print("🎯 测试总结")
    print("=" * 60)
    all_passed = test1_pass and test2_pass and test3_pass
    if all_passed:
        print("✅ 所有测试通过！")
    else:
        print("❌ 部分测试未通过")
        print()
        print("📋 详细校验:")
        print(f"   测试1 (batch_id幂等性): {'✅' if test1_pass else '❌'}")
        print(f"   测试2 (内容哈希去重): {'✅' if test2_pass else '❌'}")
        print(f"   测试3 (核对逻辑): {'✅' if test3_pass else '❌'}")
    print()
    return all_passed


if __name__ == "__main__":
    success = test_reconciliation()
    sys.exit(0 if success else 1)
