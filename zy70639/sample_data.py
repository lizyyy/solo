#!/usr/bin/env python3
"""
样例数据生成器
包含：正常输入、脏数据、边界冲突、空结果
"""

import sys
import json
import os
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from models import (
    DonationBatch, ClothingItem, DisinfectRecord, DonationRecord,
    EliminateRecord, Organization, ClothingStatus, ClothingCategory,
    DisinfectMethod, EliminateReason
)
from tracker import DataStore, ClothingTracker


def setup_clean_data_dir():
    """清空数据目录"""
    data_dir = Path("./data")
    if data_dir.exists():
        shutil.rmtree(data_dir)
    data_dir.mkdir(exist_ok=True)
    
    reports_dir = Path("./reports")
    if reports_dir.exists():
        shutil.rmtree(reports_dir)
    reports_dir.mkdir(exist_ok=True)


def generate_normal_sample():
    """生成正常流程样例数据"""
    print("=== 生成正常流程样例数据 ===")
    
    setup_clean_data_dir()
    store = DataStore()
    tracker = ClothingTracker(store)
    
    print("1. 添加转赠机构...")
    org1 = Organization(
        org_id="ORG001",
        name="阳光社区服务中心",
        contact="张主任",
        phone="13800138001",
        address="北京市朝阳区阳光路100号",
        description="社区公益组织，帮扶困难家庭"
    )
    org2 = Organization(
        org_id="ORG002",
        name="爱心助学基金会",
        contact="李老师",
        phone="13800138002",
        address="上海市浦东新区爱心路200号",
        description="面向山区学生的助学组织"
    )
    store.add_organization(org1)
    store.add_organization(org2)
    print(f"   - 添加机构: {org1.name}, {org2.name}")
    
    print("2. 添加捐赠批次...")
    batch1 = DonationBatch(
        batch_id="BATCH20240115_001",
        donor_name="王女士",
        donor_contact="13900139001",
        receive_date="2024-01-15",
        total_count=8,
        description="家庭闲置衣物，成色较好"
    )
    store.add_batch(batch1)
    print(f"   - 批次 {batch1.batch_id}: {batch1.donor_name}，申报{batch1.total_count}件")
    
    print("3. 添加衣物并完成全流程...")
    
    item1 = ClothingItem(
        item_id="ITEM00000001",
        batch_id="BATCH20240115_001",
        category=ClothingCategory.OUTERWEAR,
        description="藏青色羊毛大衣",
        brand="优衣库",
        size="L",
        color="藏青"
    )
    store.add_item(item1)
    tracker.sort_item("ITEM00000001", "分拣员A", "成色较新，无污渍")
    tracker.disinfect_item("ITEM00000001", DisinfectMethod.UV, "消毒员A", 30, None, "紫外线消毒完成")
    tracker.donate_item("ITEM00000001", "ORG001", "管理员A", "困难家庭刘先生", "已签收")
    print("   - 物品1: 羊毛大衣 → 已转赠")
    
    item2 = ClothingItem(
        item_id="ITEM00000002",
        batch_id="BATCH20240115_001",
        category=ClothingCategory.TOP,
        description="白色纯棉T恤",
        brand="无印良品",
        size="M",
        color="白色"
    )
    store.add_item(item2)
    tracker.sort_item("ITEM00000002", "分拣员A", "全新未拆封")
    tracker.disinfect_item("ITEM00000002", DisinfectMethod.HIGH_TEMPERATURE, "消毒员A", 45, 85.0)
    tracker.donate_item("ITEM00000002", "ORG002", "管理员A", "山区小学")
    print("   - 物品2: T恤 → 已转赠")
    
    item3 = ClothingItem(
        item_id="ITEM00000003",
        batch_id="BATCH20240115_001",
        category=ClothingCategory.BOTTOM,
        description="蓝色牛仔裤",
        brand="李维斯",
        size="32",
        color="蓝色"
    )
    store.add_item(item3)
    tracker.sort_item("ITEM00000003", "分拣员A", "轻微磨损，整体良好")
    tracker.disinfect_item("ITEM00000003", DisinfectMethod.WASH_DRY, "消毒员B", 60)
    print("   - 物品3: 牛仔裤 → 已消毒待转赠")
    
    item4 = ClothingItem(
        item_id="ITEM00000004",
        batch_id="BATCH20240115_001",
        category=ClothingCategory.SHOES,
        description="白色运动鞋",
        brand="耐克",
        size="42",
        color="白色"
    )
    store.add_item(item4)
    tracker.sort_item("ITEM00000004", "分拣员B", "鞋底磨损严重")
    tracker.eliminate_item("ITEM00000004", EliminateReason.DAMAGED, "审核员A", "鞋底开裂，无法穿着")
    print("   - 物品4: 运动鞋 → 已淘汰(破损)")
    
    item5 = ClothingItem(
        item_id="ITEM00000005",
        batch_id="BATCH20240115_001",
        category=ClothingCategory.TOP,
        description="灰色羊毛衫",
        brand="恒源祥",
        size="XL",
        color="灰色"
    )
    store.add_item(item5)
    tracker.sort_item("ITEM00000005", "分拣员B", "有明显霉斑")
    tracker.eliminate_item("ITEM00000005", EliminateReason.MOLDY, "审核员A", "霉斑面积较大")
    print("   - 物品5: 羊毛衫 → 已淘汰(发霉)")
    
    print("\n✓ 正常样例数据生成完成!")
    print(f"  批次: 1个")
    print(f"  衣物: 5件")
    print(f"  转赠: 2件")
    print(f"  消毒: 3件")
    print(f"  淘汰: 2件")


def generate_dirty_data_sample():
    """生成脏数据样例（包含各种数据异常）"""
    print("\n=== 生成脏数据样例 ===")
    
    setup_clean_data_dir()
    data_dir = Path("./data")
    
    dirty_batches = [
        {
            "batch_id": "BATCH_DIRTY_001",
            "donor_name": "",
            "donor_contact": "不是电话",
            "receive_date": "不是日期",
            "total_count": -5,
            "received_count": 100,
            "description": "申报数量负数"
        },
        {
            "batch_id": "BATCH_DIRTY_002",
            "donor_name": "测试用户",
            "donor_contact": None,
            "receive_date": "2024-13-45",
            "total_count": None,
            "description": "空字段测试"
        }
    ]
    
    with open(data_dir / "batches.json", 'w', encoding='utf-8') as f:
        json.dump(dirty_batches, f, ensure_ascii=False, indent=2)
    
    dirty_items = [
        {
            "item_id": "ITEM_DIRTY_001",
            "batch_id": "不存在的批次",
            "category": "不存在的分类",
            "description": "",
            "status": "不存在的状态"
        },
        {
            "item_id": "ITEM_DIRTY_002",
            "batch_id": "BATCH_DIRTY_001",
            "category": "上衣",
            "description": None,
            "brand": None,
            "size": None,
            "status": None
        }
    ]
    
    with open(data_dir / "items.json", 'w', encoding='utf-8') as f:
        json.dump(dirty_items, f, ensure_ascii=False, indent=2)
    
    print("脏数据样例包含:")
    print("  - 负数数量")
    print("  - 空字段")
    print("  - 无效日期")
    print("  - 无效外键引用")
    print("  - 无效枚举值")
    print("  - None值")


def generate_conflict_sample():
    """生成边界冲突样例"""
    print("\n=== 生成边界冲突样例 ===")
    
    setup_clean_data_dir()
    store = DataStore()
    tracker = ClothingTracker(store)
    
    batch = DonationBatch(
        batch_id="BATCH_CONFLICT_001",
        donor_name="冲突测试",
        donor_contact="13800000000",
        receive_date="2024-01-01",
        total_count=5,
        description="用于测试数据一致性冲突"
    )
    store.add_batch(batch)
    
    org = Organization(
        org_id="ORG_CONFLICT",
        name="测试机构",
        contact="测试",
        phone="13800000000"
    )
    store.add_organization(org)
    
    for i in range(1, 6):
        item = ClothingItem(
            item_id=f"ITEM_CONFLICT_{i:03d}",
            batch_id="BATCH_CONFLICT_001",
            category=ClothingCategory.TOP,
            description=f"测试衣物{i}",
            status=ClothingStatus.WAITING_SORT
        )
        store.add_item(item)
    
    items = store._load_json(store.items_file)
    
    items[0]["status"] = ClothingStatus.DISINFECTED.value
    items[1]["status"] = ClothingStatus.DONATED.value
    items[2]["status"] = ClothingStatus.ELIMINATED.value
    
    store._save_json(store.items_file, items)
    
    print("边界冲突样例包含:")
    print("  - 已消毒但无消毒记录")
    print("  - 已转赠但无消毒和转赠记录")
    print("  - 已淘汰但无淘汰记录")
    print("  - 状态与记录不一致")


def generate_empty_sample():
    """生成空结果样例"""
    print("\n=== 空结果样例 ===")
    
    setup_clean_data_dir()
    print("所有数据文件已清空")
    print("查询将返回空结果")


def main():
    if len(sys.argv) < 2:
        print("用法: python sample_data.py [normal|dirty|conflict|empty|all]")
        return
    
    scenario = sys.argv[1]
    
    if scenario == "normal":
        generate_normal_sample()
    elif scenario == "dirty":
        generate_dirty_data_sample()
    elif scenario == "conflict":
        generate_conflict_sample()
    elif scenario == "empty":
        generate_empty_sample()
    elif scenario == "all":
        generate_normal_sample()
        generate_dirty_data_sample()
        generate_conflict_sample()
        generate_empty_sample()
    else:
        print(f"未知场景: {scenario}")


if __name__ == "__main__":
    main()
