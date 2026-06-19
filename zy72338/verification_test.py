#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
偏微分网格边界检查系统 - 可复现验证测试脚本
覆盖5个核心场景，每个场景有明确的检查点和 PASS/FAIL 判定

运行方式:
    python3 verification_test.py

重点核对：
  场景1: 系统初始化 & 顺利网格样例首次导入
  场景2: 重复上传同一批（跨历史批次重复检测）
  场景3: 混合口径样例（同表重复 + 跨表格式混用）
  场景4: 补录网格样例保存后刷新
  场景5: 重算 & 导出报告一致性
"""

import sys
from models import MaterialType, CheckStatus
from workflow_engine import WorkflowEngine
from test_data import get_material_data, SUPPLEMENT_RECORDS

PASS_COUNT = 0
FAIL_COUNT = 0


def assert_equal(actual, expected, desc):
    global PASS_COUNT, FAIL_COUNT
    if actual == expected:
        PASS_COUNT += 1
        status = "✓ PASS"
    else:
        FAIL_COUNT += 1
        status = "✗ FAIL"
    print(f"  {status} - {desc}")
    if actual != expected:
        actual_repr = repr(actual)[:80]
        expected_repr = repr(expected)[:80]
        print(f"    实际值: {actual_repr}")
        print(f"    期望值: {expected_repr}")


def assert_greater(actual, threshold, desc):
    global PASS_COUNT, FAIL_COUNT
    if actual >= threshold:
        PASS_COUNT += 1
        status = "✓ PASS"
    else:
        FAIL_COUNT += 1
        status = "✗ FAIL"
    print(f"  {status} - {desc} (实际: {actual})")


def print_header(title):
    print()
    print("=" * 80)
    print(f"  {title}")
    print("=" * 80)


def scenario_1_normal_first_import():
    """场景1：顺利网格样例首次导入 - 验证第一次导入不误报历史重复"""
    print_header("场景1：顺利网格样例首次导入")

    engine = WorkflowEngine()
    data = get_material_data(MaterialType.NORMAL)
    sampling = data["sampling"]
    print(f"  导入数据：{len(sampling)} 条 (GRID-001 ~ GRID-005)")

    r1 = engine.step1_import_sampling_list(sampling)

    print(f"\n  第一步状态：导入抽样名单")
    print(f"    状态: {r1.status.value}")

    # 检查点1：第一次导入，重复导入自检必须通过
    sc = engine.run_self_check()
    dup_check = None
    for s in sc:
        if "重复导入" in s.check_name:
            dup_check = s
            break

    assert_equal(dup_check.passed, True, "第一次导入，重复导入检查通过")
    assert_equal(len(dup_check.warnings), 0, "第一次导入，重复警告数=0")

    # 检查点2：GRID-001~005 状态
    grid_ids = sorted([r.grid_id for r in engine.sampling_records])
    assert_equal(grid_ids, ["GRID-001", "GRID-002", "GRID-003", "GRID-004", "GRID-005"],
                 "GRID-001~GRID-005 全部存在")

    # 检查点3：负责人待复核数=0
    pending = engine.get_pending_manager_review()
    assert_equal(len(pending), 0, "负责人待复核数=0")

    # 检查点4：历史记录有1条第一步记录
    history = engine.get_history()
    first_step_hist = [h for h in history if "第一步" in h.operation_type]
    assert_greater(len(first_step_hist), 1, "历史记录包含第一步导入记录")

    # 检查点5：有批次号存在且非空
    batch_id = engine._sampling_import_batch_id
    assert_equal(batch_id is not None and len(batch_id) > 0, True,
                 "第一步导入批次号已记录")
    print(f"    批次号: {batch_id}")

    # 走完三步并验证指标
    engine.step2_analyst_review_params(data["params"])
    engine.step3_update_calculation()

    calcs = engine.get_calculation_details()
    assert_equal(len(calcs), 5, "计算明细共5条")

    # 导出并验证
    engine.export_data()
    sc_final = engine.run_self_check()
    export_check = None
    for s in sc_final:
        if "导出一致性" in s.check_name:
            export_check = s
            break

    assert_equal(export_check.passed, True, "导出一致性检查通过")

    # 指标总评
    all_pass_count = sum(1 for s in sc_final if s.passed)
    print(f"\n  基础自检 {all_pass_count}/{len(sc_final)} 通过")

    return engine


def scenario_2_duplicate_import():
    """场景2：重复上传同一批 - 验证跨历史批次重复检测"""
    print_header("场景2：重复上传同一批（跨历史批次重复检测）")

    engine = WorkflowEngine()
    data = get_material_data(MaterialType.NORMAL)

    # 第一次导入
    engine.step1_import_sampling_list(data["sampling"])
    batch1 = engine._sampling_import_batch_id
    print(f"  第一次导入批次: {batch1}")

    # 第二次导入（同一批数据）
    print(f"\n  第二步：重复上传同一批数据")
    r2 = engine.step1_import_sampling_list(data["sampling"])
    batch2 = engine._sampling_import_batch_id
    print(f"  第二次导入批次: {batch2}")

    # 检查点1：两次批次号不同
    assert_equal(batch1 != batch2, True, "两次导入批次号不同")

    # 检查点2：第二次导入后，重复导入检查不通过
    sc = engine.run_self_check()
    dup_check = None
    for s in sc:
        if "重复导入" in s.check_name:
            dup_check = s
            break

    assert_equal(dup_check.passed, False, "第二次导入，重复导入检查不通过（预期）")

    # 检查点3：跨历史批次重复数=5（GRID-001~005）
    cross_hist = [w for w in dup_check.warnings
                   if w.batch_info and "历史批次" in w.batch_info]
    within = [w for w in dup_check.warnings
              if w.batch_info and "本次导入" in w.batch_info]

    assert_equal(len(cross_hist), 5, "跨历史批次重复=5条（GRID-001~GRID-005）")
    assert_equal(len(within), 0, "本次导入内重复=0条")

    # 检查点4：每条重复都有原因说明
    for w in cross_hist[:2]:
        has_reason = w.duplicate_reason is not None and len(w.duplicate_reason) > 0
        assert_equal(has_reason, True, f"{w.grid_id} 有重复原因说明")
        has_batch = w.batch_info is not None and "历史批次" in w.batch_info
        assert_equal(has_batch, True, f"{w.grid_id} 有来源批次信息")

    # 检查点5：历史记录有2条第一步导入记录
    history = engine.get_history()
    first_steps = [h for h in history if "第一步" in h.operation_type]
    assert_equal(len(first_steps), 2, "历史记录有2条第一步导入记录")

    print(f"\n  重复导入详情（前3条）：")
    for w in cross_hist[:3]:
        print(f"    - {w.grid_id} | 批次=[{w.batch_info}] | 原因={w.duplicate_reason}")

    return engine


def scenario_3_wrong_caliber():
    """场景3：混合口径样例 - 验证同表重复 + 跨表格式混用都待复核"""
    print_header("场景3：混合口径网格样例")

    engine = WorkflowEngine()
    data = get_material_data(MaterialType.WRONG_CALIBER)

    # 第一步
    r1 = engine.step1_import_sampling_list(data["sampling"])
    print(f"  第一步后状态: {r1.status.value}")

    # 检查点1：同表内 GRID-003 重复
    sc1 = engine.run_self_check()
    dup_check = None
    for s in sc1:
        if "重复导入" in s.check_name:
            dup_check = s
            break

    within_dup = [w for w in dup_check.warnings
                   if w.batch_info and "本次导入" in w.batch_info]

    assert_equal(len(within_dup), 1, "同表内重复=1条（GRID-003）")
    assert_equal(within_dup[0].grid_id, "GRID-003", "同表内重复的是 GRID-003")

    # 第二步 + 第三步
    conflict_decisions = {}
    def cb(conflicts):
        for c in conflicts:
            key = (c.grid_id, c.field_name)
            if key not in conflict_decisions:
                conflict_decisions[key] = c
                return "confirm"
        return None

    r2 = engine.step2_analyst_review_params(data["params"], conflict_callback=cb)
    r3 = engine.step3_update_calculation()

    print(f"\n  第三步后状态: {r3.status.value}")

    # 检查点2：状态不是正常，有待复核
    assert_equal(r3.status == CheckStatus.NORMAL, False,
                 "混合口径状态≠正常（有待复核项）")

    # 检查点3：负责人待复核数 ≥ 3
    pending = engine.get_pending_manager_review()
    assert_greater(len(pending), 3, "负责人待复核数 ≥ 3")

    # 检查点4：包含跨表格式混用的待复核项
    format_conflicts = [w for w in pending if "格式" in w.description or "value_format" in w.field_name]
    assert_greater(len(format_conflicts), 1, "包含跨表格式混用待复核项 ≥ 1")

    # 检查点5：计算明细中有 manager_review_needed 的记录
    calcs = engine.get_calculation_details()
    review_calcs = [c for c in calcs if c.manager_review_needed]
    assert_greater(len(review_calcs), 1, "计算明细中需复核记录 ≥ 1")

    # 检查点6：remark 中有"为什么留下"的说明
    for c in review_calcs[:2]:
        has_remark = c.remark and len(c.remark) > 10
        assert_equal(has_remark, True, f"{c.grid_id} 计算明细有remark说明为什么留下")

    return engine


def scenario_4_supplement_refresh():
    """场景4：补录网格样例保存后刷新"""
    print_header("场景4：补录网格样例保存后刷新")

    engine = WorkflowEngine()
    data = get_material_data(MaterialType.NORMAL)

    # 先正常导入并导出
    engine.step1_import_sampling_list(data["sampling"])
    engine.step2_analyst_review_params(data["params"])
    engine.step3_update_calculation()
    engine.export_data()

    calcs_before = engine.get_calculation_details()
    print(f"  补录前：{len(calcs_before)} 条计算明细")

    # 补录数据
    print(f"\n  执行补录：新增/更新 {len(SUPPLEMENT_RECORDS)} 条记录")
    r_supp = engine.supplement_data(SUPPLEMENT_RECORDS, operator="活动负责人")

    # 检查点1：补录操作执行完成
    success = r_supp.status is not None
    assert_equal(success, True, "补录操作执行完成")

    # 检查点2：补录后重算
    print(f"\n  执行补录后重算")
    r_recalc = engine.recalculate_after_supplement()

    # 如果有冲突需要小祁处理
    if r_recalc.status == CheckStatus.NEED_REVIEW and r_recalc.conflicts:
        print(f"  发现新冲突，小祁处理中...")
        pending = engine.conflict_detector.get_pending_conflicts()
        for c in pending:
            decision = "confirm" if c.field_name != "missing_sampling" else "reject"
            engine.conflict_detector.resolve_conflict(c.grid_id, c.field_name, decision, "小祁")
            print(f"    - {c.grid_id} {c.field_name} 👉 {decision}")
        r_recalc = engine.recalculate_after_supplement()

    calcs_after_supp = engine.get_calculation_details()
    print(f"  补录重算后：{len(calcs_after_supp)} 条计算明细")

    # 检查点2：条数增加
    assert_equal(len(calcs_after_supp) > len(calcs_before), True,
                 "补录后计算明细条数增加")
    assert_equal(len(calcs_after_supp), 7, "补录后共7条")

    # 检查点3：历史记录中有补录记录
    history = engine.get_history()
    supp_hists = [h for h in history if "补录" in h.operation_type]
    assert_greater(len(supp_hists), 1, "历史记录包含补录操作记录")

    # 检查点4：补录后导出一致性检查失败（因为数据变了）
    sc = engine.run_self_check()
    export_check = None
    for s in sc:
        if "导出一致性" in s.check_name:
            export_check = s
            break

    assert_equal(export_check.passed, False,
                 "补录后未重新导出 → 导出一致性检查失败（预期）")

    # 重新导出
    engine.export_data()
    sc2 = engine.run_self_check()
    export_check2 = None
    for s in sc2:
        if "导出一致性" in s.check_name:
            export_check2 = s
            break

    assert_equal(export_check2.passed, True,
                 "重新导出后 → 导出一致性检查通过")

    return engine


def scenario_5_recalc_export():
    """场景5：重算 & 导出报告一致性"""
    print_header("场景5：重算 & 导出报告一致性")

    engine = WorkflowEngine()
    data = get_material_data(MaterialType.NORMAL)

    engine.step1_import_sampling_list(data["sampling"])
    engine.step2_analyst_review_params(data["params"])
    engine.step3_update_calculation()

    # 第一次导出
    exported1 = engine.export_data()
    print(f"  第一次导出：{len(exported1)} 条")

    # 检查点1：导出数据有效
    assert_equal(len(exported1), 5, "导出5条记录")
    has_grid_id = all(hasattr(e, 'grid_id') for e in exported1)
    assert_equal(has_grid_id, True, "导出记录有 grid_id")

    # 检查点2：导出一致性检查通过
    sc1 = engine.run_self_check()
    export_check = None
    for s in sc1:
        if "导出一致性" in s.check_name:
            export_check = s
            break
    assert_equal(export_check.passed, True, "导出一致性检查通过")

    # 检查点3：每条记录有导出历史记录
    history = engine.get_history()
    export_hists = [h for h in history if "导出" in h.operation_type]
    assert_greater(len(export_hists), 1, "历史记录包含导出操作记录")

    # 检查点4：导出内容与计算明细一致
    calcs = engine.get_calculation_details()
    calc_map = {c.grid_id: c for c in calcs}
    export_map = {e.grid_id: e for e in exported1}

    for gid in ["GRID-001", "GRID-002", "GRID-003"]:
        same_value = calc_map[gid].boundary_value == export_map[gid].boundary_value
        assert_equal(same_value, True, f"{gid} 导出值与计算明细一致")
        same_format = calc_map[gid].is_percent == export_map[gid].is_percent
        assert_equal(same_format, True, f"{gid} 导出格式与计算明细一致")

    print(f"\n  导出内容抽样（前3条）：")
    for e in exported1[:3]:
        pct = "%" if e.is_percent else ""
        print(f"    - {e.grid_id}: {e.boundary_value}{pct} 来源={e.source}")

    return engine


def main():
    print("偏微分网格边界检查系统 - 可复现验证测试")
    print(f"Python: {sys.version.split()[0]}")

    # 运行所有场景
    scenario_1_normal_first_import()
    scenario_2_duplicate_import()
    scenario_3_wrong_caliber()
    scenario_4_supplement_refresh()
    scenario_5_recalc_export()

    # 汇总
    print()
    print("=" * 80)
    total = PASS_COUNT + FAIL_COUNT
    print(f"  测试汇总：共 {total} 个检查点")
    print(f"    ✓ PASS: {PASS_COUNT}")
    print(f"    ✗ FAIL: {FAIL_COUNT}")
    if total > 0:
        print(f"    通过率: {PASS_COUNT/total*100:.1f}%")
    print("=" * 80)

    if FAIL_COUNT == 0:
        print("\n🎉 所有检查点通过！")
        return 0
    else:
        print(f"\n❌ 有 {FAIL_COUNT} 个检查点失败，请检查上面的输出。")
        return 1


if __name__ == "__main__":
    sys.exit(main())
