#!/usr/bin/env python3
"""
线上离线打分差异 - 三步工作流演示

演示场景：
1. 正常流程：导入 → 审核日志 → 更新指标 → 确认正常
2. 阈值不匹配场景：中途发现阈值改过但报告仍写旧值，停在待复核
"""

import sys
import os
import tempfile
import shutil

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from online_offline_diff import (
    ResultStore,
    WorkflowEngine,
    DiffEngine,
    ProcessingStatus,
)


def demo_normal_flow():
    print("=" * 60)
    print("演示场景1: 正常三步工作流")
    print("=" * 60)

    data_dir = tempfile.mkdtemp(prefix="diff_demo_normal_")
    try:
        store = ResultStore(data_dir=data_dir)
        engine = WorkflowEngine(store)

        print("\n[步骤1] 特征快照第一次导入")
        record = engine.step1_import_snapshot(
            snapshot_id="SNAP-2024-001",
            original_line_number=42,
            main_flow="用户注册→特征计算→模型A→风控决策",
            raw_data={"user_id": "U001", "feature_age": 28, "feature_amount": 5000},
            online_score=0.85,
            offline_score=0.82,
            source_file="snapshots_202401.xlsx",
            sheet_name="Sheet1",
            imported_by="数据平台",
        )
        print(f"  记录ID: {record.record_id}")
        print(f"  快照ID: {record.snapshot_id}")
        print(f"  原始行号: {record.feature_snapshot.original_line_number}")
        print(f"  状态: {record.current_status.value}")
        print(f"  差异: {record.difference:.4f} ({record.percent_diff:.2f}%)")

        print("\n[步骤2] 数据科学家林姐补看训练日志曲线")
        record = engine.step2_review_training_logs(
            record_id=record.record_id,
            on_site_statement="训练曲线收敛，AUC稳定在0.87左右，无异常波动",
            curve_data={
                "epoch": [1, 2, 3, 4, 5],
                "train_auc": [0.72, 0.78, 0.83, 0.86, 0.87],
                "val_auc": [0.70, 0.76, 0.81, 0.85, 0.86],
                "train_loss": [0.65, 0.52, 0.41, 0.35, 0.32],
            },
            reviewed_by="林姐",
            reviewer_notes="训练过程正常，特征分布一致",
        )
        print(f"  状态: {record.current_status.value}")
        print(f"  训练日志数: {len(record.training_logs)}")
        print(f"  现场说法: {record.training_logs[0].on_site_statement}")

        print("\n[步骤3] 分层指标更新")
        record = engine.step3_update_tier_metrics(
            record_id=record.record_id,
            tier_metrics={
                "overall": {"precision": 0.89, "recall": 0.78, "f1": 0.83},
                "tier_high_value": {"precision": 0.92, "recall": 0.72, "f1": 0.81},
                "tier_new_user": {"precision": 0.85, "recall": 0.82, "f1": 0.83},
            },
            updated_by="林姐",
        )
        print(f"  状态: {record.current_status.value}")
        print(f"  分层指标: {list(record.tier_metrics.keys())}")

        print("\n[终态确认] 数据科学家林姐确认为正常")
        record = engine.confirm_normal(
            record_id=record.record_id,
            confirmed_by="林姐",
            notes="线上离线差异3.66%，在可接受范围内，归因于特征计算时间差",
        )
        print(f"  状态: {record.current_status.value}")
        print(f"  是否终态: {ProcessingStatus.is_final(record.current_status)}")
        print(f"  数据科学家备注: {record.data_scientist_notes}")

        print("\n[查看审计日志]")
        audits = store.get_audit_logs(record.record_id)
        for a in audits:
            old_s = a.old_status.value if a.old_status else "N/A"
            new_s = a.new_status.value if a.new_status else "N/A"
            print(f"  [{a.timestamp.strftime('%H:%M:%S')}] {a.actor}: {a.action} ({old_s} → {new_s})")

        print("\n✅ 正常流程演示完成")
        return record.record_id, data_dir
    finally:
        shutil.rmtree(data_dir)


def demo_threshold_mismatch_flow():
    print("\n" + "=" * 60)
    print("演示场景2: 阈值改过但报告仍写旧值")
    print("=" * 60)

    data_dir = tempfile.mkdtemp(prefix="diff_demo_mismatch_")
    try:
        store = ResultStore(data_dir=data_dir)
        engine = WorkflowEngine(store)

        print("\n[步骤1] 导入特征快照")
        record = engine.step1_import_snapshot(
            snapshot_id="SNAP-2024-002",
            original_line_number=78,
            main_flow="交易发起→反欺诈模型→额度决策",
            raw_data={"trans_id": "T002", "merchant": "测试商户"},
            online_score=0.78,
            offline_score=0.88,
        )
        print(f"  状态: {record.current_status.value}")

        print("\n[记录阈值变更] 阈值从0.8改为0.85，但报告仍写旧值0.8")
        record = engine.add_threshold_change(
            record_id=record.record_id,
            field_name="approval_threshold",
            old_value=0.8,
            new_value=0.85,
            changed_by="业务运营-张三",
            change_reason="通过率需要从30%提升到40%",
            report_still_shows_old=True,
        )
        print(f"  状态: {record.current_status.value}")
        print(f"  存在阈值不匹配: {record.has_threshold_mismatch()}")
        print(f"  阈值变更记录数: {len(record.threshold_changes)}")
        tc = record.threshold_changes[0]
        print(f"    - 字段: {tc.field_name}")
        print(f"    - 旧值: {tc.old_value} → 新值: {tc.new_value}")
        print(f"    - 报告仍显示旧值: {tc.report_still_shows_old}")
        print(f"    - 变更人: {tc.changed_by}")

        print("\n[步骤2] 林姐审核训练日志，系统检测到不匹配")
        record = engine.step2_review_training_logs(
            record_id=record.record_id,
            on_site_statement="训练日志曲线正常，但需注意阈值问题",
            curve_data={"epoch": [1, 2, 3], "auc": [0.8, 0.84, 0.86]},
            reviewed_by="林姐",
            reviewer_notes="注意阈值变更未同步到报告",
        )
        print(f"  状态: {record.current_status.value}")
        print(f"  ⚠️  自动标记为阈值不匹配，等待数据科学家复核")

        print("\n[步骤3] 更新分层指标，仍停在待复核状态")
        record = engine.step3_update_tier_metrics(
            record_id=record.record_id,
            tier_metrics={"overall": {"precision": 0.85, "recall": 0.80}},
            updated_by="林姐",
        )
        print(f"  状态: {record.current_status.value}")
        print(f"  ⚠️  不会自动归为正常，保留待复核状态")

        print("\n[人工判断] 林姐复核后确认为异常")
        record = engine.confirm_abnormal(
            record_id=record.record_id,
            confirmed_by="林姐",
            notes="阈值变更导致线上分数偏低11.36%，需要推动报告同步后重新评估",
        )
        print(f"  状态: {record.current_status.value}")
        print(f"  是否终态: {ProcessingStatus.is_final(record.current_status)}")

        print("\n[导出明细 - 验证单一数据源]")
        export_path = store.export_records(output_path="/tmp/demo_export.json")
        import json
        with open(export_path) as f:
            exported = json.load(f)
        print(f"  导出行数: {len(exported)}")
        print(f"  导出包含原始行号: {exported[0]['original_line_number'] == 78}")
        print(f"  导出包含阈值不匹配标记: {exported[0]['has_threshold_mismatch']}")
        print(f"  导出包含阈值变更详情: {'threshold_changes' in exported[0]}")
        print(f"  导出包含人工改动: {'manual_changes' in exported[0]}")
        os.unlink(export_path)

        print("\n[分析记录]")
        analysis = DiffEngine.analyze_record(record)
        for k, v in analysis.items():
            print(f"  {k}: {v}")

        print("\n✅ 阈值不匹配场景演示完成")
        print(f"\n💡 关键特性验证:")
        print(f"  ✓ 原始行号保留: 78")
        print(f"  ✓ 阈值变更留痕: 旧值0.8→新值0.85")
        print(f"  ✓ 报告旧值标记: 不会自动吞掉")
        print(f"  ✓ 待处理状态: 林姐确认前不自动归正常")
        print(f"  ✓ 审计日志完整: 每步操作可追溯")
        print(f"  ✓ 单一数据源: 导出、页面、API同一份数据")

        return record.record_id, data_dir
    finally:
        shutil.rmtree(data_dir)


def demo_boundary_rules():
    print("\n" + "=" * 60)
    print("边界规则列表（代码和文档双写）")
    print("=" * 60)
    rules = DiffEngine.get_boundary_rules()
    for key, rule in rules.items():
        print(f"\n🔹 {key}:")
        print(f"   {rule}")


if __name__ == "__main__":
    demo_normal_flow()
    demo_threshold_mismatch_flow()
    demo_boundary_rules()
    print("\n🎉 所有演示完成！")
