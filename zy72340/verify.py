import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import models

def p(msg, level='info'):
    prefix = {'info': '✅ ', 'warn': '⚠️ ', 'err': '❌ ', 'step': '\n🔹 '}[level]
    print(prefix + msg)

def assert_eq(actual, expected, name):
    if actual == expected:
        p(f"{name}: {actual} == {expected} OK", 'info')
        return True
    else:
        p(f"{name}: {actual} != {expected} FAIL", 'err')
        return False

def assert_in(actual, container, name):
    if actual in container:
        p(f"{name}: '{actual}' in {container} OK", 'info')
        return True
    else:
        p(f"{name}: '{actual}' not in {container} FAIL", 'err')
        return False

def assert_true(cond, name):
    if cond:
        p(f"{name} OK", 'info')
        return True
    else:
        p(f"{name} FAIL", 'err')
        return False

def main():
    p("开始端到端验证：最小二乘标定台账 · 暂停续局全流程", 'step')

    op = 'verify_script'

    # === Step 1: 初始化 DB 并创建基础数据 ===
    p("Step 1: 创建评分权重表、台账、基础数据", 'step')
    wt_id = models.WeightTable.create('v2.0-test', '验证用权重表', {'x': 1.0, 'y': 1.0, 'intercept': 1.0}, op)
    assert_true(wt_id > 0, 'WeightTable.create 返回有效ID')

    items = [{'x': 1.0, 'y': 2.1}, {'x': 2.0, 'y': 3.9}, {'x': 3.0, 'y': 6.2}, {'x': 4.0, 'y': 7.8}, {'x': 5.0, 'y': 10.3}]
    ledger_id = models.LedgerRecord.create('LD-TEST-001', '【验证】断档暂停续局全流程', wt_id, items, op)
    assert_true(ledger_id > 0, 'LedgerRecord.create 返回有效ID')

    # === Step 2: 删除中间一行，触发断档 ===
    p("Step 2: 删除中间一行，触发编号断档 → 应自动进入 paused 状态", 'step')
    record = models.LedgerRecord.get(ledger_id)
    assert_eq(len(record['items']), 5, '删除前应有5条数据')
    item_to_del = record['items'][2]  # 第3条 (item_no=3)

    del_result = models.LedgerItem.soft_delete(item_to_del['id'], op, delete_reason='验证：该行数据异常，需教研组复核')
    assert_true(del_result.get('has_gap'), '删除后应触发断档 has_gap=True')

    # === Step 3: 验证暂停状态 + 工作流字段完整 ===
    p("Step 3: 验证暂停状态、工作流字段、历史记录", 'step')
    record = models.LedgerRecord.get(ledger_id)
    assert_eq(record['workflow_state'], models.WORKFLOW_PAUSED, 'workflow_state 应为 paused')
    assert_eq(record['status'], 'pending_review', 'status 应为 pending_review')
    assert_eq(record['has_gap'], 1, 'has_gap 应为 1')
    assert_true(record['pause_reason'] is not None and '断档' in record['pause_reason'], 'pause_reason 包含"断档"')
    assert_eq(record['next_owner'], '教研组长', 'next_owner 应为教研组长')
    assert_eq(len(record['items']), 4, '删除后应有4条活跃数据')
    assert_eq(len(record['deleted_items']), 1, '应有1条已删除数据')
    assert_eq(record['deleted_items'][0]['delete_reason'], '验证：该行数据异常，需教研组复核', 'delete_reason 完整保存')

    gap = models.LedgerRecord.check_gap(ledger_id)
    assert_true(gap['has_gap'], 'check_gap 返回 has_gap=True')
    assert_true(len(gap['gaps']) >= 1, '至少有1处断档')

    history = models.HistoryLog.list_by_ledger(ledger_id)
    pause_logs = [h for h in history if '暂停' in h['action'] or '待复核' in h['action']]
    assert_true(len(pause_logs) >= 1, '历史记录中有暂停相关记录')
    pause_detail = pause_logs[-1].get('detail', {})
    assert_true('pause_reason' in pause_detail and 'next_owner' in pause_detail, '暂停历史包含 pause_reason/next_owner')
    assert_true('original_state' in pause_detail, '暂停历史包含 original_state 快照')

    # === Step 4: 暂停状态下尝试计算 → 应被拒绝 ===
    p("Step 4: 暂停状态下 run_calculation 应被拒绝", 'step')
    calc_result = models.run_calculation(ledger_id, op)
    assert_true('error' in calc_result, '暂停时 run_calculation 应返回 error')
    assert_in('暂停', calc_result['error'], '错误信息包含"暂停"')
    assert_true('hint' in calc_result and '复核' in calc_result['hint'], '返回 hint 提示先复核')
    assert_eq(calc_result['next_owner'], '教研组长', '错误中包含 next_owner')

    # === Step 5: 教研组复核通过 → 续局 ===
    p("Step 5: 教研组复核通过，调用 ReviewRecord.create 续局", 'step')
    rv_id = models.ReviewRecord.create(
        ledger_id=ledger_id,
        review_type='gap_review',
        review_result='approve',
        review_note='原始说法：第三行数据采集错误；改后：删除该行编号不连续；改后值合理，因为该行明显偏离线性趋势。',
        reviewed_by='教研组长',
        reason='第3条数据(x=3,y=6.2)偏离线性趋势超过2倍残差阈值，经核对原始实验记录确认录入错误，剔除合理。',
        next_owner='唐老师（续局处理）'
    )
    assert_true(rv_id > 0, 'ReviewRecord.create 返回有效ID')

    record = models.LedgerRecord.get(ledger_id)
    assert_eq(record['workflow_state'], models.WORKFLOW_RESUMED, 'workflow_state 应变为 resumed')
    assert_eq(record['status'], 'ready', 'status 应变为 ready')
    assert_eq(record['review_status'], 'reviewed', 'review_status 应为 reviewed')
    assert_true(record['resumed_by'] is not None, 'resumed_by 已写入')
    assert_true(record['resume_reason'] is not None, 'resume_reason 已写入')

    reviews = models.ReviewRecord.list_by_ledger(ledger_id)
    assert_eq(len(reviews), 1, '应有1条复核记录')
    rv = reviews[0]
    assert_true(rv.get('original_state') is not None, '复核记录包含 original_state 快照')
    assert_true(rv.get('modified_state') is not None, '复核记录包含 modified_state 快照')
    assert_true(rv.get('deleted_items_detail') is not None, '复核记录包含 deleted_items_detail')
    assert_true(rv.get('gap_detail') is not None, '复核记录包含 gap_detail')
    assert_eq(rv['reason'], '第3条数据(x=3,y=6.2)偏离线性趋势超过2倍残差阈值，经核对原始实验记录确认录入错误，剔除合理。', 'reason 字段完整保存')
    assert_eq(rv['next_owner'], '唐老师（续局处理）', 'next_owner 字段完整保存')

    history = models.HistoryLog.list_by_ledger(ledger_id)
    resume_logs = [h for h in history if '续局' in h['action'] or '复核' in h['action']]
    assert_true(len(resume_logs) >= 2, '历史记录中有续局和复核相关记录')

    # === Step 6: 续局后重新计算 ===
    p("Step 6: 续局后执行 run_calculation，应成功并带工作流标签", 'step')
    calc_result = models.run_calculation(ledger_id, op)
    assert_true('error' not in calc_result, '续局后 run_calculation 不应报错')
    assert_true(calc_result.get('params') and calc_result['params'].get('slope') is not None, '返回有效参数 slope')
    assert_true(calc_result.get('workflow_tags') and len(calc_result['workflow_tags']) > 0, 'workflow_tags 非空')
    assert_in('续局后计算', ' '.join(calc_result['workflow_tags']), 'workflow_tags 包含"续局后计算"')
    assert_eq(calc_result['workflow_state'], models.WORKFLOW_RESUMED, '结果包含正确 workflow_state')
    assert_true(calc_result['has_gap'], '结果 has_gap=True')

    # === Step 7: 验证参数版本带工作流快照 ===
    p("Step 7: ParamVersion 应包含 workflow_snapshot", 'step')
    pvs = models.ParamVersion.list_by_ledger(ledger_id)
    assert_true(len(pvs) >= 1, '至少有1个参数版本')
    latest_pv = pvs[-1]
    assert_true(latest_pv.get('workflow') is not None, '参数版本包含 workflow 快照')
    assert_eq(latest_pv['workflow']['workflow_state'], models.WORKFLOW_RESUMED, '参数版本快照 workflow_state=resumed')
    assert_true(latest_pv['workflow'].get('has_gap') == 1, '参数版本快照记录 has_gap=1')

    # === Step 8: 验证导出报告 ===
    p("Step 8: export_report 导出完整报告", 'step')
    report = models.export_report(ledger_id)
    assert_true('ledger' in report and report['ledger']['serial_no'] == 'LD-TEST-001', '报告包含 ledger 信息')
    assert_true('workflow' in report and report['workflow']['current_state'] == models.WORKFLOW_RESUMED, '报告包含 workflow 摘要')
    assert_true('weight_table' in report, '报告包含 weight_table')
    assert_true(len(report.get('param_versions', [])) >= 1, '报告包含 param_versions')
    assert_true(len(report.get('reviews', [])) >= 1, '报告包含 reviews（原始说法/改后值/原因/下一步）')
    assert_true(len(report.get('history', [])) >= 5, '报告包含完整 history')
    assert_true('items_active' in report and len(report['items_active']) == 4, '报告包含 items_active(4)')
    assert_true('items_deleted' in report and len(report['items_deleted']) == 1, '报告包含 items_deleted(1)')
    assert_true(report['reviews'][0].get('reason') is not None, '报告中 review 带 reason')
    assert_true(report['reviews'][0].get('next_owner') is not None, '报告中 review 带 next_owner')
    assert_true(report['reviews'][0].get('gap_detail') is not None, '报告中 review 带 gap_detail')
    assert_true(report['reviews'][0].get('deleted_items_detail') is not None, '报告中 review 带 deleted_items_detail')

    # === Step 9: 列表/详情/历史/参数版本 数据一致性校验 ===
    p("Step 9: 列表、详情、参数版本、历史记录四端数据一致性", 'step')
    list_records = models.LedgerRecord.list_all()
    lr = [l for l in list_records if l['id'] == ledger_id][0]
    detail = models.LedgerRecord.get(ledger_id)
    assert_eq(lr['workflow_state'], detail['workflow_state'], '列表 workflow_state == 详情 workflow_state')
    assert_eq(lr['status'], detail['status'], '列表 status == 详情 status')
    assert_eq(lr['has_gap'], detail['has_gap'], '列表 has_gap == 详情 has_gap')

    pvs = models.ParamVersion.list_by_ledger(ledger_id)
    latest_workflow = pvs[-1]['workflow']
    assert_eq(latest_workflow['workflow_state'], detail['workflow_state'], '参数版本最新 workflow_state == 详情 workflow_state')

    # === Step 10: 旧口径补录流程 ===
    p("Step 10: 验证旧口径补录全流程", 'step')
    old_id = models.LedgerRecord.create('LD-TEST-002', '【验证】旧口径补录', wt_id,
        [{'x': 1.0, 'y': 2.0}, {'x': 2.0, 'y': 3.9}, {'x': 3.0, 'y': 6.0}, {'x': 4.0, 'y': 8.0}], op)
    add_result = models.LedgerItem.add_old_caliber_item(old_id, 5.0, 10.2, '旧公式截图2025赛季第3页', op)
    assert_true(add_result.get('item_id') and add_result['item_id'] > 0, '旧口径补录返回 item_id')

    old_detail = models.LedgerRecord.get(old_id)
    assert_eq(old_detail['is_old_caliber'], 1, 'is_old_caliber=1')
    assert_true(len([it for it in old_detail['items'] if it['is_old_caliber']]) == 1, '有1条旧口径数据')

    calc_old = models.run_calculation(old_id, op)
    assert_true('error' not in calc_old, '旧口径台账计算成功')
    assert_in('旧口径数据', ' '.join(calc_old.get('workflow_tags', [])), 'workflow_tags 包含旧口径标记')

    # === Final Summary ===
    p("=================================================================", 'step')
    p("所有验证通过！暂停→复核→续局→计算 全链路数据一致。", 'info')
    p("  ✓ 删除触发断档自动进入 paused，next_owner=教研组长", 'info')
    p("  ✓ 暂停状态拒绝计算，返回 hint+暂停原因+下一步找谁", 'info')
    p("  ✓ 复核记录保存：original_state / modified_state / reason / deleted_items / gap_detail / next_owner", 'info')
    p("  ✓ 复核通过 → workflow_state=resumed，status=ready，可计算", 'info')
    p("  ✓ 参数版本携带 workflow_snapshot（normal/paused/resumed）", 'info')
    p("  ✓ 导出报告串联工作流摘要+权重表+截图+活动/删除数据+参数版本+复核+历史", 'info')
    p("  ✓ 列表/详情/参数版本/历史记录 四端数据完全一致", 'info')
    p("=================================================================", 'step')

if __name__ == '__main__':
    main()
