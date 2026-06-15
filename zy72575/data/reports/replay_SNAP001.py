#!/usr/bin/env python3
"""
快照 SNAP001 重放脚本
生成时间: 2026-06-15T13:23:37.297421
原始行号: 1

此脚本可完整重放：
  1. 特征快照第一次导入
  2. 数据科学家补看训练日志曲线
  3. 可解释摘要更新
  4. （如触发）线上特征缺失却给了默认分 → 推荐负责人复核
"""

import sys
import os

# 确保能找到 ranking_click_bias 模块
_script_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(os.path.dirname(_script_dir))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from ranking_click_bias import SnapshotManager, HistoryTracker, BoundaryRuleEngine, WorkflowEngine, AuditReporter

# ===== 第 0 步：初始化系统 =====
history_tracker = HistoryTracker(history_dir='data/replay_history')
snapshot_mgr = SnapshotManager(data_dir='data/replay_snapshots', history_tracker=history_tracker)
rule_engine = BoundaryRuleEngine(rules_dir='data/replay_rules')
workflow = WorkflowEngine(snapshot_mgr, history_tracker, rule_engine)
reporter = AuditReporter(snapshot_mgr, history_tracker, workflow, output_dir='data/replay_reports')


# ===== 第 1 步：特征快照编号第一次导入 =====
# 原始行号: 1
raw_data = {
    'snapshot_id': 'SNAP001',
    'feature_001': 0.52,
    'feature_002': 0.78,
    'feature_003': None,
    'feature_004': 0.34,
    'source': 'online_traffic',
    'date': '2026-06-01'
}
snapshots_data = [raw_data]
imported, skipped = snapshot_mgr.import_snapshots(
    snapshots_data,
    source='online_20260615',
    imported_by='数据科学家林姐'
)
print('[Step 1] 导入完成: 新增 {} 条, 跳过 {} 条'.format(len(imported), len(skipped)))
if imported:
    print('  快照ID: {}'.format(imported[0].snapshot_id))
    print('  原始行号: {}'.format(imported[0].original_line_number))

# 确认导入完成（工作流 Step 1）
snapshot_id = 'SNAP001'
step1_result = workflow.step_1_import(
    snapshot_id,
    imported_by='数据科学家林姐',
    import_notes='6月15日线上特征快照，共3条，格式正常'
)
print('[Step 1] 工作流状态: {}'.format(step1_result.status.value))

# ===== 补充：手动备注修改 =====
# 数据科学家林姐等手动修改的备注
snapshot_mgr.update_snapshot(
    snapshot_id,
    updates={'notes': '初步检查发现 feature_003 有空值，后续需关注'},
    updated_by='林姐',
    change_reason='补充特征异常说明'
)
print('[备注更新] 林姐 修改了备注: 初步检查发现 feature_003 有空值，后续需关注')


# ===== 第 2 步：数据科学家林姐补看训练日志曲线 =====
step2_result = workflow.step_2_review_logs(
    snapshot_id,
    reviewed_by='林姐',
    training_log_analysis='训练曲线收敛正常，AUC从0.71稳步提升至0.86，第15轮后稳定。验证集与训练集gap约0.03，无明显过拟合。',
    curve_findings='loss曲线平滑下降，无震荡。AUC提升符合预期。注意第8轮有轻微波动但很快恢复。'
)
print('[Step 2] 日志审阅完成: {}'.format(step2_result.status.value))
print('  训练日志分析: 训练曲线收敛正常，AUC从0.71稳步提升至0.86，第15轮后稳定。验证集与训练集gap约0.03...')


# ===== 第 3 步：可解释摘要更新 =====
step3_result = workflow.step_3_update_summary(
    snapshot_id,
    updated_by='林姐',
    explainable_summary='该样本点击偏差评分为0.16，主要影响因素：位置偏置贡献58%，曝光时间贡献27%，用户历史行为贡献15%。特别说明：feature_003（商品类目深度特征）缺失，使用了全局默认分0.5填充，可能对偏差评分有±0.03的影响。',
    click_bias_score=0.16,
    missing_features=['feature_003'],
    default_score_applied=True
)
print('[Step 3] 摘要更新完成: {}'.format(step3_result.status.value))
print('  点击偏差分数: {}'.format(step3_result.click_bias_score))
print('  缺失特征: {}'.format(step3_result.missing_features))
print('  使用默认分: {}'.format(step3_result.default_score_applied))

# ===== 边界规则触发：线上特征缺失却给了默认分 =====
needs_review = step3_result.status.value == 'needs_review'
if needs_review:
    print('⚠️  触发边界规则：线上特征缺失却给了默认分')
    print('   自动标记为 needs_review，分配给推荐负责人复核')
    print('   不急着归正常，留给推荐负责人人工判断')
else:
    print('✅ 未触发边界规则')


# ===== 第 4 步：推荐负责人复核 =====
# 复核人: 推荐负责人王哥
# 复核时间: 2026-06-15T13:23:37.288301
# 复核结果: 通过

review_result = workflow.approve_review(
    snapshot_id,
    reviewed_by='推荐负责人王哥',
    approval_notes='已确认feature_003缺失为上游类目系统临时故障导致，故障已修复。默认分填充方式合理，对整体偏差评估影响在可接受范围内。同意标记为正常。',
    mark_as_normal=True
)
print('[Review] 复核通过: {}'.format(review_result.status.value))
print('  复核人: {}'.format(review_result.reviewed_by))
print('  复核意见: {}'.format(review_result.notes))


# ===== 查看完整历史记录 =====
print()
print('=' * 60)
print('重放完成 - 最终状态')
print('=' * 60)

final_status = workflow.get_workflow_status(snapshot_id)
print('快照ID: {}'.format(final_status['snapshot_id']))
print('当前步骤: {}'.format(final_status['current_step']))
print('工作流状态: {}'.format(final_status['current_state']))
print('处理状态: {}'.format(final_status['status']))
print('需要负责人复核: {}'.format(final_status['needs_leader_review']))
print('缺失特征: {}'.format(final_status['missing_features']))
print('使用默认分: {}'.format(final_status['default_score_applied']))

full_history = history_tracker.get_full_history(snapshot_id)
print()
print('历史变更总数: {}'.format(full_history['change_count']))
print('审计记录总数: {}'.format(full_history['audit_count']))
print()
print('变更明细:')
for c in full_history['changes']:
    print('  [{}] {}'.format(c['changed_at'], c['changed_by']))
    print('    {}: {} → {}'.format(
        c['field'], repr(c['old_value']), repr(c['new_value'])
    ))
    if c.get('reason'):
        print('    原因: {}'.format(c['reason']))

notes_history = history_tracker.get_notes_history(snapshot_id)
if notes_history:
    print()
    print('备注变更历史 (改前改后对比):')
    for i, n in enumerate(notes_history):
        print('  版本 {}: {}'.format(i+1, n['changed_at']))
        print('    操作人: {}'.format(n['changed_by']))
        print('    改前: {}'.format(repr(n['old_notes'])))
        print('    改后: {}'.format(repr(n['new_notes'])))
        print('    原因: {}'.format(n['reason']))

print()
print('=' * 60)
print('重放完成 - 可对比原始结果验证一致性')
print('=' * 60)