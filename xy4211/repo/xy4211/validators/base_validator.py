from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime

from models import (
    Student, ScreeningResult, DeviceLog, CalibrationCertificate, 
    ValidationIssue, IssueType, IssueSeverity
)
from config import (
    CALIBRATION_VALIDITY_DAYS,
    THRESHOLD_NORMAL_MAX,
    THRESHOLD_EXTREME_MAX,
    LOG_TIME_DRIFT_THRESHOLD_SECONDS
)


@dataclass
class ValidationContext:
    students: List[Student] = field(default_factory=list)
    screening_results: List[ScreeningResult] = field(default_factory=list)
    device_logs: List[DeviceLog] = field(default_factory=list)
    certificates: List[CalibrationCertificate] = field(default_factory=list)
    reference_date: datetime = field(default_factory=datetime.now)
    extra_data: Dict[str, Any] = field(default_factory=dict)
    
    def get_student_by_id(self, student_id: str) -> Optional[Student]:
        for student in self.students:
            if student.student_id == student_id:
                return student
        return None
    
    def get_results_by_student_id(self, student_id: str) -> List[ScreeningResult]:
        return [r for r in self.screening_results if r.student_id == student_id]
    
    def get_certificate_by_device_id(self, device_id: str) -> Optional[CalibrationCertificate]:
        for cert in self.certificates:
            if cert.device_id == device_id:
                return cert
        return None
    
    def get_logs_by_device_id(self, device_id: str) -> List[DeviceLog]:
        return [l for l in self.device_logs if l.device_id == device_id]
    
    def get_all_device_ids(self) -> List[str]:
        device_ids = set()
        for result in self.screening_results:
            if result.device_id:
                device_ids.add(result.device_id)
        for log in self.device_logs:
            if log.device_id:
                device_ids.add(log.device_id)
        for cert in self.certificates:
            if cert.device_id:
                device_ids.add(cert.device_id)
        return list(device_ids)


class BaseValidator(ABC):
    def __init__(self):
        self.issues: List[ValidationIssue] = []
    
    @abstractmethod
    def validate(self, context: ValidationContext) -> List[ValidationIssue]:
        pass
    
    def _add_issue(self, 
                   issue_type: IssueType,
                   severity: IssueSeverity,
                   title: str,
                   description: str,
                   device_id: Optional[str] = None,
                   student_id: Optional[str] = None,
                   screening_id: Optional[str] = None,
                   log_id: Optional[str] = None,
                   certificate_id: Optional[str] = None,
                   details: Optional[Dict[str, Any]] = None,
                   source_file: Optional[str] = None) -> None:
        from models import ValidationIssue
        issue = ValidationIssue(
            issue_type=issue_type,
            severity=severity,
            title=title,
            description=description,
            affected_device_id=device_id,
            affected_student_id=student_id,
            affected_screening_id=screening_id,
            affected_log_id=log_id,
            affected_certificate_id=certificate_id,
            details=details or {},
            source_file=source_file
        )
        self.issues.append(issue)
