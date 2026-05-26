"""Domain models for the reconciliation service.

Everything is persisted as plain Python dataclasses with UUID ids, and serialized into JSON for export. The central idea: an "audit run" bundles all data + rules into a snapshot (records) that we run rules over. Each student-course evaluation produces a diff set that can be approved/rejected by a human. Every cert_id is traceable back through the history.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import List, Optional
from uuid import uuid4
from datetime import date, time


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class AttendanceStatus(str, Enum):
    PRESENT = "present"
    LATE = "late"
    ABSENT = "absent"
    ABSENT_EXCUSED = "absent_excused"
    MAKEUP = "makeup"


class DiffReason(str, Enum):
    ATTENDANCE_MISSING = "attendance_missing"
    HOMEWORK_MISSING = "homework_missing"
    LATE_DEDUCTION = "late_deduction"
    MAKEUP_PENDING = "makeup_pending"
    SCORE_BELOW_PASS = "score_below_pass"
    CERT_REVOKED = "cert_revoked"
    CERT_ISSUED = "cert_issued"


class ReviewAction(str, Enum):
    APPROVE = "approve"
    REJECT = "reject"
    RECALC = "recalc"


# ---------------------------------------------------------------------------
# Core records
# ---------------------------------------------------------------------------


@dataclass
class Student:
    id: str
    name: str
    email: str
    employee_id: str


@dataclass
class Session:
    id: str
    course_id: str
    session_date: date
    session_name: str
    start_time: time
    late_minutes: int = 15
    required: bool = True


@dataclass
class AttendanceRecord:
    id: str
    student_id: str
    session_id: str
    status: AttendanceStatus
    check_in_time: Optional[time]
    note: str = ""
    source_file: str = ""


@dataclass
class HomeworkSubmission:
    id: str
    student_id: str
    course_id: str
    score: float
    submitted_at: Optional[date]
    note: str = ""
    source_file: str = ""


@dataclass
class CourseRule:
    course_id: str
    course_name: str
    min_attendance_pct: float
    pass_score: float
    late_deduction: float
    late_allowed_count: int
    require_all_homework: bool


# ---------------------------------------------------------------------------
# Diff + Review workflow
# ---------------------------------------------------------------------------


@dataclass
class Diff:
    """A single explainable difference between what the rules say and what the records
    imported data show.  The human operator reviews each diff; approval merges it to take an
    approve / reject / recalc.  Every diff carries a trace id for the
    student-course combination that produced it so we can audit it later."""
    id: str
    student_id: str
    course_id: str
    reason: DiffReason
    description: str
    detail: dict
    impact: str
    reviewed: bool = False
    decision: Optional[ReviewAction] = None
    reviewer: Optional[str] = None
    reviewed_at: Optional[time] = None
    review_note: str = ""


@dataclass
class Certificate:
    cert_id: str
    student_id: str
    course_id: str
    issued: bool
    score: float
    attendance_pct: float
    reasons: List[str]
    source_diff_ids: List[str]
    revoked: bool = False
    history: List[dict] = field(default_factory=list)


@dataclass
class EvalResult:
    student_id: str
    course_id: str
    score: float
    attendance_pct: float
    passed: bool
    cert_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _uid() -> str:
    return uuid4().hex[:12]


def to_dict(obj) -> dict:
    d = asdict(obj)
    return d
