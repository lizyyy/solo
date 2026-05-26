"""FastAPI entry point for the reconciliation service."""
from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from engine import apply_review, evaluate
from models import (
    AttendanceRecord,
    CourseRule,
    Diff,
    EvalResult,
    HomeworkSubmission,
    ReviewAction,
    Session,
    Student,
)
from parsers import (
    parse_attendance_csv,
    parse_course_rules,
    parse_homework_json,
    parse_sessions,
    parse_students,
)
from reports import build_detail, build_report, build_summary, trace_cert


# ---------------------------------------------------------------------------
# In-memory store
# ---------------------------------------------------------------------------


class Store:
    def __init__(self) -> None:
        self.students: Dict[str, Student] = {}
        self.sessions: Dict[str, Session] = {}
        self.attendance: List[AttendanceRecord] = []
        self.homework: List[HomeworkSubmission] = []
        self.rules: List[CourseRule] = []
        self.results: List[EvalResult] = []
        self.diffs: List[Diff] = []
        self.certs: Dict[str, List] = {}  # student_id -> [Certificate]


store = Store()


# ---------------------------------------------------------------------------
# Pydantic request schemas
# ---------------------------------------------------------------------------


class ImportPayload(BaseModel):
    students_csv: Optional[str] = None
    sessions_csv: Optional[str] = None
    attendance_csv: Optional[str] = None
    homework_json: Optional[str] = None
    rules_json: Optional[str] = None


class ReviewPayload(BaseModel):
    diff_id: str
    action: ReviewAction
    reviewer: str
    note: str = ""


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------


app = FastAPI(title="Training Reconciliation Service")


@app.post("/import", summary="Import raw data")
def import_data(payload: ImportPayload) -> dict:
    if payload.students_csv:
        store.students = parse_students(payload.students_csv)
    if payload.sessions_csv:
        store.sessions = parse_sessions(payload.sessions_csv, store.students)
    if payload.attendance_csv:
        store.attendance.extend(
            parse_attendance_csv(payload.attendance_csv, store.students)
        )
    if payload.homework_json:
        store.homework.extend(parse_homework_json(payload.homework_json))
    if payload.rules_json:
        store.rules = parse_course_rules(payload.rules_json)
    return {
        "students": len(store.students),
        "sessions": len(store.sessions),
        "attendance": len(store.attendance),
        "homework": len(store.homework),
        "rules": len(store.rules),
    }


@app.post("/evaluate", summary="Run the reconciliation engine")
def evaluate_all() -> dict:
    results, diffs, certs = evaluate(
        store.students,
        store.sessions,
        store.attendance,
        store.homework,
        store.rules,
    )
    store.results = results
    store.diffs = diffs
    store.certs = certs
    return {
        "results": len(results),
        "diffs": len(diffs),
        "certs": sum(len(v) for v in certs.values()),
    }


@app.post("/review", summary="Review a diff (approve/reject/recalc)")
def review(payload: ReviewPayload) -> dict:
    diff = next((d for d in store.diffs if d.id == payload.diff_id), None)
    if not diff:
        raise HTTPException(status_code=404, detail="diff not found")
    apply_review(
        diff,
        payload.action,
        payload.reviewer,
        payload.note,
        store.results,
        store.diffs,
        store.certs,
        store.students,
        store.sessions,
        store.attendance,
        store.homework,
        store.rules,
    )
    return {
        "diff_id": diff.id,
        "decision": payload.action,
        "reviewer": payload.reviewer,
    }


@app.get("/detail", summary="Student-level detail")
def detail() -> list:
    return build_detail(store.results, store.diffs, store.certs, store.students, store.rules)


@app.get("/summary", summary="Course-level summary")
def summary() -> dict:
    return build_summary(store.results, store.diffs, store.certs, store.rules)


@app.get("/report", summary="Downloadable reconciliation report")
def report() -> dict:
    return build_report(store.results, store.diffs, store.certs, store.students, store.rules)


@app.get("/diffs", summary="All diffs (pending/resolved)")
def list_diffs(status: Optional[str] = None) -> list:
    out = []
    for d in store.diffs:
        if status == "pending" and d.reviewed:
            continue
        if status == "resolved" and not d.reviewed:
            continue
        out.append(
            {
                "id": d.id,
                "student_id": d.student_id,
                "course_id": d.course_id,
                "reason": d.reason,
                "description": d.description,
                "detail": d.detail,
                "impact": d.impact,
                "reviewed": d.reviewed,
                "decision": d.decision,
                "reviewer": d.reviewer,
                "review_note": d.review_note,
            }
        )
    return out


@app.get("/trace/{cert_id}", summary="Trace a certificate back to source records")
def trace(cert_id: str) -> dict:
    return trace_cert(
        cert_id,
        store.certs,
        store.diffs,
        store.students,
        store.sessions,
        store.attendance,
        store.homework,
    )
