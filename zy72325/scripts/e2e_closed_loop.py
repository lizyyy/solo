#!/usr/bin/env python3
"""
动态规划补货策略 - 端到端数据闭环验证脚本

验证流程:
1. CSV导入（中文字段）   -> 字段归一化，自动标记异常
2. 重复导入尝试          -> 被MD5防重拦截
3. Excel字段名CSV导入     -> 英文字段自动归一到同一结构
4. 数据复核人查看异常列表 -> 与详情、历史一致
5. 阿兰补录老师批注       -> 列表/详情/摘要同步更新
6. 数据复核人执行复核     -> 状态流转+批次统计同步
7. 课堂演示更新           -> 版本+历史+统计同步
8. 导出Excel报告          -> 使用同一份最新数据
9. 生成复核报告           -> 所有展示一致
"""

import sys
import os
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

os.makedirs("data/processed", exist_ok=True)
_DB_TS = str(int(time.time() * 1000))
_DB_FILE = f"data/processed/e2e_test_{_DB_TS}.db"
os.environ["DP_STRATEGY_DB"] = f"sqlite:///{_DB_FILE}"

import importlib
from dp_strategy import models
importlib.reload(models)

from dp_strategy.importer import (
    import_formula_screenshots,
    manual_edit_record,
    get_abnormal_records,
    get_record_detail,
    list_records,
    generate_report,
    export_records,
    submit_review,
    compare_versions,
)
from dp_strategy.boundary_rules import init_boundary_rules, rollback_batch


def section(title):
    print("\n" + "=" * 72)
    print(f"  {title}")
    print("=" * 72)


def check(label, condition, detail=""):
    mark = "✅" if condition else "❌"
    print(f"  {mark} {label}" + (f" — {detail}" if detail else ""))
    return condition


def main():
    print("""
╔══════════════════════════════════════════════════════════════════════════╗
║      动态规划补货策略 — 数据闭环一致性端到端验证                          ║
║  目标: 导入→异常→编辑→复核→更新→导出→报告 各环节使用同一份最新数据       ║
╚══════════════════════════════════════════════════════════════════════════╝
""")

    if os.path.exists("data/processed/dp_strategy.db"):
        os.remove("data/processed/dp_strategy.db")

    init_boundary_rules()
    ok_all = True

    # ── Step 1: CSV导入（中文字段） ──────────────────────────────────
    section("Step 1: 导入中文列名 CSV — 字段归一化 + 异常标记")
    r1 = import_formula_screenshots(
        "data/raw/sample_formulas.csv", imported_by="运营规划阿岚"
    )
    ok_all &= check("导入成功", r1["success"], r1.get("message"))
    batch_id = r1["batch_id"]
    bs = r1["batch_summary"]
    ok_all &= check(
        "批次统计异常数=2（分母为0的SKU002+SKU004）",
        bs.get("abnormal_count") == 2,
        f"实际 abnormal_count={bs.get('abnormal_count')}",
    )
    ok_all &= check(
        "返回的异常列表包含2条",
        len(r1.get("abnormal_records", [])) == 2,
        f"实际 {len(r1.get('abnormal_records', []))}",
    )

    # ── Step 2: 重复导入拦截 ────────────────────────────────────────
    section("Step 2: 重复导入（同文件） — MD5 防重")
    r2 = import_formula_screenshots(
        "data/raw/sample_formulas.csv", imported_by="运营规划阿岚"
    )
    ok_all &= check(
        "重复导入被阻止（success=False）",
        not r2["success"],
        r2.get("message"),
    )
    ok_all &= check(
        "返回原批次ID与步骤1一致",
        r2.get("existing_batch") == batch_id,
        f"原批次={r2.get('existing_batch')}  期望={batch_id}",
    )
    # 验证没有新增记录
    list_result = list_records()
    ok_all &= check(
        "总记录数仍为5（未翻倍）",
        list_result["total"] == 5,
        f"实际 total={list_result['total']}",
    )

    # ── Step 3: 英文字段CSV导入 ──────────────────────────────────────
    section("Step 3: 导入英文列名 CSV — 多源字段归一化")
    r3 = import_formula_screenshots(
        "data/raw/sample_english_columns.csv", imported_by="运营规划阿岚"
    )
    ok_all &= check("英文字段导入成功", r3["success"], r3.get("message"))
    bs_en = r3["batch_summary"]
    ok_all &= check(
        "英文批次同样识别到2条分母为0异常",
        bs_en.get("abnormal_count") == 2,
        f"实际 abnormal_count={bs_en.get('abnormal_count')}",
    )
    # 检查归一化后结构：sku_code、product_name 等中文统一字段是否填充
    abnormals_en = r3.get("abnormal_records", [])
    if abnormals_en:
        first = abnormals_en[0]
        ok_all &= check(
            "英文字段自动归一到统一结构（有 sku_code）",
            bool(first.get("sku_code")),
            f"sku_code={first.get('sku_code')}",
        )

    # ── Step 4: 数据复核人查看异常列表 ────────────────────────────────
    section("Step 4: 数据复核人查看异常 → 列表/详情/历史一致性检查")
    abnormals = get_abnormal_records(batch_id)
    ok_all &= check(
        "get_abnormal_records 仍返回2条（步骤1批次）",
        len(abnormals) == 2,
        f"实际 {len(abnormals)}",
    )
    target = abnormals[0]  # SKU002
    target_id = target["id"]
    ok_all &= check(
        "异常列表含原始行号（分母为0且空字符串=行号3）",
        target.get("original_row_number") == 3,
        f"实际 original_row_number={target.get('original_row_number')}",
    )
    ok_all &= check(
        "异常列表含原始说法字段",
        bool(target.get("original_statement")),
        f"original_statement={target.get('original_statement')}",
    )

    detail_res = get_record_detail(target_id)
    ok_all &= check("详情查询成功", detail_res["success"])
    d = detail_res["screenshot"]
    ok_all &= check(
        "详情 abnormal_note 与列表一致",
        d.get("abnormal_note") == target.get("abnormal_note"),
        f"详情={d.get('abnormal_note')}  列表={target.get('abnormal_note')}",
    )
    ok_all &= check(
        "详情 current_version = 1（尚未修改）",
        d.get("current_version") == 1,
        f"实际={d.get('current_version')}",
    )
    ok_all &= check(
        "详情 status_label = '异常待复核'",
        d.get("status_label") == "异常待复核",
        f"实际={d.get('status_label')}",
    )

    # ── Step 5: 阿兰补录老师批注 ─────────────────────────────────────
    section("Step 5: 阿兰补录老师批注（改备注） — 列表/详情/历史同步")
    edit_res = manual_edit_record(
        screenshot_id=target_id,
        field_name="abnormal_note",
        new_value=(
            "分母为0但结果被填空字符串，原始行号: 3 | "
            "老师批注: 此商品已下架，分母为0属正常业务场景，"
            "建议标记为 N/A(下架)"
        ),
        edited_by="运营规划阿岚",
        change_reason="补看老师批注: 商品B已下架，暂不归入正常，先留待复核",
    )
    ok_all &= check("修改成功", edit_res["success"], edit_res.get("message"))
    ok_all &= check(
        "版本号升到 2",
        edit_res.get("new_version") == 2,
        f"实际={edit_res.get('new_version')}",
    )
    bs_after_edit = edit_res.get("batch_summary", {})
    ok_all &= check(
        "批次统计仍 abnormal_count=2（改备注不改状态）",
        bs_after_edit.get("abnormal_count") == 2,
        f"实际={bs_after_edit.get('abnormal_count')}",
    )

    # 复核列表已同步
    abnormals_after = get_abnormal_records(batch_id)
    t_after = next(a for a in abnormals_after if a["id"] == target_id)
    ok_all &= check(
        "异常列表 abnormal_note 已同步老师批注内容",
        "老师批注" in (t_after.get("abnormal_note") or ""),
        f"abnormal_note={t_after.get('abnormal_note')[:40]}…",
    )
    detail_after = get_record_detail(target_id)["screenshot"]
    ok_all &= check(
        "详情 abnormal_note 与列表一致",
        detail_after.get("abnormal_note") == t_after.get("abnormal_note"),
    )
    ok_all &= check(
        "历史记录含2条（import + manual_edit）",
        len(detail_after.get("history", [])) == 2,
        f"实际={len(detail_after.get('history', []))}",
    )

    # 对比 v1 vs v2，仅 abnormal_note + 版本号变化
    diff = compare_versions(target_id, 1, 2)
    changed_fields = list(diff.get("diff", {}).keys())
    ok_all &= check(
        "版本对比仅 abnormal_note 字段变化（含版本号自增）",
        "abnormal_note" in changed_fields and len(changed_fields) <= 2,
        f"变更字段={changed_fields}",
    )

    # ── Step 6: 数据复核人执行复核（带修正值+处理人） ────────────────
    section(
        "Step 6: 数据复核人复核 — 状态流转 + 批次统计同步 "
        "（保留原始说法、改后值、处理原因、下一步找谁，不急着归正常先升级复核中）"
    )
    review_res = submit_review(
        screenshot_id=target_id,
        reviewer="数据复核人-老李",
        review_decision="escalate",
        review_comment=(
            "已看到阿兰补充的老师批注，但需要运营规划组长再次确认 "
            "「已下架商品分母为0是否一律N/A」的规则适用性"
        ),
        original_statement=(
            "复核记录-原始说法: 分母=0，结果被填成空字符串，"
            "未做任何自动修正；Excel原始行号=3"
        ),
        corrected_value="N/A(下架)",  # 建议值，但暂不自动应用
        review_reason=(
            "分母为0+空字符串 + 老师批注下架商品 = 待组长确认是否可直接标记N/A"
        ),
        next_handler="运营规划组长-王姐",
    )
    ok_all &= check("复核提交成功", review_res["success"], review_res.get("message"))
    latest = review_res.get("latest_record", {})
    ok_all &= check(
        "状态变为 '复核中'（非已通过，留待组长=不急着归正常）",
        latest.get("status") == "reviewing",
        f"实际 status={latest.get('status')} label={latest.get('status_label')}",
    )
    ok_all &= check(
        "详情同步：含原始说法/改后值/处理原因/下一步找谁",
        all(
            [
                latest.get("original_statement"),
                review_res["record_detail"].get("corrected_value") == "N/A(下架)",
                review_res["record_detail"].get("review_reason"),
                review_res["record_detail"].get("next_handler")
                == "运营规划组长-王姐",
            ]
        ),
        (
            f"corrected_value={review_res['record_detail'].get('corrected_value')} "
            f"next_handler={review_res['record_detail'].get('next_handler')}"
        ),
    )

    # 批次统计同步更新
    bs_after_review = review_res.get("batch_summary", {})
    ok_all &= check(
        "批次统计：异常数 2→1（1条升为复核中），复核中=1",
        bs_after_review.get("abnormal_count") == 1
        and bs_after_review.get("reviewing_count") == 1,
        (
            f"异常数={bs_after_review.get('abnormal_count')} "
            f"复核中={bs_after_review.get('reviewing_count')}"
        ),
    )

    # ── Step 7: 课堂演示更新（组长确认后更新结果） ─────────────────
    section("Step 7: 运营组长确认 → 课堂演示结果更新 — 统计再同步")
    edit2 = manual_edit_record(
        screenshot_id=target_id,
        field_name="result_value",
        new_value="N/A(下架)",
        edited_by="课堂演示系统",
        change_reason="组长确认: 已下架商品统一标记为N/A，可进入已通过",
    )
    ok_all &= check("结果值更新成功", edit2["success"], edit2.get("message"))
    ok_all &= check(
        "版本号升到 4（v1导入、v2阿兰改备注、v3复核、v4改结果）",
        edit2.get("new_version") == 4,
        f"实际={edit2.get('new_version')}",
    )

    # 此时提交批准（带修正）
    approve_res = submit_review(
        screenshot_id=target_id,
        reviewer="运营规划组长-王姐",
        review_decision="approve_with_correction",
        review_comment="组长二次确认：下架商品一律N/A，本次结果通过",
        corrected_value="N/A(下架)",
        review_reason="课堂演示结果验证通过",
        next_handler="数据归档-小陈",
    )
    ok_all &= check(
        "带修正值的批准提交成功",
        approve_res["success"],
        approve_res.get("message"),
    )
    latest_approved = approve_res.get("latest_record", {})
    ok_all &= check(
        "当前结果值已修正为 N/A(下架)",
        latest_approved.get("result_value") == "N/A(下架)",
        f"result_value={latest_approved.get('result_value')}",
    )
    ok_all &= check(
        "状态变为 '已通过'",
        latest_approved.get("status_label") == "已通过",
        f"status_label={latest_approved.get('status_label')}",
    )
    bs_final = approve_res.get("batch_summary", {})
    ok_all &= check(
        "批次统计最终：异常=1 复核中=0 已通过=1",
        bs_final.get("abnormal_count") == 1
        and bs_final.get("reviewing_count") == 0
        and bs_final.get("approved_count") == 1,
        (
            f"异常={bs_final.get('abnormal_count')} "
            f"复核中={bs_final.get('reviewing_count')} "
            f"已通过={bs_final.get('approved_count')}"
        ),
    )

    # ── Step 8: 导出 Excel / CSV ────────────────────────────────────
    section("Step 8: 导出完整数据 & 复核报告 — 使用同一份最新数据")
    os.makedirs("data/processed", exist_ok=True)
    exp = export_records(
        "data/processed/批次复核结果.xlsx",
        batch_id=batch_id,
        format="xlsx",
    )
    ok_all &= check("Excel导出成功", exp["success"], f"输出: {exp.get('output_path')}")
    ok_all &= check(
        "导出记录数=5",
        exp.get("records_exported") == 5,
        f"records_exported={exp.get('records_exported')}",
    )

    report = generate_report(
        batch_id, output_path="data/processed/复核报告.txt"
    )
    ok_all &= check("复核报告生成成功", report["success"])
    rep_bs = report["batch_summary"]
    ok_all &= check(
        "报告内统计与步骤7一致：异常=1 已通过=1",
        rep_bs.get("abnormal_count") == 1 and rep_bs.get("approved_count") == 1,
        f"报告统计: 异常={rep_bs.get('abnormal_count')} 已通过={rep_bs.get('approved_count')}",
    )
    ok_all &= check(
        "报告含目标记录的人工复核信息",
        "原始说法" in report["report_text"] and "下一步找谁" in report["report_text"],
    )

    # ── Step 9: 回滚验证 ─────────────────────────────────────────────
    section("Step 9: 批次回滚（可选验证） — 统计同步归零")
    rb = rollback_batch(
        batch_id, rollback_note="测试回滚：验证数据闭环", rollback_by="脚本"
    )
    ok_all &= check("回滚成功", rb["success"], rb.get("message"))
    rb_bs = rb.get("batch_summary", {})
    ok_all &= check(
        "回滚后：rollbacked_count=5 其他=0",
        rb_bs.get("rollbacked_count") == 5
        and rb_bs.get("total_records") == 5,
        (
            f"rollbacked={rb_bs.get('rollbacked_count')} "
            f"total={rb_bs.get('total_records')}"
        ),
    )

    # ── 总结 ─────────────────────────────────────────────────────────
    print("\n" + "=" * 72)
    if ok_all:
        print("  🎉 全部检查通过！列表/详情/摘要/历史/导出/报告共用同一份最新数据")
    else:
        print("  ❌ 存在失败项，请检查上方明细")
    print("=" * 72)

    print("\n可执行以下命令继续手动验证:")
    print(f"  PYTHONPATH=src python3 -m dp_strategy.cli list-cmd --batch-id {batch_id}")
    print(f"  PYTHONPATH=src python3 -m dp_strategy.cli detail {target_id}")
    print(f"  PYTHONPATH=src python3 -m dp_strategy.cli history {target_id}")
    print(f"  PYTHONPATH=src python3 -m dp_strategy.cli diff {target_id} 1 4")
    print(f"  PYTHONPATH=src python3 -m dp_strategy.cli report {batch_id}")

    return 0 if ok_all else 1


if __name__ == "__main__":
    sys.exit(main())
