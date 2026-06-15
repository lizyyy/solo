#!/usr/bin/env python3
"""
验证复盘重放链路 - 确保能复盘的记录和可重新跑的命令对齐
"""
import json
import sys
import os
import shutil
import subprocess

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
    data_dirs = [
        "data/snapshots", "data/rules", "data/history", "data/reports",
        "data/replay_snapshots", "data/replay_rules", "data/replay_history", "data/replay_reports",
    ]
    for d in data_dirs:
        if os.path.exists(d):
            shutil.rmtree(d)


def print_separator(title=""):
    print("\n" + "=" * 70)
    if title:
        print(f"  {title}")
    print("=" * 70)


def main():
    clean_data()

    print_separator("验证复盘重放链路")

    # ========== 原始流程 ==========
    print_separator("【原始流程】走通三步工作流 + 特征缺失场景 + 复核")

    snapshot_mgr = SnapshotManager()
    history_tracker = HistoryTracker()
    rule_engine = BoundaryRuleEngine()
    workflow = WorkflowEngine(snapshot_mgr, history_tracker, rule_engine)
    reporter = AuditReporter(snapshot_mgr, history_tracker, workflow)

    with open("examples/sample_snapshots.json", "r", encoding="utf-8") as f:
        snapshots_data = json.load(f)

    snapshot_id = "SNAP001"

    # Step 1: 导入
    imported, skipped = snapshot_mgr.import_snapshots(
        snapshots_data, source="online_20260615", imported_by="数据科学家林姐"
    )
    workflow.step_1_import(
        snapshot_id,
        imported_by="林姐",
        import_notes="6月15日线上特征快照，共3条，格式正常",
    )
    print(f"[Step 1] 导入完成，状态: {snapshot_mgr.get_snapshot(snapshot_id).status.value}")

    # 林姐改备注
    snapshot_mgr.update_snapshot(
        snapshot_id,
        updates={"notes": "初步检查发现 feature_003 有空值，后续需关注"},
        updated_by="林姐",
        change_reason="补充特征异常说明",
    )
    print(f"[备注] 林姐修改了备注")

    # Step 2: 看训练日志曲线
    workflow.step_2_review_logs(
        snapshot_id,
        reviewed_by="林姐",
        training_log_analysis="训练曲线收敛正常，AUC从0.71稳步提升至0.86，第15轮后稳定。验证集与训练集gap约0.03，无明显过拟合。",
        curve_findings="loss曲线平滑下降，无震荡。AUC提升符合预期。注意第8轮有轻微波动但很快恢复。",
    )
    print(f"[Step 2] 日志审阅完成，状态: {snapshot_mgr.get_snapshot(snapshot_id).status.value}")

    # Step 3: 更新可解释摘要（触发特征缺失 + 默认分边界规则）
    result = workflow.step_3_update_summary(
        snapshot_id,
        updated_by="林姐",
        explainable_summary="该样本点击偏差评分为0.16，主要影响因素：位置偏置贡献58%，曝光时间贡献27%，用户历史行为贡献15%。特别说明：feature_003（商品类目深度特征）缺失，使用了全局默认分0.5填充，可能对偏差评分有±0.03的影响。",
        click_bias_score=0.16,
        missing_features=["feature_003"],
        default_score_applied=True,
    )
    print(f"[Step 3] 摘要更新完成，状态: {result.status.value}")
    print(f"         缺失特征: {result.missing_features}")
    print(f"         使用默认分: {result.default_score_applied}")
    print(f"         需要推荐负责人复核: {result.status == ProcessingStatus.NEEDS_REVIEW}")

    # 推荐负责人复核
    approved = workflow.approve_review(
        snapshot_id,
        reviewed_by="推荐负责人王哥",
        approval_notes="已确认feature_003缺失为上游类目系统临时故障导致，故障已修复。默认分填充方式合理，对整体偏差评估影响在可接受范围内。同意标记为正常。",
        mark_as_normal=True,
    )
    print(f"[复核] 推荐负责人复核通过，状态: {approved.status.value}")

    # 原始状态
    original_record = snapshot_mgr.get_snapshot(snapshot_id)
    original_status = workflow.get_workflow_status(snapshot_id)
    original_history = history_tracker.get_full_history(snapshot_id)
    original_notes_history = history_tracker.get_notes_history(snapshot_id)

    print(f"\n【原始状态汇总】")
    print(f"  最终状态: {original_status['status']}")
    print(f"  工作流步骤: {original_status['current_step']}")
    print(f"  点击偏差分数: {original_record.click_bias_score}")
    print(f"  缺失特征: {original_record.missing_features}")
    print(f"  默认分: {original_record.default_score_applied}")
    print(f"  变更记录数: {original_history['change_count']}")
    print(f"  备注变更次数: {len(original_notes_history)}")

    # ========== 生成重放脚本 ==========
    print_separator("【生成重放脚本】")

    replay_script_path = "data/reports/replay_SNAP001.py"
    os.makedirs("data/reports", exist_ok=True)
    replay_commands = reporter.generate_replay_commands(snapshot_id)
    with open(replay_script_path, "w", encoding="utf-8") as f:
        f.write("\n".join(replay_commands))

    print(f"重放脚本已生成: {replay_script_path}")
    print(f"脚本行数: {len(replay_commands)}")

    # 显示脚本前30行预览
    print("\n脚本预览 (前35行):")
    for i, line in enumerate(replay_commands[:35]):
        print(f"  {i+1:3d}: {line}")
    print("  ...")

    # ========== 执行重放脚本 ==========
    print_separator("【执行重放脚本】验证可重新跑的命令能走通")

    result = subprocess.run(
        [sys.executable, replay_script_path],
        capture_output=True,
        text=True,
        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    )

    if result.returncode == 0:
        print("✅ 重放脚本执行成功！")
        print("\n重放输出:")
        print(result.stdout)
    else:
        print("❌ 重放脚本执行失败！")
        print(f"退出码: {result.returncode}")
        print("错误输出:")
        print(result.stderr)
        print("\n标准输出:")
        print(result.stdout)
        return

    # ========== 对比验证 ==========
    print_separator("【对比验证】原始记录 vs 重放结果")

    # 加载重放后的数据
    replay_snapshot_mgr = SnapshotManager(data_dir="data/replay_snapshots")
    replay_history_tracker = HistoryTracker(history_dir="data/replay_history")
    replay_workflow = WorkflowEngine(
        replay_snapshot_mgr, replay_history_tracker,
        BoundaryRuleEngine(rules_dir="data/replay_rules")
    )

    replay_record = replay_snapshot_mgr.get_snapshot(snapshot_id)
    replay_status = replay_workflow.get_workflow_status(snapshot_id)
    replay_history = replay_history_tracker.get_full_history(snapshot_id)
    replay_notes_history = replay_history_tracker.get_notes_history(snapshot_id)

    checks = [
        ("快照ID一致", original_record.snapshot_id == replay_record.snapshot_id),
        ("原始行号一致", original_record.original_line_number == replay_record.original_line_number),
        ("点击偏差分数一致", original_record.click_bias_score == replay_record.click_bias_score),
        ("缺失特征一致", original_record.missing_features == replay_record.missing_features),
        ("使用默认分一致", original_record.default_score_applied == replay_record.default_score_applied),
        ("最终状态一致", original_status["status"] == replay_status["status"]),
        ("工作流步骤一致", original_status["current_step"] == replay_status["current_step"]),
        ("有变更历史记录", replay_history["change_count"] > 0),
        ("有审计记录", replay_history["audit_count"] > 0),
        ("备注历史可查看", len(replay_notes_history) > 0),
        ("能看出备注改前改后差别", all(
            n["old_notes"] != n["new_notes"] for n in replay_notes_history
        )),
    ]

    all_passed = True
    for check_name, passed in checks:
        status = "✅" if passed else "❌"
        print(f"  {status} {check_name}")
        if not passed:
            all_passed = False

    if all_passed:
        print("\n🎉 所有验证点通过！复盘重放链路已打通。")
    else:
        print("\n⚠️  部分验证点未通过，请检查。")

    # ========== 显示备注历史（改前改后对比） ==========
    print_separator("【备注历史】改前改后清晰可见")
    for i, n in enumerate(replay_notes_history):
        print(f"  版本 {i+1}: {n['changed_at']}")
        print(f"    操作人: {n['changed_by']}")
        print(f"    原因: {n['reason']}")
        print(f"    改前: {repr(n['old_notes'])}")
        print(f"    改后: {repr(n['new_notes'])}")
        print(f"    ↓")

    # ========== 显示"线上特征缺失却给了默认分"记录 ==========
    print_separator("【边界规则】线上特征缺失却给了默认分的记录")
    check_result = rule_engine.check_missing_feature_default_score(original_record)
    print(f"  违规: {check_result['violation']}")
    print(f"  有缺失特征: {check_result['has_missing_features']}")
    print(f"  使用默认分: {check_result['has_default_score']}")
    print(f"  缺失特征列表: {check_result['missing_features']}")
    print(f"  处理建议: {check_result['recommendation']}")

    print_separator("验证完成")


if __name__ == "__main__":
    main()
