# -*- coding: utf-8 -*-
"""
真实数据流验证脚本
覆盖：打开项目 → 导入DUP-1 → 重复导入拦截 → 温度校准 → 
      冲突处理 → 补录SAMPLE-001-SUPP → 保存会话 → 
      刷新（恢复会话） → 重算 → 导出报告
"""
import sys
import os
import json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src import QualityWorkflow

CHECK_RESULTS = []


def check(name: str, condition: bool, actual=None, expected=None) -> None:
    """统一核对函数，输出结构化结果"""
    status = "✓ PASS" if condition else "✗ FAIL"
    print(f"  [{status}] {name}")
    if not condition:
        if actual is not None and expected is not None:
            print(f"      实际: {actual}")
            print(f"      期望: {expected}")
    CHECK_RESULTS.append({"name": name, "pass": condition})


def main():
    print("=" * 80)
    print("  无人船横摇周期估算 - 真实数据流验证")
    print("  覆盖：重复导入拦截 | 温度校准 | 补录重算 | 暂停续局 | 导出报告")
    print("=" * 80)
    print()

    # ======== 第一步：打开项目，初始化工作流 ========
    print("【1/8】打开项目，初始化工作流")
    wf = QualityWorkflow()
    initial_dashboard = wf.get_dashboard()
    check("初始状态 - 采样记录数=0",
          initial_dashboard['overview']['total_sampling_records'] == 0,
          actual=initial_dashboard['overview']['total_sampling_records'], expected=0)
    check("初始状态 - 校准记录数=0",
          initial_dashboard['overview']['total_calibration_records'] == 0,
          actual=initial_dashboard['overview']['total_calibration_records'], expected=0)
    print()

    # ======== 第二步：导入 DUP-1 第一次 ========
    print("【2/8】导入 DUP-1 第一次")
    result1 = wf.step1_import_sampling_record({
        "record_id": "DUP-1",
        "ship_id": "SHIP-DUP",
        "sensor_id": "SENSOR-DUP",
        "sampling_interval": 0.05,
        "sampling_start_time": "2026-06-10T08:00:00",
        "sampling_end_time": "2026-06-10T10:00:00",
        "roll_periods": [12.5, 12.6, 12.7],
        "import_user": "操作员张三"
    })
    print(f"  返回 success={result1.get('success')}, status={result1.get('status')}")
    check("第一次导入成功 - success=True",
          result1.get('success') == True,
          actual=result1.get('success'), expected=True)
    check("第一次导入状态 - 正常",
          result1.get('status') == '正常',
          actual=result1.get('status'), expected='正常')
    check("第一次导入后记录数=1",
          len(wf.sampling_records) == 1,
          actual=len(wf.sampling_records), expected=1)
    check("第一次导入后DUP-1存在",
          wf._get_record('DUP-1') is not None)
    print()

    # ======== 第三步：再次导入 DUP-1（验证重复拦截） ========
    print("【3/8】再次导入 DUP-1（验证重复拦截）")
    result2 = wf.step1_import_sampling_record({
        "record_id": "DUP-1",
        "ship_id": "SHIP-DUP",
        "sensor_id": "SENSOR-DUP",
        "sampling_interval": 0.05,
        "sampling_start_time": "2026-06-10T08:00:00",
        "sampling_end_time": "2026-06-10T10:00:00",
        "roll_periods": [12.5, 12.6, 12.7],
        "import_user": "操作员张三"
    })
    print(f"  返回 success={result2.get('success')}, is_duplicate={result2.get('is_duplicate')}")
    print(f"  check_issues={result2.get('check_issues')}")

    check("重复导入拦截 - success=False",
          result2.get('success') == False,
          actual=result2.get('success'), expected=False)
    check("重复导入拦截 - is_duplicate=True",
          result2.get('is_duplicate') == True,
          actual=result2.get('is_duplicate'), expected=True)
    check("重复导入拦截 - 记录数仍为1（未新增）",
          len(wf.sampling_records) == 1,
          actual=len(wf.sampling_records), expected=1)
    check("重复导入拦截 - 列表/详情/导出指向同一份",
          result2.get('existing_record_link') == 'DUP-1')
    check("重复导入拦截 - 返回现有记录状态",
          result2.get('status') == '正常',
          actual=result2.get('status'), expected='正常')
    check("重复导入拦截 - 自检记录中有duplicate_import",
          len(wf.self_checker.check_results['duplicate_import']) >= 1)

    history = wf.get_history('DUP-1')
    has_dup_log = any(log['action'] == '拦截重复导入' for log in history)
    check("重复导入拦截 - 历史记录中有拦截日志",
          has_dup_log)

    dashboard = wf.get_dashboard()
    check("仪表盘 - DUP-1在列表中",
          any(r['record_id'] == 'DUP-1' for r in dashboard['record_list_snippet']))
    dup_list_item = next(r for r in dashboard['record_list_snippet'] if r['record_id'] == 'DUP-1')
    dup_detail = wf.get_record_detail('DUP-1')
    check("列表状态 vs 详情状态一致",
          dup_list_item['status'] == dup_detail['summary']['current_status'],
          actual=dup_list_item['status'], expected=dup_detail['summary']['current_status'])
    check("列表版本 vs 详情版本一致",
          dup_list_item['version'] == dup_detail['summary']['version'],
          actual=dup_list_item['version'], expected=dup_detail['summary']['version'])

    dup_export = wf.export_record('DUP-1')
    check("导出记录状态 vs 详情状态一致",
          dup_detail['summary']['current_status'] == dup_export['data']['record_detail']['status'],
          actual=dup_export['data']['record_detail']['status'],
          expected=dup_detail['summary']['current_status'])
    print()

    # ======== 第四步：导入 SAMPLE-001 主记录 + 温度校准（一晚后到） ========
    print("【4/8】导入 SAMPLE-001 + 温度校准记录（一晚后到）")
    r1 = wf.step1_import_sampling_record({
        "record_id": "SAMPLE-001",
        "ship_id": "SHIP-A",
        "sensor_id": "SENSOR-A01",
        "sampling_interval": 0.05,
        "sampling_start_time": "2026-06-08T20:00:00",
        "sampling_end_time": "2026-06-08T22:00:00",
        "roll_periods": [12.5, 12.3, 12.6],
        "import_user": "操作员张三"
    })
    print(f"  SAMPLE-001导入: status={r1['status']}, version={r1['version']}")

    cal = wf.step2_import_calibration_and_check({
        "calibration_id": "CAL-A001",
        "ship_id": "SHIP-A",
        "sensor_id": "SENSOR-A01",
        "calibration_time": "2026-06-08T18:00:00",
        "effective_sampling_interval": 0.04,
        "calibration_temperature": 32.5,
        "operator": "校准员李四",
        "remarks": "夜航高温导致采样频率偏移"
    })
    print(f"  温度校准: 新冲突={cal['new_conflicts_found']}条")
    for c in cal['conflicts']:
        print(f"    证据: 采样{c['sampling_value']}s vs 校准{c['calibration_value']}s")

    safety = wf.step3_update_safety_reminders("质检员小白")
    print(f"  安全提醒: 待处理={safety['total_pending_reminders']}条")

    check("SAMPLE-001状态变为冲突待确认",
          wf._get_record('SAMPLE-001').status.value == '冲突待确认',
          actual=wf._get_record('SAMPLE-001').status.value, expected='冲突待确认')
    check("冲突数=1",
          len(wf.conflict_detector.conflicts) == 1,
          actual=len(wf.conflict_detector.conflicts), expected=1)
    check("温度校准关联SAMPLE-001",
          'SAMPLE-001' in wf._get_calibration('CAL-A001').related_sampling_record_ids)
    check("SAMPLE-001关联校准CAL-A001",
          'CAL-A001' in wf._get_record('SAMPLE-001').related_calibration_ids)
    check("SAMPLE-001关联冲突ID",
          len(wf._get_record('SAMPLE-001').related_conflict_ids) == 1)

    print("\n  → 质检员选择折中修正0.045s，交给安全员王五复核")
    cid = wf.conflict_detector.get_conflict_summary()[0]['conflict_id']
    res = wf.resolve_conflict(
        cid, "确认冲突存在，采用折中0.045s", "质检员小白",
        handler_after="安全员王五复核后归档", correct_value=0.045
    )
    print(f"  新状态: {res['record_new_status']}, 下一步: {res['next_handler']}")

    check("冲突处理后状态=已修正",
          res['record_new_status'] == '已修正',
          actual=res['record_new_status'], expected='已修正')
    check("冲突处理后采样间隔=0.045",
          wf._get_record('SAMPLE-001').sampling_interval == 0.045,
          actual=wf._get_record('SAMPLE-001').sampling_interval, expected=0.045)
    check("原始间隔保留=0.05",
          wf._get_record('SAMPLE-001').original_sampling_interval == 0.05,
          actual=wf._get_record('SAMPLE-001').original_sampling_interval, expected=0.05)
    check("人工复核信息完整保留",
          len(wf._get_record('SAMPLE-001').review_infos) == 1)

    review = wf._get_record('SAMPLE-001').review_infos[0]
    check("原始说法保留=0.05", review.original_value == 0.05,
          actual=review.original_value, expected=0.05)
    check("改后的值保留=0.045", review.corrected_value == 0.045,
          actual=review.corrected_value, expected=0.045)
    check("处理原因保留", "冲突处理" in review.reason)
    check("下一步找谁保留", "安全员王五" in review.next_handler,
          actual=review.next_handler, expected="包含'安全员王五'")
    check("未提前归正常",
          wf._get_record('SAMPLE-001').status.value != '正常',
          actual=wf._get_record('SAMPLE-001').status.value, expected="不是'正常'")
    print()

    # ======== 第五步：补录 SAMPLE-001-SUPP，验证自动重算 ========
    print("【5/8】补录 SAMPLE-001-SUPP，验证自动重算")

    # 先算一次补录前的估算值
    est_before_result = wf.calculate_roll_period_estimate("SHIP-A", "系统-补录前")
    est_before = est_before_result['average_period']
    print(f"  补录前估算值: {est_before:.4f}s, 使用记录数: {est_before_result['records_used']}")

    # 现在补录（系统应该自动重算并写入self_check）
    supp_result = wf.step1_import_sampling_record({
        "record_id": "SAMPLE-001-SUPP",
        "ship_id": "SHIP-A",
        "sensor_id": "SENSOR-A01",
        "sampling_interval": 0.045,
        "sampling_start_time": "2026-06-08T22:30:00",
        "sampling_end_time": "2026-06-09T00:30:00",
        "roll_periods": [13.0, 13.2, 12.9],
        "import_user": "操作员张三",
        "is_supplementary": True,
        "original_record_id": "SAMPLE-001"
    })
    print(f"  补录导入: success={supp_result.get('success')}")
    if 'supplementary_recalc' in supp_result:
        sr = supp_result['supplementary_recalc']
        print(f"  补录自动重算: 前={sr['estimate_before']:.4f} → 后={sr['estimate_after']:.4f}, 差={sr['difference']:.4f}")

    check("补录导入成功",
          supp_result.get('success') == True,
          actual=supp_result.get('success'), expected=True)
    check("SAMPLE-001关联补录ID",
          'SAMPLE-001-SUPP' in wf._get_record('SAMPLE-001').supplementary_ids,
          actual=wf._get_record('SAMPLE-001').supplementary_ids,
          expected="包含'SAMPLE-001-SUPP'")
    check("SAMPLE-001状态变为已补录",
          wf._get_record('SAMPLE-001').status.value == '已补录',
          actual=wf._get_record('SAMPLE-001').status.value, expected='已补录')

    # 检查self_check的supplementary_recalc
    supp_checks = wf.self_checker.check_results['supplementary_recalc']
    check("补录重算已进入self_check",
          len(supp_checks) >= 1,
          actual=len(supp_checks), expected=">=1")

    latest_supp_check = supp_checks[-1]
    check("补录重算有前后对比",
          'estimate_before' in latest_supp_check and 'estimate_after' in latest_supp_check)
    check("补录重算关联SAMPLE-001",
          latest_supp_check.get('original_id') == 'SAMPLE-001',
          actual=latest_supp_check.get('original_id'), expected='SAMPLE-001')
    print(f"  self_check.supplementary_recalc详情: {latest_supp_check['details']}")

    # 检查Dashboard和详情页也能看到
    dashboard2 = wf.get_dashboard()
    check("Dashboard自检摘要有supplementary_recalc",
          'supplementary_recalc' in dashboard2['self_check']['summary'])
    check("Dashboard自检详细结果有supplementary_recalc",
          len(dashboard2['self_check']['detailed_results']['supplementary_recalc']) >= 1)

    detail = wf.get_record_detail('SAMPLE-001')
    check("详情页摘要有current_roll_period_estimate",
          'current_roll_period_estimate' in detail['summary'])
    check("详情页摘要有supplementary_recalc_count",
          detail['summary']['supplementary_recalc_count'] >= 1)
    check("详情页有supplementary_recalc_history",
          len(detail.get('supplementary_recalc_history', [])) >= 1)

    if detail.get('supplementary_recalc_history'):
        h = detail['supplementary_recalc_history'][0]
        check("重算历史有前后对比值",
              h.get('estimate_before') is not None and h.get('estimate_after') is not None)
        print(f"  详情页重算历史: {h['details']}")

    history = wf.get_history('SAMPLE-001')
    has_recalc_log = any(log['action'] == '补录自动重算' for log in history)
    check("历史记录有补录自动重算日志", has_recalc_log)
    print()

    # ======== 第六步：保存会话（暂停） ========
    print("【6/8】保存会话（暂停）")
    if not os.path.exists('data'):
        os.makedirs('data')
    save_result = wf.save_session('data/verify_session_checkpoint.json',
                                   '验证数据流-暂停点')
    check("保存会话成功",
          save_result['success'] == True,
          actual=save_result['success'], expected=True)
    check("会话文件存在",
          os.path.exists('data/verify_session_checkpoint.json'))

    with open('data/verify_session_checkpoint.json', 'r') as f:
        sess_data = json.load(f)

    check("会话中SAMPLE-001状态=已补录",
          any(r['record_id'] == 'SAMPLE-001' and r['status'] == '已补录'
              for r in sess_data['sampling_records']))
    check("会话中supplementary_recalc有记录",
          len(sess_data.get('self_check_results', {}).get('supplementary_recalc', [])) >= 1)
    check("会话中duplicate_import有记录",
          len(sess_data.get('self_check_results', {}).get('duplicate_import', [])) >= 1)
    print(f"  会话快照: {len(sess_data['sampling_records'])}条记录, "
          f"{len(sess_data['history_log'])}条历史")
    print()

    # ======== 第七步：刷新（恢复会话） ========
    print("【7/8】刷新（恢复会话）- 新建工作流并加载")
    wf2 = QualityWorkflow()
    load_result = wf2.load_session('data/verify_session_checkpoint.json')
    check("加载会话成功",
          load_result['success'] == True,
          actual=load_result['success'], expected=True)
    check("加载后记录数一致",
          len(wf2.sampling_records) == len(wf.sampling_records),
          actual=len(wf2.sampling_records), expected=len(wf.sampling_records))

    # 验证SAMPLE-001在新工作流中的状态
    s1_after = wf2._get_record('SAMPLE-001')
    s1_before = wf._get_record('SAMPLE-001')
    check("恢复后SAMPLE-001状态一致",
          s1_after.status.value == s1_before.status.value,
          actual=s1_after.status.value, expected=s1_before.status.value)
    check("恢复后SAMPLE-001采样间隔一致",
          s1_after.sampling_interval == s1_before.sampling_interval,
          actual=s1_after.sampling_interval, expected=s1_before.sampling_interval)
    check("恢复后SAMPLE-001版本一致",
          s1_after.version == s1_before.version,
          actual=s1_after.version, expected=s1_before.version)
    check("恢复后SAMPLE-001关联补录一致",
          s1_after.supplementary_ids == s1_before.supplementary_ids,
          actual=s1_after.supplementary_ids, expected=s1_before.supplementary_ids)
    check("恢复后self_check.supplementary_recalc一致",
          len(wf2.self_checker.check_results['supplementary_recalc']) ==
          len(wf.self_checker.check_results['supplementary_recalc']))
    check("恢复后self_check.duplicate_import一致",
          len(wf2.self_checker.check_results['duplicate_import']) ==
          len(wf.self_checker.check_results['duplicate_import']))

    # 验证刷新后Dashboard、详情、历史都一致
    dash_new = wf2.get_dashboard()
    dash_old = wf.get_dashboard()
    check("刷新后Dashboard记录数一致",
          dash_new['overview']['total_sampling_records'] ==
          dash_old['overview']['total_sampling_records'])

    detail_new = wf2.get_record_detail('SAMPLE-001')
    detail_old = wf.get_record_detail('SAMPLE-001')
    check("刷新后详情页状态一致",
          detail_new['summary']['current_status'] == detail_old['summary']['current_status'])
    check("刷新后详情页当前估算值一致",
          detail_new['summary']['current_roll_period_estimate'] ==
          detail_old['summary']['current_roll_period_estimate'])

    history_new = wf2.get_history('SAMPLE-001')
    history_old = wf.get_history('SAMPLE-001')
    check("刷新后历史记录数一致",
          len(history_new) == len(history_old))
    print()

    # ======== 第八步：重算 + 导出报告 ========
    print("【8/8】重算 + 导出报告")
    est_final = wf2.calculate_roll_period_estimate("SHIP-A", "系统-最终重算")
    print(f"  最终估算值: {est_final['average_period']:.4f}s, "
          f"使用记录数: {est_final['records_used']}, "
          f"排除记录数: {len(est_final['excluded_records'])}")

    check("最终估算使用了SAMPLE-001",
          'SAMPLE-001' in est_final['used_record_ids'])
    supp_in_est = 'SAMPLE-001-SUPP' in est_final['used_record_ids']
    supp_in_excluded = any('SAMPLE-001-SUPP' in str(e) for e in est_final['excluded_records'])
    check("SAMPLE-001-SUPP因冲突未提前归正常（在排除列表）",
          not supp_in_est and supp_in_excluded,
          actual=f"used={supp_in_est}, excluded={supp_in_excluded}",
          expected="在excluded_records中（符合别提前归正常）")

    # 导出SAMPLE-001报告
    export = wf2.export_record('SAMPLE-001')
    check("导出成功", export['success'] == True, actual=export['success'], expected=True)

    exp_data = export['data']
    check("导出包含记录详情", 'record_detail' in exp_data)
    check("导出包含历史记录", len(exp_data.get('history_log', [])) > 0)
    check("导出包含补录记录", len(exp_data.get('supplementary_records', [])) >= 1)
    check("导出包含校准记录", len(exp_data.get('related_calibrations', [])) >= 1)
    check("导出包含冲突记录", len(exp_data.get('related_conflicts', [])) >= 1)
    check("导出包含安全提醒", len(exp_data.get('related_reminders', [])) >= 1)
    check("导出记录状态=已补录",
          exp_data['record_detail']['status'] == '已补录',
          actual=exp_data['record_detail']['status'], expected='已补录')
    check("导出记录人工复核信息完整",
          len(exp_data['record_detail'].get('review_infos', [])) >= 1)

    if exp_data['record_detail'].get('review_infos'):
        ri = exp_data['record_detail']['review_infos'][0]
        check("导出中原始说法保留", ri.get('original_value') == 0.05)
        check("导出中改后的值保留", ri.get('corrected_value') == 0.045)
        check("导出中处理原因保留", '冲突处理' in ri.get('reason', ''))
        check("导出中下一步找谁保留", '安全员王五' in ri.get('next_handler', ''))

    # 自检汇总不漏项
    final_dash = wf2.get_dashboard()
    sc = final_dash['self_check']
    print(f"\n  自检汇总:")
    print(f"    · duplicate_import: count={sc['summary']['duplicate_import']['count']}, "
          f"has_issues={sc['summary']['duplicate_import']['has_issues']}")
    print(f"    · sensor_id_change: count={sc['summary']['sensor_id_change']['count']}, "
          f"has_issues={sc['summary']['sensor_id_change']['has_issues']}")
    print(f"    · supplementary_recalc: count={sc['summary']['supplementary_recalc']['count']}, "
          f"has_issues={sc['summary']['supplementary_recalc']['has_issues']}")
    print(f"    · export_consistency: count={sc['summary']['export_consistency']['count']}, "
          f"has_issues={sc['summary']['export_consistency']['has_issues']}")

    check("自检摘要 - duplicate_import有记录",
          sc['summary']['duplicate_import']['count'] >= 1)
    check("自检摘要 - supplementary_recalc有记录",
          sc['summary']['supplementary_recalc']['count'] >= 1)
    check("自检详细结果 - 四项齐全",
          all(k in sc['detailed_results']
              for k in ['duplicate_import', 'sensor_id_change',
                        'supplementary_recalc', 'export_consistency']))

    print()

    # ======== 最终汇总 ========
    print("=" * 80)
    print("  验证结果汇总")
    print("=" * 80)
    passed = sum(1 for r in CHECK_RESULTS if r['pass'])
    total = len(CHECK_RESULTS)
    print(f"  总计: {passed}/{total} 项通过")

    failed = [r for r in CHECK_RESULTS if not r['pass']]
    if failed:
        print("\n  未通过项:")
        for r in failed:
            print(f"    ✗ {r['name']}")
        print()
        print("  关键失败证明:")
        print("  - 重复导入是否入库: ", "是（FAIL）" if len(wf.sampling_records) > 3 else "否（PASS）")
        supp_recalc_count = len(wf2.self_checker.check_results['supplementary_recalc'])
        print(f"  - 补录重算是否从自检摘要漏掉: ", "是（FAIL）" if supp_recalc_count == 0 else "否（PASS）")
        dup_count = len(wf2.self_checker.check_results['duplicate_import'])
        print(f"  - 重复导入是否从自检摘要漏掉: ", "是（FAIL）" if dup_count == 0 else "否（PASS）")
    else:
        print("\n  ✓ 所有验证项通过！")
        print("\n  关键成功证明:")
        print(f"  ✓ 重复导入DUP-1未入库（记录总数={len(wf.sampling_records)}，DUP-1+SAMPLE-001+SAMPLE-001-SUPP共3条）")
        print(f"  ✓ 重复导入自检有记录（{len(wf2.self_checker.check_results['duplicate_import'])}条）")
        print(f"  ✓ 补录重算进入self_check（{len(wf2.self_checker.check_results['supplementary_recalc'])}条记录）")
        print(f"  ✓ 暂停续局前后SAMPLE-001状态/版本/间隔完全一致")
        print(f"  ✓ 暂停续局后self_check结果完全恢复")
        print(f"  ✓ 列表/详情/导出/历史全部指向同一份最新记录")
        print(f"  ✓ 人工复核4要素（原值/改后/原因/下一步）完整保留")
        print(f"  ✓ 未提前归正常（最终状态=已补录，不是正常）")
        print(f"  ✓ SAMPLE-001-SUPP因冲突未混入正常估算（在排除列表）")
        print(f"  ✓ 自检摘要4项齐全，无缺项")

    print("\n  可复现验证命令:")
    print("    cd /Users/lzy/pro/solo/workspaces/zy72360")
    print("    python3 verify_real_data_flow.py")
    print("    python3 tests/test_workflow.py")
    print("    python3 run_full_test.py")

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
