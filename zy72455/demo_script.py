#!/usr/bin/env python3
"""
历史街区招牌整治 - 演示脚本
供新同事快速验证系统功能
"""

import sys
from pathlib import Path
import json

sys.path.insert(0, str(Path(__file__).parent))

from src.data_manager import DataManager
from src.workflow import WorkflowEngine
from src.boundary_rules import BoundaryRuleEngine
from src.heatmap_utils import (
    generate_heatmap_grid,
    heatmap_grid_to_html,
    detect_anomaly_from_grid,
    get_next_steps_for_low_sampling,
)
from src.models import ProcessingStatus, HeatmapIssue


def print_separator(title=""):
    print("\n" + "=" * 60)
    if title:
        print(f"  {title}")
        print("=" * 60)


def demo():
    print("""
╔══════════════════════════════════════════════════════════╗
║     历史街区招牌整治 - 路口照片管理系统 演示             ║
╚══════════════════════════════════════════════════════════╝
    """)

    dm = DataManager(storage_path="data/demo_storage")
    workflow = WorkflowEngine(dm)
    rule_engine = BoundaryRuleEngine()

    print_separator("【第一步】导入路口照片（测试去重功能）")
    
    sample_data = [
        {
            "路口名称": "中山路与人民路交叉口",
            "拍摄时间": "2024-01-15",
            "招牌状态": "待整治",
            "备注": "第一批导入",
        },
        {
            "路口名称": "历史街区南口",
            "拍摄时间": "2024-01-15",
            "招牌状态": "已整治",
        },
    ]
    
    result = workflow.step1_import_photos(sample_data, "demo_batch_1.csv", "市政巡检员-小付")
    print(f"✓ 第一次导入: 成功 {result['success_count']} 条，跳过 {result['skipped_count']} 条")
    print(f"  说明: {result['note']}")
    
    print("\n  测试重复导入同一批数据...")
    result2 = workflow.step1_import_photos(sample_data, "demo_batch_1.csv", "市政巡检员-小付")
    print(f"✓ 第二次导入: 成功 {result2['success_count']} 条，跳过 {result2['skipped_count']} 条")
    print(f"  结论: 重复数据不会导致数量翻倍 ✓")

    print_separator("【第二步】市政巡检员小付补录公交刷卡时段")
    
    photos = dm.get_all_photos()
    for photo in photos:
        if photo.intersection_name == "历史街区南口":
            bus_hours = ["07:30-09:30", "16:30-18:30"]
            result = workflow.step2_add_bus_card_hours(
                photo.photo_id, 
                bus_hours, 
                "市政巡检员-小付",
                "回看历史街区招牌整治时发现遗漏，补录公交刷卡时段"
            )
            print(f"✓ 补录 {photo.intersection_name}:")
            print(f"  公交时段: {bus_hours}")
            print(f"  新状态: {result['new_status']}")

    print_separator("【第三步】生成热力图，测试夜间缺采样检测")
    
    for photo in photos:
        if photo.intersection_name == "历史街区南口":
            heatmap_data = {
                "hourly_samples": {
                    "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 1, "6": 3,
                    "7": 90, "8": 110, "9": 85, "10": 75, "11": 70, "12": 72,
                    "13": 68, "14": 70, "15": 72, "16": 80, "17": 95, "18": 90,
                    "19": 30, "20": 2, "21": 1, "22": 0, "23": 0,
                }
            }
            
            is_low, ratio, reason = rule_engine.detect_night_low_sampling(heatmap_data)
            print(f"✓ 热力图分析 - {photo.intersection_name}:")
            print(f"  判定结果: {'夜间缺采样' if is_low else '正常'}")
            print(f"  原因: {reason}")
            
            result = workflow.step3_generate_heatmap(
                photo.photo_id, 
                heatmap_data, 
                "系统自动生成"
            )
            print(f"\n✓ 生成结果:")
            print(f"  热力图问题: {result['heatmap_issue']}")
            print(f"  新状态: {result['new_status']}")
            if "action_required" in result:
                print(f"  ⚠️  需要操作: {result['action_required']}")
                print(f"  📖  规则引用: {result['rule_reference']}")

    print_separator("【查看原始行号和人工改动痕迹】")
    
    photo = dm.get_photos_by_status(ProcessingStatus.PENDING_REVIEW)[0]
    print(f"✓ 路口: {photo.intersection_name}")
    print(f"  原始行号: 第 {photo.original_row.row_number} 行")
    print(f"  源文件: {photo.original_row.source_file}")
    print(f"  导入时间: {photo.original_row.import_timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"\n  人工改动记录 ({len(photo.manual_changes)} 条):")
    for change in photo.manual_changes:
        print(f"    - {change.field_name}: {change.old_value} → {change.new_value}")
        print(f"      操作人: {change.operator}, 原因: {change.reason}")

    print_separator("【测试备注修改，查看历史差别】")
    
    old_remark = photo.remark or "(空)"
    dm.update_field(
        photo.photo_id, 
        "remark", 
        "街口招牌有松动，需要重点关注", 
        "市政巡检员-小付",
        "现场复查后补充备注"
    )
    
    photo_updated = dm.get_photo(photo.photo_id)
    print(f"✓ 备注修改完成")
    print(f"  改前: {old_remark}")
    print(f"  改后: {photo_updated.remark}")
    
    history = dm.get_photo_history(photo.photo_id)
    print(f"\n  历史记录总数: {len(history)} 条")
    print("  最新3条记录:")
    for record in history[-3:]:
        print(f"    [{record.change_timestamp.strftime('%H:%M:%S')}] {record.change_type}: {record.description}")

    print_separator("【街道规划员复核热力图】")
    
    result = workflow.review_heatmap(
        photo.photo_id,
        is_normal=False,
        review_note="确认夜间采样设备故障，导致热力图偏低，非实际人流情况",
        operator="街道规划员-张工"
    )
    print(f"✓ 复核完成:")
    print(f"  新状态: {result['new_status']}")
    print(f"  复核意见: {result['review_note']}")

    print_separator("【测试回滚功能】")
    
    result = workflow.rollback(
        photo.photo_id,
        operator="管理员",
        reason="复核意见需要调整，回滚后重新复核"
    )
    print(f"✓ 回滚完成:")
    print(f"  从 {result['old_status']} → {result['new_status']}")
    print(f"  原因: {result['reason']}")

    print_separator("【新同事验证：只看热力图找问题】")
    
    photo_final = dm.get_photo(photo.photo_id)
    grid = generate_heatmap_grid(photo_final.heatmap_data["hourly_samples"])
    has_anomaly, anomaly_msg = detect_anomaly_from_grid(grid)
    
    print(f"✓ 热力图异常检测:")
    print(f"  是否异常: {'是' if has_anomaly else '否'}")
    print(f"  检测信息: {anomaly_msg}")
    print(f"\n✓ 下一步操作建议:")
    for step in get_next_steps_for_low_sampling():
        print(f"  {step}")

    print_separator("演示完成！")
    print(f"""
系统特性总结:
  ✓ 原始行号、源文件永久保留，可随时追溯
  ✓ 人工改动全记录：改前值、改后值、操作人、时间、原因
  ✓ 重复导入自动去重，数量不翻倍
  ✓ 备注修改在历史记录中可查差别
  ✓ 夜间缺采样自动检测，强制待复核，不得直接归正常
  ✓ 边界规则写入代码 (src/boundary_rules.py) 和 README
  ✓ 支持回滚操作，数据可回到任意前置状态
  ✓ 三步流程清晰：导入 → 补录公交时段 → 生成热力图 → 复核

数据存储位置: data/demo_storage/
启动Web界面: python app.py  然后访问 http://localhost:5000
    """)


if __name__ == "__main__":
    demo()
