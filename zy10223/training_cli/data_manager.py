import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Set
from .models import (
    Student,
    Assignment,
    Submission,
    Anomaly,
    SubmissionStatus,
)


class DataManager:
    def __init__(self, data_dir: Path):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        self.students: Dict[str, Student] = {}
        self.assignments: Dict[str, Assignment] = {}
        self.submissions: Dict[str, Submission] = {}
        
        self.student_index: Dict[str, str] = {}
        self.submission_keys: Set[str] = set()
        
        self.anomalies: List[Anomaly] = []
        
        self._load_data()
    
    def _load_data(self):
        students_file = self.data_dir / "students.json"
        if students_file.exists():
            data = json.loads(students_file.read_text(encoding="utf-8"))
            for s in data:
                student = Student(**s)
                self._add_student_internal(student, import_mode=False)
        
        assignments_file = self.data_dir / "assignments.json"
        if assignments_file.exists():
            data = json.loads(assignments_file.read_text(encoding="utf-8"))
            for a in data:
                assignment = Assignment.from_dict(a)
                self.assignments[assignment.id] = assignment
        
        submissions_file = self.data_dir / "submissions.json"
        if submissions_file.exists():
            data = json.loads(submissions_file.read_text(encoding="utf-8"))
            for s in data:
                submission = Submission.from_dict(s)
                self._add_submission_internal(submission, import_mode=False)
        
        anomalies_file = self.data_dir / "anomalies.json"
        if anomalies_file.exists():
            data = json.loads(anomalies_file.read_text(encoding="utf-8"))
            for a in data:
                self.anomalies.append(Anomaly(**a))
    
    def _save_data(self):
        students_file = self.data_dir / "students.json"
        students_file.write_text(
            json.dumps(
                [s.__dict__ for s in self.students.values()],
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        
        assignments_file = self.data_dir / "assignments.json"
        assignments_file.write_text(
            json.dumps(
                [a.to_dict() for a in self.assignments.values()],
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        
        submissions_file = self.data_dir / "submissions.json"
        submissions_file.write_text(
            json.dumps(
                [s.to_dict() for s in self.submissions.values()],
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        
        anomalies_file = self.data_dir / "anomalies.json"
        anomalies_file.write_text(
            json.dumps(
                [a.__dict__ for a in self.anomalies],
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
    
    def _add_student_internal(self, student: Student, import_mode: bool) -> bool:
        existing_ids = set()
        for existing in self.students.values():
            for identifier in [student.id] + student.emails + student.aliases:
                if existing.matches(identifier):
                    existing_ids.add(existing.id)
        
        if len(existing_ids) > 0:
            if import_mode:
                self.anomalies.append(
                    Anomaly(
                        type="duplicate_student",
                        severity="warning",
                        message=f"学员数据冲突：新导入的学员 '{student.name}' (ID: {student.id}) 与已存在学员冲突",
                        details={
                            "new_student": student.__dict__,
                            "conflict_with": list(existing_ids),
                        },
                    )
                )
            return False
        
        self.students[student.id] = student
        self.student_index[student.id.lower()] = student.id
        self.student_index[student.name.lower()] = student.id
        for email in student.emails:
            self.student_index[email.lower()] = student.id
        for alias in student.aliases:
            self.student_index[alias.lower()] = student.id
        return True
    
    def _generate_submission_key(
        self, student_id: str, assignment_id: str, submitted_at: datetime
    ) -> str:
        key = f"{student_id}:{assignment_id}:{submitted_at.isoformat()}"
        return hashlib.md5(key.encode()).hexdigest()
    
    def _add_submission_internal(
        self, submission: Submission, import_mode: bool
    ) -> Tuple[bool, Optional[Submission]]:
        key = self._generate_submission_key(
            submission.student_id,
            submission.assignment_id,
            submission.submitted_at,
        )
        
        if key in self.submission_keys:
            if import_mode:
                self.anomalies.append(
                    Anomaly(
                        type="duplicate_submission",
                        severity="info",
                        message=f"重复提交已跳过：学员 {submission.student_id} 的作业 {submission.assignment_id} 在 {submission.submitted_at} 的提交已存在",
                        details={
                            "submission_id": submission.id,
                            "student_id": submission.student_id,
                            "assignment_id": submission.assignment_id,
                            "submitted_at": submission.submitted_at.isoformat(),
                        },
                    )
                )
            return False, None
        
        assignment = self.assignments.get(submission.assignment_id)
        if assignment:
            if submission.submitted_at > assignment.deadline:
                if submission.score is not None:
                    submission.status = SubmissionStatus.LATE_GRADED
                else:
                    submission.status = SubmissionStatus.LATE
        
        existing_submission = self._get_latest_submission(
            submission.student_id, submission.assignment_id
        )
        
        if existing_submission:
            submission.is_resubmit = True
            if existing_submission.score is not None and submission.score is None:
                submission.score = existing_submission.score
            
            if import_mode:
                self.anomalies.append(
                    Anomaly(
                        type="resubmit_detected",
                        severity="info",
                        message=f"检测到重交：学员 {submission.student_id} 的作业 {submission.assignment_id} 有新提交，旧分数将被覆盖",
                        details={
                            "old_submission": existing_submission.id,
                            "old_score": existing_submission.score,
                            "new_submission": submission.id,
                            "new_score": submission.score,
                            "submitted_at": submission.submitted_at.isoformat(),
                        },
                    )
                )
        
        if submission.student_id not in self.students:
            if import_mode:
                self.anomalies.append(
                    Anomaly(
                        type="unknown_student",
                        severity="error",
                        message=f"未知学员：提交记录中的学员 ID '{submission.student_id}' 不在学员名单中",
                        details={
                            "submission_id": submission.id,
                            "student_id": submission.student_id,
                            "source": submission.source_identifier,
                        },
                    )
                )
            return False, None
        
        if submission.assignment_id not in self.assignments:
            if import_mode:
                self.anomalies.append(
                    Anomaly(
                        type="unknown_assignment",
                        severity="error",
                        message=f"未知作业：提交记录中的作业 ID '{submission.assignment_id}' 不存在",
                        details={
                            "submission_id": submission.id,
                            "assignment_id": submission.assignment_id,
                        },
                    )
                )
            return False, None
        
        self.submission_keys.add(key)
        self.submissions[submission.id] = submission
        return True, existing_submission
    
    def _get_latest_submission(
        self, student_id: str, assignment_id: str
    ) -> Optional[Submission]:
        latest = None
        for s in self.submissions.values():
            if s.student_id == student_id and s.assignment_id == assignment_id:
                if latest is None or s.submitted_at > latest.submitted_at:
                    latest = s
        return latest
    
    def find_student(self, identifier: str) -> Optional[Student]:
        identifier = identifier.strip().lower()
        if identifier in self.student_index:
            return self.students.get(self.student_index[identifier])
        for student in self.students.values():
            if student.matches(identifier):
                return student
        return None
    
    def add_student(self, student: Student) -> bool:
        result = self._add_student_internal(student, import_mode=False)
        if result:
            self._save_data()
        return result
    
    def import_students(self, students: List[Dict]) -> Tuple[int, int]:
        added = 0
        skipped = 0
        for data in students:
            student = Student(
                id=data["id"],
                name=data["name"],
                group=data.get("group", "未分组"),
                emails=data.get("emails", []),
                aliases=data.get("aliases", []),
                notes=data.get("notes", ""),
            )
            if self._add_student_internal(student, import_mode=True):
                added += 1
            else:
                skipped += 1
        self._save_data()
        return added, skipped
    
    def add_assignment(self, assignment: Assignment) -> bool:
        if assignment.id in self.assignments:
            return False
        self.assignments[assignment.id] = assignment
        self._save_data()
        return True
    
    def import_assignments(self, assignments: List[Dict]) -> Tuple[int, int]:
        added = 0
        skipped = 0
        for data in assignments:
            try:
                assignment = Assignment.from_dict(data)
                if assignment.id not in self.assignments:
                    self.assignments[assignment.id] = assignment
                    added += 1
                else:
                    self.anomalies.append(
                        Anomaly(
                            type="duplicate_assignment",
                            severity="info",
                            message=f"作业已存在，跳过：{assignment.id}",
                            details={"assignment_id": assignment.id},
                        )
                    )
                    skipped += 1
            except Exception as e:
                self.anomalies.append(
                    Anomaly(
                        type="invalid_assignment",
                        severity="error",
                        message=f"作业数据格式错误：{e}",
                        details={"data": data},
                    )
                )
                skipped += 1
        self._save_data()
        return added, skipped
    
    def add_submission(self, submission: Submission) -> Tuple[bool, Optional[Submission]]:
        result, old = self._add_submission_internal(submission, import_mode=False)
        if result:
            self._save_data()
        return result, old
    
    def import_submissions(self, submissions: List[Dict]) -> Tuple[int, int]:
        added = 0
        skipped = 0
        
        processed: Dict[Tuple[str, str], List[Submission]] = {}
        for data in submissions:
            try:
                student_identifier = data.get("student_identifier", data.get("student_id", ""))
                student = self.find_student(student_identifier)
                
                if student is None:
                    self.anomalies.append(
                        Anomaly(
                            type="unmatched_identifier",
                            severity="warning",
                            message=f"无法匹配学员：标识符 '{student_identifier}' 无法找到对应学员",
                            details={
                                "identifier": student_identifier,
                                "assignment_id": data.get("assignment_id"),
                            },
                        )
                    )
                    skipped += 1
                    continue
                
                submission_id = data.get(
                    "id",
                    f"auto_{student.id}_{data['assignment_id']}_{datetime.now().timestamp()}",
                )
                
                submission = Submission(
                    id=submission_id,
                    student_id=student.id,
                    assignment_id=data["assignment_id"],
                    submitted_at=datetime.fromisoformat(data["submitted_at"]),
                    score=data.get("score"),
                    source_identifier=data.get("source_identifier", student_identifier),
                    resubmit_reason=data.get("resubmit_reason", ""),
                    grader_notes=data.get("grader_notes", ""),
                )
                
                key = (student.id, data["assignment_id"])
                if key not in processed:
                    processed[key] = []
                processed[key].append(submission)
                
            except Exception as e:
                self.anomalies.append(
                    Anomaly(
                        type="invalid_submission",
                        severity="error",
                        message=f"提交数据格式错误：{e}",
                        details={"data": data},
                    )
                )
                skipped += 1
        
        for (student_id, assignment_id), subs in processed.items():
            subs.sort(key=lambda s: s.submitted_at)
            for i, submission in enumerate(subs):
                result, _ = self._add_submission_internal(submission, import_mode=True)
                if result:
                    added += 1
                    if i < len(subs) - 1:
                        submission.is_resubmit = False
                        submission.status = SubmissionStatus.RESUBMITTED
                else:
                    skipped += 1
        
        self._save_data()
        return added, skipped
    
    def get_student_submissions(self, student_id: str) -> List[Submission]:
        return [
            s
            for s in self.submissions.values()
            if s.student_id == student_id
        ]
    
    def get_effective_submissions(self) -> Dict[Tuple[str, str], Submission]:
        effective: Dict[Tuple[str, str], Submission] = {}
        for submission in self.submissions.values():
            key = (submission.student_id, submission.assignment_id)
            if (
                key not in effective
                or submission.submitted_at > effective[key].submitted_at
            ):
                effective[key] = submission
        return effective
    
    def check_missing_grades(self) -> List[Anomaly]:
        effective = self.get_effective_submissions()
        anomalies = []
        for (student_id, assignment_id), submission in effective.items():
            if submission.score is None:
                student = self.students.get(student_id)
                assignment = self.assignments.get(assignment_id)
                anomalies.append(
                    Anomaly(
                        type="missing_grade",
                        severity="warning",
                        message=f"缺少批改：学员 '{student.name if student else student_id}' 的作业 '{assignment.name if assignment else assignment_id}' 尚未评分",
                        details={
                            "student_id": student_id,
                            "assignment_id": assignment_id,
                            "submission_id": submission.id,
                            "submitted_at": submission.submitted_at.isoformat(),
                        },
                    )
                )
        return anomalies
    
    def get_anomalies(self, severity: Optional[str] = None) -> List[Anomaly]:
        if severity is None:
            return list(self.anomalies)
        return [a for a in self.anomalies if a.severity == severity]
    
    def clear_anomalies(self):
        self.anomalies = []
        anomalies_file = self.data_dir / "anomalies.json"
        if anomalies_file.exists():
            anomalies_file.unlink()
