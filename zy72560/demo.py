#!/usr/bin/env python3

from workflow_manager import WorkflowManager


def print_separator(title=""):
    print("\n" + "=" * 70)
    if title:
        print(f"  {title}")
        print("=" * 70)


def scenario_1_normal():
    print_separator("场景一：正常材料 - 时间衰减排序回测")
    
    wf = WorkflowManager()
    
    yaml_content = """
experiment_id: EXP-2025-001
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
    result = wf.step1_import_yaml(yaml_content, operator="算法同学")
    exp_id = result["experiment_id"]
    print(f"实验ID: {exp_id}")
    print(f"实验名称: {result['experiment_name']}")
    print(f"是否重复: {result['is_duplicate']}")
    print(f"下一步: {result['next_step']}")
    print(result["self_check"])
    
    print("\n>>> 步骤2：评测运营小孟补看评测切片（正常口径）")
    slice_result = wf.step2_review_slice(
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
    print(f"冲突数量: {slice_result['conflict_count']}")
    print(f"分数桶差异: {slice_result['score_bucket_diff']}")
    if slice_result['warning']:
        print(f"⚠️  警告: {slice_result['warning']}")
    print(f"下一步: {slice_result['next_step']}")
    print(slice_result["self_check"])
    
    if slice_result["pending_conflicts"]:
        print("\n>>> 复核冲突项")
        for conflict in slice_result["pending_conflicts"]:
            print(f"  确认冲突 {conflict['conflict_id']}: {conflict['description']}")
            wf.review_conflict(exp_id, conflict["conflict_id"], confirm=True, reviewer="评测运营小孟")
    
    print("\n>>> 步骤3：实验对比更新")
    final_result = wf.step3_update_comparison(exp_id, operator="评测运营小孟")
    print("\n--- 最终实验对比 ---")
    print(final_result["comparison"])
    print("\n--- 历史操作记录 ---")
    print(final_result["history_log"])
    print("\n--- 最终自检 ---")
    print(final_result["self_check"])
    
    print_separator("场景一结束")
    return exp_id


def scenario_2_wrong_caliber():
    print_separator("场景二：错口径材料 - 参数YAML结论与评测切片矛盾")
    
    wf = WorkflowManager()
    
    yaml_content = """
experiment_id: EXP-2025-002
experiment_name: 时间衰减排序回测-快衰减版
version: v1.0
parameters:
  decay_rate: 0.15
  time_window: 7
  top_k: 100
metrics:
  auc: 0.875
  gauc: 0.802
  score_bucket: 4
  click_rate: 0.148
conclusion: 快衰减效果显著提升，全面优于基线
"""
    
    print("\n>>> 步骤1：参数YAML第一次导入（错口径材料）")
    result = wf.step1_import_yaml(yaml_content, operator="算法同学")
    exp_id = result["experiment_id"]
    print(f"实验ID: {exp_id}")
    print(f"实验名称: {result['experiment_name']}")
    print(f"下一步: {result['next_step']}")
    
    print("\n>>> 步骤2：评测运营小孟补看评测切片（发现口径不一致）")
    slice_result = wf.step2_review_slice(
        experiment_id=exp_id,
        slice_metrics={
            "auc": 0.821,
            "gauc": 0.745,
            "score_bucket": 2,
            "click_rate": 0.102
        },
        score_distribution={"0-20": 200, "20-40": 300, "40-60": 250, "60-80": 150, "80-100": 100},
        uploader="评测运营小孟",
        notes="实际评测发现下降，与YAML结论不符，可能是统计口径错了",
        source="补录-发现口径错误"
    )
    print(f"冲突数量: {slice_result['conflict_count']}")
    print(f"分数桶差异: {slice_result['score_bucket_diff']}")
    if slice_result['warning']:
        print(f"⚠️  警告: {slice_result['warning']}")
    
    print("\n--- 发现的冲突证据 ---")
    for i, conflict in enumerate(slice_result["pending_conflicts"], 1):
        print(f"  {i}. 冲突ID: {conflict['conflict_id']}")
        print(f"     字段: {conflict['field']}")
        print(f"     描述: {conflict['description']}")
    
    print("\n>>> 评测运营小孟选择：驳回YAML中的错误结论")
    for conflict in slice_result["pending_conflicts"]:
        if "conclusion" in conflict["field"]:
            print(f"  驳回冲突 {conflict['conflict_id']}（结论不一致）")
            wf.review_conflict(exp_id, conflict["conflict_id"], confirm=False, reviewer="评测运营小孟")
        else:
            print(f"  确认冲突 {conflict['conflict_id']}（指标差异确实存在）")
            wf.review_conflict(exp_id, conflict["conflict_id"], confirm=True, reviewer="评测运营小孟")
    
    print("\n>>> 步骤3：实验对比更新（基于复核结果）")
    final_result = wf.step3_update_comparison(exp_id, operator="评测运营小孟")
    print("\n--- 最终实验对比 ---")
    print(final_result["comparison"])
    print("\n--- 历史操作记录 ---")
    print(final_result["history_log"])
    
    print_separator("场景二结束")
    return exp_id


def scenario_3_supplement_and_one_bucket_diff():
    print_separator("场景三：补录材料 + 离线线上差一个桶")
    
    wf = WorkflowManager()
    
    yaml_content = """
experiment_id: EXP-2025-003
experiment_name: 时间衰减排序回测-优化版
version: v1.0
parameters:
  decay_rate: 0.08
  time_window: 14
  top_k: 150
metrics:
  auc: 0.865
  gauc: 0.790
  score_bucket: 4
  click_rate: 0.135
conclusion: 优化版本指标有提升，建议小流量上线
"""
    
    print("\n>>> 步骤1：参数YAML第一次导入")
    result = wf.step1_import_yaml(yaml_content, operator="算法同学")
    exp_id = result["experiment_id"]
    print(f"实验ID: {exp_id}")
    print(f"实验名称: {result['experiment_name']}")
    
    print("\n>>> 步骤2：评测运营小孟补看评测切片（补录材料，发现差一个桶）")
    slice_result = wf.step2_review_slice(
        experiment_id=exp_id,
        slice_metrics={
            "auc": 0.860,
            "gauc": 0.785,
            "score_bucket": 3,
            "click_rate": 0.132
        },
        score_distribution={"0-20": 120, "20-40": 220, "40-60": 280, "60-80": 230, "80-100": 150},
        uploader="评测运营小孟",
        notes="补录评测切片，离线和线上分数差了一个桶，需要复核",
        source="补录材料"
    )
    print(f"冲突数量: {slice_result['conflict_count']}")
    print(f"分数桶差异: {slice_result['score_bucket_diff']}")
    if slice_result['warning']:
        print(f"⚠️  警告: {slice_result['warning']}")
    
    print("\n>>> 评测运营复核：先不急着归正常，标记差一个桶")
    for conflict in slice_result["pending_conflicts"]:
        print(f"  确认冲突 {conflict['conflict_id']}")
        wf.review_conflict(exp_id, conflict["conflict_id"], confirm=True, reviewer="评测运营小孟")
    
    print("\n>>> 步骤3：实验对比更新（保留差一个桶的标记，待进一步确认）")
    final_result = wf.step3_update_comparison(exp_id, operator="评测运营小孟")
    print("\n--- 最终实验对比 ---")
    print(final_result["comparison"])
    print("\n--- 历史操作记录 ---")
    print(final_result["history_log"])
    print("\n--- 最终自检 ---")
    print(final_result["self_check"])
    
    print_separator("场景三结束")
    return exp_id


def main():
    print("""
╔══════════════════════════════════════════════════════════════════╗
║           时间衰减排序回测 - 评测流程演示系统                       ║
║                                                                  ║
║  三个场景：                                                       ║
║  1. 正常材料 - 流程走通                                          ║
║  2. 错口径材料 - 参数YAML与评测切片矛盾，需要复核选确认/驳回       ║
║  3. 补录材料 + 差一个桶 - 补录后重算，差桶不自动归正常            ║
╚══════════════════════════════════════════════════════════════════╝
    """)
    
    print("\n🚀 开始跑三个场景...")
    
    exp1 = scenario_1_normal()
    exp2 = scenario_2_wrong_caliber()
    exp3 = scenario_3_supplement_and_one_bucket_diff()
    
    print_separator("汇总 - 三个实验对比")
    print(f"  实验1 (正常):   {exp1} - 已完成")
    print(f"  实验2 (错口径): {exp2} - 已完成，冲突已驳回/确认")
    print(f"  实验3 (补录+差桶): {exp3} - 已完成，差一个桶标记保留")
    print("\n✅ 所有场景跑通完毕！")
    print("\n📝 关键特性说明：")
    print("  1. 参数YAML结论不能直接照抄，与评测切片矛盾时会列冲突证据")
    print("  2. 评测运营小孟可以选择确认或驳回，不自动拍板")
    print("  3. 基本自检覆盖：重复导入、分数差桶、补录后重算、导出一致")
    print("  4. 离线和线上分数差一个桶时，不会自动归正常，留待复核")
    print("  5. 三步流程：导入YAML → 补看切片 → 更新对比")


if __name__ == "__main__":
    main()
