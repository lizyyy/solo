"""CSV问题清单导出器"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Optional

from ..models import (
    AuditPackage,
    Issue,
    IssueType,
    IssueSeverity,
    ReviewRecord,
)


SEVERITY_LABELS = {
    IssueSeverity.CRITICAL: "严重",
    IssueSeverity.HIGH: "高",
    IssueSeverity.MEDIUM: "中",
    IssueSeverity.LOW: "低",
}

ISSUE_TYPE_LABELS = {
    IssueType.SHOCK_PEAK: "冲击峰值",
    IssueType.TEMPERATURE_OVER: "温度过高",
    IssueType.TEMPERATURE_UNDER: "温度过低",
    IssueType.HUMIDITY_OVER: "湿度过高",
    IssueType.HUMIDITY_UNDER: "湿度过低",
    IssueType.OPENBOX_MISMATCH: "开箱时段不一致",
    IssueType.MISSING_PHOTO: "照片缺失",
    IssueType.MISSING_EVIDENCE: "证据缺失",
    IssueType.MISSING_SAMPLE: "缺采样",
}


class CSVExporter:
    """CSV导出器"""
    
    ISSUE_FIELDNAMES = [
        "issue_id",
        "severity",
        "severity_code",
        "issue_type",
        "issue_type_code",
        "description",
        "box_id",
        "sensor_id",
        "route_node_id",
        "start_time",
        "end_time",
        "detected_at",
        "notes",
    ]
    
    REVIEW_FIELDNAMES = [
        "review_id",
        "issue_id",
        "reviewer",
        "review_time",
        "status",
        "conclusion",
        "comments",
        "created_at",
        "updated_at",
    ]
    
    def __init__(self):
        pass
    
    def export_issues(
        self,
        audit: AuditPackage,
        output_path: str | Path,
    ) -> Path:
        """
        导出问题清单CSV
        
        Args:
            audit: 审计包
            output_path: 输出路径
            
        Returns:
            生成的文件路径
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        sorted_issues = sorted(
            audit.issues,
            key=lambda i: [
                IssueSeverity.CRITICAL,
                IssueSeverity.HIGH,
                IssueSeverity.MEDIUM,
                IssueSeverity.LOW,
            ].index(i.severity)
        )
        
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=self.ISSUE_FIELDNAMES)
            writer.writeheader()
            
            for issue in sorted_issues:
                row = self._issue_to_row(issue)
                writer.writerow(row)
        
        return output_path
    
    def export_reviews(
        self,
        audit: AuditPackage,
        output_path: str | Path,
    ) -> Path:
        """
        导出复核记录CSV
        
        Args:
            audit: 审计包
            output_path: 输出路径
            
        Returns:
            生成的文件路径
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=self.REVIEW_FIELDNAMES)
            writer.writeheader()
            
            for review in audit.reviews:
                row = self._review_to_row(review)
                writer.writerow(row)
        
        return output_path
    
    def _issue_to_row(self, issue: Issue) -> dict:
        """将问题转换为CSV行"""
        severity_label = SEVERITY_LABELS.get(issue.severity, issue.severity.value)
        type_label = ISSUE_TYPE_LABELS.get(issue.issue_type, issue.issue_type.value)
        
        return {
            "issue_id": issue.issue_id,
            "severity": severity_label,
            "severity_code": issue.severity.value,
            "issue_type": type_label,
            "issue_type_code": issue.issue_type.value,
            "description": issue.description,
            "box_id": issue.box_id or "",
            "sensor_id": issue.sensor_id or "",
            "route_node_id": issue.route_node_id or "",
            "start_time": issue.start_time or "",
            "end_time": issue.end_time or "",
            "detected_at": issue.detected_at,
            "notes": issue.notes or "",
        }
    
    def _review_to_row(self, review: ReviewRecord) -> dict:
        """将复核记录转换为CSV行"""
        return {
            "review_id": review.review_id,
            "issue_id": review.issue_id,
            "reviewer": review.reviewer,
            "review_time": review.review_time,
            "status": review.status.value,
            "conclusion": review.conclusion.value if review.conclusion else "",
            "comments": review.comments or "",
            "created_at": review.created_at,
            "updated_at": review.updated_at or "",
        }


def export_issues_csv(audit: AuditPackage, output_path: str | Path) -> Path:
    """便捷函数：导出问题清单CSV"""
    exporter = CSVExporter()
    return exporter.export_issues(audit, output_path)
