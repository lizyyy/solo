from typing import List, Dict, Any, Optional
from datetime import datetime
from dataclasses import dataclass, field

from .base_validator import ValidationContext
from .calibration_validator import CalibrationValidator
from .result_validator import ResultValidator
from .threshold_validator import ThresholdValidator
from .log_validator import LogValidator
from .channel_validator import ChannelValidator
from models import (
    Student, ScreeningResult, DeviceLog, CalibrationCertificate,
    ValidationIssue, IssueType, IssueSeverity, ReviewStatus
)


@dataclass
class ValidationSummary:
    total_issues: int = 0
    critical_issues: int = 0
    high_issues: int = 0
    medium_issues: int = 0
    low_issues: int = 0
    unreviewed_issues: int = 0
    confirmed_issues: int = 0
    rejected_issues: int = 0
    resolved_issues: int = 0
    issue_types: Dict[str, int] = field(default_factory=dict)
    affected_devices: List[str] = field(default_factory=list)
    affected_students: List[str] = field(default_factory=list)
    validation_timestamp: datetime = field(default_factory=datetime.now)


class ValidatorEngine:
    def __init__(self):
        self.validators = [
            ("calibration", CalibrationValidator()),
            ("results", ResultValidator()),
            ("thresholds", ThresholdValidator()),
            ("logs", LogValidator()),
            ("channels", ChannelValidator()),
        ]
        self.last_context: Optional[ValidationContext] = None
        self.last_issues: List[ValidationIssue] = []
    
    def validate(self, 
                  students: List[Student],
                  screening_results: List[ScreeningResult],
                  device_logs: List[DeviceLog],
                  certificates: List[CalibrationCertificate],
                  reference_date: Optional[datetime] = None) -> List[ValidationIssue]:
        context = ValidationContext(
            students=students,
            screening_results=screening_results,
            device_logs=device_logs,
            certificates=certificates,
            reference_date=reference_date or datetime.now()
        )
        
        self.last_context = context
        self.last_issues = []
        
        for name, validator in self.validators:
            try:
                issues = validator.validate(context)
                self.last_issues.extend(issues)
            except Exception as e:
                pass
        
        return self.last_issues
    
    def get_summary(self, issues: Optional[List[ValidationIssue]] = None) -> ValidationSummary:
        if issues is None:
            issues = self.last_issues
        
        summary = ValidationSummary()
        summary.total_issues = len(issues)
        
        affected_devices = set()
        affected_students = set()
        
        for issue in issues:
            if issue.severity == IssueSeverity.CRITICAL:
                summary.critical_issues += 1
            elif issue.severity == IssueSeverity.HIGH:
                summary.high_issues += 1
            elif issue.severity == IssueSeverity.MEDIUM:
                summary.medium_issues += 1
            elif issue.severity == IssueSeverity.LOW:
                summary.low_issues += 1
            
            if issue.review_status == ReviewStatus.UNREVIEWED:
                summary.unreviewed_issues += 1
            elif issue.review_status == ReviewStatus.CONFIRMED:
                summary.confirmed_issues += 1
            elif issue.review_status == ReviewStatus.REJECTED:
                summary.rejected_issues += 1
            elif issue.review_status == ReviewStatus.RESOLVED:
                summary.resolved_issues += 1
            
            issue_type_key = issue.issue_type.value
            summary.issue_types[issue_type_key] = summary.issue_types.get(issue_type_key, 0) + 1
            
            if issue.affected_device_id:
                affected_devices.add(issue.affected_device_id)
            if issue.affected_student_id:
                affected_students.add(issue.affected_student_id)
        
        summary.affected_devices = list(affected_devices)
        summary.affected_students = list(affected_students)
        
        return summary
    
    def get_issues_by_type(self, issue_type: IssueType, 
                            issues: Optional[List[ValidationIssue]] = None) -> List[ValidationIssue]:
        if issues is None:
            issues = self.last_issues
        return [i for i in issues if i.issue_type == issue_type]
    
    def get_issues_by_severity(self, severity: IssueSeverity,
                                 issues: Optional[List[ValidationIssue]] = None) -> List[ValidationIssue]:
        if issues is None:
            issues = self.last_issues
        return [i for i in issues if i.severity == severity]
    
    def get_issues_by_student(self, student_id: str,
                               issues: Optional[List[ValidationIssue]] = None) -> List[ValidationIssue]:
        if issues is None:
            issues = self.last_issues
        return [i for i in issues if i.affected_student_id == student_id]
    
    def get_issues_by_device(self, device_id: str,
                              issues: Optional[List[ValidationIssue]] = None) -> List[ValidationIssue]:
        if issues is None:
            issues = self.last_issues
        return [i for i in issues if i.affected_device_id == device_id]


def run_all_validations(students: List[Student],
                         screening_results: List[ScreeningResult],
                         device_logs: List[DeviceLog],
                         certificates: List[CalibrationCertificate],
                         reference_date: Optional[datetime] = None) -> tuple[List[ValidationIssue], ValidationSummary]:
    engine = ValidatorEngine()
    issues = engine.validate(
        students=students,
        screening_results=screening_results,
        device_logs=device_logs,
        certificates=certificates,
        reference_date=reference_date
    )
    summary = engine.get_summary(issues)
    return issues, summary
