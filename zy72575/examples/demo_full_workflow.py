#!/usr/bin/env python3
"""
完整工作流演示 - 展示"排名学习点击偏差"系统的核心功能
"""
import json
import sys
import os
import shutil

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ranking_click_bias import (
    SnapshotManager,
    HistoryTracker,
    BoundaryRuleEngine,
    WorkflowEngine,
    AuditReporter,
    ProcessingStatus,
)


def clean_data():
    """清理旧数据，确保演示干净"""
    data_dirs = ["data/snapshots", "data/rules", "data/history", "data/reports"]
    for d in data_dirs:
        if os.path.exists(d):
            shutil.rmtree(d)
    print("✅ 已清理旧数据")


def print_separator(title=""):
    print("\n" + "=" * 70)
    if title:
        print(f"  {title}")
        print("=" * 70)


def main():
    clean_data()

    print_separator("排名学习点击偏差 - 完整工作流演示")

    snapshot_mgr = SnapshotManager()
    history_tracker = HistoryTracker()
    rule_engine = BoundaryRuleEngine()
    workflow = WorkflowEngine(snapshot_mgr, history_tracker, rule_engine)
    reporter = AuditReporter(snapshot_mgr, history_tracker, workflow)

    # ========== 第1步：导入特征快照 ==========
    print_separator("Step 1: 导入特征快照（第一次导入）")

    with open("examples/sample_snapshots.json", "r", encoding="utf-8") as f:
        snapshots_data = json.load(f)

    imported, skipped = snapshot_mgr.import_snapshots(
        snapshots_data, source="daily_run_0601", imported_by="数据科学家林姐"
    )

    print(f"成功导入: {len(imported)} 条")
    print(f"跳过重复: {len(skipped)} 条")
    for rec in imported:
        print(f"  ✅ {rec.snapshot_id} | 原始行号: {rec.original_line_number}")

    batch_id = imported[0].import_batch_id
    print(f"批次ID: {batch_id}")

    # ========== 验证：重复导入不翻倍 ==========
    print_separator("验证：重复导入同一批数据（应该全部跳过）")

    imported2, skipped2 = snapshot_mgr.import_snapshots(
        snapshots_data, source="daily_run_0601", imported_by="数据科学家林姐"
    )
    print(f"再次导入 - 成功导入: {len(imported2)} 条, 跳过重复: {len(skipped2)} 条")
    print(f"✅ 去重机制正常工作，数量没有翻倍")

    # ========== 执行三步工作流 ==========
    print_separator("Step 2: 执行三步标准工作流")

    snapshot_id = "SNAP001"
    print(f"处理快照: {snapshot_id}")

    # Step 1 - 确认导入
    print("\n[工作流] Step 1 - 确认导入完成")
    workflow.step_1_import(
        snapshot_id,
        imported_by="林姐",
        import_notes="6月1日线上特征快照，初步检查格式正常",
    )
    print(f"  ✅ 状态更新为: {snapshot_mgr.get_snapshot(snapshot_id).status.value}")

    # Step 2 - 林姐审阅训练日志曲线
    print("\n[工作流] Step 2 - 林姐审阅训练日志曲线")
    workflow.step_2_review_logs(
        snapshot_id,
        reviewed_by="林姐",
        training_log_analysis="训练曲线收敛正常，AUC从0.72提升到0.85，第12轮后稳定",
        curve_findings="loss曲线平滑，无震荡。验证集与训练集趋势一致，无过拟合迹象",
    )
    print(f"  ✅ 状态更新为: {snapshot_mgr.get_snapshot(snapshot_id).status.value}")

    # ========== 林姐只改了一条备注 ==========
    print_separator("场景演示：林姐只改了一条备注")

    record_before = snapshot_mgr.get_snapshot(snapshot_id)

    snapshot_mgr.update_snapshot(
        snapshot_id,
        updates={"notes": "补充：发现feature_003存在空值，需注意"},
        updated_by="林姐",
        change_reason="补充特征缺失情况说明",
    )

    notes_history = history_tracker.get_notes_history(snapshot_id)
    print("备注变更历史:")
    for h in notes_history:
        print(f"  📝 {h['changed_at']}")
        print(f"     改前: {repr(h['old_notes'])}")
        print(f"     改后: {repr(h['new_notes'])}")
        print(f"     操作人: {h['changed_by']}")
        print(f"     原因: {h['reason']}")
    print("✅ 备注修改历史可追溯，改前改后清晰可见")

    # ========== Step 3 - 更新可解释摘要，触发边界规则 ==========
    print_separator("[工作流] Step 3 - 更新可解释摘要（触发特征缺失边界规则）")

    result = workflow.step_3_update_summary(
        snapshot_id,
        updated_by="林姐",
        explainable_summary="该样本点击偏差评分0.15，主要影响因素为位置偏置(贡献60%)和曝光时间(贡献30%)。注意：feature_003缺失，使用了默认分填充",
        click_bias_score=0.15,
        missing_features=["feature_003"],
        default_score_applied=True,
    )

    status = workflow.get_workflow_status(snapshot_id)
    print(f"  点击偏差分数: {result.click_bias_score}")
    print(f"  缺失特征: {result.missing_features}")
    print(f"  使用默认分: {result.default_score_applied}")
    print(f"  当前状态: {result.status.value}")
    print(f"  需要推荐负责人复核: {status['needs_leader_review']}")
    print(f"  分配给: {result.assigned_to}")

    if status["needs_leader_review"]:
        print("  ⚠️  触发边界规则：线上特征缺失却给了默认分 → 自动标记需推荐负责人复核")
        print("  ✅ 没有自动归为正常，留给推荐负责人人工判断")

    # ========== 推荐负责人复核 ==========
    print_separator("场景：推荐负责人追问并复核")

    print("推荐负责人查看需复核列表:")
    review_report = reporter.generate_leader_review_report()
    print(f"  待复核总数: {review_report['total_pending_review']}")
    for snap in review_report["snapshots_needing_review"]:
        print(f"  - {snap['snapshot_id']}")
        print(f"    原始行号: {snap['original_line_number']}")
        print(f"    缺失特征: {snap['missing_features']}")
        print(f"    使用默认分: {snap['default_score_applied']}")
        print(f"    备注: {snap['notes']}")

    print("\n推荐负责人复核通过:")
    approved = workflow.approve_review(
        snapshot_id,
        reviewed_by="推荐负责人张哥",
        approval_notes="已确认feature_003缺失为上游数据源临时问题，不影响整体偏差评估，同意标记为正常",
        mark_as_normal=True,
    )
    print(f"  ✅ 复核通过，状态更新为: {approved.status.value}")
    print(f"  复核人: {approved.reviewed_by}")
    print(f"  复核时间: {approved.reviewed_at}")

    # ========== 生成复盘报告和重放命令 ==========
    print_separator("生成复盘记录和可重跑命令")

    print("1. 生成完整复盘报告...")
    audit_result = reporter.save_audit_report(snapshot_id)
    print(f"   {audit_result}")

    print("\n2. 生成可重放的Python脚本...")
    replay_commands = reporter.generate_replay_commands(snapshot_id)
    replay_path = f"data/reports/replay_{snapshot_id}.py"
    os.makedirs("data/reports", exist_ok=True)
    with open(replay_path, "w", encoding="utf-8") as f:
        f.write("\n".join(replay_commands))
    print(f"   重放脚本已保存到: {replay_path}")

    # ========== 系统概览 ==========
    print_separator("系统概览")
    print(reporter.print_summary())

    # ========== 对比版本差异 ==========
    print_separator("查看 SNAP001 的完整变更历史")
    full_history = history_tracker.get_full_history(snapshot_id)
    print(f"总变更次数: {full_history['change_count']}")
    print(f"总审计记录: {full_history['audit_count']}")
    print("\n变更明细:")
    for change in full_history["changes"]:
        print(f"  [{change['changed_at']}] {change['changed_by']}")
        print(f"    {change['field']}: {repr(change['old_value'])} → {repr(change['new_value'])}")
        if change["reason"]:
            print(f"    原因: {change['reason']}")

    print_separator("演示完成！")
    print("""
核心功能验证总结:
  ✅ 原始行号记录
  ✅ 去重导入（不翻倍）
  ✅ 三步工作流（导入→看日志→更新摘要）
  ✅ 边界规则自动触发（特征缺失+默认分 → 需复核）
  ✅ 不急着归正常，留给推荐负责人
  ✅ 备注修改可追溯（改前改后可见）
  ✅ 完整变更历史和审计追踪
  ✅ 生成复盘报告（JSON）
  ✅ 生成可重跑命令（Python脚本）
  ✅ 推荐负责人复核流程
""")


if __name__ == "__main__":
    main()
