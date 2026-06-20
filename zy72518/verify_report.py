#!/usr/bin/env python3
"""
验证脚本：核对灰度批次1的 2条待办、4条pending冲突、待办3归属、
冲突5/6的归属与状态、准确率说明、冲突汇总和导出内容是否一致。

用法: rm -f meeting_todo.db && python3 demo.py && python3 verify_report.py
"""
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import TodoExtract, ConflictRecord, EvaluationReport, GrayBatch
from services.conflict_service import get_conflict_summary_for_batch
from services.unified_data_service import UnifiedDataService

PASS = 0
FAIL = 0


def check(name, condition, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print("  [PASS] " + name)
    else:
        FAIL += 1
        print("  [FAIL] " + name + (" -- " + detail if detail else ""))


def main():
    db = SessionLocal()
    print("=" * 70)
    print("  会议纪要待办抽取系统 - 评测报告完整性验证")
    print("=" * 70)

    batch_id = 1

    print("\n--- 1. 批次1待办数 ---")
    todos = db.query(TodoExtract).filter(TodoExtract.gray_batch_id == batch_id).all()
    todo_ids = set(t.id for t in todos)
    check("批次1当前待办数为2", len(todos) == 2, "实际=" + str(len(todos)))

    print("\n--- 2. 待办3的归属 ---")
    todo3 = db.query(TodoExtract).filter(TodoExtract.id == 3).first()
    if todo3:
        check("待办3已迁移至批次2", todo3.gray_batch_id == 2, "实际gray_batch_id=" + str(todo3.gray_batch_id))
        check("待办3不在批次1待办列表中", 3 not in todo_ids)
    else:
        check("待办3存在", False, "待办3不存在")

    print("\n--- 3. 批次1冲突记录（原始） ---")
    all_conflicts = db.query(ConflictRecord).filter(ConflictRecord.batch_id == batch_id).all()
    pending_conflicts = [c for c in all_conflicts if c.status == "pending"]
    resolved_conflicts = [c for c in all_conflicts if c.status == "resolved"]
    check("批次1原始冲突总数为6", len(all_conflicts) == 6, "实际=" + str(len(all_conflicts)))
    check("批次1原始pending冲突为4", len(pending_conflicts) == 4, "实际=" + str(len(pending_conflicts)))
    check("批次1原始resolved冲突为2", len(resolved_conflicts) == 2, "实际=" + str(len(resolved_conflicts)))

    print("\n--- 4. 冲突5/6的归属与状态 ---")
    c5 = db.query(ConflictRecord).filter(ConflictRecord.id == 5).first()
    c6 = db.query(ConflictRecord).filter(ConflictRecord.id == 6).first()
    if c5:
        check("冲突5挂在批次1", c5.batch_id == 1)
        check("冲突5属于待办3", c5.todo_id == 3)
        check("冲突5状态为pending", c5.status == "pending")
    else:
        check("冲突5存在", False, "冲突5不存在")
    if c6:
        check("冲突6挂在批次1", c6.batch_id == 1)
        check("冲突6属于待办3", c6.todo_id == 3)
        check("冲突6状态为pending", c6.status == "pending")
    else:
        check("冲突6存在", False, "冲突6不存在")

    print("\n--- 5. 冲突汇总：raw vs in-scope ---")
    summary = get_conflict_summary_for_batch(db, batch_id)
    check("raw_pending_conflicts=4", summary["raw_pending_conflicts"] == 4, "实际=" + str(summary.get("raw_pending_conflicts")))
    check("pending_conflicts(in_scope)=2", summary["pending_conflicts"] == 2, "实际=" + str(summary.get("pending_conflicts")))
    check("excluded_pending_conflicts=2", summary["excluded_pending_conflicts"] == 2, "实际=" + str(summary.get("excluded_pending_conflicts")))
    check("unique_todos_with_pending=1", summary["unique_todos_with_pending"] == 1, "实际=" + str(summary.get("unique_todos_with_pending")))
    check("excluded_moved_todos有1条", len(summary.get("excluded_moved_todos", [])) == 1, "实际=" + str(len(summary.get("excluded_moved_todos", []))))
    if summary.get("excluded_moved_todos"):
        moved = summary["excluded_moved_todos"][0]
        check("被排除待办为待办3", moved["todo_id"] == 3, "实际=" + str(moved.get("todo_id")))
        check("被排除待办当前批次=2", moved["current_batch_id"] == 2, "实际=" + str(moved.get("current_batch_id")))
        check("被排除冲突数为2", moved["pending_conflicts_count"] == 2, "实际=" + str(moved.get("pending_conflicts_count")))
        check("被排除冲突ID包含5和6", set(moved["conflict_ids"]) == {5, 6}, "实际=" + str(moved.get("conflict_ids")))

    print("\n--- 6. 评测报告准确率 ---")
    report = db.query(EvaluationReport).filter(EvaluationReport.batch_id == batch_id).first()
    if report:
        check("准确率=0.5", abs(report.accuracy_rate - 0.5) < 0.001, "实际=" + str(report.accuracy_rate))
    else:
        check("评测报告存在", False)

    print("\n--- 7. 报告统计字段 ---")
    if report:
        stats = report.report_content.get("statistics", {})
        check("statistics.raw_pending_conflicts=4", stats.get("raw_pending_conflicts") == 4, "实际=" + str(stats.get("raw_pending_conflicts")))
        check("statistics.pending_conflicts_in_scope=2", stats.get("pending_conflicts_in_scope") == 2, "实际=" + str(stats.get("pending_conflicts_in_scope")))
        check("statistics.excluded_pending_conflicts=2", stats.get("excluded_pending_conflicts") == 2, "实际=" + str(stats.get("excluded_pending_conflicts")))

    print("\n--- 8. 报告accuracy_explanation ---")
    if report:
        exp = report.report_content.get("accuracy_explanation", "")
        check("说明提到4条原始pending", "4" in exp and "pending" in exp, exp[:100])
        check("说明提到2条属于当前批次", "2" in exp and "当前批次" in exp, exp[:200])
        check("说明提到2条被排除", "2" in exp and ("排除" in exp or "迁移" in exp or "不计入" in exp), exp[:300])

    print("\n--- 9. 报告excluded_conflict_explanation ---")
    if report:
        ece = report.report_content.get("excluded_conflict_explanation")
        check("excluded_conflict_explanation非空", ece is not None, "字段缺失")
        if ece:
            check("说明提到待办3", "3" in ece, ece[:100])
            check("说明提到冲突5/6", "5" in ece or "6" in ece, ece[:200])
            check("说明提到应由批次2确认", "2" in ece and ("确认" in ece or "迁移" in ece), ece[:300])

    print("\n--- 10. 报告conflict_details中冲突5/6标记 ---")
    if report:
        details = report.report_content.get("conflict_details", [])
        c5_detail = next((d for d in details if d.get("id") == 5), None)
        c6_detail = next((d for d in details if d.get("id") == 6), None)
        if c5_detail:
            check("冲突5 todo_in_current_batch=False", c5_detail.get("todo_in_current_batch") == False, "实际=" + str(c5_detail.get("todo_in_current_batch")))
        if c6_detail:
            check("冲突6 todo_in_current_batch=False", c6_detail.get("todo_in_current_batch") == False, "实际=" + str(c6_detail.get("todo_in_current_batch")))

    print("\n--- 11. 报告todo_status_list中的orphan_conflicts ---")
    if report:
        tsl = report.report_content.get("todo_status_list", [])
        orphan = next((item for item in tsl if item.get("status") == "orphan_conflicts"), None)
        check("todo_status_list含orphan_conflicts项", orphan is not None)
        if orphan:
            check("orphan说明提到已迁移待办", "迁移" in orphan.get("note", ""), orphan.get("note", "")[:100])
            od = orphan.get("orphan_details", [])
            check("orphan_details有1条", len(od) == 1, "实际=" + str(len(od)))
            if od:
                check("orphan待办ID=3", od[0].get("todo_id") == 3)
                check("orphan当前批次=2", od[0].get("current_batch_id") == 2)

    print("\n--- 12. 导出数据一致性 ---")
    page_data = UnifiedDataService.get_page_data(db, page=1, page_size=10, gray_batch_id=batch_id)
    api_data = UnifiedDataService.get_api_response(db, gray_batch_id=batch_id)
    export_content, export_record = UnifiedDataService.export_todos(
        db, export_format="json", gray_batch_id=batch_id, exported_by="验证"
    )
    check("页面/API/导出三者哈希一致", page_data["data_hash"] == api_data["data_hash"] == export_record.data_hash)

    print("\n--- 13. 冲突汇总explanation字段 ---")
    check("conflict_summary含explanation", "explanation" in summary, "字段缺失")
    if "explanation" in summary:
        check("explanation提到4条pending", "4" in summary["explanation"], summary["explanation"][:100])
        check("explanation提到2条属于当前批次", "2" in summary["explanation"] and "当前批次" in summary["explanation"], summary["explanation"][:200])
        check("explanation提到2条已迁移", "2" in summary["explanation"] and "迁移" in summary["explanation"], summary["explanation"][:200])

    print("\n" + "=" * 70)
    print("  验证结果: PASS=%d  FAIL=%d" % (PASS, FAIL))
    print("=" * 70)

    if FAIL > 0:
        print("\n  !! 存在失败项，请检查上面的 [FAIL] 条目 !!")
    else:
        print("\n  所有验证项通过，报告与DB数据完全一致！")

    db.close()
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
