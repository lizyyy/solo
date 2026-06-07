#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
推荐召回候选去重 - 演示脚本
实验平台负责人阿越给新人讲流程用
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src import DedupEngine, SliceManager, FeatureVersionManager
import json


def print_separator(title=""):
    print("\n" + "=" * 70)
    if title:
        print(f"  {title}")
        print("=" * 70)


def print_issue(issue, indent=2):
    prefix = " " * indent
    severity_map = {
        "WARNING": "⚠️  警告",
        "SUCCESS": "✅ 成功",
        "INFO": "ℹ️  信息"
    }
    sev = severity_map.get(issue.get("severity", "INFO"), issue.get("severity"))
    print(f"{prefix}{sev}: {issue.get('message', '')}")
    if issue.get("action_required"):
        print(f"{prefix}    → 处理建议: {issue['action_required']}")


def print_record_status(records):
    status_map = {
        "UNIQUE": "✅ 正常唯一",
        "DUPLICATE": "⚠️  重复待复核",
        "APPROVED_DUPLICATE": "✅ 复核通过",
        "REJECTED": "❌ 复核拒绝",
        "NEW_VERSION": "🔄 标记为新版本",
        "PENDING_REVIEW": "⏳ 待复核"
    }
    
    for r in records:
        status = status_map.get(r.dedup_status, r.dedup_status)
        review_flag = " 🔍 需策略产品复核" if r.review_required else ""
        dup_note = f" (与 {r.duplicate_of} 重复)" if r.duplicate_of else ""
        print(f"  {r.record_id} | {r.experiment_name}")
        print(f"    去重状态: {status}{review_flag}{dup_note}")
        if r.reviewer:
            print(f"    复核人: {r.reviewer} | 意见: {r.review_comment}")
        if r.notes:
            print(f"    备注: {r.notes}")
        print()


def main():
    print("""
╔══════════════════════════════════════════════════════════════╗
║          推荐召回候选去重 - 完整流程演示                        ║
║          实验平台负责人: 阿越                                   ║
╚══════════════════════════════════════════════════════════════╝
    """)

    data_dir = os.path.join(os.path.dirname(__file__), "data", "demo")

    fv_manager = FeatureVersionManager()
    dedup_engine = DedupEngine()
    slice_manager = SliceManager(feature_version_manager=fv_manager)

    print_separator("第一步: 导入初始特征版本表")
    fv_versions = fv_manager.load_versions_yaml(
        os.path.join(data_dir, "feature_versions.yaml")
    )
    fv_summary = fv_manager.batch_import(fv_versions)
    print(f"  导入特征版本: {fv_summary['new']} 个新版本, {fv_summary['updated']} 个更新")
    print(f"  当前活跃版本: {len(fv_manager.get_active_versions())} 个")
    for fv in fv_manager.get_all_versions():
        print(f"    {fv.version_id}: {fv.version_name}")

    print_separator("第二步: 导入参数YAML，执行去重检测")
    print("  (模拟算法同学提交了3条实验记录，其中有一条是误重跑)")
    print()
    
    records = dedup_engine.load_params_yaml(
        os.path.join(data_dir, "params.yaml")
    )
    dedup_summary = dedup_engine.batch_import(records)
    
    print(f"  导入结果: {dedup_summary['total']} 条记录")
    print(f"    - 正常唯一: {dedup_summary['unique']} 条")
    print(f"    - 检测重复: {dedup_summary['duplicate']} 条")
    print(f"    - 待策略复核: {dedup_summary['review_required']} 条")
    print()
    
    if dedup_summary['issues']:
        print("  检测到的问题:")
        for issue in dedup_summary['issues']:
            print_issue(issue)
    print()
    
    print("  各记录状态:")
    print_record_status(dedup_engine.get_all_records())

    print_separator("第三步: 策略产品复核重复记录")
    print("  (模拟策略产品小美查看后，确认 EXP-002 是误操作重跑，予以拒绝)")
    print()
    
    reviewed = dedup_engine.review_duplicate(
        record_id="EXP-002",
        reviewer="小美(策略产品)",
        decision="REJECT",
        comment="确实是手滑重跑了，与EXP-001完全一致，不需要保留"
    )
    
    if reviewed:
        print(f"  复核完成: {reviewed.record_id}")
        print(f"  最终状态: {reviewed.dedup_status}")
        print(f"  复核备注: {reviewed.notes}")
    
    print()
    print("  复核后状态:")
    print_record_status(dedup_engine.get_all_records())

    print_separator("第四步: 导入评测切片（含补录数据）")
    print("  (模拟评测平台第二天补录了旧口径数据)")
    print()
    
    slices = slice_manager.load_eval_slices(
        os.path.join(data_dir, "eval_slices.yaml")
    )
    slice_summary = slice_manager.batch_import(slices)
    
    print(f"  导入结果: {slice_summary['total']} 个切片")
    print(f"    - 新增: {slice_summary['new']} 个")
    print(f"    - 更新: {slice_summary['updated']} 个")
    print(f"    - 补录切片: {slice_summary['backfill']} 个")
    print()
    
    if slice_summary['issues']:
        print("  检测到的问题:")
        for issue in slice_summary['issues']:
            print_issue(issue)

    print_separator("第五步: 查看特征版本表更新")
    print("  (补录的旧口径切片带了新的特征版本，系统自动补充)")
    print()
    
    print("  当前特征版本列表:")
    for fv in fv_manager.get_all_versions():
        active_mark = "✅ 活跃" if fv.is_active else "⏸️  历史"
        print(f"    {fv.version_id}: {fv.version_name} [{active_mark}]")
        print(f"      特征数: {len(fv.feature_list)} 个")
        if fv.notes:
            print(f"      备注: {fv.notes}")
        print()
    
    print("  特征版本更新历史:")
    for h in fv_manager.get_update_history()[:5]:
        print(f"    {h['timestamp'][:19]} | {h['action']} | {h['version_id']}")

    print_separator("三种处理结果对比")
    print("""
  场景1: 顺利记录 (EXP-001)
    └─ 状态: UNIQUE → 正常入库，无需人工干预

  场景2: 同一批数据重复训练 (EXP-002)
    └─ 状态: DUPLICATE → PENDING_REVIEW → REJECTED
    └─ 关键点: 系统检测到重复后不自动处理，留给策略产品复核确认

  场景3: 评测切片补录旧口径 (SLICE-003-BACKFILL)
    └─ 状态: 补录切片 → 触发特征版本表自动更新
    └─ 关键点: FEAT-v2.0-LEGACY 自动加入版本表，确保历史数据可追溯
    """)

    print_separator("演示完成")
    print("""
  核心设计理念:
  1. 重复检测留痕不自动处理，把判断权交还给业务
  2. 评测切片补录联动特征版本表，保证数据口径完整
  3. 所有操作有记录，新人上手看一遍就懂
    """)


if __name__ == "__main__":
    main()
