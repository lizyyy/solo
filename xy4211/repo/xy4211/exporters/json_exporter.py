import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from uuid import uuid4

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from models import (
    Student, ScreeningResult, DeviceLog, CalibrationCertificate,
    ValidationIssue, IssueType, IssueSeverity, ReviewStatus
)
from validators import ValidationSummary
from config import APP_NAME, APP_VERSION


class JSONExporter:
    def __init__(self):
        pass
    
    def generate_audit_package(self,
                                students: List[Student],
                                screening_results: List[ScreeningResult],
                                device_logs: List[DeviceLog],
                                certificates: List[CalibrationCertificate],
                                issues: List[ValidationIssue],
                                summary: Optional[ValidationSummary] = None,
                                session_name: str = "默认会话",
                                include_raw_data: bool = True) -> Dict[str, Any]:
        audit_id = str(uuid4())
        generated_at = datetime.now()
        
        package: Dict[str, Any] = {
            "audit_id": audit_id,
            "generated_at": generated_at.isoformat(),
            "session_name": session_name,
            "software": {
                "name": APP_NAME,
                "version": APP_VERSION
            },
            "summary": {
                "total_students": len(students),
                "total_screening_results": len(screening_results),
                "total_device_logs": len(device_logs),
                "total_certificates": len(certificates),
                "total_issues": len(issues),
            },
            "issues_summary": {},
            "issues": [],
        }
        
        if summary:
            package["summary"].update({
                "critical_issues": summary.critical_issues,
                "high_issues": summary.high_issues,
                "medium_issues": summary.medium_issues,
                "low_issues": summary.low_issues,
                "unreviewed_issues": summary.unreviewed_issues,
                "confirmed_issues": summary.confirmed_issues,
                "rejected_issues": summary.rejected_issues,
                "resolved_issues": summary.resolved_issues,
                "affected_devices": summary.affected_devices,
                "affected_students_count": len(summary.affected_students),
            })
            package["issues_summary"] = summary.issue_types
        
        device_ids = set()
        for r in screening_results:
            if r.device_id:
                device_ids.add(r.device_id)
        for l in device_logs:
            if l.device_id:
                device_ids.add(l.device_id)
        for c in certificates:
            if c.device_id:
                device_ids.add(c.device_id)
        package["summary"]["devices_involved"] = list(device_ids)
        
        package["issues"] = [self._issue_to_audit_format(issue) for issue in issues]
        
        if include_raw_data:
            package["data"] = {
                "students": [s.to_dict() for s in students],
                "screening_results": [r.to_dict() for r in screening_results],
                "device_logs": [l.to_dict() for l in device_logs],
                "certificates": [c.to_dict() for c in certificates],
            }
        
        return package
    
    def _issue_to_audit_format(self, issue: ValidationIssue) -> Dict[str, Any]:
        return {
            "issue_id": issue.issue_id,
            "issue_type": issue.issue_type.value,
            "severity": issue.severity.value,
            "title": issue.title,
            "description": issue.description,
            "affected": {
                "device_id": issue.affected_device_id,
                "student_id": issue.affected_student_id,
                "screening_id": issue.affected_screening_id,
                "log_id": issue.affected_log_id,
                "certificate_id": issue.affected_certificate_id,
            },
            "review": {
                "status": issue.review_status.value,
                "notes": issue.review_notes,
                "reviewer": issue.reviewer,
                "timestamp": issue.review_timestamp.isoformat() if issue.review_timestamp else None,
            },
            "detection_timestamp": issue.detection_timestamp.isoformat() if issue.detection_timestamp else None,
            "details": issue.details,
            "source_file": issue.source_file,
        }
    
    def export_to_file(self,
                       output_path: Path,
                       students: List[Student],
                       screening_results: List[ScreeningResult],
                       device_logs: List[DeviceLog],
                       certificates: List[CalibrationCertificate],
                       issues: List[ValidationIssue],
                       summary: Optional[ValidationSummary] = None,
                       session_name: str = "默认会话",
                       include_raw_data: bool = True) -> bool:
        try:
            package = self.generate_audit_package(
                students=students,
                screening_results=screening_results,
                device_logs=device_logs,
                certificates=certificates,
                issues=issues,
                summary=summary,
                session_name=session_name,
                include_raw_data=include_raw_data
            )
            
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(package, f, ensure_ascii=False, indent=2, default=str)
            
            return True
        except Exception:
            return False
    
    def export_issues_only(self,
                            issues: List[ValidationIssue],
                            output_path: Path) -> bool:
        try:
            issues_data = [self._issue_to_audit_format(issue) for issue in issues]
            
            package = {
                "exported_at": datetime.now().isoformat(),
                "software": {
                    "name": APP_NAME,
                    "version": APP_VERSION
                },
                "total_issues": len(issues),
                "issues": issues_data
            }
            
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(package, f, ensure_ascii=False, indent=2, default=str)
            
            return True
        except Exception:
            return False


def export_json_audit(output_path: Path,
                       students: List[Student],
                       screening_results: List[ScreeningResult],
                       device_logs: List[DeviceLog],
                       certificates: List[CalibrationCertificate],
                       issues: List[ValidationIssue],
                       summary: Optional[ValidationSummary] = None,
                       session_name: str = "默认会话",
                       include_raw_data: bool = True) -> bool:
    exporter = JSONExporter()
    return exporter.export_to_file(
        output_path=output_path,
        students=students,
        screening_results=screening_results,
        device_logs=device_logs,
        certificates=certificates,
        issues=issues,
        summary=summary,
        session_name=session_name,
        include_raw_data=include_raw_data
    )
