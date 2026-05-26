"""Smoke test.

Run with:  python smoke.py

Exercises the full flow: import → evaluate → review → detail/summary/report
→ cert trace. Prints a compact summary of what happened.
"""
from __future__ import annotations

import json

from engine import apply_review, evaluate
from models import ReviewAction
from parsers import (
    parse_attendance_csv,
    parse_course_rules,
    parse_homework_json,
    parse_sessions,
    parse_students,
)
from reports import build_detail, build_summary, trace_cert
from sample_data import (
    ATTENDANCE_CSV,
    HOMEWORK_JSON,
    RULES_JSON,
    SESSIONS_CSV,
    STUDENTS_CSV,
)


def main() -> None:
    students = parse_students(STUDENTS_CSV)
    sessions = parse_sessions(SESSIONS_CSV, students)
    attendance = parse_attendance_csv(ATTENDANCE_CSV, students)
    homework = parse_homework_json(HOMEWORK_JSON)
    rules = parse_course_rules(RULES_JSON)

    results, diffs, certs = evaluate(students, sessions, attendance, homework, rules)

    print("=== 自动比对结果 ===")
    for r in results:
        print(f"  {r.student_id} / {r.course_id}: 得分 {r.score}, 出勤 {r.attendance_pct}%, 通过={r.passed}, cert={r.cert_id}")

    print("\n=== 差异（待复核） ===")
    for d in diffs:
        print(f"  [{d.id}] {d.reason} | {d.description} | 复核={d.reviewed}")

    # 人工复核：给 E003 的补签放行
    makeup_diff = next(
        (d for d in diffs if d.student_id == "E003" and "补签" in d.description), None
    )
    if makeup_diff:
        apply_review(
            makeup_diff,
            ReviewAction.APPROVE,
            "管理员",
            "出差已核实，补签生效",
            results,
            diffs,
            certs,
            students,
            sessions,
            attendance,
            homework,
            rules,
        )
        print(f"\n  ✅ 已复核 {makeup_diff.id}：放行")

    # 重新计算：触发 recalc 会重跑引擎
    recalc_diff = diffs[-1]  # 随便挑一个
    apply_review(
        recalc_diff,
        ReviewAction.RECALC,
        "管理员",
        "数据更新后重算",
        results,
        diffs,
        certs,
        students,
        sessions,
        attendance,
        homework,
        rules,
    )
    print(f"  🔁 已触发 recalc，最新结果：")
    for r in results[-3:]:
        print(f"    {r.student_id}: {r.score} / {r.attendance_pct}% / {r.passed}")

    print("\n=== 汇总 ===")
    summary = build_summary(results, diffs, certs, rules)
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    print("\n=== 证书溯源（E003） ===")
    e003_certs = certs.get("E003", [])
    for cert in e003_certs:
        trace = trace_cert(cert.cert_id, certs, diffs, students, sessions, attendance, homework)
        print(json.dumps(trace["explanation"], ensure_ascii=False))
        print(f"  history 长度: {len(cert.history)}")
        print(f"  关联 diffs: {cert.source_diff_ids}")


if __name__ == "__main__":
    main()
