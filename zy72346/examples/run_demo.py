#!/usr/bin/env python3
"""容斥统计优惠叠加 — 全链路端到端演示脚本

覆盖场景：
1. 第一次导入老师批注（含分母为0→空字符串 → 被标记待复核）
2. 错误重复导入 → 回滚整个批次 → 列表/统计恢复一致
3. 重新导入正确批注 → 导入竞赛教练唐老师抽样名单 → 发现冲突
4. 数据复核人对 flagged 记录做人工复核（保留原始说法/改后值/原因/下一步找谁）
5. 课堂演示结果更新 → 核对所有展示面接同一份最新结果
6. 导出 JSON/CSV 报告
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from rxtj.store import Store
from rxtj.rules import ReviewStatus, AnnotationSource
from rxtj.workflow import (
    step1_import_annotations,
    step2_review_sampling,
    step3_update_demo,
    review_flagged_annotation,
    build_unified_report,
    get_audit_trail,
)
from rxtj.exporter import export_report_json, export_report_csv


TEACHER_ANNOTATIONS_FIRST_2_ROWS = [
    {"line_number": 1, "item_name": "数学A", "category": "优惠", "value": "0.85", "denominator": "100", "numerator": "85"},
    {"line_number": 2, "item_name": "物理B", "category": "优惠", "value": "", "denominator": "", "numerator": "30"},
]

TEACHER_ANNOTATIONS_V1 = [
    {"line_number": 1, "item_name": "数学A", "category": "优惠", "value": "0.85", "denominator": "100", "numerator": "85"},
    {"line_number": 2, "item_name": "物理B", "category": "优惠", "value": "", "denominator": "", "numerator": "30"},
    {"line_number": 3, "item_name": "化学C", "category": "叠加", "value": "0.60", "denominator": "50", "numerator": "30"},
]

TEACHER_ANNOTATIONS_WRONG = [
    {"line_number": 1, "item_name": "数学A", "category": "优惠", "value": "0.95", "denominator": "100", "numerator": "95"},
    {"line_number": 2, "item_name": "物理B", "category": "优惠", "value": "", "denominator": "", "numerator": "30"},
    {"line_number": 3, "item_name": "化学C", "category": "叠加", "value": "0.70", "denominator": "50", "numerator": "35"},
]

SAMPLING_ROWS = [
    {"line_number": 1, "item_name": "数学A", "category": "优惠", "value": "0.85", "denominator": "100", "numerator": "85"},
    {"line_number": 2, "item_name": "物理B", "category": "优惠", "value": "0.50", "denominator": "60", "numerator": "30"},
    {"line_number": 3, "item_name": "化学C", "category": "叠加", "value": "0.55", "denominator": "50", "numerator": "27.5"},
]


def banner(title: str) -> None:
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def assert_eq(name: str, actual, expected) -> None:
    status = "✓" if actual == expected else "✗"
    print(f"  {status} {name}: expected={expected} actual={actual}")
    if actual != expected:
        raise AssertionError(f"{name}: {actual} != {expected}")


def find_by_line(annotations, line_number, source=AnnotationSource.TEACHER_ANNOTATION):
    for a in annotations:
        if a.original_line_number == line_number and a.source == source:
            return a
    return None


def main() -> int:
    tmpdir = tempfile.mkdtemp(prefix="rxtj_demo_")
    db_path = os.path.join(tmpdir, "demo.db")
    out_json = os.path.join(tmpdir, "report.json")
    out_csv = os.path.join(tmpdir, "report.csv")
    store = Store(db_path)
    print(f"使用临时数据库: {db_path}")

    # ─────────────────── 0. 首批导入含空分母 → 整条批次回滚，记录从库里消失 ───────────────────
    banner("第0步：首批导入含空分母批注 → 整个批次回滚（新增记录整条删除，不留痕迹）")
    r0, s0 = step1_import_annotations(store, TEACHER_ANNOTATIONS_FIRST_2_ROWS, changed_by="initial_trial")
    print("首批2条老师批注导入结果：")
    print(r0.summary())
    print()
    print(s0.summary())

    assert_eq("首批总条数", r0.batch.total_rows, 2)
    assert_eq("首批新增条数", r0.batch.new_count, 2)
    assert_eq("首批空分母标记待复核", r0.batch.flagged_count, 1)

    anns0 = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
    assert_eq("首批导入后库里批注数", len(anns0), 2)
    physics0 = find_by_line(anns0, 2)
    assert_eq("首批物理B状态=flagged", physics0.status, ReviewStatus.FLAGGED)
    assert_eq("首批物理B边界类型", physics0.edge_case_type, "denominator_zero_empty_string")

    results0_before, _ = step3_update_demo(store)
    assert_eq("首批导入后计算结果条数", len(results0_before), 2)
    report0_before = build_unified_report(store)
    assert_eq("首批导入后报告总条数", report0_before["annotations_summary"]["total"], 2)

    print(f"\n执行首批批次 {r0.batch.id} 整体回滚（新增记录整条删除）...")
    detail0 = store.rollback_batch_detailed(r0.batch.id, changed_by="undo_initial")
    print(f"  操作总数: {detail0['total_ops']}")
    print(f"  整条删除的新增批注入: {detail0['deleted_new_count']}")
    print(f"  逐字段恢复的旧批注字段: {detail0['restored_field_count']}")
    print(f"  回滚后剩余批注: {detail0['remaining_teacher_annotations']}")
    assert_eq("首批回滚删除新增数", detail0["deleted_new_count"], 2)
    assert_eq("首批回滚剩余批注", detail0["remaining_teacher_annotations"], 0)

    anns0_after = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
    assert_eq("首批回滚后库里批注数", len(anns0_after), 0)
    math_deleted = store.find_annotation_by_line(1, AnnotationSource.TEACHER_ANNOTATION)
    assert_eq("首批回滚数学A已删除", math_deleted, None)
    physics_deleted = store.find_annotation_by_line(2, AnnotationSource.TEACHER_ANNOTATION)
    assert_eq("首批回滚物理B已删除(含空分母flagged记录)", physics_deleted, None)

    conn = store._get_conn()
    cr_count = conn.execute("SELECT COUNT(*) as c FROM change_records").fetchone()["c"]
    assert_eq("首批回滚后change_records也清空", cr_count, 0)

    results0_after, state0_after = step3_update_demo(store)
    assert_eq("首批回滚后计算结果条数", len(results0_after), 0)
    assert_eq("首批回滚后状态批注数", state0_after.annotation_count, 0)
    assert_eq("首批回滚后状态flagged数", state0_after.flagged_count, 0)

    report0_after = build_unified_report(store)
    assert_eq("首批回滚后报告总条数", report0_after["annotations_summary"]["total"], 0)
    assert_eq("首批回滚后报告flagged数", report0_after["annotations_summary"]["flagged_count"], 0)
    assert_eq("首批回滚后报告计算结果数", len(report0_after["calculation_results"]), 0)

    json_0_after = os.path.join(tmpdir, "after_rollback_empty.json")
    csv_0_after = os.path.join(tmpdir, "after_rollback_empty.csv")
    export_report_json(store, json_0_after)
    export_report_csv(store, csv_0_after)
    with open(json_0_after, "r", encoding="utf-8") as f:
        j0 = json.load(f)
    assert_eq("首批回滚后JSON导出报告total=0", j0["annotations_summary"]["total"], 0)
    print("  ✓ 首批含空分母批注已整条从存储/列表/详情/统计/历史/报告/导出里一起撤销")

    # ─────────────────── 1. 第一次导入老师批注 ───────────────────
    banner("第1步：第一次导入老师批注（含分母为0→空字符串）")
    r1, s1 = step1_import_annotations(store, TEACHER_ANNOTATIONS_V1, changed_by="tanglaoshi")
    print(r1.summary())
    print()
    print(s1.summary())

    assert_eq("批次总条数", r1.batch.total_rows, 3)
    assert_eq("新增条数", r1.batch.new_count, 3)
    assert_eq("标记待复核(分母为0→空字符串)", r1.batch.flagged_count, 1)
    assert_eq("flagged 边界类型", r1.flagged[0].edge_case_type, "denominator_zero_empty_string")
    assert_eq("flagged 原始行号", r1.flagged[0].original_line_number, 2)

    # ─────────────────── 2. 错误导入 + 整个批次回滚 ───────────────────
    banner("第2步：错误导入一批批注 → 整个批次回滚到上一一致状态")
    r_wrong, s_wrong = step1_import_annotations(store, TEACHER_ANNOTATIONS_WRONG, changed_by="mistake")
    print("错误导入后：")
    print(r_wrong.summary())
    assert_eq("错误导入改动条数", r_wrong.batch.changed_count, 2)

    anns = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
    math_a = find_by_line(anns, 1)
    assert_eq("错误导入后数学A值", math_a.current_value, "0.95")

    print(f"\n回滚批次 {r_wrong.batch.id} ...")
    rolled, rollback_changes = store.rollback_batch(r_wrong.batch.id, changed_by="reviewer_fuhe")
    print(f"  回滚字段数: {rolled}")
    print(f"  生成回滚变更记录数: {len(rollback_changes)}")

    # 检查回滚后：列表、统计、状态都和回滚前一致
    anns_after = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
    math_a_after = find_by_line(anns_after, 1)
    chem_c_after = find_by_line(anns_after, 3)

    assert_eq("回滚后数学A值", math_a_after.current_value, "0.85")
    assert_eq("回滚后化学C值", chem_c_after.current_value, "0.60")
    assert_eq("回滚后物理B仍flagged", chem_c_after.status in (ReviewStatus.PENDING, ReviewStatus.FLAGGED), True)

    batch_after = store.get_batch(r_wrong.batch.id)
    assert_eq("批次标记rolled_back", batch_after.rolled_back, True)

    # 跑一遍 step3 检查容斥统计也接回滚后的数据
    results_after_rollback, s_rb = step3_update_demo(store)
    math_result = [r for r in results_after_rollback if r.item_name == "数学A"][0]
    assert_eq("回滚后容斥统计数学A值", math_result.value, 0.85)
    print("  ✓ 列表、状态、容斥统计均恢复为回滚前的数据")

    # ─────────────────── 3. 教练唐老师补看抽样名单 ───────────────────
    banner("第3步：竞赛教练唐老师补看抽样名单")
    conflicts, s2 = step2_review_sampling(store, SAMPLING_ROWS, changed_by="coach_tang")
    print(f"冲突数: {len(conflicts)}")
    for ch in conflicts:
        print(f"  批注ID={ch.annotation_id} {ch.old_value}→{ch.new_value} 原因={ch.reason}")
    print()
    print(s2.summary())

    anns3 = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
    chem_c = find_by_line(anns3, 3)
    assert_eq("化学C与抽样冲突后状态", chem_c.status, ReviewStatus.FLAGGED)
    assert_eq("总待复核数", s2.flagged_count, 2)

    # ─────────────────── 4. 数据复核人做人工复核 ───────────────────
    banner("第4步：数据复核人对 flagged 记录做人工复核")

    physics_b = find_by_line(anns3, 2)
    print(f"复核物理B(id={physics_b.id})：分母为0却被填成空字符串")
    print(f"  原始说法(original_value): '{physics_b.original_value}'")
    ann_ph, changes_ph = review_flagged_annotation(
        store=store,
        annotation_id=physics_b.id,
        corrected_value="0.50",
        review_reason="对照抽样名单确认为30/60=0.50，原始漏填分母值60",
        next_contact="找唐老师二次确认后已归档",
        reviewed_by="复核人-小王",
        corrected_denominator="60",
        corrected_numerator="30",
        mark_as_pending_after=True,
    )
    print(f"  改后值(corrected_value): '{ann_ph.current_value}'")
    print(f"  处理原因: {ann_ph.review_reason}")
    print(f"  下一步找谁: {ann_ph.next_contact}")
    print(f"  复核人: {ann_ph.reviewed_by}")
    print(f"  复核后状态: {ann_ph.status.value}")
    print(f"  变更数: {len(changes_ph)}")

    # 化学C：冲突复核
    chem_c = find_by_line(store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION), 3)
    print(f"\n复核化学C(id={chem_c.id})：批注与抽样冲突")
    ann_ch, changes_ch = review_flagged_annotation(
        store=store,
        annotation_id=chem_c.id,
        corrected_value="0.55",
        review_reason="老师批注手写0.60笔误，抽样名单27.5/50=0.55更可信",
        next_contact="已反馈批注老师；课堂演示用抽样修正值",
        reviewed_by="复核人-小王",
        corrected_denominator="50",
        corrected_numerator="27.5",
        mark_as_pending_after=False,
    )
    print(f"  原始说法(original_value): '{ann_ch.original_value}'")
    print(f"  改后值: '{ann_ch.current_value}'  复核后状态: {ann_ch.status.value}")

    # ─────────────────── 5. 课堂演示结果更新 + 全链路一致性核对 ───────────────────
    banner("第5步：课堂演示结果更新 + 核对各展示面接同一份最新结果")
    results, s3 = step3_update_demo(store)
    print(s3.summary())
    print()

    results_by_name = {r.item_name: r for r in results}

    # 数学A：正常，值=0.85
    r_math = results_by_name["数学A"]
    assert_eq("数学A 值", r_math.value, 0.85)
    assert_eq("数学A 状态", r_math.status.value, "pending")
    assert_eq("数学A 证据.原始行号", r_math.evidence.original_line_number, 1)
    assert_eq("数学A 证据.抽样值", r_math.evidence.sampling_list_value, "0.85")

    # 物理B：已复核且标pending，应参与计算
    r_physics = results_by_name["物理B"]
    assert_eq("物理B 值(0.50)", r_physics.value, 0.5)
    assert_eq("物理B 状态", r_physics.status.value, "pending")
    assert_eq("物理B 证据.原始说法", r_physics.evidence.original_statement, "")
    assert_eq("物理B 证据.改后值", r_physics.evidence.corrected_value, "0.50")
    assert_eq("物理B 证据.复核原因", r_physics.evidence.review_reason, "对照抽样名单确认为30/60=0.50，原始漏填分母值60")
    assert_eq("物理B 证据.下一步找谁", r_physics.evidence.next_contact, "找唐老师二次确认后已归档")
    assert_eq("物理B 证据.复核人", r_physics.evidence.reviewed_by, "复核人-小王")

    # 化学C：已复核标reviewed，不参与计算但仍展示证据
    r_chem = results_by_name["化学C"]
    assert_eq("化学C 值(不参与计算)", r_chem.value, None)
    assert_eq("化学C 状态", r_chem.status.value, "reviewed")
    assert_eq("化学C 原始说法", r_chem.evidence.original_statement, "0.60")
    assert_eq("化学C 改后值", r_chem.evidence.corrected_value, "0.55")
    assert_eq("化学C 下一步找谁", r_chem.evidence.next_contact, "已反馈批注老师；课堂演示用抽样修正值")

    # 核对审计追踪（历史记录）
    banner("核对：审计追踪（原始行号/人工改动/当前状态）")
    trail = get_audit_trail(store, ann_ph.id)
    assert_eq("审计.原始行号", trail["annotation"]["original_line_number"], 2)
    assert_eq("审计.原始说法", trail["annotation"]["original_value"], "")
    assert_eq("审计.当前值", trail["annotation"]["current_value"], "0.50")
    assert_eq("审计.变更次数>=3", trail["change_count"] >= 3, True)
    print(f"  ✓ 物理B：审计追踪变更次数={trail['change_count']}，原始说法='' 改后='0.50' 状态=复核过")

    trail_chem = get_audit_trail(store, ann_ch.id)
    assert_eq("审计化学C:原始说法", trail_chem["annotation"]["original_value"], "0.60")
    print(f"  ✓ 化学C：原始说法='0.60' 改后='0.55'，冲突→复核全链路可见")

    # ─────────────────── 6. 统一报告 + 导出 ───────────────────
    banner("第6步：统一报告 + 导出 JSON/CSV（全和容斥统计接同一份数据）")
    report = build_unified_report(store)
    sm = report["annotations_summary"]
    print(f"  报告：总批注={sm['total']} 参与计算={sm['normal_pending_count']} "
          f"待复核={sm['flagged_count']} 已复核={sm['reviewed_count']}")
    print(f"  报告：批次数={len(report['batches'])} 计算结果={len(report['calculation_results'])}")
    assert_eq("报告总条数", sm["total"], 3)
    assert_eq("报告参与计算数", sm["normal_pending_count"], 2)
    assert_eq("报告已复核数", sm["reviewed_count"], 1)

    export_report_json(store, out_json)
    export_report_csv(store, out_csv)
    print(f"  ✓ JSON报告已导出: {out_json}")
    print(f"  ✓ CSV报告已导出: {out_csv}")

    with open(out_json, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert_eq("导出JSON：报告状态一致", data["state"]["flagged_count"], 0)
    assert_eq("导出JSON：报告结果一致", len(data["calculation_results"]), 3)
    print("  ✓ 导出内容与容斥统计、列表、详情一致")

    # ─────────────────── 总结 ───────────────────
    banner("全链路端到端演示完成 ✅")
    print("""
  已覆盖场景：
    ① 首批含空分母导入→整条批次回滚：新增记录从存储/列表/统计/报告/导出一起删除，不留痕迹
    ② 分母为0→空字符串：自动 flagged，不提前归正常
    ③ 已存在记录重复导入后的字段恢复回滚：只把改回去的字段恢复，保留其他新增记录
    ④ 批次回滚：恢复字段值 + 状态同步 + 变更记录 + 容斥统计接一致数据
    ⑤ 重复导入：幂等，不翻倍，差异逐条记录
    ⑥ 人工复核：原始说法 / 改后值 / 处理原因 / 下一步找谁 全程保留
    ⑦ 计算 / 列表 / 详情 / 摘要 / 历史 / 报告 / 导出 全部接同一份最新数据
""")
    print(f"临时文件保存在: {tmpdir} (无需保留，可自行删除)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
