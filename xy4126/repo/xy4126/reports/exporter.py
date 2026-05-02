import csv
import json
import os
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Dict, List, Any, Optional
from uuid import uuid4

from models import (
    WorkSession,
    PackageEvidence,
    ValidationIssue,
    ReviewNote,
    IssueSeverity,
    IssueType,
    ReviewStatus,
    ServiceNote,
    ClaimApplication,
    FileEntry,
)
from storage import SessionSerializer


@dataclass
class ExportResult:
    success: bool = False
    output_path: str = ""
    file_count: int = 0
    errors: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class MarkdownExporter:
    def __init__(self):
        pass
    
    def _severity_to_emoji(self, severity: IssueSeverity) -> str:
        if severity == IssueSeverity.CRITICAL:
            return "🔴"
        elif severity == IssueSeverity.WARNING:
            return "🟡"
        else:
            return "ℹ️"
    
    def _issue_type_to_label(self, issue_type: IssueType) -> str:
        labels = {
            IssueType.DUPLICATE_WAYBILL: "重复运单",
            IssueType.PHOTO_MISSING: "照片缺失",
            IssueType.TIMESTAMP_MISSING: "时间戳缺失",
            IssueType.TIME_OUT_OF_ORDER: "时间倒序",
            IssueType.NOTE_CONFLICT: "备注冲突",
            IssueType.CLAIM_AMOUNT_ABNORMAL: "赔付金额异常",
            IssueType.CLAIM_DOCUMENT_MISSING: "赔付材料缺失",
        }
        return labels.get(issue_type, "未知问题")
    
    def _review_status_to_label(self, status: ReviewStatus) -> str:
        labels = {
            ReviewStatus.PENDING: "待处理",
            ReviewStatus.REVIEWED: "已复核",
            ReviewStatus.RESOLVED: "已解决",
            ReviewStatus.DISMISSED: "已忽略",
        }
        return labels.get(status, "未知")
    
    def _format_datetime(self, dt: Optional[datetime]) -> str:
        if not dt:
            return "-"
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    
    def _format_decimal(self, d: Decimal) -> str:
        return f"¥{d:,.2f}"
    
    def export_package_for_claim(
        self,
        package: PackageEvidence,
        include_issues: bool = True,
        include_notes: bool = True
    ) -> str:
        lines = []
        
        lines.append(f"# 运单申诉包：{package.waybill_number}")
        lines.append("")
        lines.append(f"**生成时间**：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 一、基本信息")
        lines.append("")
        
        total_photos = len(package.all_photos)
        has_claim = len(package.claim_applications) > 0
        has_notes = len(package.service_notes) > 0
        
        lines.append(f"- **运单号**：{package.waybill_number}")
        lines.append(f"- **照片总数**：{total_photos} 张")
        lines.append(f"  - 面单照片：{len(package.waybill_photos)} 张")
        lines.append(f"  - 包裹照片：{len(package.package_photos)} 张")
        lines.append(f"  - 破损照片：{len(package.damage_photos)} 张")
        lines.append(f"  - 其他照片：{len(package.photos)} 张")
        lines.append(f"- **客服备注**：{len(package.service_notes)} 条")
        lines.append(f"- **赔付申请**：{len(package.claim_applications)} 条")
        
        if package.earliest_timestamp:
            lines.append(f"- **最早照片时间**：{self._format_datetime(package.earliest_timestamp)}")
        if package.latest_timestamp:
            lines.append(f"- **最晚照片时间**：{self._format_datetime(package.latest_timestamp)}")
        
        lines.append("")
        lines.append("---")
        lines.append("")
        
        if package.claim_applications:
            lines.append("## 二、赔付申请信息")
            lines.append("")
            
            for i, claim in enumerate(package.claim_applications, 1):
                lines.append(f"### 申请 #{i}")
                lines.append("")
                lines.append(f"- **申请金额**：{self._format_decimal(claim.claim_amount)}")
                if claim.expected_amount > Decimal("0"):
                    lines.append(f"- **预期金额**：{self._format_decimal(claim.expected_amount)}")
                if claim.approved_amount is not None:
                    lines.append(f"- **核定金额**：{self._format_decimal(claim.approved_amount)}")
                if claim.claim_reason:
                    lines.append(f"- **赔付原因**：{claim.claim_reason}")
                if claim.applicant:
                    lines.append(f"- **申请人**：{claim.applicant}")
                if claim.apply_time:
                    lines.append(f"- **申请时间**：{self._format_datetime(claim.apply_time)}")
                if claim.status:
                    status_labels = {
                        "pending": "待处理",
                        "approved": "已通过",
                        "rejected": "已拒绝",
                        "completed": "已完成"
                    }
                    lines.append(f"- **状态**：{status_labels.get(claim.status, claim.status)}")
                lines.append("")
        
        if package.service_notes and include_notes:
            lines.append("## 三、客服备注记录")
            lines.append("")
            
            for i, note in enumerate(package.service_notes, 1):
                lines.append(f"### 备注 #{i}")
                lines.append("")
                lines.append(f"> {note.content}")
                lines.append("")
                if note.operator:
                    lines.append(f"- **操作人**：{note.operator}")
                if note.timestamp:
                    lines.append(f"- **时间**：{self._format_datetime(note.timestamp)}")
                if note.source_file:
                    lines.append(f"- **来源文件**：{Path(note.source_file).name}")
                lines.append("")
        
        if package.all_photos:
            lines.append("## 四、证据照片清单")
            lines.append("")
            
            all_photos = package.waybill_photos + package.package_photos + package.damage_photos + package.photos
            
            for i, photo in enumerate(all_photos, 1):
                category_label = ""
                if photo in package.waybill_photos:
                    category_label = "面单照片"
                elif photo in package.package_photos:
                    category_label = "包裹照片"
                elif photo in package.damage_photos:
                    category_label = "破损照片"
                else:
                    category_label = "其他照片"
                
                lines.append(f"### 照片 #{i} - {category_label}")
                lines.append("")
                lines.append(f"- **文件名**：{photo.filename}")
                lines.append(f"- **文件路径**：{photo.file_path}")
                if photo.best_timestamp:
                    lines.append(f"- **拍摄时间**：{self._format_datetime(photo.best_timestamp)}")
                lines.append(f"- **文件大小**：{photo.file_size} 字节")
                lines.append("")
        
        if package.issues and include_issues:
            lines.append("## 五、校验问题汇总")
            lines.append("")
            
            critical_issues = [i for i in package.issues if i.severity == IssueSeverity.CRITICAL]
            warning_issues = [i for i in package.issues if i.severity == IssueSeverity.WARNING]
            info_issues = [i for i in package.issues if i.severity == IssueSeverity.INFO]
            
            lines.append(f"- **严重问题**：{len(critical_issues)} 个")
            lines.append(f"- **警告问题**：{len(warning_issues)} 个")
            lines.append(f"- **提示信息**：{len(info_issues)} 个")
            lines.append("")
            
            for issue in package.issues:
                emoji = self._severity_to_emoji(issue.severity)
                issue_label = self._issue_type_to_label(issue.issue_type)
                status_label = self._review_status_to_label(issue.review_status)
                
                lines.append(f"### {emoji} {issue_label}")
                lines.append("")
                lines.append(f"> {issue.message}")
                lines.append("")
                lines.append(f"- **严重程度**：{issue.severity.value}")
                lines.append(f"- **复核状态**：{status_label}")
                
                if issue.affected_files:
                    lines.append(f"- **影响文件**：{', '.join(issue.affected_files)}")
                if issue.affected_notes:
                    lines.append(f"- **影响备注**：{', '.join(issue.affected_notes)}")
                
                if issue.review_notes:
                    lines.append("")
                    lines.append("#### 复核记录")
                    lines.append("")
                    for rn in issue.review_notes:
                        lines.append(f"- **{rn.author}** ({self._format_datetime(rn.timestamp)})：{rn.content}")
                        if rn.status_change:
                            lines.append(f"  - 状态变更：{self._review_status_to_label(rn.status_change)}")
                
                lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此申诉包由「异常包裹证据包归档员」自动生成*")
        
        return "\n".join(lines)
    
    def export_session_summary(
        self,
        session: WorkSession,
        title: str = None
    ) -> str:
        lines = []
        
        lines.append(f"# {title or '工作会话汇总报告'}")
        lines.append("")
        lines.append(f"**会话ID**：{session.session_id}")
        lines.append(f"**会话名称**：{session.name}")
        if session.description:
            lines.append(f"**描述**：{session.description}")
        lines.append(f"**创建时间**：{self._format_datetime(session.created_at)}")
        lines.append(f"**最后更新**：{self._format_datetime(session.updated_at)}")
        if session.scanned_directory:
            lines.append(f"**扫描目录**：{session.scanned_directory}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 一、统计概览")
        lines.append("")
        lines.append(f"- **总包裹数**：{len(session.packages)}")
        lines.append(f"- **总文件数**：{len(session.files)}")
        lines.append(f"- **校验问题数**：{len(session.issues)}")
        
        critical_count = sum(1 for i in session.issues.values() if i.severity == IssueSeverity.CRITICAL)
        warning_count = sum(1 for i in session.issues.values() if i.severity == IssueSeverity.WARNING)
        info_count = sum(1 for i in session.issues.values() if i.severity == IssueSeverity.INFO)
        
        lines.append(f"  - 🔴 严重问题：{critical_count}")
        lines.append(f"  - 🟡 警告问题：{warning_count}")
        lines.append(f"  - ℹ️ 提示信息：{info_count}")
        
        packages_with_claims = sum(1 for p in session.packages.values() if len(p.claim_applications) > 0)
        lines.append(f"- **有赔付申请的包裹**：{packages_with_claims}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        if session.packages:
            lines.append("## 二、包裹清单")
            lines.append("")
            lines.append("| 运单号 | 照片数 | 备注数 | 赔付申请 | 问题数 | 严重问题 |")
            lines.append("|--------|--------|--------|----------|--------|----------|")
            
            for waybill, package in session.packages.items():
                photo_count = len(package.all_photos)
                note_count = len(package.service_notes)
                claim_count = len(package.claim_applications)
                issue_count = len(package.issues)
                critical_count = sum(1 for i in package.issues if i.severity == IssueSeverity.CRITICAL)
                
                critical_mark = "🔴" if critical_count > 0 else ""
                lines.append(
                    f"| {waybill} | {photo_count} | {note_count} | {claim_count} | "
                    f"{issue_count} | {critical_count} {critical_mark} |"
                )
            
            lines.append("")
            lines.append("---")
            lines.append("")
        
        if session.issues:
            lines.append("## 三、问题详情")
            lines.append("")
            
            sorted_issues = sorted(
                session.issues.values(),
                key=lambda x: (
                    0 if x.severity == IssueSeverity.CRITICAL else
                    1 if x.severity == IssueSeverity.WARNING else 2,
                    x.waybill_number
                )
            )
            
            for issue in sorted_issues:
                emoji = self._severity_to_emoji(issue.severity)
                issue_label = self._issue_type_to_label(issue.issue_type)
                status_label = self._review_status_to_label(issue.review_status)
                
                lines.append(f"### {emoji} [{issue.waybill_number}] {issue_label}")
                lines.append("")
                lines.append(f"> {issue.message}")
                lines.append("")
                lines.append(f"- **状态**：{status_label}")
                lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append(f"*报告生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
        lines.append("*由「异常包裹证据包归档员」自动生成*")
        
        return "\n".join(lines)


class CSVExporter:
    def __init__(self):
        pass
    
    def export_issues_to_csv(
        self,
        issues: List[ValidationIssue],
        output_path: str
    ) -> ExportResult:
        result = ExportResult()
        
        try:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                
                writer.writerow([
                    '问题ID', '运单号', '问题类型', '严重程度', '问题描述',
                    '影响文件', '影响备注', '复核状态', '问题详情'
                ])
                
                issue_type_labels = {
                    IssueType.DUPLICATE_WAYBILL: "重复运单",
                    IssueType.PHOTO_MISSING: "照片缺失",
                    IssueType.TIMESTAMP_MISSING: "时间戳缺失",
                    IssueType.TIME_OUT_OF_ORDER: "时间倒序",
                    IssueType.NOTE_CONFLICT: "备注冲突",
                    IssueType.CLAIM_AMOUNT_ABNORMAL: "赔付金额异常",
                    IssueType.CLAIM_DOCUMENT_MISSING: "赔付材料缺失",
                }
                
                severity_labels = {
                    IssueSeverity.CRITICAL: "严重",
                    IssueSeverity.WARNING: "警告",
                    IssueSeverity.INFO: "提示",
                }
                
                status_labels = {
                    ReviewStatus.PENDING: "待处理",
                    ReviewStatus.REVIEWED: "已复核",
                    ReviewStatus.RESOLVED: "已解决",
                    ReviewStatus.DISMISSED: "已忽略",
                }
                
                for issue in issues:
                    writer.writerow([
                        issue.issue_id,
                        issue.waybill_number,
                        issue_type_labels.get(issue.issue_type, str(issue.issue_type)),
                        severity_labels.get(issue.severity, str(issue.severity)),
                        issue.message,
                        '; '.join(issue.affected_files) if issue.affected_files else '',
                        '; '.join(issue.affected_notes) if issue.affected_notes else '',
                        status_labels.get(issue.review_status, str(issue.review_status)),
                        json.dumps(issue.metadata, ensure_ascii=False) if issue.metadata else ''
                    ])
            
            result.success = True
            result.output_path = output_path
            result.file_count = 1
            result.metadata = {
                "issue_count": len(issues),
                "exported_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            result.success = False
            result.errors.append(f"导出CSV失败: {str(e)}")
        
        return result
    
    def export_packages_to_csv(
        self,
        packages: Dict[str, PackageEvidence],
        output_path: str
    ) -> ExportResult:
        result = ExportResult()
        
        try:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                
                writer.writerow([
                    '运单号', '照片总数', '面单照片', '包裹照片', '破损照片',
                    '备注数量', '赔付申请数', '申请金额', '问题数', '严重问题数',
                    '最早照片时间', '最晚照片时间'
                ])
                
                for waybill, package in packages.items():
                    total_claim_amount = sum(
                        (c.claim_amount for c in package.claim_applications),
                        Decimal('0')
                    )
                    critical_count = sum(
                        1 for i in package.issues if i.severity == IssueSeverity.CRITICAL
                    )
                    
                    writer.writerow([
                        waybill,
                        len(package.all_photos),
                        len(package.waybill_photos),
                        len(package.package_photos),
                        len(package.damage_photos),
                        len(package.service_notes),
                        len(package.claim_applications),
                        float(total_claim_amount) if total_claim_amount else 0,
                        len(package.issues),
                        critical_count,
                        package.earliest_timestamp.strftime('%Y-%m-%d %H:%M:%S') if package.earliest_timestamp else '',
                        package.latest_timestamp.strftime('%Y-%m-%d %H:%M:%S') if package.latest_timestamp else ''
                    ])
            
            result.success = True
            result.output_path = output_path
            result.file_count = 1
            result.metadata = {
                "package_count": len(packages),
                "exported_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            result.success = False
            result.errors.append(f"导出CSV失败: {str(e)}")
        
        return result


class JSONExporter:
    def __init__(self):
        pass
    
    def export_audit_trail(
        self,
        session: WorkSession,
        output_path: str,
        include_files: bool = True,
        include_review_notes: bool = True
    ) -> ExportResult:
        result = ExportResult()
        
        try:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            audit_data = {
                "audit_id": f"audit_{uuid4().hex[:12]}",
                "generated_at": datetime.now().isoformat(),
                "session_info": {
                    "session_id": session.session_id,
                    "name": session.name,
                    "description": session.description,
                    "created_at": SessionSerializer.datetime_to_str(session.created_at),
                    "updated_at": SessionSerializer.datetime_to_str(session.updated_at),
                    "scanned_directory": session.scanned_directory,
                },
                "summary": {
                    "total_packages": len(session.packages),
                    "total_files": len(session.files),
                    "total_issues": len(session.issues),
                    "critical_issues": sum(
                        1 for i in session.issues.values() 
                        if i.severity == IssueSeverity.CRITICAL
                    ),
                    "packages_with_claims": sum(
                        1 for p in session.packages.values() 
                        if len(p.claim_applications) > 0
                    ),
                },
                "packages": [],
                "issues": [],
            }
            
            for waybill, package in session.packages.items():
                package_data = {
                    "waybill_number": package.waybill_number,
                    "photo_summary": {
                        "total": len(package.all_photos),
                        "waybill_photos": len(package.waybill_photos),
                        "package_photos": len(package.package_photos),
                        "damage_photos": len(package.damage_photos),
                    },
                    "service_notes_count": len(package.service_notes),
                    "claim_applications_count": len(package.claim_applications),
                    "issue_count": len(package.issues),
                    "earliest_timestamp": SessionSerializer.datetime_to_str(package.earliest_timestamp),
                    "latest_timestamp": SessionSerializer.datetime_to_str(package.latest_timestamp),
                }
                
                if include_files:
                    package_data["photos"] = [
                        SessionSerializer.file_entry_to_dict(p) 
                        for p in package.all_photos
                    ]
                    package_data["service_notes"] = [
                        SessionSerializer.service_note_to_dict(n) 
                        for n in package.service_notes
                    ]
                    package_data["claim_applications"] = [
                        SessionSerializer.claim_application_to_dict(c) 
                        for c in package.claim_applications
                    ]
                
                audit_data["packages"].append(package_data)
            
            for issue_id, issue in session.issues.items():
                issue_data = {
                    "issue_id": issue.issue_id,
                    "waybill_number": issue.waybill_number,
                    "issue_type": issue.issue_type.value if issue.issue_type else None,
                    "severity": issue.severity.value if issue.severity else None,
                    "message": issue.message,
                    "affected_files": issue.affected_files,
                    "affected_notes": issue.affected_notes,
                    "review_status": issue.review_status.value if issue.review_status else None,
                    "metadata": issue.metadata,
                }
                
                if include_review_notes:
                    issue_data["review_notes"] = [
                        SessionSerializer.review_note_to_dict(n) 
                        for n in issue.review_notes
                    ]
                
                audit_data["issues"].append(issue_data)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(audit_data, f, ensure_ascii=False, indent=2)
            
            result.success = True
            result.output_path = output_path
            result.file_count = 1
            result.metadata = {
                "audit_id": audit_data["audit_id"],
                "package_count": len(session.packages),
                "issue_count": len(session.issues),
                "exported_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            result.success = False
            result.errors.append(f"导出审计记录失败: {str(e)}")
        
        return result


class ReportExporter:
    def __init__(self, output_dir: str = None):
        self.output_dir = output_dir or os.path.join(os.getcwd(), "exports")
        self.markdown_exporter = MarkdownExporter()
        self.csv_exporter = CSVExporter()
        self.json_exporter = JSONExporter()
    
    def export_claim_package(
        self,
        package: PackageEvidence,
        output_dir: str = None
    ) -> ExportResult:
        result = ExportResult()
        target_dir = output_dir or self.output_dir
        os.makedirs(target_dir, exist_ok=True)
        
        try:
            md_content = self.markdown_exporter.export_package_for_claim(package)
            output_path = os.path.join(target_dir, f"申诉包_{package.waybill_number}.md")
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(md_content)
            
            result.success = True
            result.output_path = output_path
            result.file_count = 1
            result.metadata = {
                "waybill_number": package.waybill_number,
                "photo_count": len(package.all_photos),
                "note_count": len(package.service_notes),
                "claim_count": len(package.claim_applications),
                "exported_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            result.success = False
            result.errors.append(f"导出申诉包失败: {str(e)}")
        
        return result
    
    def export_all_claim_packages(
        self,
        session: WorkSession,
        output_dir: str = None,
        only_with_claims: bool = True
    ) -> ExportResult:
        result = ExportResult()
        target_dir = output_dir or self.output_dir
        os.makedirs(target_dir, exist_ok=True)
        
        exported_count = 0
        errors = []
        
        for waybill, package in session.packages.items():
            if only_with_claims and len(package.claim_applications) == 0:
                continue
            
            try:
                sub_result = self.export_claim_package(package, target_dir)
                if sub_result.success:
                    exported_count += 1
                else:
                    errors.extend(sub_result.errors)
            except Exception as e:
                errors.append(f"导出运单 {waybill} 失败: {str(e)}")
        
        result.success = exported_count > 0
        result.file_count = exported_count
        result.errors = errors
        result.output_path = target_dir
        result.metadata = {
            "total_packages": len(session.packages),
            "exported_count": exported_count,
            "only_with_claims": only_with_claims,
            "exported_at": datetime.now().isoformat()
        }
        
        return result
    
    def export_issue_list(
        self,
        session: WorkSession,
        output_dir: str = None
    ) -> ExportResult:
        target_dir = output_dir or self.output_dir
        output_path = os.path.join(target_dir, f"问题清单_{session.session_id}.csv")
        
        issues = list(session.issues.values())
        return self.csv_exporter.export_issues_to_csv(issues, output_path)
    
    def export_package_list(
        self,
        session: WorkSession,
        output_dir: str = None
    ) -> ExportResult:
        target_dir = output_dir or self.output_dir
        output_path = os.path.join(target_dir, f"包裹清单_{session.session_id}.csv")
        
        return self.csv_exporter.export_packages_to_csv(session.packages, output_path)
    
    def export_audit_record(
        self,
        session: WorkSession,
        output_dir: str = None
    ) -> ExportResult:
        target_dir = output_dir or self.output_dir
        output_path = os.path.join(target_dir, f"审计记录_{session.session_id}.json")
        
        return self.json_exporter.export_audit_trail(session, output_path)
    
    def export_session_summary(
        self,
        session: WorkSession,
        output_dir: str = None,
        title: str = None
    ) -> ExportResult:
        result = ExportResult()
        target_dir = output_dir or self.output_dir
        os.makedirs(target_dir, exist_ok=True)
        
        try:
            md_content = self.markdown_exporter.export_session_summary(session, title)
            output_path = os.path.join(target_dir, f"会话汇总_{session.session_id}.md")
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(md_content)
            
            result.success = True
            result.output_path = output_path
            result.file_count = 1
            result.metadata = {
                "session_id": session.session_id,
                "package_count": len(session.packages),
                "issue_count": len(session.issues),
                "exported_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            result.success = False
            result.errors.append(f"导出会话汇总失败: {str(e)}")
        
        return result
    
    def export_all(
        self,
        session: WorkSession,
        output_dir: str = None
    ) -> Dict[str, ExportResult]:
        results = {}
        
        results["summary"] = self.export_session_summary(session, output_dir)
        results["packages_csv"] = self.export_package_list(session, output_dir)
        results["issues_csv"] = self.export_issue_list(session, output_dir)
        results["audit_json"] = self.export_audit_record(session, output_dir)
        results["claim_packages"] = self.export_all_claim_packages(session, output_dir)
        
        return results
