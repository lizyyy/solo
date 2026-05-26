"""The reconciliation engine.

It takes all imported data, runs the course rules, and produces:
    * an EvalResult per student-course pair
    * a list of Diff records explaining *why* each result is what it is
    * Certificate records that include source_diff_ids + a history chain so
      cert_ids can be traced all the way back to the imported data.
"""
from __future__ import annotations

from datetime import date, time
from typing import Dict, List, Tuple

from models import (
    AttendanceRecord,
    AttendanceStatus,
    Certificate,
    CourseRule,
    Diff,
    DiffReason,
    EvalResult,
    HomeworkSubmission,
    ReviewAction,
    Session,
    Student,
    _uid,
)


def _cert_id(student_id: str, course_id: str, seq: int) -> str:
    return f"CERT-{student_id}-{course_id}-{seq:03d}"


def evaluate(
    students: Dict[str, Student],
    sessions: Dict[str, Session],
    attendance: List[AttendanceRecord],
    homework: List[HomeworkSubmission],
    rules: List[CourseRule],
) -> Tuple[List[EvalResult], List[Diff], Dict[str, List[Certificate]]]:
    """Run rules against imported data.

    Returns:
        results   – EvalResult per student/course
        diffs     – Diff records explaining every non-obvious finding
        certs     – grouped by student_id -> [Certificate] (ordered by history)
    """
    rule_by_course: Dict[str, CourseRule] = {r.course_id: r for r in rules}
    sessions_by_course: Dict[str, List[Session]] = {}
    for s in sessions.values():
        sessions_by_course.setdefault(s.course_id, []).append(s)

    att_by_student_session: Dict[Tuple[str, str], AttendanceRecord] = {
        (a.student_id, a.session_id): a for a in attendance
    }

    results: List[EvalResult] = []
    diffs: List[Diff] = []
    certs: Dict[str, List[Certificate]] = {
        s.id: [] for s in students.values()
    }

    for student in students.values():
        for rule in rules:
            course_id = rule.course_id
            sessions_here = sessions_by_course.get(course_id, [])

            present_count = 0
            late_count = 0
            absent_count = 0
            makeup_pending = 0
            missing_attendance: List[str] = []
            late_deductions_total = 0.0

            for sess in sessions_here:
                if not sess.required:
                    continue
                att = att_by_student_session.get((student.id, sess.id))
                if att is None:
                    absent_count += 1
                    missing_attendance.append(sess.session_name)
                    diffs.append(
                        Diff(
                            id=_uid(),
                            student_id=student.id,
                            course_id=course_id,
                            reason=DiffReason.ATTENDANCE_MISSING,
                            description=f"缺签到：{sess.session_name}",
                            detail={"session_id": sess.id, "session_name": sess.session_name},
                            impact="本次课按缺勤处理",
                        )
                    )
                elif att.status in (AttendanceStatus.PRESENT, AttendanceStatus.ABSENT_EXCUSED, AttendanceStatus.MAKEUP):
                    present_count += 1
                    if att.status == AttendanceStatus.MAKEUP:
                        diffs.append(
                            Diff(
                                id=_uid(),
                                student_id=student.id,
                                course_id=course_id,
                                reason=DiffReason.MAKEUP_PENDING,
                                description=f"补签：{sess.session_name}（需复核）",
                                detail={"session_id": sess.id, "note": att.note},
                                impact="待人工确认后计入出勤",
                            )
                        )
                        makeup_pending += 1
                elif att.status == AttendanceStatus.LATE:
                    present_count += 1
                    late_count += 1
                    late_deductions_total += rule.late_deduction
                    diffs.append(
                        Diff(
                            id=_uid(),
                            student_id=student.id,
                            course_id=course_id,
                            reason=DiffReason.LATE_DEDUCTION,
                            description=f"迟到扣分：{sess.session_name}",
                            detail={
                                "session_id": sess.id,
                                "check_in_time": att.check_in_time.isoformat() if att.check_in_time else None,
                                "deduction": rule.late_deduction,
                            },
                            impact=f"扣 {rule.late_deduction} 分",
                        )
                    )
                    if late_count > rule.late_allowed_count:
                        absent_count += 1
                        diffs.append(
                            Diff(
                                id=_uid(),
                                student_id=student.id,
                                course_id=course_id,
                                reason=DiffReason.ATTENDANCE_MISSING,
                                description=f"超过允许迟到次数 ({late_count} > {rule.late_allowed_count})",
                                detail={"late_count": late_count},
                                impact="本次课按缺勤处理",
                            )
                        )
                else:  # absent
                    absent_count += 1

            total_required = sum(1 for s in sessions_here if s.required) or 1
            attendance_pct = round(present_count / total_required * 100, 1)

            hw_here = [h for h in homework if h.student_id == student.id and h.course_id == course_id]
            if rule.require_all_homework and len(hw_here) < len(sessions_here):
                diffs.append(
                    Diff(
                        id=_uid(),
                        student_id=student.id,
                        course_id=course_id,
                        reason=DiffReason.HOMEWORK_MISSING,
                        description=f"作业数量不足：{len(hw_here)}/{len(sessions_here)}",
                        detail={},
                        impact="不能结业",
                    )
                )

            hw_scores = [h.score for h in hw_here]
            raw_score = (sum(hw_scores) / len(hw_scores)) if hw_scores else 0.0
            final_score = round(raw_score - late_deductions_total, 1)

            reasons: List[str] = []
            passed = True

            if attendance_pct < rule.min_attendance_pct:
                passed = False
                reasons.append(f"出勤率 {attendance_pct}% < 要求 {rule.min_attendance_pct}%")
            if final_score < rule.pass_score:
                passed = False
                reasons.append(f"得分 {final_score} < 及格线 {rule.pass_score}")
            if missing_attendance and makeup_pending == 0 and attendance_pct < rule.min_attendance_pct:
                reasons.append("有缺勤未补签")

            cert_id = _cert_id(student.id, course_id, len(certs[student.id]))
            source_diff_ids = [d.id for d in diffs if d.student_id == student.id and d.course_id == course_id]

            cert = Certificate(
                cert_id=cert_id,
                student_id=student.id,
                course_id=course_id,
                issued=passed,
                score=final_score,
                attendance_pct=attendance_pct,
                reasons=reasons,
                source_diff_ids=source_diff_ids,
                history=[
                    {
                        "seq": 0,
                        "action": "initial_evaluate",
                        "score": final_score,
                        "attendance_pct": attendance_pct,
                        "issued": passed,
                        "source_diff_ids": list(source_diff_ids),
                    }
                ],
            )
            certs[student.id].append(cert)

            diffs.append(
                Diff(
                    id=_uid(),
                    student_id=student.id,
                    course_id=course_id,
                    reason=DiffReason.CERT_ISSUED if passed else DiffReason.CERT_REVOKED,
                    description=("签发" if passed else "未通过"),
                    detail={
                        "final_score": final_score,
                        "attendance_pct": attendance_pct,
                        "cert_id": cert_id,
                        "reasons": reasons,
                    },
                    impact="通过" if passed else "未通过",
                )
            )

            results.append(
                EvalResult(
                    student_id=student.id,
                    course_id=course_id,
                    score=final_score,
                    attendance_pct=attendance_pct,
                    passed=passed,
                    cert_id=cert_id,
                )
            )

    return results, diffs, certs


def apply_review(
    diff: Diff,
    action: ReviewAction,
    reviewer: str,
    note: str,
    results: List[EvalResult],
    diffs: List[Diff],
    certs: Dict[str, List[Certificate]],
    students: Dict[str, Student],
    sessions: Dict[str, Session],
    attendance: List[AttendanceRecord],
    homework: List[HomeworkSubmission],
    rules: List[CourseRule],
) -> None:
    """Record a manual review decision and recompute the affected certificate.

    After this:
        * the diff is marked reviewed
        * the cert history is extended (so we can trace cert_id -> diffs ->
          original records)
        * detail/summary/report all pick up the new numbers
    """
    diff.reviewed = True
    diff.decision = action
    diff.reviewer = reviewer
    diff.review_note = note

    # Find existing cert for this student+course (if any)
    chain = certs.get(diff.student_id, [])
    matching = [c for c in chain if c.course_id == diff.course_id]
    existing_cert = matching[-1] if matching else None

    if action == ReviewAction.RECALC:
        # Re-run a scoped re-evaluation for this student/course
        rule_by_course = {r.course_id: r for r in rules}
        sub_results, sub_diffs, sub_certs = evaluate(
            students={k: v for k, v in students.items() if k == diff.student_id},
            sessions=sessions,
            attendance=[a for a in attendance if a.student_id == diff.student_id],
            homework=[h for h in homework if h.student_id == diff.student_id],
            rules=[rule_by_course[diff.course_id]],
        )
        # Merge in new diffs
        diffs.extend(sub_diffs)

        # Update EvalResult in-place
        for r in sub_results:
            for i, ex in enumerate(results):
                if ex.student_id == r.student_id and ex.course_id == r.course_id:
                    results[i] = r
                    break
            else:
                results.append(r)

        # Update the EXISTING cert in-place (do NOT create duplicate)
        if existing_cert and sub_certs:
            new_cert_data = sub_certs[diff.student_id][0]
            existing_cert.score = new_cert_data.score
            existing_cert.attendance_pct = new_cert_data.attendance_pct
            existing_cert.issued = new_cert_data.issued
            existing_cert.reasons = new_cert_data.reasons + [f"重算：{note}"]
            # Merge source_diff_ids: keep old review diffs + add new diffs
            new_diff_ids = new_cert_data.source_diff_ids
            for did in new_diff_ids:
                if did not in existing_cert.source_diff_ids:
                    existing_cert.source_diff_ids.append(did)
            existing_cert.history.append(
                {
                    "seq": len(existing_cert.history),
                    "action": "recalc",
                    "reviewer": reviewer,
                    "note": note,
                    "score": existing_cert.score,
                    "attendance_pct": existing_cert.attendance_pct,
                    "issued": existing_cert.issued,
                    "source_diff_ids": list(existing_cert.source_diff_ids),
                }
            )
        return

    # APPROVE / REJECT: mutate the latest cert of this student-course chain
    if not matching:
        return
    cert = matching[-1]

    # Update the cert state
    if action == ReviewAction.APPROVE:
        cert.issued = True
        cert.reasons = [f"人工放行：{note}"] + cert.reasons
    else:  # REJECT
        cert.issued = False
        cert.revoked = True
        cert.reasons = [f"人工驳回：{note}"] + cert.reasons

    # Also update the EvalResult to stay in sync
    for r in results:
        if r.student_id == cert.student_id and r.course_id == cert.course_id:
            r.passed = cert.issued
            break

    cert.history.append(
        {
            "seq": len(cert.history),
            "action": action.value,
            "reviewer": reviewer,
            "note": note,
            "diff_id": diff.id,
            "score": cert.score,
            "attendance_pct": cert.attendance_pct,
            "issued": cert.issued,
        }
    )
    # keep source_diff_ids in sync so tracing works end-to-end
    if diff.id not in cert.source_diff_ids:
        cert.source_diff_ids.append(diff.id)
