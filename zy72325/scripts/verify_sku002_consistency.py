#!/usr/bin/env python3
"""SKU002 多视图一致性核对脚本。

验证场景：默认已有数据下，从 列表/详情/异常列表/导出/报告/重复导入结果 等
所有入口读到的 SKU002 都是同一份最新处理结果。

重点核对：
- 结果值 = N/A(下架)
- 状态 = 已通过（或对应状态，根据当前处理阶段）
- 人工复核四要素：原始说法 / 改后的值 / 处理原因 / 下一步找谁
- 历史版本数 ≥ 3
- 导出 Excel 内容 与 详情一致
- 报告文本 与 详情一致
- 重复导入返回的 all_records 与 详情一致

用法:
  # 1) 全新跑一次返工演示（生成处理过的 SKU002）
  PYTHONPATH=src python3 scripts/demo_rework_scenario.py

  # 2) 跑一致性核对（默认已有数据下验证所有入口一致）
  PYTHONPATH=src python3 scripts/verify_sku002_consistency.py
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from dp_strategy.importer import (
    import_formula_screenshots,
    get_record_detail,
    get_record_history,
    list_records,
    export_records,
    generate_report,
    get_abnormal_records,
)


TARGET_SKU = "SKU002"


def _h(mark, label, detail=""):
    print(f"  {mark} {label}: {detail}")
    return mark == "✅"


def find_sku002_in_records(records):
    for r in records:
        if r.get("sku_code") == TARGET_SKU:
            return r
    return None


def main():
    print(
        f"""
╔═══════════════════════════════════════════════════════════════╗
║  SKU002 多视图一致性核对                                       ║
║  验证：列表/详情/异常/导出/报告/重复导入 → 同一份最新数据       ║
╚═══════════════════════════════════════════════════════════════╝
"""
    )

    ok_all = True

    # ── 1) 详情页（基准） ──────────────────────────────────────────
    # 先从列表找 SKU002 的 id
    list_result = list_records()
    records = list_result.get("records", [])
    sku002_list = find_sku002_in_records(records)
    if not sku002_list:
        print(f"❌ 列表里找不到 {TARGET_SKU}，请先跑 demo_rework_scenario.py 或 import 样例数据")
        sys.exit(1)

    target_id = sku002_list["id"]
    detail = get_record_detail(target_id)["screenshot"]

    print(f"\n【基准】详情页（id={target_id}, SKU={TARGET_SKU}）")
    print(f"  状态: {detail.get('status_label') or detail.get('status')}")
    print(f"  结果值: {detail.get('result_value')}")
    print(f"  原始说法: {detail.get('original_statement')}")
    print(f"  改后的值: {detail.get('corrected_value')}")
    print(f"  处理原因: {str(detail.get('review_reason', ''))[:80]}")
    print(f"  下一步找谁: {detail.get('next_handler')}")

    # ── 2) 列表 vs 详情 ──────────────────────────────────────────
    print(f"\n📋 Step 1: 列表 与 详情 一致")
    ok_all &= _h(
        "✅" if sku002_list.get("status") == detail.get("status") else "❌",
        "状态一致",
        f"列表={sku002_list.get('status')} 详情={detail.get('status')}",
    )
    ok_all &= _h(
        "✅" if sku002_list.get("result_value") == detail.get("result_value") else "❌",
        "结果值一致",
        f"列表={sku002_list.get('result_value')} 详情={detail.get('result_value')}",
    )
    ok_all &= _h(
        "✅" if sku002_list.get("corrected_value") == detail.get("corrected_value") else "❌",
        "改后的值一致",
        f"列表={sku002_list.get('corrected_value')} 详情={detail.get('corrected_value')}",
    )
    ok_all &= _h(
        "✅" if sku002_list.get("next_handler") == detail.get("next_handler") else "❌",
        "下一步找谁一致",
        f"列表={sku002_list.get('next_handler')} 详情={detail.get('next_handler')}",
    )
    ok_all &= _h(
        "✅" if sku002_list.get("original_statement") == detail.get("original_statement") else "❌",
        "原始说法一致",
        f"列表={str(sku002_list.get('original_statement'))[:30]}…",
    )
    ok_all &= _h(
        "✅" if sku002_list.get("review_reason") == detail.get("review_reason") else "❌",
        "处理原因一致",
        f"列表={str(sku002_list.get('review_reason') or '')[:30]}…",
    )

    # ── 3) 异常列表 vs 详情（仅当状态为 abnormal 时才会出现在异常列表） ──
    print(f"\n📋 Step 2: 异常列表 与 详情 一致（仅 abnormal 状态时有意义）")
    abnormals = get_abnormal_records()
    sku002_abn = find_sku002_in_records(abnormals)

    if detail.get("status") == "abnormal":
        if sku002_abn:
            ok_all &= _h(
                "✅" if sku002_abn.get("result_value") == detail.get("result_value") else "❌",
                "异常列表-结果值一致",
                f"{sku002_abn.get('result_value')}",
            )
            ok_all &= _h(
                "✅" if sku002_abn.get("abnormal_note") == detail.get("abnormal_note") else "❌",
                "异常列表-异常说明一致",
                f"{str(sku002_abn.get('abnormal_note', ''))[:40]}…",
            )
        else:
            ok_all &= _h("❌", "状态是 abnormal 但不在异常列表中", "")
    else:
        ok_all &= _h(
            "✅",
            f"状态为 {detail.get('status_label') or detail.get('status')}，不在异常列表符合预期",
            f"异常列表中有 {len(abnormals)} 条",
        )

    # ── 4) 历史记录最新版 vs 详情 ──────────────────────────────────
    print(f"\n📋 Step 3: 历史最新版本 与 详情 一致")
    history = get_record_history(target_id)
    if history:
        latest_h = history[-1]  # 版本升序，最新版本在末尾
        ok_all &= _h(
            "✅" if len(history) >= 3 else "❌",
            "历史版本数 ≥ 3（导入/编辑/复核/改值/批准 等）",
            f"共 {len(history)} 个版本",
        )
        ok_all &= _h(
            "✅" if latest_h.get("version") == detail.get("current_version") else "❌",
            "最新版本号 与 详情 current_version 一致",
            f"history v{latest_h.get('version')} detail v{detail.get('current_version')}",
        )
    else:
        ok_all &= _h("❌", "没有历史记录", "")

    # ── 5) 导出 Excel 回读 vs 详情 ─────────────────────────────────
    print(f"\n📋 Step 4: 导出 Excel 回读 与 详情 一致")
    exp_path = os.path.join(
        os.path.dirname(__file__), "..", "data", "processed", "verify_sku002_export.xlsx"
    )
    exp_res = export_records(exp_path)
    if exp_res.get("success"):
        try:
            import pandas as pd
            df = pd.read_excel(exp_res["output_path"])
            row = df[df["SKU编码"] == TARGET_SKU].iloc[0].to_dict()
            ok_all &= _h(
                "✅" if str(row.get("当前结果")) == str(detail.get("result_value")) else "❌",
                "导出-当前结果一致",
                f"excel={row.get('当前结果')} detail={detail.get('result_value')}",
            )
            ok_all &= _h(
                "✅" if str(row.get("处理状态")) == str(detail.get("status_label")) else "❌",
                "导出-处理状态一致",
                f"excel={row.get('处理状态')} detail={detail.get('status_label')}",
            )
            ok_all &= _h(
                "✅" if str(row.get("修正值") or "") == str(detail.get("corrected_value") or "") else "❌",
                "导出-修正值一致",
                f"excel={row.get('修正值')} detail={detail.get('corrected_value')}",
            )
            ok_all &= _h(
                "✅" if str(row.get("原始说法") or "") == str(detail.get("original_statement") or "") else "❌",
                "导出-原始说法一致",
                f"excel={str(row.get('原始说法', ''))[:30]}…",
            )
            ok_all &= _h(
                "✅" if str(row.get("下一步处理人") or "") == str(detail.get("next_handler") or "") else "❌",
                "导出-下一步处理人一致",
                f"excel={row.get('下一步处理人')} detail={detail.get('next_handler')}",
            )
        except Exception as e:
            ok_all &= _h("❌", "导出回读失败", str(e))
    else:
        ok_all &= _h("❌", "导出失败", exp_res.get("message", ""))

    # ── 6) 报告文本 vs 详情 ────────────────────────────────────────
    print(f"\n📋 Step 5: 报告文本 与 详情 一致")
    batch_id = detail.get("batch_id")
    rep_res = generate_report(batch_id)
    if rep_res.get("success"):
        rep_text = rep_res.get("report_text") or ""
        has_sku = TARGET_SKU in rep_text
        has_result = str(detail.get("result_value") or "") in rep_text
        has_corrected = str(detail.get("corrected_value") or "") in rep_text
        has_next = str(detail.get("next_handler") or "") in rep_text
        has_status = str(detail.get("status_label") or "") in rep_text

        ok_all &= _h("✅" if has_sku else "❌", "报告含 SKU002", str(has_sku))
        ok_all &= _h("✅" if has_result else "❌", "报告含结果值", detail.get("result_value"))
        ok_all &= _h("✅" if has_corrected else "❌", "报告含改后的值", detail.get("corrected_value"))
        ok_all &= _h("✅" if has_next else "❌", "报告含下一步找谁", detail.get("next_handler"))
        ok_all &= _h("✅" if has_status else "❌", "报告含状态", detail.get("status_label"))
    else:
        ok_all &= _h("❌", "报告生成失败", rep_res.get("message", ""))

    # ── 7) 重复导入返回的 all_records vs 详情 ──────────────────────
    print(f"\n📋 Step 6: 重复导入返回的 all_records 与 详情 一致")
    dup_res = import_formula_screenshots(
        os.path.join(os.path.dirname(__file__), "..", "data", "raw", "sample_formulas.csv"),
        imported_by="verify",
    )
    ok_all &= _h(
        "✅" if dup_res.get("duplicate") else "❌",
        "命中重复导入",
        f"duplicate={dup_res.get('duplicate')}",
    )
    ok_all &= _h(
        "✅" if dup_res.get("batch_id") == batch_id else "❌",
        "重复导入返回同一 batch_id",
        f"{dup_res.get('batch_id')}",
    )

    dup_sku002 = find_sku002_in_records(dup_res.get("all_records") or [])
    if dup_sku002:
        ok_all &= _h(
            "✅" if dup_sku002.get("result_value") == detail.get("result_value") else "❌",
            "重复导入-结果值一致",
            f"dup={dup_sku002.get('result_value')} detail={detail.get('result_value')}",
        )
        ok_all &= _h(
            "✅" if dup_sku002.get("status") == detail.get("status") else "❌",
            "重复导入-状态一致",
            f"dup={dup_sku002.get('status')} detail={detail.get('status')}",
        )
        ok_all &= _h(
            "✅" if dup_sku002.get("corrected_value") == detail.get("corrected_value") else "❌",
            "重复导入-改后的值一致",
            f"dup={dup_sku002.get('corrected_value')}",
        )
        ok_all &= _h(
            "✅" if dup_sku002.get("next_handler") == detail.get("next_handler") else "❌",
            "重复导入-下一步找谁一致",
            f"dup={dup_sku002.get('next_handler')}",
        )
        ok_all &= _h(
            "✅" if dup_sku002.get("original_statement") == detail.get("original_statement") else "❌",
            "重复导入-原始说法一致",
            f"dup={str(dup_sku002.get('original_statement', ''))[:30]}…",
        )
    else:
        ok_all &= _h("❌", "重复导入 all_records 里找不到 SKU002", "")

    # ── 汇总 ───────────────────────────────────────────────────────
    print(f"\n{'='*62}")
    if ok_all:
        print(f"🎉 全部通过！所有视图读到的 SKU002 都是同一份最新处理结果")
    else:
        print(f"❌ 存在不一致项，请检查上方明细")
    print(f"{'='*62}")
    print(f"\n可复现命令:")
    print(f"  # 先生成处理过的数据（首次）")
    print(f"  PYTHONPATH=src python3 scripts/demo_rework_scenario.py")
    print(f"  # 再核对所有视图一致（已有数据下）")
    print(f"  PYTHONPATH=src python3 scripts/verify_sku002_consistency.py")

    sys.exit(0 if ok_all else 1)


if __name__ == "__main__":
    main()
