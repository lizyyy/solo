import csv
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Set
from pathlib import Path
from datetime import datetime


@dataclass
class CourseSession:
    session_id: str
    course_name: str
    session_date: str
    session_time: str
    required: bool = True


@dataclass
class AttendanceRecord:
    student_id: str
    student_name: str
    session_id: str
    source: str
    status: str
    timestamp: Optional[str] = None
    original_row: int = 0
    notes: str = ""
    is_makeup: bool = False


@dataclass
class ConflictRecord:
    student_id: str
    session_id: str
    machine_status: str
    teacher_status: str
    conflict_type: str
    final_status: str
    original_machine_row: int = 0
    original_teacher_row: int = 0


@dataclass
class StudentAttendance:
    student_id: str
    student_name: str
    total_sessions: int = 0
    attended_sessions: int = 0
    absent_sessions: int = 0
    make_up_count: int = 0
    attendance_rate: float = 0.0
    is_eligible: bool = False
    session_details: Dict[str, Dict] = field(default_factory=dict)


class AttendanceDataProcessor:
    STATUS_PRESENT = "出勤"
    STATUS_ABSENT = "缺勤"
    STATUS_LATE = "迟到"
    STATUS_EARLY_LEAVE = "早退"

    CONFLICT_TYPE_STATUS = "状态冲突"
    CONFLICT_TYPE_DUPLICATE = "重复记录"

    SOURCE_MACHINE = "签到机"
    SOURCE_TEACHER = "老师补签"
    SOURCE_MERGED = "合并结果"

    def __init__(self, machine_file: str, teacher_file: str, courses_file: str,
                 encoding: str = "utf-8", min_attendance_rate: float = 0.8):
        self.machine_file = machine_file
        self.teacher_file = teacher_file
        self.courses_file = courses_file
        self.encoding = encoding
        self.min_attendance_rate = min_attendance_rate

        self.courses: Dict[str, CourseSession] = {}
        self.machine_records: List[AttendanceRecord] = []
        self.teacher_records: List[AttendanceRecord] = []
        self.merged_records: List[AttendanceRecord] = []
        self.conflicts: List[ConflictRecord] = []
        self.students: Dict[str, StudentAttendance] = {}

        self.bad_rows: Dict[str, List[Dict]] = {
            "machine": [],
            "teacher": [],
            "courses": []
        }

        self.stats: Dict = {
            "total_courses": 0,
            "total_machine_records": 0,
            "total_teacher_records": 0,
            "total_merged_records": 0,
            "total_conflicts": 0,
            "total_students": 0,
            "eligible_students": 0,
            "not_eligible_students": 0
        }

    def read_csv_with_headers(self, filepath: str, required_headers: Set[str],
                              file_type: str) -> List[Dict]:
        records = []
        with open(filepath, 'r', encoding=self.encoding) as f:
            reader = csv.DictReader(f)
            headers = set(reader.fieldnames or [])

            missing_headers = required_headers - headers
            if missing_headers:
                raise ValueError(f"{file_type}缺少必要列: {', '.join(missing_headers)}")

            for row_num, row in enumerate(reader, start=2):
                try:
                    records.append({**row, "_original_row": row_num})
                except Exception as e:
                    self.bad_rows[file_type].append({
                        "row_num": row_num,
                        "row_data": dict(row),
                        "error": str(e)
                    })

        return records

    def load_courses(self):
        required_headers = {"场次编号", "课程名称", "场次日期", "场次时间"}
        rows = self.read_csv_with_headers(self.courses_file, required_headers, "courses")

        for row in rows:
            try:
                session = CourseSession(
                    session_id=row["场次编号"].strip(),
                    course_name=row["课程名称"].strip(),
                    session_date=row["场次日期"].strip(),
                    session_time=row["场次时间"].strip()
                )
                self.courses[session.session_id] = session
            except Exception as e:
                self.bad_rows["courses"].append({
                    "row_num": row["_original_row"],
                    "row_data": {k: v for k, v in row.items() if not k.startswith("_")},
                    "error": str(e)
                })

        self.stats["total_courses"] = len(self.courses)

    def load_machine_records(self):
        required_headers = {"学员编号", "学员姓名", "场次编号", "签到状态"}
        rows = self.read_csv_with_headers(self.machine_file, required_headers, "machine")

        for row in rows:
            try:
                record = AttendanceRecord(
                    student_id=row["学员编号"].strip(),
                    student_name=row["学员姓名"].strip(),
                    session_id=row["场次编号"].strip(),
                    source=self.SOURCE_MACHINE,
                    status=self._normalize_status(row["签到状态"]),
                    timestamp=row.get("签到时间", "").strip(),
                    original_row=row["_original_row"]
                )
                self.machine_records.append(record)
            except Exception as e:
                self.bad_rows["machine"].append({
                    "row_num": row["_original_row"],
                    "row_data": {k: v for k, v in row.items() if not k.startswith("_")},
                    "error": str(e)
                })

        self.stats["total_machine_records"] = len(self.machine_records)

    def load_teacher_records(self):
        required_headers = {"学员编号", "学员姓名", "场次编号", "补签状态"}
        rows = self.read_csv_with_headers(self.teacher_file, required_headers, "teacher")

        for row in rows:
            try:
                record = AttendanceRecord(
                    student_id=row["学员编号"].strip(),
                    student_name=row["学员姓名"].strip(),
                    session_id=row["场次编号"].strip(),
                    source=self.SOURCE_TEACHER,
                    status=self._normalize_status(row["补签状态"]),
                    timestamp=row.get("补签时间", "").strip(),
                    original_row=row["_original_row"],
                    notes=row.get("备注", "").strip()
                )
                self.teacher_records.append(record)
            except Exception as e:
                self.bad_rows["teacher"].append({
                    "row_num": row["_original_row"],
                    "row_data": {k: v for k, v in row.items() if not k.startswith("_")},
                    "error": str(e)
                })

        self.stats["total_teacher_records"] = len(self.teacher_records)

    def _normalize_status(self, status: str) -> str:
        status = status.strip()
        status_map = {
            "出勤": self.STATUS_PRESENT,
            "出席": self.STATUS_PRESENT,
            "正常": self.STATUS_PRESENT,
            "已签到": self.STATUS_PRESENT,
            "缺勤": self.STATUS_ABSENT,
            "缺席": self.STATUS_ABSENT,
            "未签到": self.STATUS_ABSENT,
            "迟到": self.STATUS_LATE,
            "早退": self.STATUS_EARLY_LEAVE,
        }
        return status_map.get(status, self.STATUS_ABSENT)

    def merge_records(self):
        machine_dict: Dict[tuple, AttendanceRecord] = {}
        for record in self.machine_records:
            key = (record.student_id, record.session_id)
            machine_dict[key] = record

        teacher_dict: Dict[tuple, AttendanceRecord] = {}
        for record in self.teacher_records:
            key = (record.student_id, record.session_id)
            teacher_dict[key] = record

        all_keys = set(machine_dict.keys()) | set(teacher_dict.keys())
        all_session_ids = set(self.courses.keys())

        for key in all_keys:
            student_id, session_id = key

            if session_id not in all_session_ids:
                machine_rec = machine_dict.get(key)
                teacher_rec = teacher_dict.get(key)
                if machine_rec:
                    self.bad_rows["machine"].append({
                        "row_num": machine_rec.original_row,
                        "row_data": {
                            "学员编号": machine_rec.student_id,
                            "学员姓名": machine_rec.student_name,
                            "场次编号": session_id,
                            "签到状态": machine_rec.status
                        },
                        "error": f"未知的课程场次编号: {session_id}"
                    })
                if teacher_rec:
                    self.bad_rows["teacher"].append({
                        "row_num": teacher_rec.original_row,
                        "row_data": {
                            "学员编号": teacher_rec.student_id,
                            "学员姓名": teacher_rec.student_name,
                            "场次编号": session_id,
                            "补签状态": teacher_rec.status
                        },
                        "error": f"未知的课程场次编号: {session_id}"
                    })
                continue

            machine_rec = machine_dict.get(key)
            teacher_rec = teacher_dict.get(key)

            if machine_rec and teacher_rec:
                if machine_rec.status != teacher_rec.status:
                    final_status = teacher_rec.status
                    conflict = ConflictRecord(
                        student_id=student_id,
                        session_id=session_id,
                        machine_status=machine_rec.status,
                        teacher_status=teacher_rec.status,
                        conflict_type=self.CONFLICT_TYPE_STATUS,
                        final_status=final_status,
                        original_machine_row=machine_rec.original_row,
                        original_teacher_row=teacher_rec.original_row
                    )
                    self.conflicts.append(conflict)

                    merged = AttendanceRecord(
                        student_id=student_id,
                        student_name=teacher_rec.student_name,
                        session_id=session_id,
                        source=self.SOURCE_MERGED,
                        status=final_status,
                        timestamp=teacher_rec.timestamp or machine_rec.timestamp,
                        original_row=teacher_rec.original_row,
                        notes=f"状态冲突: 签到机={machine_rec.status}, 补签={teacher_rec.status}, 采用补签",
                        is_makeup=True
                    )
                    self.merged_records.append(merged)
                else:
                    merged = AttendanceRecord(
                        student_id=student_id,
                        student_name=teacher_rec.student_name,
                        session_id=session_id,
                        source=self.SOURCE_MERGED,
                        status=teacher_rec.status,
                        timestamp=teacher_rec.timestamp or machine_rec.timestamp,
                        original_row=teacher_rec.original_row,
                        is_makeup=True
                    )
                    self.merged_records.append(merged)

            elif teacher_rec:
                self.merged_records.append(AttendanceRecord(
                    student_id=teacher_rec.student_id,
                    student_name=teacher_rec.student_name,
                    session_id=teacher_rec.session_id,
                    source=self.SOURCE_TEACHER,
                    status=teacher_rec.status,
                    timestamp=teacher_rec.timestamp,
                    original_row=teacher_rec.original_row,
                    notes=teacher_rec.notes,
                    is_makeup=True
                ))

            elif machine_rec:
                self.merged_records.append(AttendanceRecord(
                    student_id=machine_rec.student_id,
                    student_name=machine_rec.student_name,
                    session_id=machine_rec.session_id,
                    source=self.SOURCE_MACHINE,
                    status=machine_rec.status,
                    timestamp=machine_rec.timestamp,
                    original_row=machine_rec.original_row,
                    is_makeup=False
                ))

        self.stats["total_merged_records"] = len(self.merged_records)
        self.stats["total_conflicts"] = len(self.conflicts)

    def calculate_student_attendance(self):
        student_session_data: Dict[str, Dict] = {}
        all_students: Dict[str, str] = {}

        for record in self.merged_records:
            if record.student_id not in all_students:
                all_students[record.student_id] = record.student_name

            if record.student_id not in student_session_data:
                student_session_data[record.student_id] = {}

            student_session_data[record.student_id][record.session_id] = {
                    "status": record.status,
                    "source": record.source,
                    "notes": record.notes,
                    "is_makeup": record.is_makeup
                }

        total_sessions = len(self.courses)

        for student_id, session_data in student_session_data.items():
            attended = 0
            absent = 0
            make_up = 0

            for session_id, info in session_data.items():
                if info["status"] in [self.STATUS_PRESENT, self.STATUS_LATE, self.STATUS_EARLY_LEAVE]:
                    attended += 1
                    if info["is_makeup"]:
                        make_up += 1
                else:
                    absent += 1

            for session_id in self.courses.keys():
                if session_id not in session_data:
                    absent += 1

            attendance_rate = attended / total_sessions if total_sessions > 0 else 0
            is_eligible = attendance_rate >= self.min_attendance_rate

            student = StudentAttendance(
                student_id=student_id,
                student_name=all_students[student_id],
                total_sessions=total_sessions,
                attended_sessions=attended,
                absent_sessions=absent,
                make_up_count=make_up,
                attendance_rate=round(attendance_rate, 4),
                is_eligible=is_eligible,
                session_details=session_data
            )

            self.students[student_id] = student

        self.stats["total_students"] = len(self.students)
        self.stats["eligible_students"] = sum(1 for s in self.students.values() if s.is_eligible)
        self.stats["not_eligible_students"] = sum(1 for s in self.students.values() if not s.is_eligible)

    def process(self):
        self.load_courses()
        self.load_machine_records()
        self.load_teacher_records()
        self.merge_records()
        self.calculate_student_attendance()
