import csv
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from io import StringIO

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from models import (
    Student, ScreeningResult, DeviceLog, CalibrationCertificate,
    ValidationIssue, IssueType, IssueSeverity, ReviewStatus
)


class CSVExporter:
    def __init__(self):
        self.issue_type_names: Dict[IssueType, str] = {
            IssueType.CALIBRATION_EXPIRED: "校准证书过期",
            IssueType.CALIBRATION_MISSING: "缺少校准证书",
            IssueType.RESULT_MISSING: "缺少筛查结果",
            IssueType.RESULT_DUPLICATE: "重复筛查记录",
            IssueType.CHANNEL_SWAPPED: "通道接反嫌疑",
            IssueType.THRESHOLD_ANOMALY: "阈值异常",
            IssueType.THRESHOLD_EXTREME: "极端阈值",
            IssueType.LOG_TIME_DRIFT: "日志时间漂移",
            IssueType.INVALID_DATA: "无效数据",
            IssueType.MISSING_FIELD: "缺失字段",
            IssueType.OTHER: "其他问题",
        }
        
        self.severity_names: Dict[IssueSeverity, str] = {
            IssueSeverity.CRITICAL: "严重",
            IssueSeverity.HIGH: "高",
            IssueSeverity.MEDIUM: "中",
            IssueSeverity.LOW: "低",
        }
        
        self.review_status_names: Dict[ReviewStatus, str] = {
            ReviewStatus.UNREVIEWED: "未复核",
            ReviewStatus.CONFIRMED: "确认问题",
            ReviewStatus.REJECTED: "排除问题",
            ReviewStatus.RESOLVED: "已解决",
        }
    
    def export_issues(self,
                       issues: List[ValidationIssue],
                       students: Optional[List[Student]] = None) -> str:
        output = StringIO()
        writer = csv.writer(output)
        
        headers = [
            "序号",
            "问题ID",
            "问题类型",
            "严重程度",
            "标题",
            "描述",
            "涉及设备ID",
            "涉及学生ID",
            "涉及学生姓名",
            "涉及筛查ID",
            "涉及日志ID",
            "涉及证书ID",
            "复核状态",
            "复核备注",
            "复核人",
            "复核时间",
            "检测时间",
            "源文件"
        ]
        writer.writerow(headers)
        
        student_map: Dict[str, str] = {}
        if students:
            for s in students:
                student_map[s.student_id] = s.name or ""
        
        for idx, issue in enumerate(issues, 1):
            issue_type_name = self.issue_type_names.get(issue.issue_type, issue.issue_type.value)
            severity_name = self.severity_names.get(issue.severity, issue.severity.value)
            review_status_name = self.review_status_names.get(
                issue.review_status, issue.review_status.value
            )
            
            student_name = ""
            if issue.affected_student_id and issue.affected_student_id in student_map:
                student_name = student_map[issue.affected_student_id]
            
            row = [
                idx,
                issue.issue_id,
                issue_type_name,
                severity_name,
                issue.title,
                issue.description,
                issue.affected_device_id or "",
                issue.affected_student_id or "",
                student_name,
                issue.affected_screening_id or "",
                issue.affected_log_id or "",
                issue.affected_certificate_id or "",
                review_status_name,
                issue.review_notes or "",
                issue.reviewer or "",
                issue.review_timestamp.strftime("%Y-%m-%d %H:%M:%S") if issue.review_timestamp else "",
                issue.detection_timestamp.strftime("%Y-%m-%d %H:%M:%S") if issue.detection_timestamp else "",
                issue.source_file or ""
            ]
            writer.writerow(row)
        
        return output.getvalue()
    
    def export_to_file(self,
                        output_path: Path,
                        issues: List[ValidationIssue],
                        students: Optional[List[Student]] = None) -> bool:
        try:
            csv_content = self.export_issues(issues, students)
            
            with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
                f.write(csv_content)
            
            return True
        except Exception:
            return False
    
    def export_students_summary(self,
                                 students: List[Student],
                                 screening_results: List[ScreeningResult]) -> str:
        output = StringIO()
        writer = csv.writer(output)
        
        headers = [
            "学生ID",
            "姓名",
            "性别",
            "年龄",
            "年级",
            "班级",
            "学校",
            "是否有筛查结果",
            "筛查结果数量",
            "筛查日期"
        ]
        writer.writerow(headers)
        
        result_map: Dict[str, List[ScreeningResult]] = {}
        for r in screening_results:
            if r.student_id not in result_map:
                result_map[r.student_id] = []
            result_map[r.student_id].append(r)
        
        for student in students:
            results = result_map.get(student.student_id, [])
            has_result = len(results) > 0
            
            screening_dates = []
            for r in results:
                if r.screening_date:
                    screening_dates.append(r.screening_date.strftime("%Y-%m-%d"))
            
            row = [
                student.student_id,
                student.name or "",
                student.gender or "",
                student.age if student.age else "",
                student.grade or "",
                student.class_name or "",
                student.school or "",
                "是" if has_result else "否",
                len(results),
                "; ".join(screening_dates)
            ]
            writer.writerow(row)
        
        return output.getvalue()
    
    def export_students_to_file(self,
                                 output_path: Path,
                                 students: List[Student],
                                 screening_results: List[ScreeningResult]) -> bool:
        try:
            csv_content = self.export_students_summary(students, screening_results)
            
            with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
                f.write(csv_content)
            
            return True
        except Exception:
            return False


def export_csv_issues(output_path: Path,
                       issues: List[ValidationIssue],
                       students: Optional[List[Student]] = None) -> bool:
    exporter = CSVExporter()
    return exporter.export_to_file(output_path, issues, students)
