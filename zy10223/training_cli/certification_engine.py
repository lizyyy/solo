from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from .models import (
    Student,
    Assignment,
    Submission,
    CertificationRules,
    CertificationStatus,
    Anomaly,
    SubmissionStatus,
)
from .data_manager import DataManager


@dataclass
class StudentCertificationResult:
    student: Student
    status: CertificationStatus
    reasons: List[str]
    submitted_count: int
    on_time_count: int
    late_count: int
    ungraded_count: int
    avg_score: Optional[float]
    details: Dict = field(default_factory=dict)


class CertificationEngine:
    def __init__(self, data_manager: DataManager, rules: CertificationRules):
        self.dm = data_manager
        self.rules = rules
    
    def _is_assignment_eligible(self, assignment: Assignment) -> bool:
        if not assignment.required:
            return False
        if assignment.round_num in self.rules.exclude_rounds:
            return False
        return True
    
    def evaluate_student(self, student: Student) -> StudentCertificationResult:
        reasons: List[str] = []
        submitted_count = 0
        on_time_count = 0
        late_count = 0
        ungraded_count = 0
        scores: List[float] = []
        
        eligible_assignments = [
            a for a in self.dm.assignments.values()
            if self._is_assignment_eligible(a)
        ]
        
        effective = self.dm.get_effective_submissions()
        assignment_status: Dict[str, str] = {}
        
        for assignment in eligible_assignments:
            key = (student.id, assignment.id)
            submission = effective.get(key)
            
            if submission is None:
                reasons.append(f"未提交作业：{assignment.name} (第{assignment.round_num}轮)")
                assignment_status[assignment.id] = "missing"
            else:
                submitted_count += 1
                
                if submission.status in [SubmissionStatus.LATE, SubmissionStatus.LATE_GRADED]:
                    late_count += 1
                    assignment_status[assignment.id] = "late"
                else:
                    on_time_count += 1
                    assignment_status[assignment.id] = "on_time"
                
                if submission.score is not None:
                    scores.append(submission.score)
                else:
                    ungraded_count += 1
                    assignment_status[assignment.id] = "submitted_ungraded"
        
        avg_score = sum(scores) / len(scores) if scores else None
        
        if submitted_count < self.rules.min_required_assignments:
            reasons.append(
                f"提交数量不足：已提交 {submitted_count} 个作业，要求至少 {self.rules.min_required_assignments} 个"
            )
        
        if not self.rules.allow_late_for_cert:
            if late_count > self.rules.max_late_submissions:
                reasons.append(
                    f"迟交数量超限：迟交 {late_count} 个作业，最多允许 {self.rules.max_late_submissions} 个"
                )
        
        if self.rules.require_all_graded and ungraded_count > 0:
            reasons.append(
                f"存在未批改作业：{ungraded_count} 个作业尚未评分"
            )
        
        if self.rules.min_avg_score is not None and avg_score is not None:
            if avg_score < self.rules.min_avg_score:
                reasons.append(
                    f"平均分不足：平均分 {avg_score:.1f}，要求至少 {self.rules.min_avg_score}"
                )
        elif self.rules.min_avg_score is not None and avg_score is None:
            reasons.append("没有可计算的分数")
        
        if len(reasons) == 0:
            status = CertificationStatus.QUALIFIED
        elif len(reasons) <= 2 and all(
            "未提交" not in r and "超限" not in r
            for r in reasons
        ):
            status = CertificationStatus.AT_RISK
        else:
            status = CertificationStatus.DISQUALIFIED
        
        return StudentCertificationResult(
            student=student,
            status=status,
            reasons=reasons,
            submitted_count=submitted_count,
            on_time_count=on_time_count,
            late_count=late_count,
            ungraded_count=ungraded_count,
            avg_score=avg_score,
            details={
                "assignment_status": assignment_status,
                "scores": scores,
                "eligible_assignments": len(eligible_assignments),
            },
        )
    
    def evaluate_all(self) -> List[StudentCertificationResult]:
        results = []
        for student in self.dm.students.values():
            results.append(self.evaluate_student(student))
        return results
    
    def get_reminder_list(self, assignment_id: Optional[str] = None) -> Dict[str, List[Dict]]:
        reminders: Dict[str, List[Dict]] = {}
        
        effective = self.dm.get_effective_submissions()
        
        if assignment_id:
            target_assignments = {assignment_id: self.dm.assignments.get(assignment_id)}
        else:
            target_assignments = dict(self.dm.assignments)
        
        for aid, assignment in target_assignments.items():
            if assignment is None:
                continue
            
            group_reminders: Dict[str, List[Dict]] = {}
            
            for student in self.dm.students.values():
                key = (student.id, aid)
                submission = effective.get(key)
                
                needs_reminder = False
                reminder_type = ""
                details = {}
                
                if submission is None:
                    needs_reminder = True
                    reminder_type = "未提交"
                    details = {
                        "deadline": assignment.deadline.isoformat(),
                    }
                elif submission.score is None:
                    needs_reminder = True
                    reminder_type = "已提交待批改"
                    details = {
                        "submitted_at": submission.submitted_at.isoformat(),
                        "is_late": submission.status in [SubmissionStatus.LATE, SubmissionStatus.LATE_GRADED],
                    }
                elif submission.is_resubmit:
                    needs_reminder = False
                    reminder_type = "已重交"
                    details = {
                        "score": submission.score,
                        "resubmit_reason": submission.resubmit_reason,
                    }
                
                if needs_reminder:
                    if student.group not in group_reminders:
                        group_reminders[student.group] = []
                    group_reminders[student.group].append({
                        "student": student,
                        "type": reminder_type,
                        "details": details,
                    })
            
            if group_reminders:
                reminders[aid] = []
                for group, students in group_reminders.items():
                    students_sorted = sorted(
                        students,
                        key=lambda x: (0 if x["type"] == "未提交" else 1, x["student"].name),
                    )
                    reminders[aid].append({
                        "group": group,
                        "assignment": assignment,
                        "students": students_sorted,
                    })
        
        return reminders
