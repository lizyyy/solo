"""Report building + certificate trace.

Produces:
    * detail  – every diff, sorted by student/course, with its review status
    * summary – per-course counts of pass / fail / pending
    * report  – downloadable bundle with detail, summary, and cert trace
    * trace   – walk from a cert_id through the history + diffs back to
                the original records so the operator can explain "为什么这条记录
                被放行 / 退回 / 要求补材料"
"""
from __future__ import annotations

from collections import defaultdict
from typing import Dict, List, Optional

from models import (
    AttendanceRecord,
    Certificate,
    CourseRule,
    Diff,
    EvalResult,
    HomeworkSubmission,
    Session,
    Student,
)


def build_detail(
    results: List[EvalResult],
    diffs: List[Diff],
    certs: Dict[str, List[Certificate]],
    students: Dict[str, Student],
    rules: List[CourseRule],
) -> List[dict]:
    rule_by_course = {r.course_id: r for r in rules}
    rows: List[dict] = []
    for r in results:
        certs_here = [
            c for c in certs.get(r.student_id, []) if c.course_id == r.course_id
        ]
        cert = certs_here[-1] if certs_here else None
        rows.append(
            {
                "student_id": r.student_id,
                "student_name": students[r.student_id].name if r.student_id in students else r.student_id,
                "course_id": r.course_id,
                "course_name": rule_by_course[r.course_id].course_name if r.course_id in rule_by_course else r.course_id,
                "score": r.score,
                "attendance_pct": r.attendance_pct,
                "pass": r.passed,
                "cert_id": cert.cert_id if cert else None,
                "cert_issued": cert.issued if cert else False,
                "reasons": cert.reasons if cert else [],
                "history_len": len(cert.history) if cert else 0,
                "diff_ids": cert.source_diff_ids if cert else [],
            }
        )
    return rows


def build_summary(
    results: List[EvalResult],
    diffs: List[Diff],
    certs: Dict[str, List[Certificate]],
    rules: List[CourseRule],
) -> Dict[str, dict]:
    rule_by_course = {r.course_id: r for r in rules}
    out: Dict[str, dict] = {}
    for rule in rules:
        course_results = [r for r in results if r.course_id == rule.course_id]
        issued = 0
        revoked = 0
        for r in course_results:
            chain = [c for c in certs.get(r.student_id, []) if c.course_id == rule.course_id]
            cert = chain[-1] if chain else None
            if cert and cert.issued:
                issued += 1
            elif cert and (not cert.issued):
                revoked += 1
        pending = sum(
            1
            for d in diffs
            if d.course_id == rule.course_id and not d.reviewed
        )
        out[rule.course_id] = {
            "course_name": rule.course_name,
            "total_students": len(course_results),
            "cert_issued": issued,
            "cert_revoked": revoked,
            "pending_reviews": pending,
            "avg_score": round(sum(r.score for r in course_results) / len(course_results), 2) if course_results else 0.0,
            "avg_attendance_pct": round(sum(r.attendance_pct for r in course_results) / len(course_results), 2) if course_results else 0.0,
        }
    return out


def build_report(
    results: List[EvalResult],
    diffs: List[Diff],
    certs: Dict[str, List[Certificate]],
    students: Dict[str, Student],
    rules: List[CourseRule],
) -> dict:
    return {
        "detail": build_detail(results, diffs, certs, students, rules),
        "summary": build_summary(results, diffs, certs, rules),
        "generated_at": "now",
    }


def trace_cert(
    cert_id: str,
    certs: Dict[str, List[Certificate]],
    diffs: List[Diff],
    students: Dict[str, Student],
    sessions: Dict[str, Session],
    attendance: List[AttendanceRecord],
    homework: List[HomeworkSubmission],
) -> dict:
    """Explain *why* this certificate was issued / revoked.

    Walks: cert_id -> history chain -> diffs -> original records.
    """
    matches: List[Certificate] = []
    for chain in certs.values():
        for c in chain:
            if c.cert_id == cert_id:
                matches.append(c)
    if not matches:
        return {"error": "cert_id not found"}

    # Pick the cert with the longest history (most recent state)
    target = max(matches, key=lambda c: len(c.history))

    diff_by_id = {d.id: d for d in diffs}
    used_diffs = [diff_by_id[d_id] for d_id in target.source_diff_ids if d_id in diff_by_id]

    linked_attendance = [a for a in attendance if a.student_id == target.student_id]
    linked_homework = [
        h
        for h in homework
        if h.student_id == target.student_id and h.course_id == target.course_id
    ]

    return {
        "cert_id": target.cert_id,
        "issued": target.issued,
        "revoked": target.revoked,
        "student_id": target.student_id,
        "student_name": students[target.student_id].name if target.student_id in students else target.student_id,
        "course_id": target.course_id,
        "final_score": target.score,
        "final_attendance_pct": target.attendance_pct,
        "reasons": target.reasons,
        "history": target.history,
        "diffs": [
            {
                "id": d.id,
                "reason": d.reason,
                "description": d.description,
                "impact": d.impact,
                "reviewed": d.reviewed,
                "decision": d.decision,
                "reviewer": d.reviewer,
                "review_note": d.review_note,
                "detail": d.detail,
            }
            for d in used_diffs
        ],
        "source_records": {
            "attendance": [
                {
                    "session_id": a.session_id,
                    "session_name": sessions[a.session_id].session_name if a.session_id in sessions else a.session_id,
                    "status": a.status,
                    "note": a.note,
                    "source_file": a.source_file,
                }
                for a in linked_attendance
            ],
            "homework": [
                {
                    "score": h.score,
                    "submitted_at": h.submitted_at.isoformat() if h.submitted_at else None,
                    "note": h.note,
                    "source_file": h.source_file,
                }
                for h in linked_homework
            ],
        },
        "explanation": _explain(target, used_diffs),
    }


def _explain(cert: Certificate, diffs: List[Diff]) -> str:
    if cert.issued:
        head = f"证书 {cert.cert_id} 已签发，最终得分 {cert.score}，出勤率 {cert.attendance_pct}%。"
    else:
        head = f"证书 {cert.cert_id} 未通过（{'已撤销' if cert.revoked else '初始未通过'}），最终得分 {cert.score}，出勤率 {cert.attendance_pct}%。"

    if cert.reasons:
        head += " 原因：" + "；".join(cert.reasons) + "。"

    pending = [d for d in diffs if not d.reviewed]
    decided = [d for d in diffs if d.reviewed]
    if pending:
        head += f" 有 {len(pending)} 条差异待复核。"
    if decided:
        lines = []
        for d in decided:
            decision = "放行" if d.decision == "approve" else "驳回"
            lines.append(f"{d.description}（{decision}，{d.reviewer}）")
        head += " 复核记录：" + "；".join(lines) + "。"
    return head
