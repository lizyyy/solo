import sys
from pathlib import Path
from datetime import datetime, timedelta

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import unittest
from models.student import Student
from models.screening_result import ScreeningResult, ScreeningStatus
from models.device_log import DeviceLog, LogLevel, LogEventType
from models.calibration_certificate import CalibrationCertificate, CalibrationStatus
from models.validation_issue import IssueType, IssueSeverity
from validators.calibration_validator import CalibrationValidator
from validators.result_validator import ResultValidator
from validators.threshold_validator import ThresholdValidator
from validators.log_validator import LogValidator
from validators.channel_validator import ChannelValidator
from validators.base_validator import ValidationContext


class TestValidators(unittest.TestCase):
    
    def setUp(self):
        self.students = [
            Student(student_id="S001", name="张三", gender="男", age=8, grade="三年级", class_name="1班", school="实验小学"),
            Student(student_id="S002", name="李四", gender="女", age=9, grade="三年级", class_name="1班", school="实验小学"),
            Student(student_id="S003", name="王五", gender="男", age=8, grade="三年级", class_name="1班", school="实验小学"),
        ]
        
        self.screening_results = [
            ScreeningResult(
                screening_id="SR001",
                student_id="S001",
                device_id="AUD001",
                screening_date=datetime.now() - timedelta(hours=2),
                left_ear_thresholds={500: 15, 1000: 10, 2000: 15, 4000: 20, 8000: 15},
                right_ear_thresholds={500: 10, 1000: 15, 2000: 10, 4000: 15, 8000: 20},
                left_ear_status=ScreeningStatus.NORMAL,
                right_ear_status=ScreeningStatus.NORMAL,
                status=ScreeningStatus.NORMAL,
                tester="李医生",
                location="流动筛查车A"
            ),
            ScreeningResult(
                screening_id="SR002",
                student_id="S001",
                device_id="AUD001",
                screening_date=datetime.now() - timedelta(hours=1),
                left_ear_thresholds={500: 15, 1000: 10, 2000: 15, 4000: 20, 8000: 15},
                right_ear_thresholds={500: 10, 1000: 15, 2000: 10, 4000: 15, 8000: 20},
                left_ear_status=ScreeningStatus.NORMAL,
                right_ear_status=ScreeningStatus.NORMAL,
                status=ScreeningStatus.NORMAL,
                tester="李医生",
                location="流动筛查车A"
            ),
            ScreeningResult(
                screening_id="SR003",
                student_id="S002",
                device_id="AUD001",
                screening_date=datetime.now(),
                left_ear_thresholds={500: 35, 1000: 40, 2000: 45, 4000: 50, 8000: 45},
                right_ear_thresholds={500: 15, 1000: 10, 2000: 15, 4000: 20, 8000: 15},
                left_ear_status=ScreeningStatus.REFER,
                right_ear_status=ScreeningStatus.NORMAL,
                status=ScreeningStatus.REFER,
                tester="李医生",
                location="流动筛查车A"
            ),
        ]
        
        self.device_logs = [
            DeviceLog(
                log_id="LOG001",
                device_id="AUD001",
                log_timestamp=datetime.now() - timedelta(hours=3),
                level=LogLevel.INFO,
                event_type=LogEventType.DEVICE_START,
                message="设备启动完成",
                details={"firmware_version": "2.1.0"}
            ),
            DeviceLog(
                log_id="LOG002",
                device_id="AUD002",
                log_timestamp=datetime.now() - timedelta(hours=1),
                level=LogLevel.ERROR,
                event_type=LogEventType.ERROR_OCCURRED,
                message="通道通信错误",
                details={"error_code": "E0042"}
            ),
        ]
    
    def test_calibration_validator_expired(self):
        certs = [
            CalibrationCertificate(
                certificate_id="CAL001",
                device_id="AUD001",
                calibration_date=datetime.now() - timedelta(days=400),
                valid_until=datetime.now() - timedelta(days=30),
                issued_by="国家计量科学研究院",
                certificate_number="JL001",
                left_ear_calibration={500: 0.3},
                right_ear_calibration={500: 0.2}
            )
        ]
        
        context = ValidationContext(
            students=self.students,
            screening_results=self.screening_results,
            device_logs=self.device_logs,
            certificates=certs
        )
        
        validator = CalibrationValidator()
        issues = validator.validate(context)
        
        expired_issues = [i for i in issues if i.issue_type == IssueType.CALIBRATION_EXPIRED]
        self.assertEqual(len(expired_issues), 1)
        self.assertEqual(expired_issues[0].severity, IssueSeverity.CRITICAL)
        self.assertIn("过期", expired_issues[0].description)
    
    def test_calibration_validator_valid(self):
        certs = [
            CalibrationCertificate(
                certificate_id="CAL001",
                device_id="AUD001",
                calibration_date=datetime.now() - timedelta(days=30),
                valid_until=datetime.now() + timedelta(days=335),
                issued_by="国家计量科学研究院",
                certificate_number="JL001",
                left_ear_calibration={500: 0.3},
                right_ear_calibration={500: 0.2}
            )
        ]
        
        context = ValidationContext(
            students=self.students,
            screening_results=self.screening_results,
            device_logs=self.device_logs,
            certificates=certs
        )
        
        validator = CalibrationValidator()
        issues = validator.validate(context)
        
        expired_issues = [i for i in issues if i.issue_type == IssueType.CALIBRATION_EXPIRED]
        self.assertEqual(len(expired_issues), 0)
    
    def test_result_validator_missing(self):
        context = ValidationContext(
            students=self.students,
            screening_results=self.screening_results,
            device_logs=self.device_logs,
            certificates=[]
        )
        
        validator = ResultValidator()
        issues = validator.validate(context)
        
        missing_issues = [i for i in issues if i.issue_type == IssueType.RESULT_MISSING]
        self.assertEqual(len(missing_issues), 1)
        self.assertEqual(missing_issues[0].affected_student_id, "S003")
        self.assertIn("王五", missing_issues[0].description)
    
    def test_result_validator_duplicate(self):
        context = ValidationContext(
            students=self.students,
            screening_results=self.screening_results,
            device_logs=self.device_logs,
            certificates=[]
        )
        
        validator = ResultValidator()
        issues = validator.validate(context)
        
        duplicate_issues = [i for i in issues if i.issue_type == IssueType.RESULT_DUPLICATE]
        self.assertEqual(len(duplicate_issues), 1)
        self.assertEqual(duplicate_issues[0].affected_student_id, "S001")
        self.assertIn("2", duplicate_issues[0].description)
    
    def test_threshold_validator_normal(self):
        normal_result = ScreeningResult(
            screening_id="SR999",
            student_id="S001",
            device_id="AUD001",
            screening_date=datetime.now(),
            left_ear_thresholds={500: 15, 1000: 10, 2000: 15, 4000: 20, 8000: 15},
            right_ear_thresholds={500: 10, 1000: 15, 2000: 10, 4000: 15, 8000: 20},
            left_ear_status=ScreeningStatus.NORMAL,
            right_ear_status=ScreeningStatus.NORMAL,
            status=ScreeningStatus.NORMAL
        )
        
        context = ValidationContext(
            students=[],
            screening_results=[normal_result],
            device_logs=[],
            certificates=[]
        )
        
        validator = ThresholdValidator()
        issues = validator.validate(context)
        
        abnormal_issues = [i for i in issues if i.issue_type in [IssueType.THRESHOLD_ANOMALY, IssueType.THRESHOLD_EXTREME]]
        self.assertEqual(len(abnormal_issues), 0)
    
    def test_threshold_validator_abnormal(self):
        abnormal_result = ScreeningResult(
            screening_id="SR004",
            student_id="S001",
            device_id="AUD001",
            screening_date=datetime.now(),
            left_ear_thresholds={500: 35, 1000: 40, 2000: 45, 4000: 50, 8000: 45},
            right_ear_thresholds={500: 15, 1000: 10, 2000: 15, 4000: 20, 8000: 15},
            left_ear_status=ScreeningStatus.REFER,
            right_ear_status=ScreeningStatus.NORMAL,
            status=ScreeningStatus.REFER
        )
        
        context = ValidationContext(
            students=[],
            screening_results=[abnormal_result],
            device_logs=[],
            certificates=[]
        )
        
        validator = ThresholdValidator()
        issues = validator.validate(context)
        
        abnormal_issues = [i for i in issues if i.issue_type == IssueType.THRESHOLD_ANOMALY]
        self.assertGreater(len(abnormal_issues), 0)
    
    def test_threshold_validator_extreme(self):
        extreme_result = ScreeningResult(
            screening_id="SR005",
            student_id="S001",
            device_id="AUD001",
            screening_date=datetime.now(),
            left_ear_thresholds={500: 125, 1000: 90, 2000: 85, 4000: 80, 8000: 75},
            right_ear_thresholds={500: 10, 1000: 15, 2000: 10, 4000: 15, 8000: 20},
            left_ear_status=ScreeningStatus.NORMAL,
            right_ear_status=ScreeningStatus.NORMAL,
            status=ScreeningStatus.NORMAL
        )
        
        context = ValidationContext(
            students=[],
            screening_results=[extreme_result],
            device_logs=[],
            certificates=[]
        )
        
        validator = ThresholdValidator()
        issues = validator.validate(context)
        
        extreme_issues = [i for i in issues if i.issue_type == IssueType.THRESHOLD_EXTREME]
        self.assertGreater(len(extreme_issues), 0)
        self.assertEqual(extreme_issues[0].severity, IssueSeverity.HIGH)
    
    def test_log_validator_error(self):
        context = ValidationContext(
            students=[],
            screening_results=[],
            device_logs=self.device_logs,
            certificates=[]
        )
        
        validator = LogValidator()
        issues = validator.validate(context)
        
        error_issues = [i for i in issues if i.issue_type == IssueType.INVALID_DATA]
        self.assertEqual(len(error_issues), 1)
        self.assertIn("通道通信错误", error_issues[0].description)
    
    def test_channel_validator_possible_swap(self):
        swapped_result = ScreeningResult(
            screening_id="SR006",
            student_id="S001",
            device_id="AUD001",
            screening_date=datetime.now(),
            left_ear_thresholds={500: 45, 1000: 50, 2000: 55, 4000: 60, 8000: 55},
            right_ear_thresholds={500: 10, 1000: 15, 2000: 12, 4000: 18, 8000: 15},
            left_ear_status=ScreeningStatus.NORMAL,
            right_ear_status=ScreeningStatus.NORMAL,
            status=ScreeningStatus.NORMAL
        )
        
        context = ValidationContext(
            students=[],
            screening_results=[swapped_result],
            device_logs=[],
            certificates=[]
        )
        
        validator = ChannelValidator()
        issues = validator.validate(context)
        
        channel_issues = [i for i in issues if i.issue_type == IssueType.CHANNEL_SWAPPED]
        self.assertGreater(len(channel_issues), 0)
        self.assertEqual(channel_issues[0].severity, IssueSeverity.HIGH)
    
    def test_calibration_missing(self):
        context = ValidationContext(
            students=self.students,
            screening_results=self.screening_results,
            device_logs=self.device_logs,
            certificates=[]
        )
        
        validator = CalibrationValidator()
        issues = validator.validate(context)
        
        missing_issues = [i for i in issues if i.issue_type == IssueType.CALIBRATION_MISSING]
        self.assertGreater(len(missing_issues), 0)
        self.assertEqual(missing_issues[0].severity, IssueSeverity.CRITICAL)
    
    def test_threshold_anomaly_severity_based_on_level(self):
        mild_result = ScreeningResult(
            screening_id="SR_MILD",
            student_id="S001",
            device_id="AUD001",
            screening_date=datetime.now(),
            left_ear_thresholds={500: 30, 1000: 35, 2000: 32, 4000: 28, 8000: 30},
            right_ear_thresholds={500: 15, 1000: 10, 2000: 15, 4000: 20, 8000: 15},
            left_ear_status=ScreeningStatus.NORMAL,
            right_ear_status=ScreeningStatus.NORMAL,
            status=ScreeningStatus.NORMAL
        )
        
        context = ValidationContext(
            students=[],
            screening_results=[mild_result],
            device_logs=[],
            certificates=[]
        )
        
        validator = ThresholdValidator()
        issues = validator.validate(context)
        
        mild_issues = [i for i in issues if i.severity == IssueSeverity.LOW]
        self.assertGreater(len(mild_issues), 0)


if __name__ == "__main__":
    unittest.main()
