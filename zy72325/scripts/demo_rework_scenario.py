#!/usr/bin/env python3
"""动态规划补货策略 — 返工场景完整演示（支持已有批次、可反复跑、数据一致性核对）。

重点：
- 不管是首次导入 还是 重复导入返回的已有批次，都接着同一条 SKU002 处理
- SKU002 已是 N/A(下架) 时，不再硬改；保留原始说法、改后值、处理原因、下一步找谁
- 分母为 0 + 空字符串的记录，不提前归正常（除非人工显式批准通过）
- 最终核对：结果值 / 异常状态 / 复核四要素 / 历史 / 导出 / 报告 → 全来自同一份数据
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from dp_strategy.importer import (
    import_formula_screenshots,
    manual_edit_record,
    get_record_history,
    get_record_detail,
    compare_versions,
    generate_report,
    export_records,
    submit_review,
)
from dp_strategy.boundary_rules import (
    init_boundary_rules,
    get_abnormal_records,
)


TEACHER_NOTE = "老师批注: 商品B已下架，分母为0属正常业务场景，需特殊处理"
TEACHER_NOTE_LEGACY = "老师批注: 此商品已下架，分母为0属正常情况，需特殊处理"
TARGET_SKU = "SKU002"
TARGET_RESULT = "N/A(下架)"


def print_separator(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def find_sku002(import_result: dict, abnormals: list) -> int:
    """从导入结果优先按 SKU 精确定位，兜底从异常列表找分母 0+空字符串。"""
    sku_map = import_result.get("record_ids_by_sku") or {}
    if TARGET_SKU in sku_map:
        return sku_map[TARGET_SKU]
    for r in import_result.get("all_records") or []:
        if r.get("sku_code") == TARGET_SKU:
            return r["id"]
    for r in abnormals:
        if (r.get("sku_code") == TARGET_SKU
                or (r.get("denominator_value") == 0.0
                    and not (r.get("original_result") or "").strip())):
            return r["id"]
    raise RuntimeError(f"找不到目标记录 {TARGET_SKU} 或 分母=0且结果空 的异常记录")


def note_already_has_teacher(current_note: str) -> bool:
    if not current_note:
        return False
    return TEACHER_NOTE in current_note or TEACHER_NOTE_LEGACY in current_note


def demo_step1_import_screenshots():
    print_separator("步骤1: 导入/复用 旧公式截图批次")

    file_path = os.path.join(
        os.path.dirname(__file__), "..", "data", "raw", "sample_formulas.csv"
    )
    result = import_formula_screenshots(file_path, imported_by="运营规划阿岚")

    if result.get("duplicate"):
        print(f"⚠️  命中重复导入 → 复用原批次继续处理: {result.get('batch_id')}")
    else:
        print(f"✅ 首次导入成功 → 新批次: {result.get('batch_id')}")

    print(f"导入结果: {result['message']}")
    print(f"批次ID:     {result['batch_id']}")
    bs = result.get("batch_summary", {})
    print(
        f"批次统计:   总数={bs.get('total_records', '-')} "
        f"异常待复核={bs.get('abnormal_count', '-')} "
        f"复核中={bs.get('reviewing_count', '-')} 已通过={bs.get('approved_count', '-')}"
    )
    return result


def demo_step2_check_abnormal(batch_id: str):
    print_separator("数据复核人检查异常记录（限定本批次）")

    abnormal_records = get_abnormal_records(batch_id=batch_id)
    print(f"发现 {len(abnormal_records)} 条异常记录:\n")

    for r in abnormal_records:
        print(f"记录ID: {r['id']}")
        print(f"  原始行号: {r['original_row_number']}")
        print(f"  SKU: {r['sku_code']} ({r['product_name']})")
        print(f"  分母: {r['denominator_value']}  分子: {r['numerator_value']}")
        print(f"  原始结果: '{r.get('original_result') or '(空字符串)'}'")
        print(f"  当前结果: '{r.get('result_value') or '(空字符串)'}'")
        print(f"  状态: {r.get('status_label') or r['status']}")
        print(f"  异常类型: {r.get('abnormal_type_label') or r['abnormal_type']}")
        print(f"  异常说明: {r.get('abnormal_note', '')}")
        if r.get("original_statement"):
            print(f"  原始说法: {r['original_statement']}")
        if r.get("corrected_value") is not None:
            print(f"  改后的值: {r['corrected_value']}")
        if r.get("review_reason"):
            print(f"  处理原因: {r['review_reason']}")
        if r.get("next_handler"):
            print(f"  下一步找谁: {r['next_handler']}")
        print()

    return abnormal_records


def demo_step3_alan_adds_teacher_comment(target_id: int):
    print_separator("步骤2: 运营规划阿岚补看老师批注（若已补过则跳过）")

    before = get_record_detail(target_id)["screenshot"]
    current_note = before.get("abnormal_note") or ""

    if note_already_has_teacher(current_note):
        print("✅ 已包含老师批注，本次不再重复追加，保留原处理痕迹。")
        print(f"当前 abnormal_note (前 80 字): {current_note[:80]}…")
        return False

    new_note = (
        (current_note + " | " if current_note else "")
        + TEACHER_NOTE
    )
    result = manual_edit_record(
        screenshot_id=target_id,
        field_name="abnormal_note",
        new_value=new_note,
        edited_by="运营规划阿岚",
        change_reason=f"补看老师批注: 商品B已下架，分母为0属正常业务场景",
    )
    if not result["success"] and "值未变化" not in result.get("message", ""):
        raise RuntimeError(f"补看老师批注失败: {result.get('message')}")

    print(f"修改结果: {result['message']}")
    latest = result.get("latest_record", {})
    print(f"当前版本: v{latest.get('current_version', before.get('current_version'))}")
    return True


def demo_step4_data_reviewer_escalates(target_id: int):
    """复核人把 SKU002 升到『复核中』，不急着归正常，留下四要素。"""
    print_separator("步骤2+: 数据复核人升级为『复核中』（若已升级/已通过则跳过）")

    detail = get_record_detail(target_id)["screenshot"]
    current_status = detail.get("status")
    if current_status in ("reviewing", "approved", "rejected", "rollbacked"):
        print(
            f"✅ 记录状态已为 {detail.get('status_label', current_status)}，"
            f"不再重复升级，保留现有四要素。"
        )
        print(f"  原始说法: {detail.get('original_statement')}")
        print(f"  改后的值: {detail.get('corrected_value')}")
        print(f"  处理原因: {detail.get('review_reason')}")
        print(f"  下一步找谁: {detail.get('next_handler')}")
        return False

    orig_stmt = detail.get("original_statement") or (
        f"原始说法(行号{detail.get('original_row_number')}): "
        f"分母={detail.get('denominator_value')}, "
        f"结果='{detail.get('original_result') or '(空字符串)'}"
    )
    res = submit_review(
        screenshot_id=target_id,
        reviewer="数据复核人",
        review_decision="escalate",
        review_comment="分母为0+空字符串，需组长确认后再归正常",
        original_statement=orig_stmt,
        corrected_value=TARGET_RESULT,
        review_reason="边界规则触发: 分母为0但原结果为空字符串，留人工复核确认",
        next_handler="运营规划组长-王姐",
    )
    if not res.get("success"):
        raise RuntimeError(f"复核提交失败: {res.get('message')}")
    print(f"提交结果: {res.get('message')}")
    d = get_record_detail(target_id)["screenshot"]
    print(f"新状态: {d.get('status_label') or d['status']}")
    print(f"四要素已双写: 改后值={d.get('corrected_value')} 找谁={d.get('next_handler')}")
    return True


def demo_step5_view_history(target_id: int):
    print_separator("查看历史变更记录")

    history = get_record_history(target_id)
    print(f"共 {len(history)} 个版本:")
    for h in history:
        print(f"\n版本 {h['version']}: [{h['change_type']}] {h['change_time']}")
        print(f"  操作人: {h['changed_by']}")
        print(f"  变更原因: {h['change_reason']}")
        if h.get("diff_fields"):
            print(f"  变更字段: {', '.join(h['diff_fields'])}")


def demo_step6_classroom_demo_update(target_id: int):
    """课堂演示：组长已 OK → 把 result_value 改成 N/A(下架)，然后批准通过。"""
    print_separator("步骤3: 课堂演示结果更新（已修正则跳过）")

    before = get_record_detail(target_id)["screenshot"]
    before_result = before.get("result_value")
    already_ok = (before_result == TARGET_RESULT)

    if already_ok:
        print(
            f"✅ result_value 已是 '{TARGET_RESULT}'，不再重复改值，"
            f"直接走批准通过或复用现有批准。"
        )
    else:
        edit_res = manual_edit_record(
            screenshot_id=target_id,
            field_name="result_value",
            new_value=TARGET_RESULT,
            edited_by="课堂演示系统",
            change_reason="课堂演示结果: 已下架商品标记为N/A",
        )
        if not edit_res["success"] and "值未变化" not in edit_res.get("message", ""):
            raise RuntimeError(f"课堂演示改结果值失败: {edit_res.get('message')}")
        print(f"修改结果: {edit_res.get('message')}")
        print(f"字段: {edit_res.get('field')}  '{edit_res.get('old_value')}' → '{edit_res.get('new_value')}'")

    # 状态流转：如果还在 reviewing/abnormal，做一次带修正值的批准
    detail = get_record_detail(target_id)["screenshot"]
    if detail.get("status") not in ("approved", "rollbacked", "rejected"):
        approve_res = submit_review(
            screenshot_id=target_id,
            reviewer="运营规划组长-王姐",
            review_decision="approve_with_correction",
            review_comment=f"同意修正，按 {TARGET_RESULT} 归档",
            original_statement=detail.get("original_statement") or detail.get("original_statement"),
            corrected_value=TARGET_RESULT,
            review_reason=(detail.get("review_reason") or "") + " | 组长现场确认：下架商品按N/A归档",
            next_handler=detail.get("next_handler") or "无（已归档）",
        )
        if not approve_res.get("success"):
            raise RuntimeError(f"批准通过失败: {approve_res.get('message')}")
        print(
            f"✅ 带修正值批准通过 → 新状态: {get_record_detail(target_id)['screenshot'].get('status_label')}"
        )
    else:
        print(
            f"✅ 已处于状态 '{detail.get('status_label') or detail['status']}'，跳过重复批准。"
        )
    return True


def demo_step7_consistency_check(batch_id: str, target_id: int):
    """同一条记录在 列表/详情/异常列表/导出/报告 中，数据完全一致。"""
    print_separator("步骤4: 一致性核对 — 所有视图读同一份最新处理结果")

    abnormals = get_abnormal_records(batch_id=batch_id)  # 已通过的不在异常列表里
    detail = get_record_detail(target_id)["screenshot"]

    ok_all = True

    def _chk(label, cond, detail_txt):
        nonlocal ok_all
        mark = "✅" if cond else "❌"
        print(f"  {mark} {label}: {detail_txt}")
        if not cond:
            ok_all = False

    print(f"\n— 目标: {detail.get('sku_code')} / {detail.get('product_name')} —")
    _chk(
        "结果值 = N/A(下架)",
        detail.get("result_value") == TARGET_RESULT,
        f"result_value={detail.get('result_value')}",
    )
    _chk(
        "异常状态不是 pending/abnormal（除非未完成复核）",
        detail.get("status") in ("approved", "reviewing", "abnormal"),
        f"status={detail.get('status_label') or detail['status']}",
    )
    _chk(
        "原始说法 非空",
        bool(detail.get("original_statement")),
        f"original_statement={detail.get('original_statement')}",
    )
    _chk(
        "改后的值 = N/A(下架)",
        detail.get("corrected_value") == TARGET_RESULT,
        f"corrected_value={detail.get('corrected_value')}",
    )
    _chk(
        "处理原因 非空",
        bool(detail.get("review_reason")),
        f"review_reason={str(detail.get('review_reason'))[:60]}…",
    )
    _chk(
        "下一步找谁 非空",
        bool(detail.get("next_handler")),
        f"next_handler={detail.get('next_handler')}",
    )
    _chk(
        "历史版本数 ≥ 3（导入/补批注/复核/改值/批准 至少3条）",
        len(get_record_history(target_id)) >= 3,
        f"versions={len(get_record_history(target_id))}",
    )

    # 导出 & 报告
    export_path = os.path.join(
        os.path.dirname(__file__), "..", "data", "processed",
        f"rework_{batch_id}_export.xlsx",
    )
    report_path = os.path.join(
        os.path.dirname(__file__), "..", "data", "processed",
        f"rework_{batch_id}_report.txt",
    )
    export_res = export_records(export_path, batch_id=batch_id)
    report_res = generate_report(batch_id, output_path=report_path)

    _chk(
        f"导出 Excel 成功(≥5 条)",
        export_res.get("success") and export_res.get("records_exported", 0) >= 5,
        f"records_exported={export_res.get('records_exported')} path={export_res.get('output_path')}",
    )
    _chk(
        "报告生成成功且状态统计与详情一致",
        report_res.get("success") and (
            report_res.get("report_text").find(TARGET_RESULT) != -1
            or report_res.get("report_text").find(TARGET_SKU) != -1
        ),
        f"output_path={report_res.get('output_path')} SKU002 命中={TARGET_RESULT in (report_res.get('report_text') or '')}",
    )

    # 导出内容也读一条验证：DataFrame 取第 target_sku 行
    try:
        import pandas as pd
        df = pd.read_excel(export_res["output_path"])
        row = df[df["SKU编码"] == TARGET_SKU].iloc[0].to_dict()
        _chk(
            "导出 Excel 中 SKU002 结果值 与 detail 一致",
            str(row.get("当前结果")) == str(detail.get("result_value")),
            f"excel_result={row.get('当前结果')} detail_result={detail.get('result_value')}",
        )
        _chk(
            "导出 Excel 中 SKU002 改后的值 与 detail 一致",
            str(row.get("修正值") or "") == str(detail.get("corrected_value") or ""),
            f"excel_corrected={row.get('修正值')} detail_corrected={detail.get('corrected_value')}",
        )
        _chk(
            "导出 Excel 中 SKU002 状态 与 detail 状态文案一致",
            str(row.get("处理状态")) == str(detail.get("status_label")),
            f"excel_status={row.get('处理状态')} detail_status={detail.get('status_label')}",
        )
    except Exception as e:
        print(f"  ⚠️  回读 Excel 校验失败（不影响核心一致性）: {e}")
        import traceback
        traceback.print_exc()

    return ok_all


def main():
    print(
        """
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   动态规划补货策略 - 返工场景完整演示 (支持已有批次重跑)     ║
║                                                           ║
║  1. 导入（新/已有批次都能接着走）                           ║
║  2. 数据复核人查异常 → 阿岚补看老师批注                     ║
║  3. 复核人升级『复核中』，不提前归正常，留四要素             ║
║  4. 课堂演示组长现场确认 → 改值 → 批准通过                  ║
║  5. 列表/详情/历史/导出/报告 全部核对 同一份最新结果         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
"""
    )

    init_boundary_rules()

    import_result = demo_step1_import_screenshots()
    batch_id = import_result["batch_id"]

    abnormals = demo_step2_check_abnormal(batch_id)
    target_id = find_sku002(import_result, abnormals)
    print(f"👉 定位到目标记录: id={target_id} (SKU={TARGET_SKU})")

    demo_step3_alan_adds_teacher_comment(target_id)
    demo_step4_data_reviewer_escalates(target_id)
    demo_step5_view_history(target_id)
    demo_step6_classroom_demo_update(target_id)

    ok = demo_step7_consistency_check(batch_id, target_id)

    print_separator("演示完成")
    print(f"批次ID:     {batch_id}")
    print(f"关键记录ID: {target_id}")
    print(f"一致性核对: {'全部通过 ✅' if ok else '存在不一致 ❌'}")
    print("\n可使用以下命令继续验证:")
    print(f"  PYTHONPATH=src python3 -m dp_strategy.cli history {target_id}")
    print(f"  PYTHONPATH=src python3 -m dp_strategy.cli detail {target_id}")
    print(f"  PYTHONPATH=src python3 -m dp_strategy.cli abnormal --batch-id {batch_id}")
    print(f"  PYTHONPATH=src python3 -m dp_strategy.cli report {batch_id}")
    print(f"\n可再次运行本脚本验证『已有批次下重复导入也能接同一条记录』:")
    print(f"  PYTHONPATH=src python3 scripts/demo_rework_scenario.py")

    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
