"""Parsers for the three external data sources:
    1) attendance CSV     (签到)
    2) homework JSON      (作业)
    3) course rules       (课程规则)
"""
from __future__ import annotations

import csv
import json
from datetime import date, time
from io import StringIO
from typing import List, Dict

from models import (
    _uid,
    AttendanceRecord,
    AttendanceStatus,
    CourseRule,
    HomeworkSubmission,
    Session,
    Student,
)


# ---------------------------------------------------------------------------
# Attendance CSV
# ---------------------------------------------------------------------------


def parse_attendance_csv(text: str, students: Dict[str, Student]) -> List[AttendanceRecord]:
    """Expected columns:
        employee_id,session_id,status,check_in_time,note
    status is one of: present, late, absent, absent_excused, makeup
    """
    records: List[AttendanceRecord] = []
    reader = csv.DictReader(StringIO(text))
    for row in reader:
        emp = row["employee_id"].strip()
        student = students.get(emp)
        if not student:
            # register on the fly for robustness
            student = Student(
                id=emp,
                name=row.get("name", emp),
                email=row.get("email", f"{emp}@example.com"),
                employee_id=emp,
            )
            students[emp] = student
        t_str = row.get("check_in_time") or ""
        t_value = time.fromisoformat(t_str) if t_str else None
        records.append(
            AttendanceRecord(
                id=_uid(),
                student_id=student.id,
                session_id=row["session_id"].strip(),
                status=AttendanceStatus(row["status"].strip().lower()),
                check_in_time=t_value,
                note=row.get("note", "").strip(),
                source_file="attendance.csv",
            )
        )
    return records


# ---------------------------------------------------------------------------
# Homework JSON
# ---------------------------------------------------------------------------


def parse_homework_json(text: str) -> List[HomeworkSubmission]:
    """Expected JSON list with fields: employee_id, course_id, score, submitted_at, note"""
    data = json.loads(text)
    out: List[HomeworkSubmission] = []
    for row in data:
        sub = row.get("submitted_at")
        submitted = date.fromisoformat(sub) if sub else None
        out.append(
            HomeworkSubmission(
                id=_uid(),
                student_id=str(row["employee_id"]),
                course_id=str(row["course_id"]),
                score=float(row["score"]),
                submitted_at=submitted,
                note=str(row.get("note", "")),
                source_file="homework.json",
            )
        )
    return out


# ---------------------------------------------------------------------------
# Course rules
# ---------------------------------------------------------------------------


def parse_course_rules(text: str) -> List[CourseRule]:
    """Expected JSON list with fields:
        course_id, course_name, min_attendance_pct, pass_score,
        late_deduction, late_allowed_count, require_all_homework
    """
    data = json.loads(text)
    return [CourseRule(**row) for row in data]


# ---------------------------------------------------------------------------
# Students
# ---------------------------------------------------------------------------


def parse_students(text: str) -> Dict[str, Student]:
    """CSV: employee_id,name,email"""
    students: Dict[str, Student] = {}
    reader = csv.DictReader(StringIO(text))
    for row in reader:
        s = Student(
            id=row["employee_id"].strip(),
            name=row["name"].strip(),
            email=row["email"].strip(),
            employee_id=row["employee_id"].strip(),
        )
        students[s.employee_id] = s
    return students


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------


def parse_sessions(text: str, students: Dict[str, Student]) -> Dict[str, Session]:
    """CSV: session_id,course_id,session_date,session_name,start_time,late_minutes,required"""
    sessions: Dict[str, Session] = {}
    reader = csv.DictReader(StringIO(text))
    for row in reader:
        sid = row["session_id"].strip()
        sessions[sid] = Session(
            id=sid,
            course_id=row["course_id"].strip(),
            session_date=date.fromisoformat(row["session_date"].strip()),
            session_name=row["session_name"].strip(),
            start_time=time.fromisoformat(row["start_time"].strip()),
            late_minutes=int(row.get("late_minutes", "15")),
            required=row.get("required", "true").strip().lower() != "false",
        )
    return sessions
