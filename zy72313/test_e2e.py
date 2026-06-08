#!/usr/bin/env python3
"""
端到端测试脚本：验证三个核心场景
Case 1: 同一学生不同版本答案 → 必须生成独立复核记录，批量不覆盖
Case 2: 同一版本重复提交 → 给出可懂跳过原因，不当成多版答案
Case 3: 误差说明更新并回滚 → 保存改前/改后/修改人/原因，可回滚
最后输出 report-summary 核对一致性
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import json
import yaml
import shutil
from pathlib import Path
from datetime import datetime
import pandas as pd

from markov_churn import (
    MarkovChurnModel,
    DataImporter,
    HistoryManager,
    ReviewSystem,
    Visualizer
)

PASS = 0
FAIL = 0

def assert_eq(name, actual, expected):
    global PASS, FAIL
    ok = actual == expected
    if ok:
        PASS += 1
        print(f"  [PASS] {name}: {actual!r}")
    else:
        FAIL += 1
        print(f"  [FAIL] {name}: expected {expected!r}, got {actual!r}")

def assert_true(name, cond):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  [PASS] {name}")
    else:
        FAIL += 1
        print(f"  [FAIL] {name}")

def main():
    with open('config.yaml', 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)

    if Path("data").exists():
        shutil.rmtree("data")
    for d in ["data_dir", "history_dir", "import_dir", "export_dir"]:
        Path(config["system"][d]).mkdir(parents=True, exist_ok=True)

    history_mgr = HistoryManager(config['system']['history_dir'])
    review_sys = ReviewSystem(
        Path(config['system']['data_dir']) / "reviews.json",
        history_mgr
    )
    importer = DataImporter(config['system']['import_dir'], history_mgr)
    model = MarkovChurnModel(
        states=config['markov_model']['states'],
        smoothing_factor=config['markov_model']['smoothing_factor']
    )

    # ================================================================
    print("\n" + "=" * 70)
    print("Case 1: 两版答案（STU_A同时有v1和v2）→ 独立复核记录，批量不覆盖")
    print("=" * 70)
    # ================================================================
    r1 = importer.import_csv("test_data/test_case1_two_versions.csv", model, True, True)
    print(f"  导入状态: {r1['status']}, 成功{r1['imported_count']}条, 跳过{r1['skipped_count']}条")

    assert_true("requires_review=True 被触发", r1.get("requires_review") is True)
    assert_eq("review_type=multiple_answers", r1.get("review_type"), "multiple_answers")
    assert_true("multiple_answer_students 包含 STU_A", "STU_A" in r1["multiple_answer_students"])
    assert_true("STU_B 不在 multiple_answer_students 里(只有单版)", "STU_B" not in r1["multiple_answer_students"])

    summaries = [model.get_student_version_summary(s) for s in r1["multiple_answer_students"]]
    created = review_sys.create_batch_multiple_answer_reviews(summaries, r1.get("source_file",""))
    print(f"  创建了 {len(created)} 条独立复核记录")
    for rev in created:
        print(f"    - {rev.review_id} : {rev.description}")

    assert_true("批量创建 >= 1 条", len(created) >= 1)
    ids = [r.review_id for r in created]
    assert_true("每条复核记录ID不重复", len(set(ids)) == len(ids))

    for rev in created:
        d = rev.data
        assert_eq(f"{rev.review_id} 状态=pending", rev.status, "pending")
        assert_true(f"{rev.review_id} 包含student_id", d.get("student_id") is not None)
        assert_true(f"{rev.review_id} version_count>=2", d.get("version_count", 0) >= 2)

    pending = review_sys.get_pending_reviews("multiple_answers")
    print(f"  待复核任务数: {len(pending)}")
    assert_true("待复核任务数与创建数一致", len(pending) == len(created))

    # 批准 STU_A 的
    for rev in created:
        if rev.data.get("student_id") == "STU_A":
            r = review_sys.approve(rev.review_id, approver="唐老师",
                                   comment="业务运营复核确认：STU_A采用v2(第二版修正)")
            print(f"  批准: {r.review_id} by {r.resolved_by}")
            assert_eq(f"批准后状态=approved", r.status, "approved")
            assert_eq(f"批准人=唐老师", r.resolved_by, "唐老师")

    # ================================================================
    print("\n" + "=" * 70)
    print("Case 2: 同版本重复提交 → 可懂原因跳过，不当成多版答案")
    print("=" * 70)
    # ================================================================
    r2 = importer.import_csv("test_data/test_case2_duplicate_version.csv", model, True, True)
    print(f"  导入: success={r2['imported_count']} skipped_dup={r2.get('skipped_duplicate_version_count',0)}")

    assert_true("STU_D 被检测出同版本重复跳过", r2.get("skipped_duplicate_version_count", 0) >= 2)
    assert_true("STU_D 未进入multiple_answer_students(同版本不算多版)",
                "STU_D" not in r2.get("multiple_answer_students", []))
    assert_true("duplicate_reasons 给出可懂原因", len(r2.get("duplicate_reasons", [])) >= 2)

    print(f"  跳过原因样例:")
    for reason in r2.get("duplicate_reasons", [])[:2]:
        print(f"    - {reason}")

    # 再导一遍同一个文件：整体文件也必须哈希跳过不翻倍
    r2b = importer.import_csv("test_data/test_case2_duplicate_version.csv", model, True, True)
    print(f"  二次同文件导入: status={r2b['status']}")
    assert_eq("同文件二次导入status=skipped（不翻倍）", r2b["status"], "skipped")
    assert_eq("reason=duplicate_file", r2b.get("reason"), "duplicate_file")

    # ================================================================
    print("\n" + "=" * 70)
    print("Case 3: 误差说明更新→保存改前/改后/修改人/原因，可回滚")
    print("=" * 70)
    # ================================================================
    # 找一条要改的记录
    customer_id = "CA1"
    ts = pd.to_datetime("2024-03-01").to_pydatetime()
    before = model.find_state_record(customer_id, ts)
    print(f"  更新前 CA1@2024-03-01 error_notes = {before.error_notes!r}")

    # 3a. 唐老师改误差说明
    upd = model.update_error_notes(
        customer_id, ts,
        new_error_notes="复核后更新：唐老师确认第一版判定公式有误，应以第二版为准；实际客户已在4月召回",
        modifier="唐老师",
        reason="业务运营复核发现公式误差来源，补全误差说明便于后续复盘"
    )
    print(f"  更新结果: status={upd['status']}")
    assert_eq("更新status=success", upd["status"], "success")
    assert_eq("modifier=唐老师", upd["modifier"], "唐老师")
    assert_true("old_value != new_value", upd["old_value"] != upd["new_value"])
    print(f"  改前文本: {upd['old_value']!r}")
    print(f"  改后文本: {upd['new_value']!r}")

    vid1, chg = history_mgr.record_error_note_update(upd)
    print(f"  记录历史版本: {vid1}")

    # 3b. 唐老师再改一次（第二次），之后回滚到第一次改后的值
    upd2 = model.update_error_notes(
        customer_id, ts,
        new_error_notes="二次更新：唐老师补充客户召回具体日期2024-04-18，由运营同学孙XX跟进",
        modifier="唐老师",
        reason="补充具体召回信息"
    )
    assert_eq("二次更新status=success", upd2["status"], "success")
    vid2, _ = history_mgr.record_error_note_update(upd2)
    print(f"  二次更新记录版本: {vid2}")

    # 3c. 回滚到上一份说明（第二次→第一次改后的值）
    prev = history_mgr.find_previous_field_value(customer_id, upd2["timestamp"], "error_notes")
    print(f"  从历史找到上一份error_notes: {prev!r}")
    assert_true("上一份值存在且等于第一次改后的值", prev == upd["new_value"])

    rb = model.rollback_field_update(
        customer_id, ts, "error_notes", prev,
        modifier="业务运营",
        reason="第二次补充信息未经复核通过，回滚到唐老师第一版误差说明"
    )
    print(f"  回滚status={rb['status']}")
    assert_eq("回滚status=success", rb["status"], "success")
    assert_eq("回滚后的new_value=第一次改后值", rb["new_value"], prev)
    vid_rb, _ = history_mgr.record_field_rollback(rb)
    print(f"  回滚版本: {vid_rb}")

    final_rec = model.find_state_record(customer_id, ts)
    print(f"  回滚后最终 error_notes={final_rec.error_notes!r}")
    assert_eq("最终值=回滚目标值", final_rec.error_notes, prev)

    # ================================================================
    print("\n" + "=" * 70)
    print("一致性核对：report-summary / 历史 / 复核")
    print("=" * 70)
    # ================================================================
    versions = history_mgr.list_versions()
    print(f"  总版本数: {len(versions)}")
    for v in versions[:5]:
        print(f"    {v.version_id} | {v.author:10} | {v.description}")

    rep = history_mgr.summary_report()
    print(f"  历史摘要: {json.dumps(rep, ensure_ascii=False, indent=6)}")

    all_reviews = review_sys.list_reviews()
    print(f"  总复核任务数: {len(all_reviews)}")
    for r in all_reviews:
        d = r.data
        print(f"    {r.review_id} | {r.status:8} | {r.review_type:20} | "
              f"学生{d.get('student_id','-')} | resolved_by={r.resolved_by or '-'}")

    pending_final = review_sys.get_pending_reviews("multiple_answers")
    print(f"  最终待处理multiple_answers: {len(pending_final)}")

    for r in created:
        lookup_r = review_sys.get_review(r.review_id)
        assert_true(f"复核记录持久化: {r.review_id} 可被再次读取", lookup_r is not None)

    # 核对历史中的操作数
    ops = rep["operation_counts"]
    assert_true("error_note_update 计数=2（第一次+第二次）", ops["error_note_update"] == 2)
    assert_true("field_rollback 计数=1", ops["field_rollback"] == 1)
    assert_true("import 计数=2 (两个不同case文件)", ops["import"] == 2)
    assert_true("review_approve 计数>=1", ops["review_approve"] >= 1)

    # 版本链测试
    chain = history_mgr.get_version_chain()
    print(f"  版本链长度: {len(chain)}, HEAD={chain[0] if chain else 'N/A'}")
    assert_true("版本链存在", len(chain) >= 4)  # import + error_note*2 + rollback + approve

    # 对比两个版本看 diff 文本
    if vid1 and vid2:
        diff = history_mgr.compare_versions(vid1, vid2)
        print(f"  {vid1} vs {vid2} diff行数={len(diff['diff'])}")
        assert_true("版本diff非空", len(diff["diff"]) > 0)

    # ================================================================
    print("\n" + "=" * 70)
    print(f"测试汇总: PASS={PASS}, FAIL={FAIL}")
    print("=" * 70)
    if FAIL == 0:
        print("✅ 全部通过")
        return 0
    else:
        print("❌ 存在失败")
        return 1


if __name__ == '__main__':
    sys.exit(main())
