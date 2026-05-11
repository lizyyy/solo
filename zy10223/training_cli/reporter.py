from datetime import datetime
from typing import Dict, List, Optional
from io import StringIO
from tabulate import tabulate
from .data_manager import DataManager
from .certification_engine import CertificationEngine
from .models import (
    Student,
    Assignment,
    Submission,
    StudentHistory,
    CertificationStatus,
    Anomaly,
    SubmissionStatus,
)


class Reporter:
    def __init__(self, data_manager: DataManager, certification_engine: CertificationEngine):
        self.dm = data_manager
        self.engine = certification_engine
    
    def _format_datetime(self, dt: Optional[datetime]) -> str:
        if dt is None:
            return "-"
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    
    def _status_to_text(self, status: SubmissionStatus) -> str:
        mapping = {
            SubmissionStatus.PENDING: "待提交",
            SubmissionStatus.SUBMITTED: "已提交",
            SubmissionStatus.RESUBMITTED: "已重交",
            SubmissionStatus.GRADED: "已批改",
            SubmissionStatus.LATE: "迟交",
            SubmissionStatus.LATE_GRADED: "迟交已批改",
        }
        return mapping.get(status, str(status))
    
    def _cert_status_to_text(self, status: CertificationStatus) -> str:
        mapping = {
            CertificationStatus.QUALIFIED: "✓ 已达标",
            CertificationStatus.AT_RISK: "⚠ 有风险",
            CertificationStatus.DISQUALIFIED: "✗ 未达标",
        }
        return mapping.get(status, str(status))
    
    def format_anomalies(self, anomalies: List[Anomaly]) -> str:
        if not anomalies:
            return "无异常"
        
        output = StringIO()
        output.write("\n" + "=" * 80 + "\n")
        output.write("异常报告\n")
        output.write("=" * 80 + "\n\n")
        
        by_severity: Dict[str, List[Anomaly]] = {"error": [], "warning": [], "info": []}
        for a in anomalies:
            by_severity.setdefault(a.severity, []).append(a)
        
        severity_labels = {"error": "错误", "warning": "警告", "info": "信息"}
        
        for sev in ["error", "warning", "info"]:
            if by_severity.get(sev):
                output.write(f"【{severity_labels.get(sev, sev)}】共 {len(by_severity[sev])} 条\n")
                output.write("-" * 80 + "\n")
                
                for a in by_severity[sev]:
                    output.write(f"\n  {a.message}\n")
                    if a.details:
                        output.write("    详情：\n")
                        for k, v in a.details.items():
                            output.write(f"      - {k}: {v}\n")
                output.write("\n")
        
        return output.getvalue()
    
    def format_reminder_list(self, reminders: Dict[str, List[Dict]]) -> str:
        output = StringIO()
        output.write("\n" + "=" * 80 + "\n")
        output.write("分组催交名单\n")
        output.write("=" * 80 + "\n\n")
        
        if not reminders:
            output.write("没有需要催交的作业。\n")
            return output.getvalue()
        
        for assignment_id, group_data_list in reminders.items():
            assignment = None
            for gd in group_data_list:
                if gd["assignment"]:
                    assignment = gd["assignment"]
                    break
            
            if assignment:
                output.write(f"【作业】{assignment.name} (第{assignment.round_num}轮)\n")
                output.write(f"截止时间：{self._format_datetime(assignment.deadline)}\n")
                output.write("-" * 80 + "\n\n")
            
            for group_data in group_data_list:
                students = group_data["students"]
                output.write(f"【分组】{group_data['group']} ({len(students)} 人\n")
                
                table_data = []
                for s in students:
                    student = s["student"]
                    detail = s["details"]
                    
                    extra = ""
                    if s["type"] == "未提交":
                        extra = f"截止: {self._format_datetime(assignment.deadline)}"
                    elif s["type"] == "已提交待批改":
                        extra = f"提交时间: {self._format_datetime(datetime.fromisoformat(detail['submitted_at']))}"
                        if detail.get("is_late"):
                            extra += " [迟交]"
                    
                    table_data.append([
                        student.id,
                        student.name,
                        s["type"],
                        extra,
                    ])
                
                output.write(tabulate(
                    table_data,
                    headers=["学员ID", "姓名", "状态", "备注"],
                    tablefmt="grid",
                ))
                output.write("\n\n")
        
        return output.getvalue()
    
    def format_certification_risk(self, results: List) -> str:
        output = StringIO()
        output.write("\n" + "=" * 80 + "\n")
        output.write("证书风险名单\n")
        output.write("=" * 80 + "\n\n")
        
        at_risk = [r for r in results if r.status != CertificationStatus.QUALIFIED]
        at_risk.sort(key=lambda x: x.student.group)
        
        if not at_risk:
            output.write("所有学员均已达标。\n")
            return output.getvalue()
        
        output.write(f"共有 {len(at_risk)} 名学员存在证书风险\n\n")
        
        table_data = []
        for r in at_risk:
            status_text = self._cert_status_to_text(r.status)
            table_data.append([
                r.student.group,
                r.student.id,
                r.student.name,
                status_text,
                r.submitted_count,
                r.on_time_count,
                r.late_count,
                f"{r.avg_score:.1f}" if r.avg_score else "-",
                "; ".join(r.reasons[:2]),
            ])
        
        output.write(tabulate(
            table_data,
            headers=["分组", "学员ID", "姓名", "证书状态", "已提交", "准时", "迟交", "平均分", "风险原因"],
            tablefmt="grid",
        ))
        output.write("\n")
        
        return output.getvalue()
    
    def format_student_history(self, student: Student, submissions: List[Submission], cert_result=None) -> str:
        output = StringIO()
        output.write("\n" + "=" * 80 + "\n")
        output.write(f"学员作业历史\n")
        output.write("=" * 80 + "\n\n")
        
        output.write(f"学员ID: {student.id}\n")
        output.write(f"姓名: {student.name}\n")
        output.write(f"分组: {student.group}\n")
        if student.emails:
            output.write(f"邮箱: {', '.join(student.emails)}\n")
        if student.aliases:
            output.write(f"别名: {', '.join(student.aliases)}\n")
        
        if cert_result:
            output.write(f"证书状态: {self._cert_status_to_text(cert_result.status)}\n")
            output.write(f"统计: 已提交 {cert_result.submitted_count}/{cert_result.details['eligible_assignments']}, "
                        f"准时 {cert_result.on_time_count}, 迟交 {cert_result.late_count}, "
                        f"未批改 {cert_result.ungraded_count}\n")
            if cert_result.avg_score:
                output.write(f"平均分: {cert_result.avg_score:.1f}\n")
            if cert_result.reasons:
                output.write("问题:\n")
                for r in cert_result.reasons:
                    output.write(f"  - {r}\n")
        
        output.write("\n")
        output.write("-" * 80 + "\n")
        output.write("作业详情\n")
        output.write("-" * 80 + "\n\n")
        
        submissions_sorted = sorted(submissions, key=lambda s: (
            self.dm.assignments.get(s.assignment_id).round_num
            if self.dm.assignments.get(s.assignment_id)
            else 0,
            s.submitted_at,
        ))
        
        if not submissions_sorted:
            output.write("暂无提交记录。\n")
            return output.getvalue()
        
        table_data = []
        for s in submissions_sorted:
            assignment = self.dm.assignments.get(s.assignment_id)
            if assignment:
                assignment_name = f"{assignment.name} (第{assignment.round_num}轮)"
            else:
                assignment_name = s.assignment_id
            
            is_late = s.status in [SubmissionStatus.LATE, SubmissionStatus.LATE_GRADED]
            status_text = self._status_to_text(s.status)
            if s.is_resubmit:
                status_text += " [重交]"
            
            extra = []
            if s.resubmit_reason:
                extra.append(f"补交说明: {s.resubmit_reason}")
            if s.grader_notes:
                extra.append(f"批改备注: {s.grader_notes}")
            
            table_data.append([
                assignment_name,
                self._format_datetime(s.submitted_at),
                s.score if s.score else "-",
                status_text,
                "; ".join(extra),
            ])
        
        output.write(tabulate(
            table_data,
            headers=["作业", "提交时间", "分数", "状态", "备注"],
            tablefmt="grid",
        ))
        
        return output.getvalue()
    
    def format_all_students_history(self) -> str:
        output = StringIO()
        output.write("\n" + "=" * 80 + "\n")
        output.write("全体学员作业历史汇总\n")
        output.write("=" * 80 + "\n\n")
        
        all_results = self.engine.evaluate_all()
        students = sorted(self.dm.students.values(), key=lambda s: (s.group, s.name))
        
        for student in students:
            submissions = self.dm.get_student_submissions(student.id)
            cert_result = next(
                (r for r in all_results if r.student.id == student.id),
                None
            )
            output.write(self.format_student_history(student, submissions, cert_result))
            output.write("\n" + "~" * 80 + "\n\n")
        
        return output.getvalue()
    
    def format_full_report(self, assignment_id: Optional[str] = None) -> str:
        output = StringIO()
        output.write("\n" + "#" * 80 + "\n")
        output.write("# 训练营作业催交通知报告\n")
        output.write(f"# 生成时间: {self._format_datetime(datetime.now())}\n")
        output.write("#" * 80 + "\n")
        
        reminders = self.engine.get_reminder_list(assignment_id)
        output.write(self.format_reminder_list(reminders))
        
        anomalies = self.dm.get_anomalies()
        output.write(self.format_anomalies(anomalies))
        
        results = self.engine.evaluate_all()
        output.write(self.format_certification_risk(results))
        
        return output.getvalue()
