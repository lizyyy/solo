import sys
from pathlib import Path
from datetime import datetime

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import unittest
from models.student import Student
from models.device import Device
from models.screening_result import ScreeningResult, ScreeningStatus
from models.device_log import DeviceLog, LogLevel, LogEventType
from models.calibration_certificate import CalibrationCertificate, CalibrationStatus
from models.validation_issue import ValidationIssue, IssueType, IssueSeverity, ReviewStatus


class TestModels(unittest.TestCase):
    
    def test_student_model(self):
        student = Student(
            student_id="S001",
            name="张三",
            gender="男",
            age=8,
            grade="三年级",
            class_name="1班",
            school="实验小学"
        )
        
        self.assertEqual(student.student_id, "S001")
        self.assertEqual(student.name, "张三")
        self.assertEqual(student.age, 8)
        
        json_data = student.to_dict()
        self.assertEqual(json_data["student_id"], "S001")
        self.assertEqual(json_data["name"], "张三")
        
        restored = Student.from_dict(json_data)
        self.assertEqual(restored.student_id, "S001")
    
    def test_device_model(self):
        device = Device(
            device_id="AUD001",
            device_name="听力筛查仪A",
            device_model="Model-X1",
            serial_number="SN001234",
            manufacturer="某某公司"
        )
        
        self.assertEqual(device.device_id, "AUD001")
        self.assertEqual(device.device_model, "Model-X1")
        
        json_data = device.to_dict()
        restored = Device.from_dict(json_data)
        self.assertEqual(restored.device_id, "AUD001")
    
    def test_screening_result_model(self):
        result = ScreeningResult(
            screening_id="SR001",
            student_id="S001",
            device_id="AUD001",
            screening_date=datetime(2025, 4, 15, 9, 30),
            left_ear_thresholds={500: 15, 1000: 10, 2000: 15, 4000: 20, 8000: 15},
            right_ear_thresholds={500: 10, 1000: 15, 2000: 10, 4000: 15, 8000: 20},
            left_ear_status=ScreeningStatus.NORMAL,
            right_ear_status=ScreeningStatus.NORMAL,
            status=ScreeningStatus.NORMAL,
            tester="李医生",
            location="流动筛查车A"
        )
        
        self.assertEqual(result.screening_id, "SR001")
        self.assertEqual(result.left_ear_thresholds[500], 15)
        self.assertEqual(result.left_ear_status, ScreeningStatus.NORMAL)
        
        json_data = result.to_dict()
        self.assertIn("screening_date", json_data)
        self.assertIn("left_ear_thresholds", json_data)
        
        restored = ScreeningResult.from_dict(json_data)
        self.assertEqual(restored.screening_id, "SR001")
        self.assertEqual(restored.left_ear_thresholds[500], 15)
        self.assertIsInstance(restored.screening_date, datetime)
    
    def test_device_log_model(self):
        log = DeviceLog(
            log_id="LOG001",
            device_id="AUD001",
            log_timestamp=datetime(2025, 4, 15, 8, 0),
            level=LogLevel.INFO,
            event_type=LogEventType.DEVICE_START,
            message="设备启动完成",
            details={"firmware_version": "2.1.0"}
        )
        
        self.assertEqual(log.log_id, "LOG001")
        self.assertEqual(log.event_type, LogEventType.DEVICE_START)
        
        json_data = log.to_dict()
        restored = DeviceLog.from_dict(json_data)
        self.assertEqual(restored.log_id, "LOG001")
        self.assertIsInstance(restored.log_timestamp, datetime)
    
    def test_calibration_certificate_model(self):
        cert = CalibrationCertificate(
            certificate_id="CAL2025001",
            device_id="AUD001",
            calibration_date=datetime(2025, 1, 20),
            valid_until=datetime(2026, 1, 19),
            issued_by="国家计量科学研究院",
            certificate_number="JL2025-0120-001",
            left_ear_calibration={500: 0.3, 1000: 0.2},
            right_ear_calibration={500: 0.2, 1000: 0.3}
        )
        
        self.assertEqual(cert.certificate_id, "CAL2025001")
        self.assertEqual(cert.issued_by, "国家计量科学研究院")
        
        json_data = cert.to_dict()
        restored = CalibrationCertificate.from_dict(json_data)
        self.assertEqual(restored.certificate_id, "CAL2025001")
        self.assertIsInstance(restored.calibration_date, datetime)
        self.assertIsInstance(restored.valid_until, datetime)
    
    def test_calibration_status(self):
        cert = CalibrationCertificate(
            certificate_id="CAL001",
            device_id="AUD001",
            calibration_date=datetime.now() - timedelta(days=30),
            valid_until=datetime.now() + timedelta(days=335)
        )
        self.assertEqual(cert.get_status(), CalibrationStatus.VALID)
        
        expired_cert = CalibrationCertificate(
            certificate_id="CAL002",
            device_id="AUD002",
            calibration_date=datetime.now() - timedelta(days=400),
            valid_until=datetime.now() - timedelta(days=30)
        )
        self.assertEqual(expired_cert.get_status(), CalibrationStatus.EXPIRED)
    
    def test_validation_issue_model(self):
        issue = ValidationIssue(
            issue_id="ISSUE001",
            issue_type=IssueType.CALIBRATION_EXPIRED,
            severity=IssueSeverity.CRITICAL,
            title="校准证书过期",
            description="设备AUD001的校准证书已过期",
            affected_device_id="AUD001",
            affected_student_id=None,
            affected_screening_id=None,
            review_status=ReviewStatus.UNREVIEWED
        )
        
        self.assertEqual(issue.issue_id, "ISSUE001")
        self.assertEqual(issue.issue_type, IssueType.CALIBRATION_EXPIRED)
        self.assertEqual(issue.severity, IssueSeverity.CRITICAL)
        
        json_data = issue.to_dict()
        self.assertEqual(json_data["issue_type"], "calibration_expired")
        self.assertEqual(json_data["severity"], "critical")
        self.assertEqual(json_data["review_status"], "unreviewed")
        
        restored = ValidationIssue.from_dict(json_data)
        self.assertEqual(restored.issue_id, "ISSUE001")
        self.assertEqual(restored.issue_type, IssueType.CALIBRATION_EXPIRED)
        self.assertEqual(restored.severity, IssueSeverity.CRITICAL)
    
    def test_validation_issue_with_related_data(self):
        issue = ValidationIssue(
            issue_id="ISSUE002",
            issue_type=IssueType.THRESHOLD_ANOMALY,
            severity=IssueSeverity.MEDIUM,
            title="听力阈值异常",
            description="左耳高频阈值过高",
            affected_device_id="AUD001",
            affected_student_id="S001",
            affected_screening_id="SR001",
            details={
                "frequency": "4000",
                "threshold": 55,
                "ear": "left"
            },
            review_status=ReviewStatus.UNREVIEWED
        )
        
        json_data = issue.to_dict()
        self.assertIn("details", json_data)
        self.assertEqual(json_data["details"]["frequency"], "4000")
        
        restored = ValidationIssue.from_dict(json_data)
        self.assertEqual(restored.details["frequency"], "4000")
        self.assertEqual(restored.details["threshold"], 55)
    
    def test_review_status_enum(self):
        self.assertEqual(ReviewStatus.UNREVIEWED.value, "unreviewed")
        self.assertEqual(ReviewStatus.CONFIRMED.value, "confirmed")
        self.assertEqual(ReviewStatus.REJECTED.value, "rejected")
        self.assertEqual(ReviewStatus.RESOLVED.value, "resolved")
    
    def test_issue_type_enum(self):
        self.assertIn(IssueType.CALIBRATION_EXPIRED.value, "calibration_expired")
        self.assertIn(IssueType.RESULT_MISSING.value, "result_missing")
        self.assertIn(IssueType.THRESHOLD_ANOMALY.value, "threshold_anomaly")
        self.assertIn(IssueType.CHANNEL_SWAPPED.value, "channel_swapped")


from datetime import timedelta

if __name__ == "__main__":
    unittest.main()
