from __future__ import annotations

import sys
from copy import deepcopy
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from bridge_support_review import (
    AlarmRecord,
    JudgmentType,
    ReviewParameters,
    SparePartRow,
    VersionLayer,
    build_tang_report,
    run_review_pipeline,
)
from bridge_support_review.deviation_locator import (
    compare_to_expected,
    locate_deviation_rows,
)
from bridge_support_review.layer_tracker import (
    layer_judgment_overlay,
    summarize_layer_changes,
    tag_layers,
)
from bridge_support_review.parameter_trace import (
    build_step_diff_brief,
    detect_parameter_change,
)
from bridge_support_review.substitution_hang import confirm_hang_event


def make_sample_rows():
    return [
        SparePartRow(
            row_id="R001",
            part_no="QZ-200-A",
            part_name="球型钢支座",
            spec_model="QZ2000kN 常温型",
            quantity=12,
            supplier="中南桥梁配件有限公司（合格供方备案）",
            warehouse_status="在库充足",
            remark="附带出厂质量证明，已纳入合格供方名录",
        ),
        SparePartRow(
            row_id="R002",
            part_no="QZ-350-B",
            part_name="盆式橡胶支座",
            spec_model="GPZ(Ⅱ)3.5DX",
            quantity=8,
            supplier="华东橡胶制品厂",
            warehouse_status="库存紧张",
            remark="",
        ),
        SparePartRow(
            row_id="R003",
            part_no="QZ-500-SUB",
            part_name="抗震球型支座",
            spec_model="LQZ5000kN 替代款",
            quantity=4,
            supplier="华北重工配件厂",
            warehouse_status="在库",
            remark="原厂替换 跨品牌替代",
            is_substituted=True,
            original_part_no="QZ-500-ORIG",
        ),
        SparePartRow(
            row_id="R004",
            part_no="QZ-100-C",
            part_name="板式橡胶支座",
            spec_model="GJZ200×250×42",
            quantity=20,
            supplier="西南胶业（合格供方）",
            warehouse_status="在库",
            remark="",
            manual_note="已处理",
        ),
    ]


def make_sample_alarms():
    now = datetime.now()
    return [
        AlarmRecord(
            alarm_id="A-101",
            part_no="QZ-350-B",
            alarm_type="WAREHOUSE_LOW",
            alarm_level="WARN",
            alarm_content="库存低于安全阈值",
            triggered_at=now - timedelta(days=2),
        ),
        AlarmRecord(
            alarm_id="A-102",
            part_no="QZ-100-C",
            alarm_type="SUPPLIER_CERT_EXPIRE",
            alarm_level="NOTICE",
            alarm_content="供方证书即将到期",
            triggered_at=now - timedelta(days=1),
        ),
        AlarmRecord(
            alarm_id="A-103",
            part_no="QZ-500-SUB",
            alarm_type="PART_SUBSTITUTION",
            alarm_level="WARN",
            alarm_content="型号替换未走确认流程",
            triggered_at=now - timedelta(hours=6),
        ),
    ]


def _assert(cond, msg):
    if not cond:
        print(f"  ❌ {msg}")
        return False
    print(f"  ✅ {msg}")
    return True


def scenario_1_baseline_and_re_run_with_changed_params():
    print("\n=== 场景 1：参数变更，算法值班人可追踪哪一步翻转了结论 ===")
    rows = make_sample_rows()
    alarms = make_sample_alarms()
    old_params = ReviewParameters(
        allow_partial_match=True,
        require_supplier_cert=True,
        strict_substitution_check=True,
        min_warehouse_ratio=0.8,
        remark_weight=0.5,
    )
    baseline, _ = run_review_pipeline(
        rows, alarms, old_params, VersionLayer.LATEST_EXPORT
    )

    new_alarms = []
    for a in alarms:
        na = deepcopy(a)
        if na.alarm_id == "A-101":
            na.resolved = True
            na.resolved_note = "已补库至安全线以上"
        new_alarms.append(na)
    new_params = ReviewParameters(
        allow_partial_match=False,
        require_supplier_cert=False,
        strict_substitution_check=True,
        min_warehouse_ratio=0.2,
        remark_weight=0.7,
    )
    rerun, _ = run_review_pipeline(
        rows, new_alarms, new_params, VersionLayer.LATEST_EXPORT, previous_result=baseline
    )

    all_pass = True
    all_pass &= _assert(rerun.parameter_change_impact is not None, "参数变化 impact 已记录")
    impact = rerun.parameter_change_impact
    all_pass &= _assert(impact.changed_field in ["allow_partial_match", "remark_weight"], f"识别到变更字段：{impact.changed_field}")
    all_pass &= _assert(len(impact.affected_steps) >= 1, f"影响步骤数 {len(impact.affected_steps)} ≥ 1")
    step_brief = build_step_diff_brief(baseline.snapshots, rerun.snapshots)
    all_pass &= _assert(any(v["flip_count"] > 0 for v in step_brief.values()), "至少有一个步骤出现翻转")
    report = build_tang_report(rerun, rows, previous_result=baseline)
    all_pass &= _assert("参数未变更" not in report, "报告中未出现错误的『参数未变更』文字")
    all_pass &= _assert("参数变更追踪" in report, "报告含『参数变更追踪』章节")
    return all_pass


def scenario_2_remark_patch_before_rehearsal():
    print("\n=== 场景 2：彩排进场前补一条备注，报告要说明它改变了哪些判断 ===")
    rows = make_sample_rows()
    alarms = make_sample_alarms()
    params = ReviewParameters(remark_weight=0.8)
    patch = {"R002": "已备案 合格证明齐备，供应商纳入合格供方"}
    result, impact = run_review_pipeline(
        rows, alarms, params, VersionLayer.REMARK_PATCHED, remark_patch=patch
    )
    all_pass = True
    all_pass &= _assert(impact is not None, "备注补丁 impact 已生成")
    all_pass &= _assert("R002" in impact.patched_row_ids, "R002 行被识别为补丁行")
    all_pass &= _assert(result.remark_patch_impact is not None, "复核结果中保留补丁影响")
    all_pass &= _assert(
        "由 SUPPLEMENT 改为 PASS" in result.remark_patch_impact.description
        or "翻转" in result.remark_patch_impact.description,
        "描述中说明了补丁翻转的结论",
    )
    report = build_tang_report(result, rows)
    all_pass &= _assert("彩排补记备注" in report, "报告含『彩排补记备注』章节")
    return all_pass


def scenario_3_substitution_must_hang():
    print("\n=== 场景 3：备件型号替换，宁可挂起等值班人确认，不给假稳定结论 ===")
    rows = make_sample_rows()
    alarms = make_sample_alarms()
    params = ReviewParameters(strict_substitution_check=True, require_supplier_cert=True)
    result, _ = run_review_pipeline(rows, alarms, params, VersionLayer.LATEST_EXPORT)
    all_pass = True
    r003 = result.final_judgments.get("R003")
    all_pass &= _assert(r003 is not None, "R003 行存在复核结论")
    all_pass &= _assert(r003.judgment == JudgmentType.HANG, f"R003 被挂起（实际为 {r003.judgment.value}），不会给出『稳定通过』的假结论")
    all_pass &= _assert(len(result.hang_events) >= 1, "生成了挂起事件，等待算法值班人确认")
    hang = result.hang_events[0]
    confirmed_hang, new_judgment, note = confirm_hang_event(
        hang, confirmed_by="值班人-小王", allow_pass=True, note="风险已现场复核"
    )
    all_pass &= _assert(confirmed_hang.confirmed, "挂起事件可以被值班人确认")
    all_pass &= _assert(new_judgment == JudgmentType.PASS, "确认后给出放行结论")
    all_pass &= _assert("风险已现场复核" in note, "确认记录保留了值班人的说明")
    return all_pass


def scenario_4_layer_distinguishes_old_patched_and_latest():
    print("\n=== 场景 4：同样的材料重跑，工具分清旧处理 / 后补备注 / 最新导出 ===")
    orig_rows = make_sample_rows()
    alarms = make_sample_alarms()
    params = ReviewParameters()
    patch = {"R002": "合格供方名录已更新，质量证明齐全"}
    from bridge_support_review.remark_impact import apply_remark_patch
    patched_rows, _ = apply_remark_patch(orig_rows, patch)
    latest_rows = make_sample_rows()
    latest_rows[0].warehouse_status = "在库充足 复检合格"

    layers = tag_layers(orig_rows, patched_rows, latest_rows)
    all_pass = True
    all_pass &= _assert(
        {r.source_layer for r in layers["ORIGINAL"]} == {VersionLayer.ORIGINAL},
        "ORIGINAL 层标记正确",
    )
    all_pass &= _assert(
        any(r.source_layer == VersionLayer.REMARK_PATCHED for r in layers["REMARK_PATCHED"]),
        "REMARK_PATCHED 层包含补记后的行",
    )
    all_pass &= _assert(
        any(r.source_layer == VersionLayer.LATEST_EXPORT for r in layers["LATEST_EXPORT"]),
        "LATEST_EXPORT 层包含最新导出行",
    )
    orig_result, _ = run_review_pipeline(
        orig_rows, alarms, params, VersionLayer.ORIGINAL
    )
    patched_result, _ = run_review_pipeline(
        patched_rows, alarms, params, VersionLayer.REMARK_PATCHED
    )
    latest_result, _ = run_review_pipeline(
        latest_rows, alarms, params, VersionLayer.LATEST_EXPORT
    )
    overlay = layer_judgment_overlay(
        orig_result.final_judgments,
        patched_result.final_judgments,
        latest_result.final_judgments,
    )
    summary = summarize_layer_changes(overlay)
    all_pass &= _assert(
        sum(summary.values()) == len(orig_rows),
        "三层合计行数与原始备件行数一致",
    )
    return all_pass


def scenario_5_deviation_row_locator():
    print("\n=== 场景 5：哪一行拖偏了复核结论，报告里能直接找到 ===")
    rows = make_sample_rows()
    alarms = make_sample_alarms()
    params = ReviewParameters()
    result, _ = run_review_pipeline(rows, alarms, params, VersionLayer.LATEST_EXPORT)
    deviations = locate_deviation_rows(rows, result.snapshots, result.final_judgments)
    all_pass = True
    all_pass &= _assert(len(deviations) >= 2, "至少识别出 2 条偏差行（R002/R003/R004 应有部分被标为非 PASS）")
    dev_row_ids = {d[0] for d in deviations}
    all_pass &= _assert("R003" in dev_row_ids, "R003 型号替换行被定位为拖偏行")
    report = build_tang_report(result, rows)
    all_pass &= _assert("偏差定位" in report, "报告中存在偏差定位章节")
    all_pass &= _assert(any(d[0] in report for d in deviations), "偏差行号出现在报告文本中，老唐可按号查找")
    return all_pass


def scenario_6_tang_report_ending_is_actionable_not_tech():
    print("\n=== 场景 6：收尾是老唐需要的补/放行清单，不是技术说明 ===")
    rows = make_sample_rows()
    alarms = make_sample_alarms()
    params = ReviewParameters()
    result, _ = run_review_pipeline(rows, alarms, params, VersionLayer.LATEST_EXPORT)
    report = build_tang_report(result, rows)
    all_pass = True
    all_pass &= _assert("需补材料" in report and "可放行材料" in report, "报告提供『需补材料』『可放行材料』两个行动清单")
    all_pass &= _assert("收尾（给老唐的人话版）" in report, "报告有专门的人话版收尾章节")
    all_pass &= _assert(
        ("参数" not in report.split("收尾（给老唐的人话版）")[-1]
         or "老唐" in report.split("收尾（给老唐的人话版）")[-1]),
        "收尾段落使用老唐语境，不罗列技术参数",
    )
    all_pass &= _assert(
        "月底报警" in report or "走流程" in report or "加班" in report,
        "收尾用老唐熟悉的场景语言（月底报警/加班/走流程等）",
    )
    return all_pass


def scenario_7_end_to_end_with_expected_judgments():
    print("\n=== 场景 7：端到端校验各条行的最终结论符合业务逻辑 ===")
    rows = make_sample_rows()
    alarms = make_sample_alarms()
    params = ReviewParameters(
        allow_partial_match=True,
        require_supplier_cert=True,
        strict_substitution_check=True,
        min_warehouse_ratio=0.8,
        remark_weight=0.8,
    )
    patch = {"R002": "合格供方备案完成 原厂质量承诺函已提供"}
    result, _ = run_review_pipeline(
        rows, alarms, params, VersionLayer.LATEST_EXPORT, remark_patch=patch
    )
    expected = {
        "R001": JudgmentType.PASS,
        "R002": JudgmentType.PASS,
        "R003": JudgmentType.HANG,
        "R004": JudgmentType.SUPPLEMENT,
    }
    diffs = compare_to_expected(result.final_judgments, expected)
    all_pass = True
    all_pass &= _assert(len(diffs) == 0, f"与预期结论完全一致（差异：{diffs}）")
    return all_pass


def main():
    scenarios = [
        scenario_1_baseline_and_re_run_with_changed_params,
        scenario_2_remark_patch_before_rehearsal,
        scenario_3_substitution_must_hang,
        scenario_4_layer_distinguishes_old_patched_and_latest,
        scenario_5_deviation_row_locator,
        scenario_6_tang_report_ending_is_actionable_not_tech,
        scenario_7_end_to_end_with_expected_judgments,
    ]
    passed = 0
    failed = 0
    for fn in scenarios:
        try:
            ok = fn()
            if ok:
                passed += 1
                print(f"  → {fn.__name__} 通过")
            else:
                failed += 1
                print(f"  → {fn.__name__} 失败")
        except Exception as exc:
            failed += 1
            print(f"  ✗ {fn.__name__} 抛出异常：{exc!r}")
    print("\n" + "=" * 60)
    print(f"总场景：{len(scenarios)}  通过：{passed}  失败：{failed}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
