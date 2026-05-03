import sys
from pathlib import Path
import tempfile
import json
import csv
from datetime import datetime

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import unittest
from exporters.markdown_exporter import MarkdownExporter, export_markdown_report
from exporters.csv_exporter import CSVExporter, export_csv_issues
from exporters.json_exporter import JSONExporter, export_json_audit
from models import (
    ValidationIssue, IssueType, IssueSeverity, ReviewStatus,
    Student, ScreeningResult, DeviceLog, CalibrationCertificate
)
from validators import ValidationSummary


class TestExporters(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = Path(tempfile.mkdtemp())
        
        self.test_issues = [
            ValidationIssue(
                issue_id="ISSUE001",
                issue_type=IssueType.CALIBRATION_EXPIRED,
                severity=IssueSeverity.CRITICAL,
                title="校准证书过期",
                description="设备AUD001的校准证书已过期30天",
                affected_device_id="AUD001",
                affected_student_id=None,
                affected_screening_id=None,
                review_status=ReviewStatus.UNREVIEWED
            ),
            ValidationIssue(
                issue_id="ISSUE002",
                issue_type=IssueType.THRESHOLD_ANOMALY,
                severity=IssueSeverity.MEDIUM,
                title="听力阈值异常",
                description="左耳4000Hz阈值为55dB",
                affected_device_id="AUD001",
                affected_student_id="S001",
                affected_screening_id="SR001",
                details={"frequency": "4000", "threshold": 55, "ear": "left"},
                review_status=ReviewStatus.CONFIRMED,
                review_notes="已确认问题，建议复检"
            )
        ]
        
        self.test_students = [
            Student(
                student_id="S001",
                name="张三",
                gender="男",
                age=8,
                grade="二年级",
                class_name="1班",
                school="实验小学"
            ),
            Student(
                student_id="S002",
                name="李四",
                gender="女",
                age=9,
                grade="三年级",
                class_name="2班",
                school="实验小学"
            )
        ]
        
        self.test_results: List[ScreeningResult] = []
        self.test_logs: List[DeviceLog] = []
        self.test_certs: List[CalibrationCertificate] = []
        
        self.test_summary = ValidationSummary(
            total_issues=2,
            critical_issues=1,
            high_issues=0,
            medium_issues=1,
            low_issues=0,
            unreviewed_issues=1,
            confirmed_issues=1,
            rejected_issues=0,
            resolved_issues=0,
            issue_types={
                "calibration_expired": 1,
                "threshold_anomaly": 1
            },
            affected_devices=["AUD001"],
            affected_students=["S001"]
        )
    
    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_markdown_exporter(self):
        output_path = self.temp_dir / "report.md"
        
        exporter = MarkdownExporter()
        success = exporter.export_to_file(
            output_path=output_path,
            students=self.test_students,
            screening_results=self.test_results,
            device_logs=self.test_logs,
            certificates=self.test_certs,
            issues=self.test_issues,
            summary=self.test_summary,
            session_name="实验小学2025年4月15日筛查"
        )
        
        self.assertTrue(success)
        self.assertTrue(output_path.exists())
        
        content = output_path.read_text(encoding='utf-8')
        
        self.assertIn("耳机校准与筛查包核验台", content)
        self.assertIn("实验小学2025年4月15日筛查", content)
        self.assertIn("校准证书过期", content)
        self.assertIn("听力阈值异常", content)
        self.assertIn("张三", content)
        self.assertIn("已确认问题，建议复检", content)
        self.assertIn("问题统计", content)
        self.assertIn("AUD001", content)
    
    def test_markdown_export_function(self):
        output_path = self.temp_dir / "report2.md"
        
        success = export_markdown_report(
            output_path=output_path,
            students=self.test_students,
            screening_results=self.test_results,
            device_logs=self.test_logs,
            certificates=self.test_certs,
            issues=self.test_issues,
            summary=self.test_summary,
            session_name="测试会话"
        )
        
        self.assertTrue(success)
        self.assertTrue(output_path.exists())
        
        content = output_path.read_text(encoding='utf-8')
        self.assertIn("测试会话", content)
    
    def test_csv_exporter(self):
        output_path = self.temp_dir / "issues.csv"
        
        exporter = CSVExporter()
        success = exporter.export_to_file(
            output_path=output_path,
            issues=self.test_issues,
            students=self.test_students
        )
        
        self.assertTrue(success)
        self.assertTrue(output_path.exists())
        
        with open(output_path, 'r', encoding='utf-8-sig', newline='') as f:
            reader = csv.reader(f)
            rows = list(reader)
        
        self.assertGreater(len(rows), 0)
        
        header = rows[0]
        self.assertIn("问题ID", header)
        self.assertIn("问题类型", header)
        self.assertIn("严重程度", header)
        self.assertIn("复核状态", header)
        
        issue_ids = [row[1] for row in rows[1:]] if len(rows) > 1 else []
        self.assertIn("ISSUE001", issue_ids)
        self.assertIn("ISSUE002", issue_ids)
        
        for row in rows[1:]:
            if row[1] == "ISSUE002":
                self.assertIn("张三", row)
                break
    
    def test_csv_export_function(self):
        output_path = self.temp_dir / "issues2.csv"
        
        success = export_csv_issues(
            output_path=output_path,
            issues=self.test_issues,
            students=self.test_students
        )
        
        self.assertTrue(success)
        self.assertTrue(output_path.exists())
    
    def test_csv_students_summary(self):
        exporter = CSVExporter()
        csv_content = exporter.export_students_summary(
            students=self.test_students,
            screening_results=[]
        )
        
        self.assertIn("张三", csv_content)
        self.assertIn("李四", csv_content)
        self.assertIn("是否有筛查结果", csv_content)
    
    def test_json_exporter(self):
        output_path = self.temp_dir / "audit.json"
        
        exporter = JSONExporter()
        success = exporter.export_to_file(
            output_path=output_path,
            students=self.test_students,
            screening_results=self.test_results,
            device_logs=self.test_logs,
            certificates=self.test_certs,
            issues=self.test_issues,
            summary=self.test_summary,
            session_name="实验小学2025年4月15日筛查",
            include_raw_data=True
        )
        
        self.assertTrue(success)
        self.assertTrue(output_path.exists())
        
        with open(output_path, 'r', encoding='utf-8') as f:
            content = json.load(f)
        
        self.assertIn("session_name", content)
        self.assertEqual(content["session_name"], "实验小学2025年4月15日筛查")
        
        self.assertIn("issues", content)
        self.assertEqual(len(content["issues"]), 2)
        
        issue_ids = [i["issue_id"] for i in content["issues"]]
        self.assertIn("ISSUE001", issue_ids)
        self.assertIn("ISSUE002", issue_ids)
        
        self.assertIn("data", content)
        self.assertIn("students", content["data"])
        self.assertEqual(len(content["data"]["students"]), 2)
    
    def test_json_export_function(self):
        output_path = self.temp_dir / "audit2.json"
        
        success = export_json_audit(
            output_path=output_path,
            students=self.test_students,
            screening_results=self.test_results,
            device_logs=self.test_logs,
            certificates=self.test_certs,
            issues=self.test_issues,
            summary=self.test_summary,
            session_name="测试会话",
            include_raw_data=True
        )
        
        self.assertTrue(success)
        self.assertTrue(output_path.exists())
    
    def test_json_exporter_without_raw_data(self):
        output_path = self.temp_dir / "audit_no_raw.json"
        
        exporter = JSONExporter()
        success = exporter.export_to_file(
            output_path=output_path,
            students=self.test_students,
            screening_results=self.test_results,
            device_logs=self.test_logs,
            certificates=self.test_certs,
            issues=self.test_issues,
            summary=self.test_summary,
            session_name="无原始数据测试",
            include_raw_data=False
        )
        
        self.assertTrue(success)
        
        with open(output_path, 'r', encoding='utf-8') as f:
            content = json.load(f)
        
        self.assertNotIn("data", content)
        self.assertIn("session_name", content)
        self.assertIn("issues", content)
    
    def test_json_issues_only(self):
        output_path = self.temp_dir / "issues_only.json"
        
        exporter = JSONExporter()
        success = exporter.export_issues_only(
            issues=self.test_issues,
            output_path=output_path
        )
        
        self.assertTrue(success)
        
        with open(output_path, 'r', encoding='utf-8') as f:
            content = json.load(f)
        
        self.assertIn("issues", content)
        self.assertEqual(len(content["issues"]), 2)
        self.assertIn("total_issues", content)
        self.assertEqual(content["total_issues"], 2)
    
    def test_empty_issues(self):
        output_path = self.temp_dir / "empty_report.md"
        
        exporter = MarkdownExporter()
        success = exporter.export_to_file(
            output_path=output_path,
            students=[],
            screening_results=[],
            device_logs=[],
            certificates=[],
            issues=[],
            summary=None,
            session_name="空测试"
        )
        
        self.assertTrue(success)
        
        content = output_path.read_text(encoding='utf-8')
        self.assertIn("未发现任何校验问题", content)


if __name__ == "__main__":
    unittest.main()
