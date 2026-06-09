#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
偏微分网格边界检查系统 - 完整验收演示脚本
启动方式: python3 demo.py
复跑方式: python3 demo.py  (每次运行会重新实例化WorkflowEngine，不保留上一次内存状态)
          如需模拟跨批次历史导入测试，请看 demo 中"演示2-错口径材料"末尾的特别测试段落
"""

from models import MaterialType, CheckStatus, CalculationDetail
from workflow_engine import WorkflowEngine
from test_data import get_material_data, SUPPLEMENT_RECORDS, PERCENT_DECIMAL_MIX_SAMPLING


def print_separator(title="", char="=", length=80):
    if title:
        print(f"\n{char * 2} {title} {char * (length - len(title) - 4)}")
    else:
        print(f"\n{char * length}")


def verify_six_metrics(
    engine: WorkflowEngine,
    scenario_name: str,
    expected_pending_review_min: int = 0,
    expected_duplicate_warning_count: int = 0,
    do_export: bool = True
):
    """
    核对六项核心指标:
    1. 重复导入检查
    2. 负责人待复核数
    3. 计算明细
    4. 历史记录
    5. 导出一致性
    6. 自检总体结果
    """
    print_separator(f"【六项指标核对】{scenario_name}", "-")

    self_check = engine.run_self_check()
    calcs = engine.get_calculation_details()
    history = engine.get_history()
    pending = engine.get_pending_manager_review()

    metrics = {
        "① 重复导入检查": "未执行",
        "② 负责人待复核数": f"{len(pending)} 项",
        "③ 计算明细条数": f"{len(calcs)} 条",
        "④ 历史记录条数": f"{len(history)} 条",
        "⑤ 导出一致性": "未执行导出",
        "⑥ 自检总评": "",
    }

    duplicate_check_result = None
    export_check_result = None
    total_pass = 0
    for sc in self_check:
        if "重复导入" in sc.check_name:
            duplicate_check_result = sc
            status = "✓ PASS" if sc.passed else "✗ FAIL"
            metrics["① 重复导入检查"] = f"{status}  - {sc.details}"
            if sc.passed:
                total_pass += 1
        elif "导出一致性" in sc.check_name:
            export_check_result = sc

    if do_export:
        exported = engine.export_data()
        self_check_after_export = engine.run_self_check()
        for sc in self_check_after_export:
            if "导出一致性" in sc.check_name:
                export_check_result = sc
                status = "✓ PASS" if sc.passed else "✗ FAIL"
                metrics["⑤ 导出一致性"] = f"{status}  - {sc.details}"
                if sc.passed:
                    total_pass += 1
    else:
        export_check_result = None
        for sc in self_check:
            if "导出一致性" in sc.check_name:
                export_check_result = sc
                status = "✓ PASS" if sc.passed else "✗ FAIL"
                metrics["⑤ 导出一致性"] = f"{status}  - {sc.details}"

    percent_check = None
    supplement_check = None
    for sc in self_check:
        if "百分数小数混合" in sc.check_name:
            percent_check = sc
            if sc.passed:
                total_pass += 1
        elif "补录后重算" in sc.check_name:
            supplement_check = sc
            if sc.passed:
                total_pass += 1

    total_checks = len(self_check)
    for sc in self_check:
        if sc.passed:
            total_pass += 0  # already counted above to avoid double count? reset

    passed_count = sum(1 for sc in self_check if sc.passed)
    metrics["⑥ 自检总评"] = f"基础自检 {passed_count}/{total_checks} 通过"

    for k, v in metrics.items():
        print(f"  {k}: {v}")

    print(f"\n  📊 计算明细摘要（含是否需要负责人复核）：")
    review_count = 0
    for i, c in enumerate(calcs, 1):
        mark = "🔴需复核" if c.manager_review_needed else "✓已正常"
        if c.manager_review_needed:
            review_count += 1
        print(f"    {i}. {c.grid_id} 采用={c.boundary_value}{'%' if c.is_percent else ''} "
              f"来源={c.source}  {mark}")
        if c.remark:
            short_remark = c.remark[:80] + ("..." if len(c.remark) > 80 else "")
            print(f"       为什么留下：{short_remark}")

    print(f"\n  📜 历史记录摘要（{len(history)}条）：")
    for i, h in enumerate(history, 1):
        t = h.operation_time.strftime('%H:%M:%S')
        print(f"    {i}. [{t}] {h.operator} | {h.operation_type}")
        print(f"         {h.detail[:80]}{'...' if len(h.detail) > 80 else ''}")

    if duplicate_check_result and duplicate_check_result.warnings:
        print(f"\n  ⚠️  重复导入详情（{len(duplicate_check_result.warnings)}条）：")
        for i, w in enumerate(duplicate_check_result.warnings, 1):
            print(f"    {i}. grid={w.grid_id}  批次信息=[{w.batch_info}]  原因={w.duplicate_reason or '-'}")
            print(f"       {w.description[:90]}")

    if pending:
        print(f"\n  🧑‍💼 负责人待复核清单（{len(pending)}项）：")
        for i, w in enumerate(pending, 1):
            src = f" (来源：{w.source_table})" if w.source_table else ""
            print(f"    {i}. 网格[{w.grid_id}] {w.field_name}{src}")
            print(f"       {w.description[:100]}")

    ok_pending = len(pending) >= expected_pending_review_min
    ok_dup = (not expected_duplicate_warning_count) or (
        duplicate_check_result and len(duplicate_check_result.warnings) >= expected_duplicate_warning_count
    )

    print_separator(f"指标核对结论: {'✓ 通过' if (ok_pending and ok_dup) else '✗ 未达预期'}", "-")
    return ok_pending and ok_dup


def demo_normal_material():
    """演示1：顺利网格样例（正常材料）"""
    print_separator("演示1：顺利网格样例 - 正常材料", "=")

    engine = WorkflowEngine()
    data = get_material_data(MaterialType.NORMAL)
    print(f"\n材料说明: {data['description']}")
    print(f"抽样记录数: {len(data['sampling'])} | 参数调试记录数: {len(data['params'])}")

    print_separator("第一步：抽样名单导入")
    r1 = engine.step1_import_sampling_list(data['sampling'])
    print(f"状态: {r1.status.value}")
    print(r1.message)

    print_separator("第二步：小祁补看参数调试表")
    r2 = engine.step2_analyst_review_params(data['params'])
    print(f"状态: {r2.status.value}")
    print(r2.message)

    print_separator("第三步：更新计算明细")
    r3 = engine.step3_update_calculation()
    print(f"状态: {r3.status.value}")
    print(r3.message)

    verify_six_metrics(
        engine,
        scenario_name="顺利网格样例-正常材料",
        expected_pending_review_min=0,
        expected_duplicate_warning_count=0
    )

    print_separator("演示1 完成", "=")
    return engine


def demo_wrong_caliber_material():
    """演示2：混合口径网格样例 - 错口径材料"""
    print_separator("演示2：混合口径网格样例 - 错口径材料", "=")

    engine = WorkflowEngine()
    data = get_material_data(MaterialType.WRONG_CALIBER)
    print(f"\n材料说明: {data['description']}")
    print(f"抽样记录数: {len(data['sampling'])} | 参数调试记录数: {len(data['params'])}")

    print_separator("第一步：抽样名单导入（含同表重复、同表内百分数小数混合）")
    r1 = engine.step1_import_sampling_list(data['sampling'])
    print(f"状态: {r1.status.value}")
    print(r1.message)

    print_separator("第二步：小祁补看参数调试表（会触发跨表格式混用和数值冲突）")

    def analyst_cb(conflicts):
        for c in conflicts:
            print(f"\n🤔 小祁处理：grid={c.grid_id} field={c.field_name}")
            print(f"   来自[抽样名单]: {c.sampling_value}  vs  来自[参数调试表]: {c.param_value}")
            if c.field_name == "boundary_threshold":
                print(f"   👉 小祁决策: confirm（以参数调试表为准）")
                return "confirm"
            elif c.field_name == "value_format":
                print(f"   👉 小祁决策: confirm（确认统一为参数表格式）")
                return "confirm"
            elif c.field_name == "missing_param":
                print(f"   👉 小祁决策: reject（以抽样为准，参数表后续补）")
                return "reject"
            elif c.field_name == "missing_sampling":
                print(f"   👉 小祁决策: reject（以参数为线索，等待补录抽样）")
                return "reject"
            else:
                print(f"   👉 小祁决策: reject（以抽样为准）")
                return "reject"
        return None

    r2 = engine.step2_analyst_review_params(data['params'], conflict_callback=analyst_cb)
    print(f"\n状态: {r2.status.value}")
    print(r2.message)

    still_pending = engine.conflict_detector.get_pending_conflicts()
    if still_pending:
        print_separator("仍有未处理冲突，继续手动处理")
        for c in still_pending:
            print(f"\n处理: grid={c.grid_id} field={c.field_name}")
            decision = "confirm" if c.field_name in ("boundary_threshold", "value_format") else "reject"
            engine.conflict_detector.resolve_conflict(
                c.grid_id, c.field_name, decision, "小祁"
            )
            print(f"   👉 决策: {decision}")

    print_separator("第三步：更新计算明细")
    r3 = engine.step3_update_calculation()
    print(f"状态: {r3.status.value}")
    print(r3.message)

    verify_six_metrics(
        engine,
        scenario_name="混合口径网格样例-错口径材料",
        expected_pending_review_min=3,
        expected_duplicate_warning_count=1
    )

    print_separator("【关键验证】混合口径出现时状态必须不是'正常'")
    final_status = r3.status
    if final_status == CheckStatus.NORMAL:
        print("✗ FAIL - 混合口径样例被错误标记为'正常'！(应该是待负责人复核)")
    else:
        print(f"✓ PASS - 混合口径样例状态为 '{final_status.value}'，"
              f"未自动归为正常，留给活动负责人复核。")

    print_separator("【特别测试】区分本次导入重复 vs 历史批次重复")
    print("\n模拟同一份抽样名单再次导入（属于历史批次重复，与本次导入重复区分）：")
    engine2 = WorkflowEngine()
    r1_first = engine2.step1_import_sampling_list(data['sampling'])
    print(f"第一次导入状态: {r1_first.status.value}")
    sc1 = engine2.run_self_check()
    for sc in sc1:
        if "重复导入" in sc.check_name:
            print(f"第一次导入自检-重复导入: {'✓' if sc.passed else '✗'} ({sc.details})")
            if sc.warnings:
                for w in sc.warnings:
                    print(f"   - {w.batch_info}: {w.description[:70]}")

    print("\n--- 用同一个engine2再次导入同一份（模拟历史批次重复场景） ---")
    r1_again = engine2.step1_import_sampling_list(data['sampling'])
    print(f"第二次导入状态: {r1_again.status.value}")
    sc2 = engine2.run_self_check()
    for sc in sc2:
        if "重复导入" in sc.check_name:
            print(f"第二次导入自检-重复导入: {'✓' if sc.passed else '✗'} ({sc.details})")
            if sc.warnings:
                for w in sc.warnings:
                    marker = "【本次导入内重复】" if w.batch_info == "本次导入" else (
                        "【跨历史批次重复】" if "历史批次" in (w.batch_info or "") else "【其他】"
                    )
                    print(f"   {marker} batch=[{w.batch_info}] grid=[{w.grid_id}] 原因=[{w.duplicate_reason}]")

    print_separator("演示2 完成", "=")
    return engine


def demo_supplement_material():
    """演示3：补录网格样例"""
    print_separator("演示3：补录网格样例 - 先正常→再补录→再重算", "=")

    engine = WorkflowEngine()
    normal = get_material_data(MaterialType.NORMAL)

    print("\n① 先跑一遍正常材料作为基础:")
    engine.step1_import_sampling_list(normal['sampling'])
    engine.step2_analyst_review_params(normal['params'])
    step3_r = engine.step3_update_calculation()
    print(f"  基础完成：计算明细 {len(engine.get_calculation_details())} 条, "
          f"待复核 {len(engine.get_pending_manager_review())} 项")

    print_separator("② 先导出一次（用来验证导出一致性在补录后会变化）")
    engine.export_data()
    sc0 = engine.run_self_check()
    for sc in sc0:
        if "导出一致性" in sc.check_name:
            print(f"  刚导出后-导出一致性: {'✓' if sc.passed else '✗'} {sc.details}")

    print_separator("③ 补录数据")
    print(f"  补录记录数: {len(SUPPLEMENT_RECORDS)} (GRID-007/GRID-008新增, GRID-002更新)")
    r_supp = engine.supplement_data(SUPPLEMENT_RECORDS)
    print(f"  状态: {r_supp.status.value}")
    print(f"  {r_supp.message}")

    print_separator("④ 补录后自检-此时不应通过补录后重算检查")
    sc_before = engine.run_self_check()
    for sc in sc_before:
        mark = "✓" if sc.passed else "✗"
        print(f"  {mark} {sc.check_name}: {sc.details}")

    print_separator("⑤ 补录后重算")
    r_recalc = engine.recalculate_after_supplement()
    if r_recalc.status == CheckStatus.NEED_REVIEW and r_recalc.conflicts:
        print("  补录后发现新冲突，小祁处理中...")
        for c in engine.conflict_detector.get_pending_conflicts():
            decision = "confirm" if c.field_name != "missing_sampling" else "reject"
            engine.conflict_detector.resolve_conflict(c.grid_id, c.field_name, decision, "小祁")
            print(f"    grid={c.grid_id} field={c.field_name} 👉 决策: {decision}")
        r_recalc = engine.recalculate_after_supplement()

    print(f"  状态: {r_recalc.status.value}")
    print(f"  {r_recalc.message[:300]}")

    verify_six_metrics(
        engine,
        scenario_name="补录网格样例",
        expected_pending_review_min=0,
        do_export=False
    )

    print_separator("⑥ 导出一致性测试：补录重算后应与上次导出不一致")
    sc_after = engine.run_self_check()
    export_check = None
    for sc in sc_after:
        if "导出一致性" in sc.check_name:
            export_check = sc
            mark = "✓ PASS（符合预期：数据已变）" if not sc.passed else "✗ UNEXPECTED"
            print(f"  {mark} {sc.check_name}: {sc.details}")
            if sc.warnings:
                for w in sc.warnings:
                    print(f"     - grid={w.grid_id} field={w.field_name}: {w.description[:80]}")

    print("\n⑦ 重新导出并再次验证一致性应通过:")
    engine.export_data()
    sc_final = engine.run_self_check()
    for sc in sc_final:
        if "导出一致性" in sc.check_name:
            mark = "✓ PASS" if sc.passed else "✗ FAIL"
            print(f"  {mark} {sc.check_name}: {sc.details}")

    print_separator("演示3 完成", "=")
    return engine


def demo_percent_decimal_cross_table():
    """演示4：专项验证跨表百分数小数混用"""
    print_separator("演示4：专项验证 - 抽样与参数跨表百分数/小数混用必须待负责人复核", "=")

    from test_data import NORMAL_SAMPLING, NORMAL_PARAMS
    from models import ParamDebugRecord

    engine = WorkflowEngine()

    # 修改部分参数为小数格式来触发跨表混用
    modified_params = []
    for i, p in enumerate(NORMAL_PARAMS):
        if p.grid_id in ("GRID-002", "GRID-004"):
            if p.param_value.endswith("%"):
                new_val = str(float(p.param_value.rstrip("%")) / 100)
                modified_params.append(ParamDebugRecord(
                    grid_id=p.grid_id,
                    param_name=p.param_name,
                    param_value=new_val,
                    debug_time=p.debug_time,
                    analyst=p.analyst,
                    remark=p.remark
                ))
                print(f"  🔧 将参数调试表 {p.grid_id} 由 '{p.param_value}' 改为小数格式 '{new_val}'")
            else:
                modified_params.append(p)
        else:
            modified_params.append(p)

    print_separator("第一步：抽样导入（全百分数）")
    r1 = engine.step1_import_sampling_list(NORMAL_SAMPLING)
    print(f"  状态: {r1.status.value} | 待复核: {len(engine.get_pending_manager_review())}")

    print_separator("第二步：小祁补看参数（GRID-002/004为小数，跨表格式混用）")

    def cb(conflicts):
        for c in conflicts:
            print(f"  🤔 小祁处理 grid={c.grid_id} field={c.field_name}")
            print(f"     抽样[{c.sampling_source}]: {c.sampling_value}")
            print(f"     参数[{c.param_source}]: {c.param_value}")
            print(f"     👉 决策: confirm")
            return "confirm"
        return None

    r2 = engine.step2_analyst_review_params(modified_params, conflict_callback=cb)
    pending_after_step2 = engine.get_pending_manager_review()
    print(f"\n  状态: {r2.status.value} | 待复核: {len(pending_after_step2)}")
    print(f"  消息摘要: 有{r2.message.splitlines()[0] if r2.message else ''}")
    if pending_after_step2:
        print(f"  🧑‍💼 待复核清单:")
        for w in pending_after_step2:
            print(f"    - {w.grid_id} {w.field_name}: {w.description[:80]}")

    print_separator("第三步：更新计算明细后再看待复核")
    r3 = engine.step3_update_calculation()
    pending_final = engine.get_pending_manager_review()
    print(f"  状态: {r3.status.value} | 待复核最终: {len(pending_final)}")

    calcs = engine.get_calculation_details()
    target_calcs = [c for c in calcs if c.grid_id in ("GRID-002", "GRID-004")]
    print(f"\n  📊 GRID-002/004 计算明细:")
    for c in target_calcs:
        print(f"    {c.grid_id}: 采用={c.boundary_value}{'%' if c.is_percent else ''} "
              f"来源={c.source}  需复核={'🔴是' if c.manager_review_needed else '否'}")
        if c.remark:
            print(f"       为什么留下: {c.remark[:100]}")

    final_check = "✓ PASS" if r3.status == CheckStatus.NEED_REVIEW and len(pending_final) >= 2 else "✗ FAIL"
    print_separator(f"跨表混用专项验证结论: {final_check}", "-")

    print_separator("演示4 完成", "=")


def print_run_instructions():
    print_separator("📘 启动与复跑方式", "=")
    print("""
【启动方式】
  首次运行：
    cd /Users/lzy/pro/solo/workspaces/zy72338
    python3 demo.py

【复跑方式】
  每次执行 python3 demo.py 都会全新实例化 3 个独立的 WorkflowEngine，
  它们内存状态互不干扰，对应 3 条独立路线（顺利/混合/补录）。

【单独路线复跑】
  python3 -c "
from demo import demo_normal_material
demo_normal_material()       # 路线1：顺利网格样例
  "
  python3 -c "
from demo import demo_wrong_caliber_material
demo_wrong_caliber_material()  # 路线2：混合口径网格样例
  "
  python3 -c "
from demo import demo_supplement_material
demo_supplement_material()   # 路线3：补录网格样例
  "
  python3 -c "
from demo import demo_percent_decimal_cross_table
demo_percent_decimal_cross_table()  # 路线4：跨表混用专项
  "

【关键核查清单 - 每次跑必须盯的6项】
  ① 重复导入检查   → 区分'本次导入内' vs '跨历史批次'，分别说明原因
  ② 负责人待复核数 → 混合口径/跨表格式混用>0，不为'正常'
  ③ 计算明细       → remark 列能看出'为什么留下这条'、原始抽样/参数值
  ④ 历史记录       → 每步操作都有时间戳和操作人，含批次号
  ⑤ 导出一致性     → 导出 vs 当前；数据变更后应失败，再导一次应通过
  ⑥ 自检总评       → 4 项基本自检（重复/混用/补录重算/导出一致）

【核心改动回顾（v2 版）】
  1. 跨表(value_format)由 low→high，need_manager_review=True
  2. ConflictEvidence 增加 sampling_source/param_source/analyst_decision 字段
  3. WarningItem 增加 source_table/batch_info/duplicate_reason 字段
  4. CalculationDetail 增加 original_sampling_value/original_param_value/
     conflict_resolved/analyst_decision/manager_review_needed，remark 写明原因
  5. 重复导入检查增加批次号概念，区分本次/历史，分别说明原因
  6. 三步每一步均输出'负责人待复核数'，有一项>0就不标记为正常
  7. 自检模块增加'跨表格式混用'到百分数小数混合检查中
""")


def main():
    print("\n" + "=" * 80)
    print("📊 偏微分网格边界检查系统 v2 验收演示")
    print("=" * 80)

    try:
        demo_normal_material()
        demo_wrong_caliber_material()
        demo_supplement_material()
        demo_percent_decimal_cross_table()
        print_run_instructions()
        print("\n🎉 所有演示路线执行完毕！请对照上方【六项指标核对】各段检查结论。")
    except Exception as e:
        print(f"\n❌ 演示异常: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
