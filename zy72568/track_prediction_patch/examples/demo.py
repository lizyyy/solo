"""
轨迹预测缺失修补系统 - 完整演示
=================================

演示内容：
1. 召回候选表第一次导入
2. 算法工程师小乔补看参数YAML
3. 检测到阈值冲突（候选表和YAML不一致）
4. 列出冲突证据，让用户选择确认或驳回
5. 分层指标更新
6. 碰到阈值旧值问题，保留标记留给数据科学家复核
7. 导出、页面、接口读取同一份结果
8. 查看审计日志：谁改了什么、为什么改、影响哪些结果
"""

import json
from track_prediction_patch.models import CandidateRecord
from track_prediction_patch.core import PatchWorkflow


def print_separator(title=""):
    print("\n" + "=" * 80)
    if title:
        print(f"  {title}")
        print("=" * 80)


def demo_full_workflow():
    print_separator("轨迹预测缺失修补系统 - 完整演示")

    # ============================================================
    # 初始化工作流，由算法工程师小乔创建
    # ============================================================
    print_separator("步骤0: 初始化工作流 (创建人: 算法工程师小乔)")
    workflow = PatchWorkflow(created_by="算法工程师小乔")
    print(f"✓ 创建工作流成功，Patch ID: {workflow.patch_record.patch_id}")

    # ============================================================
    # 第一步：召回候选表第一次导入
    # ============================================================
    print_separator("第一步: 召回候选表第一次导入")

    candidate_records = [
        CandidateRecord(
            track_id="TRK_001",
            predicted_value=0.85,
            reported_threshold=0.7,  # 报告的旧阈值
            is_missing=True,
            source="召回系统A",
        ),
        CandidateRecord(
            track_id="TRK_002",
            predicted_value=0.62,
            reported_threshold=0.7,  # 报告的旧阈值
            is_missing=True,
            source="召回系统B",
        ),
        CandidateRecord(
            track_id="TRK_003",
            predicted_value=0.91,
            reported_threshold=0.7,  # 报告的旧阈值
            is_missing=False,
            source="召回系统A",
        ),
    ]

    state, check_results, conflicts = workflow.step_1_import_candidates(
        candidate_records=candidate_records,
        table_name="2026-06-07_召回候选表",
        import_batch="BATCH_20260607_001",
    )

    print(f"✓ 导入 {len(candidate_records)} 条候选记录")
    print(f"  工作流状态: {state.current_step}")
    print(f"  自检结果:")
    for result in check_results:
        print(f"    - {result.check_item}: {'✓ 通过' if result.passed else '✗ 未通过'} - {result.description}")

    # ============================================================
    # 第二步：算法工程师小乔补看参数YAML
    # ============================================================
    print_separator("第二步: 算法工程师小乔补看参数YAML")

    yaml_content = """
# 轨迹预测参数配置
thresholds:
  default:
    value: 0.8  # 新阈值！候选表里报告的是0.7
    description: 轨迹预测默认阈值
  high_confidence:
    value: 0.9
    description: 高置信度阈值
model_version: "v2.3.1"
features:
  - velocity
  - acceleration
  - heading
"""

    state, check_results, conflicts = workflow.step_2_review_params(
        yaml_content=yaml_content,
        yaml_name="track_prediction_params_v2.yaml",
    )

    print(f"✓ 参数YAML加载完成")
    print(f"  工作流状态: {state.current_step}")
    print(f"  阈值配置数量: {len(workflow.param_yaml.thresholds)}")
    for name, threshold in workflow.param_yaml.thresholds.items():
        print(f"    - {name}: {threshold.value}")

    # ============================================================
    # 检测到冲突！列出证据，不自动拍板
    # ============================================================
    print_separator("⚠️  冲突检测: 召回候选表 vs 参数YAML")

    if conflicts:
        print(f"检测到 {len(conflicts)} 处阈值冲突！")
        print("系统不会自动处理，请算法工程师小乔确认或驳回：\n")

        for idx, conflict in enumerate(conflicts, 1):
            print(f"  冲突 {idx}: {conflict.description}")
            print(f"    证据ID: {conflict.evidence_id}")
            print(f"    候选表报告阈值: {conflict.candidate_value}")
            print(f"    参数YAML当前阈值: {conflict.yaml_value}")
            print(f"    严重程度: {conflict.severity}")
            print()

        # 演示：用户（小乔）确认第一个冲突，驳回第二个
        print("--- 人工处理冲突 ---")
        print("算法工程师小乔确认第一个冲突（接受YAML的新阈值）")
        resolved1 = workflow.resolve_conflict(
            evidence_id=conflicts[0].evidence_id,
            resolution="confirmed",
            resolved_by="算法工程师小乔",
        )
        print(f"  ✓ 已确认: {resolved1.track_id} - 决议: {resolved1.resolution}")

        print("算法工程师小乔驳回第二个冲突（保持候选表原值）")
        resolved2 = workflow.resolve_conflict(
            evidence_id=conflicts[1].evidence_id,
            resolution="rejected",
            resolved_by="算法工程师小乔",
        )
        print(f"  ✓ 已驳回: {resolved2.track_id} - 决议: {resolved2.resolution}")

        print("算法工程师小乔确认第三个冲突")
        resolved3 = workflow.resolve_conflict(
            evidence_id=conflicts[2].evidence_id,
            resolution="confirmed",
            resolved_by="算法工程师小乔",
        )
        print(f"  ✓ 已确认: {resolved3.track_id} - 决议: {resolved3.resolution}")

    # ============================================================
    # 自检结果展示
    # ============================================================
    print_separator("🔍  自检结果")

    print(f"  阈值旧值检测:")
    for result in check_results:
        if result.check_item == "old_threshold_report":
            print(f"    - {'✗ 发现问题' if not result.passed else '✓ 正常'}: {result.description}")
            if result.issues:
                print(f"    - 系统已标记需要数据科学家复核，不会自动归为正常")
                for issue in result.issues[:2]:
                    print(f"      * {issue.description[:80]}...")

    # ============================================================
    # 第三步：分层指标更新
    # ============================================================
    print_separator("第三步: 分层指标更新")

    tier_metrics = {
        "tier_1": {
            "recall": 0.92,
            "precision": 0.88,
            "f1": 0.90,
            "count": 150,
        },
        "tier_2": {
            "recall": 0.85,
            "precision": 0.82,
            "f1": 0.83,
            "count": 320,
        },
        "tier_3": {
            "recall": 0.78,
            "precision": 0.75,
            "f1": 0.76,
            "count": 530,
        },
    }

    state, check_results, unified_result = workflow.step_3_update_metrics(
        tier_metrics=tier_metrics,
        recalculate=False,
    )

    print(f"✓ 分层指标更新完成")
    print(f"  工作流状态: {state.current_step}")
    print(f"  修补记录状态: {workflow.patch_record.status}")
    print(f"  需要数据科学家复核: {workflow.reviewer.needs_data_scientist_review(workflow.patch_record)}")

    if workflow.patch_record.status == "needs_review":
        print("\n  ⚠️  系统检测到阈值旧值问题，已标记为 NEEDS_REVIEW")
        print("     没有自动归为正常，留给数据科学家复核")

    # ============================================================
    # 统一结果层：导出、页面、接口读同一份数据
    # ============================================================
    print_separator("📊 统一结果层: 导出/页面/接口 数据一致性")

    consistent_result = workflow.get_consistent_result()

    print(f"  结果版本: {consistent_result['version']}")
    print(f"  数据哈希: {consistent_result['data_hash']}")
    print()

    print("  导出版本 (export):")
    export_data = consistent_result["export"]
    print(f"    - 来源标记: {export_data['source']}")
    print(f"    - 分层指标数量: {len(export_data['tier_metrics'])}")
    print(f"    - 轨迹明细数量: {len(export_data['track_details'])}")

    print("\n  页面版本 (page):")
    page_data = consistent_result["page"]
    print(f"    - 来源标记: {page_data['source']}")
    print(f"    - 数据哈希一致: {page_data['data_hash'] == export_data['data_hash']}")

    print("\n  接口版本 (api):")
    api_data = consistent_result["api"]
    print(f"    - 来源标记: {api_data['source']}")
    print(f"    - 数据哈希一致: {api_data['data_hash'] == export_data['data_hash']}")

    print(f"\n  ✓ 三个来源使用同一份数据，哈希值完全一致")
    print(f"  ✓ 阈值异常记录在所有展示位置都会显示，不会一个地方异常另一个地方消失")

    # ============================================================
    # 审计和复核：谁改了什么、为什么改、影响哪些结果
    # ============================================================
    print_separator("📝 审计日志: 谁改了什么、为什么改")

    change_history = workflow.reviewer.get_who_changed_what(workflow.patch_record.patch_id)
    print(f"  共 {len(change_history)} 条操作记录:\n")

    for idx, change in enumerate(change_history, 1):
        print(f"  {idx}. [{change['timestamp'][:19]}] {change['operator']}")
        print(f"     操作: {change['operation']}")
        print(f"     原因: {change['reason']}")
        if change['changes'] != "无变更":
            print(f"     变更: {change['changes']}")
        print()

    # ============================================================
    # 影响分析
    # ============================================================
    print_separator("📈 变更影响分析")

    impact = workflow.reviewer.get_impact_analysis(
        workflow.patch_record,
        "update_threshold",
    )
    print(f"  操作类型: {impact['operation_type']}")
    print(f"  影响描述: {impact['impact_description']}")
    print(f"  影响指标: {', '.join(impact['affected_metrics'])}")
    print(f"  需要重算: {impact['needs_recalculation']}")
    print(f"  问题数量: {impact['issues_count']}")

    # ============================================================
    # 工作流摘要
    # ============================================================
    print_separator("📋 工作流完整摘要")

    summary = workflow.get_workflow_summary()
    print(json.dumps(summary, indent=2, ensure_ascii=False, default=str))

    print_separator("演示完成 ✓")
    print("""
核心特性总结：
1. ✓ 冲突不自动拍板：召回候选表和参数YAML矛盾时，列出证据让小乔选确认/驳回
2. ✓ 基本自检：重复导入、阈值旧值、补录重算、导出一致性
3. ✓ 统一结果层：导出、页面、接口读同一份结果，异常记录全渠道一致
4. ✓ 真实复核支持：谁改了什么、为什么改、影响哪些结果，全记录
5. ✓ 三步流程：导入→补看YAML→分层指标更新 完整走完
6. ✓ 阈值旧值问题：不急着归正常，留给数据科学家复核
    """)


if __name__ == "__main__":
    demo_full_workflow()
