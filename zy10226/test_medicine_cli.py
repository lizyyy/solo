#!/usr/bin/env python3
"""社区药箱补货 CLI 测试脚本"""

import sys
import os
import json
from datetime import date, timedelta
from io import StringIO

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from community_medicine import MedicineStore, MedicineValidator, MedicineService


class MockDate(date):
    """模拟日期类"""
    @classmethod
    def today(cls):
        return cls(2026, 5, 11)


def test_all_scenarios():
    """测试所有业务场景"""
    print("=" * 70)
    print("社区药箱补货 CLI - 自动化测试")
    print("=" * 70)
    
    if os.path.exists("data/medicine_data.json"):
        os.remove("data/medicine_data.json")
    
    store = MedicineStore()
    today = date(2026, 5, 11)
    validator = MedicineValidator(store, today)
    service = MedicineService(store, validator)
    
    passed = 0
    failed = 0
    
    print("\n" + "-" * 70)
    print("【测试1】添加药品")
    print("-" * 70)
    
    result = service.add_medicine(
        name="布洛芬缓释胶囊",
        unit="盒",
        min_stock=10,
        category="解热镇痛"
    )
    if result["success"]:
        med_id = result["medicine"]["id"]
        print(f"✓ 添加成功: {result['medicine']['name']} (ID: {med_id})")
        passed += 1
    else:
        print(f"✗ 添加失败: {result['reason']}")
        failed += 1
    
    print("\n【测试1.1】重复添加同一药品（去重）")
    result = service.add_medicine(
        name="布洛芬缓释胶囊",
        unit="盒",
        min_stock=10,
        category="解热镇痛"
    )
    if not result["success"] and "重复操作" in result["reason"]:
        print(f"✓ 去重有效: {result['reason']}")
        passed += 1
    else:
        print(f"✗ 去重失败: 应该拒绝重复添加")
        failed += 1
    
    result2 = service.add_medicine(
        name="碘伏消毒液",
        unit="瓶",
        min_stock=15,
        category="消毒用品"
    )
    if result2["success"]:
        med_id2 = result2["medicine"]["id"]
        print(f"✓ 添加成功: {result2['medicine']['name']}")
        passed += 1
    
    result3 = service.add_medicine(
        name="创可贴",
        unit="盒",
        min_stock=20,
        category="外伤处理"
    )
    if result3["success"]:
        med_id3 = result3["medicine"]["id"]
        print(f"✓ 添加成功: {result3['medicine']['name']}")
        passed += 1
    
    print("\n" + "-" * 70)
    print("【测试2】补货入库")
    print("-" * 70)
    
    expiry_normal = (today + timedelta(days=365)).strftime("%Y-%m-%d")
    expiry_soon = (today + timedelta(days=7)).strftime("%Y-%m-%d")
    
    result = service.replenish(
        medicine_id=med_id,
        batch_no="20260101",
        expiry_date=expiry_normal,
        quantity=5,
        source="社区医院捐赠",
        volunteer="张志愿者"
    )
    if result["success"]:
        inv_id1 = result["inventory_item"]["id"]
        print(f"✓ 补货成功: 库存ID={inv_id1}, 批次={result['inventory_item']['batch_no']}")
        passed += 1
    else:
        print(f"✗ 补货失败: {result['reason']}")
        failed += 1
    
    print("\n【测试2.1】同批号同来源重复入库（应拒绝）")
    result = service.replenish(
        medicine_id=med_id,
        batch_no="20260101",
        expiry_date=expiry_normal,
        quantity=3,
        source="社区医院捐赠",
        volunteer="张志愿者"
    )
    if not result["success"] and "同批号同来源已存在" in result["reason"]:
        print(f"✓ 同批号同来源被正确拒绝: {result['reason']}")
        passed += 1
    else:
        print(f"✗ 同批号同来源应该被拒绝")
        failed += 1
    
    print("\n【测试2.2】不同来源同批号（应创建新记录）")
    result = service.replenish(
        medicine_id=med_id,
        batch_no="20260101",
        expiry_date=expiry_normal,
        quantity=8,
        source="居民李XX捐赠",
        volunteer="王志愿者"
    )
    if result["success"]:
        inv_id2 = result["inventory_item"]["id"]
        print(f"✓ 不同来源补货成功: {result['inventory_item']['source']}")
        passed += 1
    
    print("\n【测试2.3】重复提交相同补货（去重）")
    result = service.replenish(
        medicine_id=med_id,
        batch_no="20260102",
        expiry_date=expiry_normal,
        quantity=3,
        source="社区医院捐赠",
        volunteer="张志愿者"
    )
    if result["success"]:
        print(f"✓ 新批号补货成功")
        passed += 1
        result2 = service.replenish(
            medicine_id=med_id,
            batch_no="20260102",
            expiry_date=expiry_normal,
            quantity=3,
            source="社区医院捐赠",
            volunteer="张志愿者"
        )
        if not result2["success"] and "同批号同来源已存在" in result2["reason"]:
            print(f"✓ 去重有效: {result2['reason']}")
            passed += 1
        else:
            print(f"✗ 去重失败")
            failed += 1
    else:
        print(f"✗ 新批号补货失败: {result.get('reason', '未知')}")
        failed += 1
    
    print("\n" + "-" * 70)
    print("【测试3】居民领用")
    print("-" * 70)
    
    result = service.use_medicine(
        inventory_id=inv_id1,
        quantity=2,
        resident="居民张XX",
        allow_expired_days=0
    )
    if result["success"]:
        print(f"✓ 领用成功: 剩余库存={result['remaining_quantity']}")
        passed += 1
    else:
        print(f"✗ 领用失败: {result['reason']}")
        failed += 1
    
    print("\n【测试3.1】领用量超过库存")
    result = service.use_medicine(
        inventory_id=inv_id1,
        quantity=100,
        resident="居民李XX",
        allow_expired_days=0
    )
    if not result["success"] and "超过库存" in result["reason"]:
        print(f"✓ 库存检查有效: {result['reason']}")
        passed += 1
    else:
        print(f"✗ 库存检查失败")
        failed += 1
    
    print("\n【测试3.2】过期药领用（宽限期内）")
    expired_5days = (today - timedelta(days=5)).strftime("%Y-%m-%d")
    replenish_result = service.replenish(
        medicine_id=med_id2,
        batch_no="20251201",
        expiry_date=expired_5days,
        quantity=4,
        source="居民王XX捐赠",
        volunteer="赵志愿者"
    )
    if replenish_result["success"]:
        inv_id_exp = replenish_result["inventory_item"]["id"]
        result = service.use_medicine(
            inventory_id=inv_id_exp,
            quantity=1,
            resident="居民李XX",
            allow_expired_days=7
        )
        if result["success"]:
            print(f"✓ 过期5天在宽限期7天内，领用成功")
            passed += 1
        else:
            print(f"✗ 宽限期处理错误: {result['reason']}")
            failed += 1
    
    print("\n【测试3.3】过期药领用（超出宽限期）")
    expired_60days = (today - timedelta(days=60)).strftime("%Y-%m-%d")
    replenish_result = service.replenish(
        medicine_id=med_id3,
        batch_no="20241201",
        expiry_date=expired_60days,
        quantity=3,
        source="居民刘XX捐赠",
        volunteer="张志愿者"
    )
    if replenish_result["success"]:
        inv_id_exp2 = replenish_result["inventory_item"]["id"]
        result = service.use_medicine(
            inventory_id=inv_id_exp2,
            quantity=1,
            resident="居民王XX",
            allow_expired_days=7
        )
        if not result["success"] and "超过宽限期" in result["reason"]:
            print(f"✓ 过期60天超出宽限期7天，拒绝领用")
            passed += 1
        else:
            print(f"✗ 宽限期检查错误")
            failed += 1
    
    print("\n【测试3.4】重复领用（去重）")
    result = service.use_medicine(
        inventory_id=inv_id1,
        quantity=2,
        resident="居民张XX",
        allow_expired_days=0
    )
    if not result["success"] and "重复操作" in result["reason"]:
        print(f"✓ 去重有效: {result['reason']}")
        passed += 1
    else:
        print(f"✗ 领用去重失败")
        failed += 1
    
    print("\n" + "-" * 70)
    print("【测试4】下架药品")
    print("-" * 70)
    
    result = service.offline(
        inventory_id=inv_id_exp2,
        reason="过期下架",
        operator="王志愿者"
    )
    if result["success"]:
        print(f"✓ 下架成功: 原因={result['offline_record']['reason']}")
        passed += 1
    else:
        print(f"✗ 下架失败: {result['reason']}")
        failed += 1
    
    print("\n【测试4.1】已下架药品不能再次下架（状态检查）")
    result = service.offline(
        inventory_id=inv_id_exp2,
        reason="过期下架",
        operator="王志愿者"
    )
    if not result["success"] and "已下架" in result["reason"]:
        print(f"✓ 状态检查有效: {result['reason']}")
        passed += 1
    else:
        print(f"✗ 下架状态检查失败")
        failed += 1
    
    print("\n【测试4.2】已下架药品不能领用")
    result = service.use_medicine(
        inventory_id=inv_id_exp2,
        quantity=1,
        resident="居民刘XX",
        allow_expired_days=100
    )
    if not result["success"] and "已下架" in result["reason"]:
        print(f"✓ 已下架药品不能领用: {result['reason']}")
        passed += 1
    else:
        print(f"✗ 下架状态检查失败")
        failed += 1
    
    print("\n" + "-" * 70)
    print("【测试5】下架后补回")
    print("-" * 70)
    
    result = service.replenish_offline(
        inventory_id=inv_id_exp2,
        quantity=5,
        volunteer="李志愿者"
    )
    if result["success"]:
        print(f"✓ 补回成功: 数量={result['replenish_record']['quantity']}")
        passed += 1
    else:
        print(f"✗ 补回失败: {result['reason']}")
        failed += 1
    
    print("\n【测试5.1】已补回（active状态）不能再次补回（状态检查）")
    result = service.replenish_offline(
        inventory_id=inv_id_exp2,
        quantity=5,
        volunteer="李志愿者"
    )
    if not result["success"] and "不在下架状态" in result["reason"]:
        print(f"✓ 状态检查有效: {result['reason']}")
        passed += 1
    else:
        print(f"✗ 补回状态检查失败")
        failed += 1
    
    print("\n【测试5.2】完整的下架-补回循环测试")
    result = service.offline(
        inventory_id=inv_id_exp2,
        reason="再次检查下架",
        operator="赵志愿者"
    )
    if result["success"]:
        print(f"✓ 再次下架成功（从active状态下架）")
        passed += 1
        
        result2 = service.replenish_offline(
            inventory_id=inv_id_exp2,
            quantity=2,
            volunteer="张志愿者"
        )
        if result2["success"]:
            print(f"✓ 再次补回成功")
            passed += 1
        else:
            print(f"✗ 再次补回失败: {result2['reason']}")
            failed += 1
    else:
        print(f"✗ 再次下架失败: {result['reason']}")
        failed += 1
    
    print("\n" + "-" * 70)
    print("【测试6】库存状态报告")
    print("-" * 70)
    
    status = service.get_inventory_status(warning_days=30)
    
    print(f"\n【可用库存】共 {len(status['available_stock'])} 种药品")
    for mid, info in status["available_stock"].items():
        med = store.data["medicines"][mid]
        print(f"  {med['name']}: 有效库存 {info['total']} {med['unit']}")
        if info["batches"]:
            print(f"    有效批次:")
            for batch in info["batches"]:
                expire_status = f"剩余{batch['days_to_expire']}天" if batch['days_to_expire'] >= 0 else f"已过期{-batch['days_to_expire']}天"
                print(f"      - 批号{batch['batch_no']}: {batch['quantity']} {med['unit']} ({expire_status})")
        if info.get("expired_batches"):
            print(f"    已过期批次（不计入可用库存）:")
            for batch in info["expired_batches"]:
                print(f"      - 批号{batch['batch_no']}: {batch['quantity']} {med['unit']} (已过期{-batch['days_to_expire']}天)")
    
    print(f"\n【即将过期】共 {len(status['expiring_soon'])} 个批次")
    for item in status["expiring_soon"]:
        print(f"  - {item['medicine_name']}: 剩余{item['days_to_expire']}天")
    
    print(f"\n【需要补货】共 {len(status['need_replenish'])} 种药品")
    for item in status["need_replenish"]:
        print(f"  - {item['medicine_name']}: 有效库存{item['current_stock']} < 最低{item['min_stock']}, 缺口{item['deficit']}")
    
    print(f"\n【交接差异】共 {len(status['handover_diff'])} 个批次（含历史下架记录）")
    for item in status["handover_diff"]:
        status_str = "下架中" if item["current_status"] == "offline" else "已补回(active)"
        print(f"  - {item['medicine_name']}: 批号{item['batch_no']}, 下架{item['offline_count']}次, 当前状态:{status_str}")
    
    print("\n【验证库存口径修复】")
    chuangketie_info = status["available_stock"].get(med_id3, {})
    if chuangketie_info.get("total") == 0:
        print(f"✓ 已过期60天的创可贴不计入可用库存（有效库存={chuangketie_info.get('total')}）")
        print(f"✓ 已过期批次单独列出: {len(chuangketie_info.get('expired_batches', []))} 个批次")
        passed += 1
    else:
        print(f"✗ 库存口径错误: 过期创可贴不应计入可用库存，实际={chuangketie_info.get('total')}")
        failed += 1
    
    print("\n【验证交接差异修复】")
    if len(status["handover_diff"]) > 0:
        print(f"✓ 交接差异包含历史下架记录: {len(status['handover_diff'])} 个批次")
        has_replenished = any(item["current_status"] == "active" for item in status["handover_diff"])
        if has_replenished:
            print(f"✓ 包含已补回的批次（当前状态为 active）")
            passed += 1
        else:
            print(f"✗ 未包含已补回的批次")
            failed += 1
    else:
        print(f"✗ 交接差异应该包含历史下架记录")
        failed += 1
    
    print("\n【验证补货缺口计算】")
    need_replenish_names = [item["medicine_name"] for item in status["need_replenish"]]
    if "创可贴" in need_replenish_names:
        chuangketie_need = next(item for item in status["need_replenish"] if item["medicine_name"] == "创可贴")
        if chuangketie_need["current_stock"] == 0 and chuangketie_need["deficit"] == 20:
            print(f"✓ 创可贴补货缺口正确: 有效库存0，最低20，缺口20")
            passed += 1
        else:
            print(f"✗ 创可贴补货缺口错误: 有效库存={chuangketie_need['current_stock']}, 缺口={chuangketie_need['deficit']}")
            failed += 1
    else:
        print(f"✗ 创可贴应该在需要补货列表中")
        failed += 1
    
    print("\n" + "-" * 70)
    print("【测试7】验证数据持久化")
    print("-" * 70)
    
    store.save()
    print(f"✓ 数据已保存到: data/medicine_data.json")
    
    with open("data/medicine_data.json", "r", encoding="utf-8") as f:
        saved_data = json.load(f)
    
    print(f"\n数据概览:")
    print(f"  - 药品: {len(saved_data['medicines'])} 种")
    print(f"  - 库存记录: {len(saved_data['inventory'])} 条")
    print(f"  - 领用记录: {len(saved_data['usage_records'])} 条")
    print(f"  - 补货记录: {len(saved_data['replenish_records'])} 条")
    print(f"  - 下架记录: {len(saved_data['offline_records'])} 条")
    print(f"  - 操作历史: {len(saved_data['operations'])} 条")
    passed += 1
    
    print("\n" + "=" * 70)
    print(f"测试完成: 通过 {passed}/{passed + failed}")
    if failed == 0:
        print("✓ 所有测试通过！")
    else:
        print(f"✗ 有 {failed} 个测试失败")
    print("=" * 70)
    
    return failed == 0


if __name__ == "__main__":
    success = test_all_scenarios()
    sys.exit(0 if success else 1)
