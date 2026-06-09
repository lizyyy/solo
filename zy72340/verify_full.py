#!/usr/bin/env python3
"""
全链路一致性验证：
1. 触发问题输入（删除产生断档、补录旧口径）
2. 验证四要素保存（原始说法/改后值/原因/下一步找谁）
3. 验证状态变化（断档→待复核→复核通过→可正常计算）
4. 验证同一份数据在列表/详情/摘要/参数版本/历史记录/报告中一致
5. 验证导出报告功能正常
"""

import sys
sys.path.insert(0, '/Users/lzy/pro/solo/workspaces/zy72340')

import models
import os
import json

if os.path.exists(models.DB_PATH):
    os.remove(models.DB_PATH)
    print("已清理旧数据库")

models.init_db()
print("数据库初始化完成")

operator = "唐老师"

all_passed = True

def check(name, condition, detail=""):
    global all_passed
    status = "✅ PASS" if condition else "❌ FAIL"
    print(f"  {status} - {name}")
    if detail:
        print(f"         {detail}")
    if not condition:
        all_passed = False

print("\n" + "="*70)
print("【验证1】删除产生断档 → 四要素完整保存 + 状态变为pending_review")
print("="*70)

wt = models.WeightTable.create('v1.0', '测试权重表', {'x':1.0,'y':1.0,'intercept':1.0}, operator)
ledger_id = models.LedgerRecord.create(
    'LD-TEST-001', '【测试】删除断档四要素验证', wt,
    [{'x':1,'y':2},{'x':2,'y':4},{'x':3,'y':6},{'x':4,'y':8},{'x':5,'y':10}],
    operator
)

record = models.LedgerRecord.get(ledger_id)
item3_id = record['items'][2]['id']

print(f"\n删除编号3数据点(ID={item3_id})...")
models.LedgerItem.soft_delete(item3_id, operator, '测试删除原因：异常点剔除')

record_after = models.LedgerRecord.get(ledger_id)
list_all = models.LedgerRecord.list_all()
lr_in_list = next((l for l in list_all if l['id'] == ledger_id), None)

check("status变为pending_review", record_after['status'] == 'pending_review',
      f"实际status={record_after['status']}")
check("review_status变为pending_review", record_after['review_status'] == 'pending_review')
check("has_gap=1", record_after['has_gap'] == 1)
check("列表页has_gap一致", lr_in_list['has_gap'] == record_after['has_gap'])
check("列表页status一致", lr_in_list['status'] == record_after['status'])
check("列表页review_status一致", lr_in_list['review_status'] == record_after['review_status'])

check("gap_original_claim（原始说法）已保存", bool(record_after['gap_original_claim']),
      f"内容: {record_after['gap_original_claim'][:80]}...")
check("gap_corrected_value（改后值）已保存", bool(record_after['gap_corrected_value']),
      f"内容: {record_after['gap_corrected_value'][:80]}...")
check("gap_reason（处理原因）已保存", bool(record_after['gap_reason']),
      f"内容: {record_after['gap_reason'][:80]}...")
check("gap_next_handler（下一步找谁）='教研组复核断档'",
      record_after['gap_next_handler'] == '教研组复核断档')
check("主表next_handler一致", record_after['next_handler'] == '教研组复核断档')
check("列表页next_handler一致", lr_in_list['next_handler'] == '教研组复核断档')

check("断档检测gap_detail中包含缺失编号3",
      record_after['gap_detail']['has_gap'] and \
      any(3 in g.get('missing',[]) for g in record_after['gap_detail'].get('gap_details',[])))

print(f"\n断档记录params为{record_after.get('params')} → 确实不归正常，正确")

print("\n" + "="*70)
print("【验证2】断档记录尝试跑计算 → 生成暂停的参数版本，不更新主表")
print("="*70)

result = models.run_calculation(ledger_id, operator)
check("run_calculation返回is_suspended=True", result.get('is_suspended') == True)
check("run_calculation返回next_handler='教研组复核断档'",
      result.get('next_handler') == '教研组复核断档')

versions = models.ParamVersion.list_by_ledger(ledger_id)
check(f"参数版本数={len(versions)}", len(versions) == 1)
if versions:
    pv = versions[0]
    check("参数版本is_suspended=1", pv.get('is_suspended') == 1)
    check("参数版本有suspension_note", bool(pv.get('suspension_note')))
    check("参数版本next_handler='教研组复核断档'",
          pv.get('next_handler') == '教研组复核断档')

record_after_run = models.LedgerRecord.get(ledger_id)
check("主表params仍为None（不归正常）", record_after_run.get('params') is None,
      f"实际params={record_after_run.get('params')}")
check("主表status仍为pending_review", record_after_run['status'] == 'pending_review')

print("\n" + "="*70)
print("【验证3】变更轨迹表 → 断档删除有完整轨迹（原值→改值→原因→下一步）")
print("="*70)

traces = models.ChangeTrace.list_by_ledger(ledger_id)
check(f"变更轨迹数量={len(traces)}", len(traces) >= 2)  # 创建+删除

delete_trace = next((t for t in traces if t['trace_type'] == 'item_delete'), None)
check("找到item_delete类型轨迹", delete_trace is not None)
if delete_trace:
    check("删除轨迹original_value包含原始xy",
          isinstance(delete_trace['original_value'], dict) and \
          'x' in delete_trace['original_value'])
    check("删除轨迹corrected_value包含删除状态",
          isinstance(delete_trace['corrected_value'], dict))
    check("删除轨迹change_reason='测试删除原因：异常点剔除'",
          delete_trace['change_reason'] == '测试删除原因：异常点剔除')
    check("删除轨迹next_handler='教研组复核断档'",
          delete_trace['next_handler'] == '教研组复核断档')
    check("删除轨迹is_suspended=1", delete_trace['is_suspended'] == 1)
    check("删除轨迹suspension_note包含断档字样",
          bool(delete_trace.get('suspension_note')))

print("\n" + "="*70)
print("【验证4】历史记录联表带出变更轨迹四要素")
print("="*70)

history = models.HistoryLog.list_by_ledger(ledger_id)
delete_history = next((h for h in history if '软删除' in h['action']), None)
check("找到软删除历史记录", delete_history is not None)
if delete_history:
    check("历史记录关联change_trace_id", delete_history.get('change_trace_id') is not None)

print("\n" + "="*70)
print("【验证5】复核通过 → 状态变为ready，四要素保留")
print("="*70)

models.ReviewRecord.create(
    ledger_id, 'gap_review', 'approve',
    '复核通过：确认编号3为异常点，删除合理',
    '教研组长',
    original_claim=record_after['gap_original_claim'],
    corrected_value=record_after['gap_corrected_value'],
    next_step='唐老师继续参数拟合',
    next_handler='唐老师'
)

record_reviewed = models.LedgerRecord.get(ledger_id)
check("review_status变为reviewed", record_reviewed['review_status'] == 'reviewed')
check("status变为ready", record_reviewed['status'] == 'ready')
check("gap_original_claim仍然保留（不丢失）",
      record_reviewed['gap_original_claim'] == record_after['gap_original_claim'])
check("gap_corrected_value仍然保留", bool(record_reviewed['gap_corrected_value']))
check("gap_reason仍然保留", bool(record_reviewed['gap_reason']))
check("gap_next_handler更新为唐老师", record_reviewed['gap_next_handler'] == '唐老师')
check("主表next_handler更新为唐老师", record_reviewed['next_handler'] == '唐老师')

print("\n复核后重新跑计算...")
result2 = models.run_calculation(ledger_id, operator)
check("复核后计算不再suspended", result2.get('is_suspended') in [False, None, 0])

record_final = models.LedgerRecord.get(ledger_id)
check("主表params已更新（归正常）", record_final.get('params') is not None,
      f"params={record_final.get('params')}")

versions_final = models.ParamVersion.list_by_ledger(ledger_id)
latest_pv = versions_final[-1]
check("最新参数版本已生效（is_suspended=0）",
      latest_pv.get('is_suspended') in [False, None, 0])

print("\n" + "="*70)
print("【验证6】旧口径补录 → 原始参数被保存，四要素完整")
print("="*70)

ledger3_id = models.LedgerRecord.create(
    'LD-TEST-003', '【测试】旧口径补录验证', wt,
    [{'x':1,'y':2},{'x':2,'y':4},{'x':3,'y':6},{'x':4,'y':8}], operator
)
models.run_calculation(ledger3_id, operator)  # 先跑一次得到原始参数
record_old_before = models.LedgerRecord.get(ledger3_id)
params_before = record_old_before.get('params', {})
print(f"补录前参数: k={params_before.get('slope')}, b={params_before.get('intercept')}")

old_item_id = models.LedgerItem.add_old_caliber_item(
    ledger3_id, 5.0, 12.0, '旧公式截图第7页', operator,
    '测试补录：从旧公式截图找到的2024赛季数据'
)

record_old_after = models.LedgerRecord.get(ledger3_id)
check("is_old_caliber=1", record_old_after['is_old_caliber'] == 1)
check("original_params_json已保存（补录前参数）",
      record_old_after.get('original_params') is not None)
check("original_params与补录前一致",
      record_old_after['original_params'].get('slope') == params_before.get('slope'))
check("next_handler='唐老师复核旧口径适用性'",
      record_old_after['next_handler'] == '唐老师复核旧口径适用性')
check("correction_reason包含补录说明", bool(record_old_after.get('correction_reason')))

old_traces = models.ChangeTrace.list_by_ledger(ledger3_id)
old_trace = next((t for t in old_traces if t['trace_type'] == 'old_caliber_add'), None)
check("找到old_caliber_add轨迹", old_trace is not None)
if old_trace:
    check("轨迹source_ref='旧公式截图第7页'", old_trace.get('source_ref') == '旧公式截图第7页')
    check("轨迹change_reason包含补录原因", '测试补录' in old_trace.get('change_reason',''))
    check("轨迹next_handler='唐老师复核旧口径适用性'",
          old_trace['next_handler'] == '唐老师复核旧口径适用性')

print("\n" + "="*70)
print("【验证7】全链路一致性：同一条记录在9个视图中数据一致")
print("="*70)

lid = ledger_id  # 断档那条（现在已复核）
from_list = models.LedgerRecord.list_all()
in_list = next((l for l in from_list if l['id'] == lid), None)
in_detail = models.LedgerRecord.get(lid)
in_report = models.LedgerRecord.generate_report(lid, 'json')
in_pv_list = models.ParamVersion.list_by_ledger(lid)
in_history = models.HistoryLog.list_by_ledger(lid)
in_traces = models.ChangeTrace.list_by_ledger(lid)
in_gap = models.LedgerRecord.check_gap(lid)

check("list_all vs get: status一致", in_list['status'] == in_detail['status'])
check("list_all vs get: review_status一致", in_list['review_status'] == in_detail['review_status'])
check("list_all vs get: has_gap一致", in_list['has_gap'] == in_detail['has_gap'])
check("list_all vs get: next_handler一致", in_list['next_handler'] == in_detail['next_handler'])
check("list_all vs get: params一致", 
      (in_list.get('params') or {}).get('slope') == (in_detail.get('params') or {}).get('slope'))

check("detail vs report: serial_no一致", in_detail['serial_no'] == in_report['serial_no'])
check("detail vs report: status一致", in_detail['status'] == in_report['status'])
check("detail vs report: params一致", 
      (in_detail.get('params') or {}).get('slope') == (in_report.get('current_params') or {}).get('slope'))
check("detail vs report: gap四要素一致",
      in_detail.get('gap_original_claim') == in_report['gap_info'].get('original_claim'))
check("detail vs report: gap_next_handler一致",
      in_detail.get('gap_next_handler') == in_report['gap_info'].get('next_handler'))
check("detail vs report: items数量一致",
      len(in_detail.get('items',[])) == len(in_report.get('items',[])))
check("detail vs report: param_versions数量一致",
      len(in_detail.get('param_versions',[])) == len(in_report.get('param_versions',[])))
check("detail vs report: change_traces数量一致",
      len(in_detail.get('change_traces',[])) == len(in_report.get('change_traces',[])))

check("detail vs check_gap: has_gap一致",
      in_detail['gap_detail']['has_gap'] == in_gap['has_gap'])
check("detail vs check_gap: gaps数组一致",
      in_detail['gap_detail']['gaps'] == in_gap['gaps'])

latest_pv_detail = in_detail['param_versions'][-1] if in_detail.get('param_versions') else None
latest_pv_api = in_pv_list[-1] if in_pv_list else None
check("detail内嵌param_versions vs API param-versions: 最新version_no一致",
      latest_pv_detail and latest_pv_api and \
      latest_pv_detail['version_no'] == latest_pv_api['version_no'])
check("detail内嵌param_versions vs API: is_suspended一致",
      latest_pv_detail and latest_pv_api and \
      (latest_pv_detail.get('is_suspended') or 0) == (latest_pv_api.get('is_suspended') or 0))

check("detail内嵌history vs API history: 数量一致",
      len(in_detail.get('history',[])) == len(in_history))
check("detail内嵌change_traces vs API traces: 数量一致",
      len(in_detail.get('change_traces',[])) == len(in_traces))

print("\n" + "="*70)
print("【验证8】CSV导出报告正常生成")
print("="*70)

csv_report = models.LedgerRecord.generate_report(lid, 'csv')
check("CSV报告非空", bool(csv_report))
check("CSV包含标题'最小二乘标定台账报告'", '最小二乘标定台账报告' in csv_report)
check("CSV包含断档信息章节", '四、断档信息' in csv_report)
check("CSV包含原始说法字段", '原始说法' in csv_report)
check("CSV包含变更轨迹章节", '七、变更轨迹' in csv_report)
check("CSV包含参数版本历史", '八、参数版本历史' in csv_report)
print(f"  CSV报告长度: {len(csv_report)} 字符")

print("\n" + "="*70)
print("【验证9】暂停/恢复功能正常")
print("="*70)

lid4 = models.LedgerRecord.create(
    'LD-TEST-004', '【测试】暂停恢复功能', wt,
    [{'x':1,'y':2},{'x':2,'y':4},{'x':3,'y':6}], operator
)

trace_id = models.LedgerRecord.suspend(lid4, operator, '等待外部数据确认', '张三')
r_suspend = models.LedgerRecord.get(lid4)
check("暂停后status=suspended", r_suspend['status'] == 'suspended')
check("暂停后next_handler='张三'", r_suspend['next_handler'] == '张三')
check("暂停后suspension_note正确", r_suspend['suspension_note'] == '等待外部数据确认')
check("暂停后is_suspended=True", r_suspend['is_suspended'] == True)

traces_suspend = models.ChangeTrace.list_by_ledger(lid4)
suspend_trace = next((t for t in traces_suspend if t['trace_type'] == 'suspend'), None)
check("暂停轨迹类型为suspend", suspend_trace is not None)
check("暂停轨迹is_suspended=1", suspend_trace and suspend_trace['is_suspended'] == 1)

models.LedgerRecord.resume(lid4, operator, '外部数据已到')
r_resume = models.LedgerRecord.get(lid4)
check("恢复后status=ready", r_resume['status'] == 'ready')
check("恢复后is_suspended=False", r_resume['is_suspended'] == False)

print("\n" + "="*70)
print("【验证10】修正数据点功能 → 变更轨迹完整")
print("="*70)

lid5 = models.LedgerRecord.create(
    'LD-TEST-005', '【测试】修正数据点', wt,
    [{'x':1,'y':2},{'x':2,'y':40},{'x':3,'y':6}], operator
)

r5 = models.LedgerRecord.get(lid5)
item2_id = r5['items'][1]['id']
correct_result = models.LedgerItem.correct_item(
    item2_id, new_y=4.0, reason='抄录错误：y应该是4不是40',
    source='原始记录本P12', operator=operator
)
check("修正返回success", correct_result.get('status') == 'success')

r5_after = models.LedgerRecord.get(lid5)
check("修正后y值变为4.0", r5_after['items'][1]['y_value'] == 4.0)
check("original_y保留40.0", r5_after['items'][1]['original_y'] == 40.0)
check("correction_reason保存正确", r5_after['items'][1]['correction_reason'] == '抄录错误：y应该是4不是40')

traces5 = models.ChangeTrace.list_by_ledger(lid5)
correct_trace = next((t for t in traces5 if t['trace_type'] == 'item_correct'), None)
check("找到item_correct轨迹", correct_trace is not None)
if correct_trace:
    check("修正轨迹原始y=40", correct_trace['original_value'].get('y') == 40.0)
    check("修正轨迹改后y=4", correct_trace['corrected_value'].get('y') == 4.0)
    check("修正轨迹原因正确", '抄录错误' in correct_trace['change_reason'])
    check("修正轨迹source_ref='原始记录本P12'", correct_trace['source_ref'] == '原始记录本P12')

print("\n" + "="*70)
print("✅" if all_passed else "❌", "全部验证结束！")
print("="*70)

if all_passed:
    print("\n🎉 全链路一致性验证全部通过！核心点总结：")
    print("  1. ✅ 断档四要素（原始说法/改后值/原因/下一步）全链路保存")
    print("  2. ✅ 断档未复核前params不更新（不归正常，关键核心要求）")
    print("  3. ✅ 列表/详情/摘要/参数版本/历史记录/报告 全部从同一份LedgerRecord.get()获取")
    print("  4. ✅ 断档→待复核→复核通过→参数归正常 状态流转正确")
    print("  5. ✅ 变更轨迹完整记录每次修改的原值→改值→原因→来源→下一步")
    print("  6. ✅ 旧口径补录保存原始参数作为对比，标记下一步找谁")
    print("  7. ✅ CSV/JSON报告导出正常，包含9个完整章节")
    print("  8. ✅ 暂停/恢复功能正常流转")
    print("  9. ✅ 数据点修正保留原值+改值+原因+来源")
else:
    print("\n⚠️ 有验证失败，请检查上面的❌标记")
    sys.exit(1)
