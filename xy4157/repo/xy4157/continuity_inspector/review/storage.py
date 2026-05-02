"""
复核存储 - 管理人工复核意见的存储和加载
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from ..models import ProjectData, ContinuityIssue, AuditEntry, IssueCategory, IssueSeverity
from ..parsers.json_parser import JSONParser


class ReviewStorage:
    """
    复核意见存储管理器
    
    功能:
    - 加载和保存项目数据
    - 记录问题的放行/拒绝意见
    - 维护审计日志
    """
    
    def __init__(self):
        self.project: Optional[ProjectData] = None
        self.json_parser = JSONParser()
    
    def load_project(self, file_path: str) -> ProjectData:
        """从文件加载项目数据"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        self.project = self.json_parser.parse_project_data(data)
        return self.project
    
    def save_project(self, file_path: str):
        """保存项目数据到文件"""
        if self.project is None:
            raise ValueError("没有加载的项目数据")
        
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        from ..exporters.json_exporter import JSONExporter
        exporter = JSONExporter()
        exporter.export_project_data(self.project, file_path)
    
    def approve_issue(self, issue_id: str, user: str, notes: str = ""):
        """
        放行一个问题
        
        Args:
            issue_id: 问题ID
            user: 操作人
            notes: 备注说明
        """
        if self.project is None:
            raise ValueError("没有加载的项目数据")
        
        issue = self._find_issue(issue_id)
        if issue is None:
            raise ValueError(f"未找到问题: {issue_id}")
        
        issue.approved = True
        issue.approval_notes = notes
        issue.approved_by = user
        issue.approved_at = datetime.now().isoformat()
        
        audit = AuditEntry(
            action="APPROVE",
            timestamp=datetime.now().isoformat(),
            user=user,
            details={
                "issue_id": issue_id,
                "issue_category": issue.category.value,
                "issue_severity": issue.severity.value,
                "scene": issue.scene_id,
                "shot": issue.shot_number,
                "description": issue.description,
                "notes": notes
            }
        )
        self.project.audit_trail.append(audit)
    
    def reject_issue(self, issue_id: str, user: str, notes: str = ""):
        """
        拒绝一个问题 (标记为需要重拍/修改)
        
        Args:
            issue_id: 问题ID
            user: 操作人
            notes: 备注说明
        """
        if self.project is None:
            raise ValueError("没有加载的项目数据")
        
        issue = self._find_issue(issue_id)
        if issue is None:
            raise ValueError(f"未找到问题: {issue_id}")
        
        issue.approved = False
        issue.approval_notes = notes
        issue.approved_by = user
        issue.approved_at = datetime.now().isoformat()
        
        audit = AuditEntry(
            action="REJECT",
            timestamp=datetime.now().isoformat(),
            user=user,
            details={
                "issue_id": issue_id,
                "issue_category": issue.category.value,
                "issue_severity": issue.severity.value,
                "scene": issue.scene_id,
                "shot": issue.shot_number,
                "description": issue.description,
                "notes": notes
            }
        )
        self.project.audit_trail.append(audit)
    
    def batch_approve(self, issue_ids: List[str], user: str, notes: str = ""):
        """批量放行问题"""
        for issue_id in issue_ids:
            self.approve_issue(issue_id, user, notes)
    
    def get_issues_by_category(self, category: IssueCategory) -> List[ContinuityIssue]:
        """按类别获取问题"""
        if self.project is None:
            return []
        return [i for i in self.project.issues if i.category == category]
    
    def get_issues_by_severity(self, severity: IssueSeverity) -> List[ContinuityIssue]:
        """按严重程度获取问题"""
        if self.project is None:
            return []
        return [i for i in self.project.issues if i.severity == severity]
    
    def get_pending_issues(self) -> List[ContinuityIssue]:
        """获取待处理的问题"""
        if self.project is None:
            return []
        return [i for i in self.project.issues if not i.approved or not i.approved_at]
    
    def get_approved_issues(self) -> List[ContinuityIssue]:
        """获取已放行的问题"""
        if self.project is None:
            return []
        return [i for i in self.project.issues if i.approved]
    
    def get_audit_history(self, limit: int = 100) -> List[AuditEntry]:
        """获取审计历史"""
        if self.project is None:
            return []
        history = sorted(
            self.project.audit_trail,
            key=lambda x: x.timestamp,
            reverse=True
        )
        return history[:limit]
    
    def _find_issue(self, issue_id: str) -> Optional[ContinuityIssue]:
        """查找问题"""
        if self.project is None:
            return None
        for issue in self.project.issues:
            if issue.issue_id == issue_id:
                return issue
        return None
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取项目统计信息"""
        if self.project is None:
            return {}
        
        total = len(self.project.issues)
        approved = len(self.get_approved_issues())
        pending = len(self.get_pending_issues())
        
        by_category = {}
        by_severity = {}
        
        for issue in self.project.issues:
            cat = issue.category.value
            sev = issue.severity.value
            
            if cat not in by_category:
                by_category[cat] = {"total": 0, "approved": 0, "pending": 0}
            by_category[cat]["total"] += 1
            if issue.approved:
                by_category[cat]["approved"] += 1
            else:
                by_category[cat]["pending"] += 1
            
            if sev not in by_severity:
                by_severity[sev] = {"total": 0, "approved": 0, "pending": 0}
            by_severity[sev]["total"] += 1
            if issue.approved:
                by_severity[sev]["approved"] += 1
            else:
                by_severity[sev]["pending"] += 1
        
        return {
            "project_name": self.project.project_name,
            "production_day": self.project.production_day,
            "summary": {
                "total_issues": total,
                "approved": approved,
                "pending": pending
            },
            "by_category": by_category,
            "by_severity": by_severity,
            "call_sheet_count": len(self.project.call_sheet_entries),
            "script_notes_count": len(self.project.script_notes),
            "screenshots_count": len(self.project.screenshots),
            "audit_entries_count": len(self.project.audit_trail)
        }
