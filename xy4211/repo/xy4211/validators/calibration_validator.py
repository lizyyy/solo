from typing import List
from datetime import datetime

from .base_validator import BaseValidator, ValidationContext
from models import ValidationIssue, IssueType, IssueSeverity, CalibrationCertificate, CalibrationStatus
from config import CALIBRATION_VALIDITY_DAYS


class CalibrationValidator(BaseValidator):
    def __init__(self):
        super().__init__()
    
    def validate(self, context: ValidationContext) -> List[ValidationIssue]:
        self.issues.clear()
        
        device_ids = context.get_all_device_ids()
        
        for device_id in device_ids:
            cert = context.get_certificate_by_device_id(device_id)
            
            if cert is None:
                self._add_issue(
                    issue_type=IssueType.CALIBRATION_MISSING,
                    severity=IssueSeverity.CRITICAL,
                    title=f"设备 {device_id} 缺少校准证书",
                    description=f"设备 {device_id} 已使用但未找到对应的校准证书。请确保证书已导入。",
                    device_id=device_id
                )
                continue
            
            self._validate_certificate_expiry(cert, context.reference_date)
        
        return self.issues
    
    def _validate_certificate_expiry(self, cert: CalibrationCertificate, reference_date: datetime) -> None:
        status = cert.get_status(reference_date)
        
        if status == CalibrationStatus.EXPIRED:
            days_remaining = cert.get_days_remaining(reference_date)
            if days_remaining is not None:
                days_expired = abs(days_remaining)
            else:
                days_expired = 0
            
            self._add_issue(
                issue_type=IssueType.CALIBRATION_EXPIRED,
                severity=IssueSeverity.CRITICAL,
                title=f"设备 {cert.device_id} 校准证书已过期",
                description=f"设备 {cert.device_id} 的校准证书已于 {cert.valid_until.strftime('%Y-%m-%d') if cert.valid_until else '未知日期'} 过期，已过期 {days_expired} 天。校准有效期通常为 {CALIBRATION_VALIDITY_DAYS} 天。",
                device_id=cert.device_id,
                certificate_id=cert.certificate_id,
                details={
                    "calibration_date": cert.calibration_date.isoformat() if cert.calibration_date else None,
                    "valid_until": cert.valid_until.isoformat() if cert.valid_until else None,
                    "days_expired": days_expired
                },
                source_file=cert.source_file
            )
        elif status == CalibrationStatus.VALID:
            days_remaining = cert.get_days_remaining(reference_date)
            if days_remaining is not None and days_remaining <= 30:
                self._add_issue(
                    issue_type=IssueType.CALIBRATION_EXPIRED,
                    severity=IssueSeverity.MEDIUM,
                    title=f"设备 {cert.device_id} 校准证书即将过期",
                    description=f"设备 {cert.device_id} 的校准证书将于 {cert.valid_until.strftime('%Y-%m-%d') if cert.valid_until else '未知日期'} 过期，仅剩 {days_remaining} 天。请及时安排重新校准。",
                    device_id=cert.device_id,
                    certificate_id=cert.certificate_id,
                    details={
                        "calibration_date": cert.calibration_date.isoformat() if cert.calibration_date else None,
                        "valid_until": cert.valid_until.isoformat() if cert.valid_until else None,
                        "days_remaining": days_remaining
                    },
                    source_file=cert.source_file
                )


def validate_calibration(context: ValidationContext) -> List[ValidationIssue]:
    validator = CalibrationValidator()
    return validator.validate(context)
