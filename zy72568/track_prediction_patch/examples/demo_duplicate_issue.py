"""
轨迹预测缺失修补系统 - 3条重复导入问题样例演示
===============================================

场景：
1. 第一次导入5条候选记录
2. 第二次导入（含3条重复 + 2条新增）
3. 停在"检测到3条重复导入记录"处，查看状态/历史/结果说明
4. 继续走第二步、第三步
5. 阈值改过但报告重新对齐

演示目标：
- 修复"先写入再检查导致首次导入误判重复"的问题
- 展示状态变化、历史留痕、结果说明
- 不停在"能不能点下一步"，而是看问题处理过程
"""

import json
import sys
sys.path.insert(0, '.')

from track_prediction_patch.models import CandidateRecord
from track_prediction_patch.core import PatchWorkflow


def print_sep(title="", char="=", width=70):
    print()
    if title:
        print(f" {char * 2} {title} {char * (width - len(title) - 4)}")
    else:
        print(char * width)


def print_state(state, label="当前状态"):
    print_sep(label, "-")
    print(f"  当前步骤: {state.current_step}")
    print(f"  状态消息: {state.status_message}")
    print(f"  能否进入下一步: {'是' if state.can_proceed else '否'}")
    if state.blocking_issues:
        print(f"  阻塞问题:")
        for issue in state.blocking_issues:
            print(f"    - {issue}")
    if state.result_summary:
        print(f"  结果摘要:")
        for k, v in state.result_summary.items():
            if isinstance(v, list) and len(v) > 5:
                print(f"    - {k}: {v[:5]}... (共{len(v)}项)")
            else:
                print(f"    - {k}: {v}")


def print_history(workflow):
    print_sep("历史留痕 - step_history", "-")
    for i, step in enumerate(workflow.state.step_history, 1):
        print(f"  [{i}] {step['timestamp'][:19]} - {step['step']}")
        print(f"      操作人: {step.get('operator', '未知')}")
        print(f"      描述: {step.get('description', '')}")
        extra_keys = [k for k in step.keys() if k not in ['step', 'timestamp', 'description', 'operator']]
        if extra_keys:
            print(f"      扩展信息:")
            for k in extra_keys:
                print(f"        {k}: {step[k]}")


def print_audit_logs(workflow):
    print_sep("审计日志 - 谁改了什么", "-")
    history = workflow.reviewer.get_who_changed_what(workflow.patch_record.patch_id)
    for i, change in enumerate(history, 1):
        print(f"  [{i}] {change['timestamp'][:19]}")
        print(f"      操作人: {change['operator']}")
        print(f"      操作类型: {change['operation']}")
        print(f"      变更内容: {change['changes']}")
        print(f"      原因: {change['reason']}")


def print_issues(workflow, filter_type=None):
    print_sep("问题记录", "-")
    issues = workflow.patch_record.issues
    if filter_type:
        issues = [i for i in issues if i.issue_type == filter_type]
    print(f"  共 {len(issues)} 条问题:")
    for i, issue in enumerate(issues, 1):
        status = "已解决" if issue.resolved else "待处理"
        print(f"  [{i}] {issue.issue_type} - {status} - 严重度: {issue.severity}")
        print(f"      轨迹ID: {issue.track_id or '无'}")
        print(f"      描述: {issue.description}")
        if issue.resolved:
            print(f"      解决人: {issue.resolved_by}, 时间: {issue.resolved_at}")


def demo_duplicate_issue():
    print_sep("轨迹预测缺失修补系统 - 3条重复导入问题样例", "=")
    print("  创建人: 算法工程师小乔")
    print("  场景: 首次导入5条 -> 追加导入(3条重复+2条新增) -> 查看状态/历史/结果")

    # ============================================================
    # 初始化
    # ============================================================
    workflow = PatchWorkflow(created_by="算法工程师小乔")
    print(f"\n  ✓ 工作流创建成功, Patch ID: {workflow.patch_record.patch_id}")

    # ============================================================
    # 第一步：第一次导入 5 条候选记录
    # ============================================================
    print_sep("第一步: 召回候选表第一次导入 (5条记录)", "=")

    first_batch = [
        CandidateRecord(
            track_id="TRK_001",
            predicted_value=0.85,
            reported_threshold=0.7,
            is_missing=True,
            source="召回系统A",
        ),
        CandidateRecord(
            track_id="TRK_002",
            predicted_value=0.62,
            reported_threshold=0.7,
            is_missing=True,
            source="召回系统B",
        ),
        CandidateRecord(
            track_id="TRK_003",
            predicted_value=0.91,
            reported_threshold=0.7,
            is_missing=False,
            source="召回系统A",
        ),
        CandidateRecord(
            track_id="TRK_004",
            predicted_value=0.78,
            reported_threshold=0.7,
            is_missing=True,
            source="召回系统C",
        ),
        CandidateRecord(
            track_id="TRK_005",
            predicted_value=0.55,
            reported_threshold=0.7,
            is_missing=False,
            source="召回系统B",
        ),
    ]

    state, checks, conflicts = workflow.step_1_import_candidates(
        first_batch,
        table_name="2026-06-15_召回候选表",
        import_batch="BATCH_20260615_001",
    )

    print(f"\n  导入完成！")
    print_state(state, "首次导入后状态")
    print(f"\n  自检结果:")
    for r in checks:
        print(f"    - {r.check_item}: {'✓ 通过' if r.passed else '✗ 未通过'} - {r.description}")
        print(f"      问题数: {len(r.issues)}")

    print_history(workflow)

    print_sep("关键验证: 首次导入会不会误判重复？", "!")
    print(f"  首次导入5条，重复导入检测到的问题数: {len([i for i in workflow.patch_record.issues if i.issue_type == 'duplicate_import'])}")
    print(f"  预期: 0条（因为是第一次导入，表是空的）")
    print(f"  结论: {'✓ 修复成功 - 没有误判' if len([i for i in workflow.patch_record.issues if i.issue_type == 'duplicate_import']) == 0 else '✗ 仍有误判'}")

    # ============================================================
    # 追加导入：3条重复 + 2条新增
    # ============================================================
    print_sep("追加导入: 3条重复 + 2条新增 (共5条)", "=")
    print("  目的: 验证检测到3条重复导入记录时的状态、历史、结果说明")
    print("  场景: 业务同事误操作，把之前导入过的记录又导了一遍")

    second_batch = [
        CandidateRecord(
            track_id="TRK_001",  # 重复
            predicted_value=0.85,
            reported_threshold=0.7,
            is_missing=True,
            source="召回系统A",
        ),
        CandidateRecord(
            track_id="TRK_002",  # 重复
            predicted_value=0.62,
            reported_threshold=0.7,
            is_missing=True,
            source="召回系统B",
        ),
        CandidateRecord(
            track_id="TRK_003",  # 重复
            predicted_value=0.91,
            reported_threshold=0.7,
            is_missing=False,
            source="召回系统A",
        ),
        CandidateRecord(
            track_id="TRK_006",  # 新增
            predicted_value=0.73,
            reported_threshold=0.7,
            is_missing=True,
            source="召回系统D",
        ),
        CandidateRecord(
            track_id="TRK_007",  # 新增
            predicted_value=0.81,
            reported_threshold=0.7,
            is_missing=False,
            source="召回系统A",
        ),
    ]

    state, checks, conflicts = workflow.append_candidates(
        second_batch,
        import_batch="BATCH_20260615_002",
    )

    # ============================================================
    # 停在这里！查看状态变化、历史留痕、结果说明
    # ============================================================
    print_sep("🔍 停在检测到3条重复导入记录处 - 查看状态", "=")
    print_state(state, "追加导入后状态")

    print_sep("🔍 停在检测到3条重复导入记录处 - 查看自检结果", "=")
    for r in checks:
        print(f"  检查项: {r.check_item}")
        print(f"  是否通过: {'✓ 通过' if r.passed else '✗ 未通过'}")
        print(f"  描述: {r.description}")
        print(f"  问题数量: {len(r.issues)}")
        if r.issues:
            print(f"  详细问题:")
            for i, issue in enumerate(r.issues, 1):
                print(f"    [{i}] 轨迹[{issue.track_id}]: {issue.description}")
        if r.details:
            print(f"  详细数据:")
            for k, v in r.details.items():
                if isinstance(v, list) and len(v) > 10:
                    print(f"    {k}: {v[:10]}... (共{len(v)}项)")
                else:
                    print(f"    {k}: {v}")

    print_sep("🔍 停在检测到3条重复导入记录处 - 查看历史留痕", "=")
    print_history(workflow)

    print_sep("🔍 停在检测到3条重复导入记录处 - 查看审计日志", "=")
    print_audit_logs(workflow)

    print_sep("🔍 停在检测到3条重复导入记录处 - 查看问题记录", "=")
    print_issues(workflow, filter_type="duplicate_import")

    print_sep("🔍 停在检测到3条重复导入记录处 - 查看结果说明 (result_summary)", "=")
    summary = state.result_summary
    print(f"  总导入数: {summary.get('total_count')} 条")
    print(f"  新增数: {summary.get('new_count')} 条")
    print(f"  重复数: {summary.get('duplicate_count')} 条")
    print(f"  重复轨迹ID: {summary.get('duplicate_track_ids')}")
    print(f"  新增轨迹ID: {summary.get('new_track_ids')}")
    print(f"  导入前记录数: {summary.get('before_count')}")
    print(f"  导入后记录数: {summary.get('after_count')}")
    print(f"  是否首次导入: {summary.get('is_first_import')}")

    print_sep("🔍 验证: 检测到3条重复导入记录", "!")
    dup_count = summary.get('duplicate_count', 0)
    print(f"  检测到重复数: {dup_count}")
    print(f"  预期: 3条 (TRK_001, TRK_002, TRK_003)")
    print(f"  结论: {'✓ 正确' if dup_count == 3 else '✗ 不正确'}")

    # ============================================================
    # 继续第二步：算法工程师小乔补看参数YAML
    # ============================================================
    print_sep("继续第二步: 算法工程师小乔补看参数YAML", "=")

    yaml_content = """
# 轨迹预测参数配置 - 已更新阈值
thresholds:
  default:
    value: 0.8
    description: 轨迹预测默认阈值 (6月10日更新，从0.7调整为0.8)
  high_confidence:
    value: 0.9
    description: 高置信度阈值
model_version: "v2.3.1"
features:
  - velocity
  - acceleration
  - heading
"""

    state, checks, conflicts = workflow.step_2_review_params(
        yaml_content=yaml_content,
        yaml_name="track_prediction_params_20260610.yaml",
    )

    print(f"\n  YAML加载完成！")
    print_state(state, "参数YAML补看后状态")

    print(f"\n  阈值冲突检测:")
    if conflicts:
        print(f"    检测到 {len(conflicts)} 处阈值冲突:")
        for c in conflicts[:3]:
            print(f"      - {c.description}")
    else:
        print(f"    无冲突")

    print(f"\n  自检结果:")
    for r in checks:
        print(f"    - {r.check_item}: {'✓ 通过' if r.passed else '✗ 未通过'} - {r.description}")

    # ============================================================
    # 阈值改过但报告重新对齐：解决冲突
    # ============================================================
    print_sep("阈值改过但报告重新对齐 - 解决冲突", "=")
    print("  说明: 候选表报告的阈值是旧的0.7，YAML已更新为0.8")
    print("  处理: 算法工程师小乔逐个确认冲突，选择以YAML为准")

    print(f"\n  共 {len(conflicts)} 条冲突待处理")
    for i, conflict in enumerate(conflicts, 1):
        print(f"\n  处理冲突 {i}/{len(conflicts)}:")
        print(f"    轨迹: {conflict.track_id}")
        print(f"    候选表阈值: {conflict.candidate_value}")
        print(f"    YAML阈值: {conflict.yaml_value}")
        print(f"    处理: confirmed（以YAML新阈值为准，重新对齐）")

        resolved = workflow.resolve_conflict(
            evidence_id=conflict.evidence_id,
            resolution="confirmed",
            resolved_by="算法工程师小乔",
        )
        print(f"    结果: 已{resolved.resolution}")

    print_state(workflow.state, "冲突解决后状态")

    print_sep("阈值重新对齐后的问题状态", "-")
    threshold_issues = [i for i in workflow.patch_record.issues if i.issue_type == "threshold_mismatch"]
    print(f"  阈值问题总数: {len(threshold_issues)}")
    print(f"  已解决: {sum(1 for i in threshold_issues if i.resolved)}")
    print(f"  待处理: {sum(1 for i in threshold_issues if not i.resolved)}")

    # ============================================================
    # 第三步：分层指标更新
    # ============================================================
    print_sep("第三步: 分层指标更新", "=")

    tier_metrics = {
        "tier_1_high_value": {
            "recall": 0.92,
            "precision": 0.88,
            "f1": 0.90,
            "count": 150,
            "missing_count": 8,
        },
        "tier_2_medium_value": {
            "recall": 0.85,
            "precision": 0.82,
            "f1": 0.83,
            "count": 320,
            "missing_count": 25,
        },
        "tier_3_general": {
            "recall": 0.78,
            "precision": 0.75,
            "f1": 0.76,
            "count": 530,
            "missing_count": 67,
        },
    }

    state, checks, unified_result = workflow.step_3_update_metrics(
        tier_metrics=tier_metrics,
        recalculate=False,
    )

    print(f"\n  分层指标更新完成！")
    print_state(state, "指标更新后状态")

    print(f"\n  统一结果层验证:")
    consistent = workflow.get_consistent_result()
    print(f"    结果版本: {consistent['version']}")
    print(f"    数据哈希: {consistent['data_hash']}")
    print(f"    导出/页面/API哈希一致: {consistent['export']['data_hash'] == consistent['page']['data_hash'] == consistent['api']['data_hash']}")
    print(f"    轨迹明细数: {len(consistent['export']['track_details'])}")

    # ============================================================
    # 最终汇总
    # ============================================================
    print_sep("最终状态汇总", "=")
    summary = workflow.get_workflow_summary()
    print(f"  Patch ID: {summary['patch_id']}")
    print(f"  当前步骤: {summary['current_step']}")
    print(f"  修补状态: {summary['status']}")
    print(f"  状态消息: {summary['status_message']}")
    print(f"  候选记录数: {summary['candidate_count']}")
    print(f"  导入批次历史: {summary['import_history_count']} 次")
    print(f"  问题总数: {summary['issues_summary']['total']}")
    print(f"  已解决: {summary['issues_summary']['resolved']}")
    print(f"  待处理: {summary['issues_summary']['unresolved']}")
    print(f"  能否进入下一步: {'是' if summary['can_proceed'] else '否'}")

    print_sep("步骤历史全览", "-")
    for i, step in enumerate(summary['step_history'], 1):
        print(f"  [{i}] {step['step']} - {step['description']}")

    print_sep("演示完成 ✓", "=")
    print("""
本次演示验证了:

1. ✓ 重复导入检测修复: 首次导入不再误判
   - 首次导入5条，检测到0条重复 ✓
   - 追加导入5条(3重复+2新增)，检测到3条重复 ✓

2. ✓ 状态变化可见: state.status_message / result_summary
   - 导入后立即显示"共X条，新增Y条，重复Z条"
   - result_summary包含完整明细

3. ✓ 历史留痕完整: step_history + 审计日志
   - 每次操作都有时间戳、操作人、描述
   - 谁改了什么、为什么改，一目了然

4. ✓ 问题记录可追踪: issues 列表
   - 每条重复导入都有对应的issue
   - 有轨迹ID、严重度、解决状态

5. ✓ 阈值改过但报告重新对齐
   - 冲突检测列出证据
   - 人工确认/驳回，不自动拍板
   - 解决后状态同步更新

6. ✓ 统一结果层
   - 导出/页面/API读同一份数据
   - 异常记录全渠道一致
""")


if __name__ == "__main__":
    demo_duplicate_issue()
