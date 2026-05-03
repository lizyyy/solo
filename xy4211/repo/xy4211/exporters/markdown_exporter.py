from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from collections import defaultdict

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from models import (
    Student, ScreeningResult, DeviceLog, CalibrationCertificate,
    ValidationIssue, IssueType, IssueSeverity, ReviewStatus
)
from validators import ValidationSummary
from config import APP_NAME, APP_VERSION


class MarkdownExporter:
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
    
    def generate_report(self,
                         students: List[Student],
                         screening_results: List[ScreeningResult],
                         device_logs: List[DeviceLog],
                         certificates: List[CalibrationCertificate],
                         issues: List[ValidationIssue],
                         summary: Optional[ValidationSummary] = None,
                         session_name: str = "默认会话") -> str:
        lines = []
        
        lines.append(f"# {APP_NAME} - 交付报告")
        lines.append("")
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"> 会话名称: {session_name}")
        lines.append(f"> 软件版本: {APP_VERSION}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 一、数据概览")
        lines.append("")
        lines.append("| 数据类型 | 数量 |")
        lines.append("|---------|------|")
        lines.append(f"| 学生名单 | {len(students)} 人 |")
        lines.append(f"| 筛查结果 | {len(screening_results)} 条 |")
        lines.append(f"| 设备日志 | {len(device_logs)} 条 |")
        lines.append(f"| 校准证书 | {len(certificates)} 份 |")
        lines.append("")
        
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
        
        lines.append(f"**涉及设备**: {', '.join(sorted(device_ids)) if device_ids else '无'}")
        lines.append("")
        
        lines.append("## 二、校验问题汇总")
        lines.append("")
        
        if issues:
            if summary:
                lines.append("### 问题统计")
                lines.append("")
                lines.append("| 严重程度 | 数量 |")
                lines.append("|---------|------|")
                lines.append(f"| 🔴 严重 | {summary.critical_issues} |")
                lines.append(f"| 🟠 高 | {summary.high_issues} |")
                lines.append(f"| 🟡 中 | {summary.medium_issues} |")
                lines.append(f"| 🟢 低 | {summary.low_issues} |")
                lines.append(f"| **合计** | **{summary.total_issues}** |")
                lines.append("")
                
                lines.append("### 复核状态")
                lines.append("")
                lines.append("| 状态 | 数量 |")
                lines.append("|------|------|")
                lines.append(f"| 未复核 | {summary.unreviewed_issues} |")
                lines.append(f"| 确认问题 | {summary.confirmed_issues} |")
                lines.append(f"| 排除问题 | {summary.rejected_issues} |")
                lines.append(f"| 已解决 | {summary.resolved_issues} |")
                lines.append("")
            
            lines.append("### 问题详情")
            lines.append("")
            
            severity_order = [
                (IssueSeverity.CRITICAL, "🔴 严重问题"),
                (IssueSeverity.HIGH, "🟠 高优先级问题"),
                (IssueSeverity.MEDIUM, "🟡 中优先级问题"),
                (IssueSeverity.LOW, "🟢 低优先级问题"),
            ]
            
            for severity, section_title in severity_order:
                severity_issues = [i for i in issues if i.severity == severity]
                if not severity_issues:
                    continue
                
                lines.append(f"#### {section_title}")
                lines.append("")
                
                for idx, issue in enumerate(severity_issues, 1):
                    issue_type_name = self.issue_type_names.get(issue.issue_type, issue.issue_type.value)
                    review_status_name = self.review_status_names.get(
                        issue.review_status, issue.review_status.value
                    )
                    
                    lines.append(f"**{idx}. {issue.title}**")
                    lines.append("")
                    lines.append(f"- 问题类型: {issue_type_name}")
                    lines.append(f"- 复核状态: {review_status_name}")
                    
                    if issue.affected_device_id:
                        lines.append(f"- 涉及设备: {issue.affected_device_id}")
                    if issue.affected_student_id:
                        student_name = ""
                        for s in students:
                            if s.student_id == issue.affected_student_id:
                                student_name = s.name or ""
                                break
                        if student_name:
                            lines.append(f"- 涉及学生: {student_name} ({issue.affected_student_id})")
                        else:
                            lines.append(f"- 涉及学生ID: {issue.affected_student_id}")
                    
                    lines.append("")
                    lines.append(f"**描述**: {issue.description}")
                    lines.append("")
                    
                    if issue.review_notes:
                        lines.append(f"**复核备注**: {issue.review_notes}")
                        lines.append("")
                    
                    if issue.reviewer:
                        lines.append(f"**复核人**: {issue.reviewer}")
                        lines.append("")
                    
                    lines.append("---")
                    lines.append("")
        else:
            lines.append("✅ 未发现任何校验问题。")
            lines.append("")
        
        lines.append("## 三、设备校准状态")
        lines.append("")
        
        if certificates:
            lines.append("| 设备ID | 校准日期 | 有效期至 | 状态 | 剩余天数 |")
            lines.append("|--------|---------|---------|------|---------|")
            
            for cert in certificates:
                status = cert.get_status()
                status_text = "✅ 有效" if status.value == "valid" else "❌ 已过期" if status.value == "expired" else "❓ 未知"
                days_remaining = cert.get_days_remaining()
                
                lines.append(
                    f"| {cert.device_id} | "
                    f"{cert.calibration_date.strftime('%Y-%m-%d') if cert.calibration_date else '-'} | "
                    f"{cert.valid_until.strftime('%Y-%m-%d') if cert.valid_until else '-'} | "
                    f"{status_text} | "
                    f"{days_remaining if days_remaining is not None else '-'} |"
                )
        else:
            lines.append("⚠️ 未导入任何校准证书。")
        lines.append("")
        
        lines.append("## 四、筛查结果统计")
        lines.append("")
        
        if screening_results:
            from models import ScreeningStatus
            
            status_counts = defaultdict(int)
            for r in screening_results:
                status_counts[r.status.value] += 1
            
            lines.append("| 结果状态 | 数量 |")
            lines.append("|---------|------|")
            for status, count in status_counts.items():
                status_name = {
                    "normal": "正常/通过",
                    "refer": "转诊/未通过",
                    "invalid": "无效",
                    "incomplete": "未完成"
                }.get(status, status)
                lines.append(f"| {status_name} | {count} |")
            lines.append("")
            
            results_with_student = 0
            for r in screening_results:
                for s in students:
                    if s.student_id == r.student_id:
                        results_with_student += 1
                        break
            
            lines.append(f"- 有匹配学生名单的结果: {results_with_student} 条")
            if students:
                missing_count = len(students) - results_with_student
                if missing_count > 0:
                    lines.append(f"- ⚠️ 缺少结果的学生: {missing_count} 人")
        else:
            lines.append("⚠️ 未导入任何筛查结果。")
        lines.append("")
        
        lines.append("## 五、导入文件清单")
        lines.append("")
        lines.append("此报告基于以下导入的数据文件生成：")
        lines.append("")
        
        imported_files: List[str] = []
        seen = set()
        
        for s in students:
            if s.source_file and s.source_file not in seen:
                imported_files.append(f"- 📄 学生名单: {Path(s.source_file).name}")
                seen.add(s.source_file)
        
        for r in screening_results:
            if r.source_file and r.source_file not in seen:
                imported_files.append(f"- 📊 筛查结果: {Path(r.source_file).name}")
                seen.add(r.source_file)
        
        for l in device_logs:
            if l.source_file and l.source_file not in seen:
                imported_files.append(f"- 📋 设备日志: {Path(l.source_file).name}")
                seen.add(l.source_file)
        
        for c in certificates:
            if c.source_file and c.source_file not in seen:
                imported_files.append(f"- 🔧 校准证书: {Path(c.source_file).name}")
                seen.add(c.source_file)
        
        if imported_files:
            lines.extend(imported_files)
        else:
            lines.append("- 无文件来源信息")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append(f"*本报告由 {APP_NAME} v{APP_VERSION} 自动生成*")
        lines.append("")
        
        return "\n".join(lines)
    
    def export_to_file(self,
                        output_path: Path,
                        students: List[Student],
                        screening_results: List[ScreeningResult],
                        device_logs: List[DeviceLog],
                        certificates: List[CalibrationCertificate],
                        issues: List[ValidationIssue],
                        summary: Optional[ValidationSummary] = None,
                        session_name: str = "默认会话") -> bool:
        try:
            report = self.generate_report(
                students=students,
                screening_results=screening_results,
                device_logs=device_logs,
                certificates=certificates,
                issues=issues,
                summary=summary,
                session_name=session_name
            )
            
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(report)
            
            return True
        except Exception:
            return False


def export_markdown_report(output_path: Path,
                             students: List[Student],
                             screening_results: List[ScreeningResult],
                             device_logs: List[DeviceLog],
                             certificates: List[CalibrationCertificate],
                             issues: List[ValidationIssue],
                             summary: Optional[ValidationSummary] = None,
                             session_name: str = "默认会话") -> bool:
    exporter = MarkdownExporter()
    return exporter.export_to_file(
        output_path=output_path,
        students=students,
        screening_results=screening_results,
        device_logs=device_logs,
        certificates=certificates,
        issues=issues,
        summary=summary,
        session_name=session_name
    )
