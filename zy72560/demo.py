#!/usr/bin/env python3

from workflow_manager import WorkflowManager


def print_separator(title=""):
    print("\n" + "=" * 70)
    if title:
        print(f"  {title}")
        print("=" * 70)


def print_status_snapshot(wf, exp_id, label=""):
    print(f"\n{'─' * 60}")
    if label:
        print(f"  📌 状态快照 - {label}")
    else:
        print(f"  📌 当前状态快照")
    print('─' * 60)
    status = wf.get_full_status(exp_id)
    print(f"  实验名称:   {status['experiment_name']}")
    print(f"  当前步骤:   步骤{status['current_step']} - {status['step_name']}")
    print(f"  状态描述:   {status['status_description']}")
    print(f"  YAML导入次数: {status['yaml_import_count']}")
    print(f"  评测切片数: {status['slice_count']}")
    print(f"  待复核冲突: {status['pending_review_count']}")
    print(f"  是否已导出: {'是' if status['exported'] else '否'}")
    print(f"  是否已归档: {'是' if status['archived'] else '否'}")
    print(f"\n  历史操作（最近5条）:")
    history_lines = status['history_log'].split('\n')
    for line in history_lines[-5:]:
        print(f"    {line}")
    print(f"\n  自检:")
    for line in status['self_check'].split('\n'):
        print(f"    {line}")
    print('─' * 60)


def scenario_duplicate_import_bug():
    """
    场景：复现"第二次导入同一实验覆盖旧值，自检仍显示通过"的问题
    重点看：重复导入检测、历史版本、自检是否对齐
    """
    print_separator("场景：复现重复导入问题 + 自检对齐验证")
    
    wf = WorkflowManager()
    
    yaml_v1 = """
experiment_id: EXP-TEST-DUP
experiment_name: 时间衰减排序回测-重复导入测试
version: v1.0
parameters:
  decay_rate: 0.05
  time_window: 30
metrics:
  auc: 0.856
  gauc: 0.782
  score_bucket: 3
  click_rate: 0.125
conclusion: 整体指标提升显著
"""
    
    print("\n>>> 第1次导入：首次导入 v1.0")
    result1 = wf.step1_import_yaml(yaml_v1, operator="算法同学")
    exp_id = result1["experiment_id"]
    print(f"导入类型: {result1['import_type']}")
    print(f"导入次数: {result1['import_count']}")
    print(f"当前状态: {result1['current_status']}")
    print(result1["self_check"])
    
    print_status_snapshot(wf, exp_id, "第一次导入后")
    
    print("\n>>> 第2次导入：内容完全一样，重复导入（之前会显示通过）")
    result2 = wf.step1_import_yaml(yaml_v1, operator="算法同学")
    print(f"导入类型: {result2['import_type']}")
    print(f"导入次数: {result2['import_count']}")
    print(f"当前状态: {result2['current_status']}")
    print(result2["self_check"])
    
    print_status_snapshot(wf, exp_id, "第二次导入后（重复导入）")
    
    yaml_v2 = """
experiment_id: EXP-TEST-DUP
experiment_name: 时间衰减排序回测-重复导入测试
version: v2.0
parameters:
  decay_rate: 0.08
  time_window: 14
metrics:
  auc: 0.865
  gauc: 0.790
  score_bucket: 4
  click_rate: 0.135
conclusion: 优化版效果更好
"""
    
    print("\n>>> 第3次导入：版本更新，内容有变化")
    result3 = wf.step1_import_yaml(yaml_v2, operator="算法同学")
    print(f"导入类型: {result3['import_type']}")
    print(f"导入次数: {result3['import_count']}")
    print(f"当前状态: {result3['current_status']}")
    print(result3["self_check"])
    
    print_status_snapshot(wf, exp_id, "第三次导入后（版本更新）")
    
    print("\n>>> 继续走完剩下步骤，停在可导出状态")
    
    print("\n  → 步骤2：补录评测切片")
    slice_result = wf.step2_review_slice(
        experiment_id=exp_id,
        slice_metrics={
            "auc": 0.860,
            "gauc": 0.785,
            "score_bucket": 3,
            "click_rate": 0.132
        },
        score_distribution={"0-20": 100, "20-40": 200, "40-60": 300, "60-80": 250, "80-100": 150},
        uploader="评测运营小孟",
        notes="补录评测切片，离线和线上分数差了一个桶",
        source="补录"
    )
    print(f"  冲突数: {slice_result['conflict_pending']}")
    print(f"  分数桶: {slice_result['score_bucket_diff']}")
    if slice_result['warning']:
        print(f"  ⚠️  {slice_result['warning']}")
    
    print("\n  → 复核所有冲突")
    pending_conflicts = slice_result["pending_conflicts"]
    for conflict in pending_conflicts:
        wf.review_conflict(exp_id, conflict["conflict_id"], confirm=True, reviewer="评测运营小孟")
        print(f"    ✓ 已确认: {conflict['field']}")
    
    print("\n  → 步骤3：更新实验对比")
    step3 = wf.step3_update_comparison(exp_id, operator="评测运营小孟")
    print(f"  状态: {step3['status']}")
    print(f"  下一步: {step3['next_step']}")
    
    print_status_snapshot(wf, exp_id, "停在可以导出或归档")
    
    print("\n>>> 步骤4：导出")
    step4 = wf.step4_export(exp_id, operator="评测运营小孟")
    print(step4["export_summary"])
    
    print_status_snapshot(wf, exp_id, "导出完成后")
    
    print("\n>>> 步骤5：归档")
    step5 = wf.step5_archive(exp_id, operator="评测运营小孟")
    print(f"归档状态: {step5['archived']}")
    
    print_status_snapshot(wf, exp_id, "归档完成后（最终状态）")
    
    print("\n>>> 完整实验对比结果")
    full = wf.get_full_status(exp_id)
    print(full["comparison"])
    
    print_separator("场景结束 - 重复导入问题已修复，自检对齐")
    return exp_id


def scenario_normal_three_steps():
    """
    场景：正常材料，三步走通，停在可导出查看状态
    """
    print_separator("场景：正常材料三步走通 + 导出归档")
    
    wf = WorkflowManager()
    
    yaml_content = """
experiment_id: EXP-NORMAL-001
experiment_name: 时间衰减排序回测-基线版
version: v1.0
parameters:
  decay_rate: 0.05
  time_window: 30
  top_k: 100
metrics:
  auc: 0.856
  gauc: 0.782
  score_bucket: 3
  click_rate: 0.125
conclusion: 整体指标提升显著，正向收益达标
"""
    
    print("\n>>> 步骤1：参数YAML第一次导入")
    r1 = wf.step1_import_yaml(yaml_content, operator="算法同学")
    exp_id = r1["experiment_id"]
    print(f"实验ID: {exp_id}")
    print(f"导入类型: {r1['import_type']}")
    print(f"状态: {r1['current_status']}")
    
    print("\n>>> 步骤2：评测运营小孟补看评测切片")
    r2 = wf.step2_review_slice(
        experiment_id=exp_id,
        slice_metrics={
            "auc": 0.852,
            "gauc": 0.778,
            "score_bucket": 3,
            "click_rate": 0.123
        },
        score_distribution={"0-20": 100, "20-40": 200, "40-60": 300, "60-80": 250, "80-100": 150},
        uploader="评测运营小孟",
        notes="切片复核完毕，结论正向，达标",
        source="正常评测"
    )
    print(f"冲突数: {r2['conflict_pending']}")
    print(f"分数桶: {r2['score_bucket_diff']}")
    print(f"状态: {r2['current_status']}")
    
    pending = r2["pending_conflicts"]
    if pending:
        print("\n  复核冲突:")
        for c in pending:
            wf.review_conflict(exp_id, c["conflict_id"], confirm=True, reviewer="评测运营小孟")
            print(f"    确认: {c['field']}")
    
    print("\n>>> 步骤3：实验对比更新")
    r3 = wf.step3_update_comparison(exp_id, operator="评测运营小孟")
    print(f"状态: {r3['status']}")
    print(f"下一步: {r3['next_step']}")
    
    print_status_snapshot(wf, exp_id, "停在可以导出或归档")
    
    print("\n>>> 完整实验对比")
    print(r3["comparison"])
    
    print("\n>>> 完整历史记录")
    print(r3["history_log"])
    
    print("\n>>> 步骤4：导出")
    r4 = wf.step4_export(exp_id, operator="评测运营小孟")
    print(r4["export_summary"])
    
    print_separator("场景结束")
    return exp_id


def main():
    print("""
╔══════════════════════════════════════════════════════════════════╗
║     时间衰减排序回测 - 状态流 & 自检 & 导出 验证演示               ║
║                                                                  ║
║  重点验证：                                                       ║
║  1. 重复导入检测 - 同一实验多次导入保留历史，自检正确显示          ║
║  2. 状态流对齐 - 每一步状态描述、历史留痕清晰                      ║
║  3. 导出链路 - 从可导出 → 导出 → 归档完整链路                      ║
║  4. 自检对齐 - 重复导入、分数差桶、补录后重算、导出一致 四项自检   ║
╚══════════════════════════════════════════════════════════════════╝
    """)
    
    print("\n🚀 开始验证...")
    
    scenario_duplicate_import_bug()
    scenario_normal_three_steps()
    
    print_separator("总结")
    print("""
  ✅ 修复内容：

  1. 【重复导入检测修复】
     - 同一实验多次导入不再覆盖，全部保留历史版本
     - 区分三种导入：首次导入 / 重复导入（内容一致） / 版本更新（内容不同）
     - 自检能正确识别重复导入，不再出现"第二次导入仍显示通过"
     - 每个导入批次有 import_id 和 content_hash，可追溯

  2. 【状态流强化】
     - 每一步都有清晰的 status_description（状态描述）
     - 步骤1: 参数YAML已导入，等待评测运营补看评测切片
     - 步骤2: 评测切片已补录，存在 N 个冲突待复核
     - 步骤3: 实验对比已更新，可以导出或归档
     - 导出后: 已导出，可以归档
     - 归档后: 已归档

  3. 【导出链路完整】
     - 增加 ExportManager，支持导出为内存数据/JSON/YAML
     - 导出内容包含：YAML版本历史、评测切片、实验对比、冲突、自检、历史记录
     - 导出有 summary，明确说明是否可导出、建议是什么
     - 差一个桶的情况会重点提醒，不会自动归为正常

  4. 【自检与导出对齐】
     - 重复导入检查：看同一实验的导入次数、内容重复次数
     - 分数桶差异检查：差一个桶标记为未通过，需要复核
     - 补录后重算检查：待复核冲突数、是否可以重算
     - 导出一致性检查：YAML/切片/对比三者指标和数值是否一致
    """)
    print("=" * 70)


if __name__ == "__main__":
    main()
