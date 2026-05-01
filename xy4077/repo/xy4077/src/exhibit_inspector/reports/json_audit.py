"""JSON审计包导出器"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from ..models import AuditPackage


class JsonAuditExporter:
    """JSON审计包导出器"""
    
    def __init__(self):
        pass
    
    def export(
        self,
        audit: AuditPackage,
        output_path: str | Path,
        include_sensor_data: bool = False,
    ) -> Path:
        """
        导出JSON审计包
        
        Args:
            audit: 审计包
            output_path: 输出路径
            include_sensor_data: 是否包含详细传感器数据（可能很大）
            
        Returns:
            生成的文件路径
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        audit_data = self._build_audit_json(audit, include_sensor_data)
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2, default=str)
        
        return output_path
    
    def _build_audit_json(
        self,
        audit: AuditPackage,
        include_sensor_data: bool,
    ) -> dict:
        """构建审计包JSON"""
        data = {
            "audit_package": {
                "version": "1.0",
                "generated_at": datetime.now().isoformat(),
            },
            "metadata": audit.metadata.model_dump() if audit.metadata else None,
            "config": audit.config.model_dump() if audit.config else None,
            "route_book": audit.route_book.model_dump() if audit.route_book else None,
            "boxes": [box.model_dump() for box in audit.boxes] if audit.boxes else [],
            "photos": [photo.model_dump() for photo in audit.photos] if audit.photos else [],
            "sensor_record_count": audit.sensor_record_count,
            "sensor_stats": audit.sensor_stats,
            "issues": [issue.model_dump() for issue in audit.issues] if audit.issues else [],
            "reviews": [review.model_dump() for review in audit.reviews] if audit.reviews else [],
            "import_summary": audit.import_summary,
            "analysis_summary": self._build_analysis_summary(audit),
        }
        
        return data
    
    def _build_analysis_summary(self, audit: AuditPackage) -> dict:
        """构建分析摘要"""
        from ..models import IssueType, IssueSeverity
        
        summary = {
            "total_issues": len(audit.issues),
            "by_severity": {
                "critical": 0,
                "high": 0,
                "medium": 0,
                "low": 0,
            },
            "by_type": {},
            "by_box": {},
        }
        
        for issue in audit.issues:
            severity = issue.severity.value
            if severity in summary["by_severity"]:
                summary["by_severity"][severity] += 1
            
            issue_type = issue.issue_type.value
            if issue_type not in summary["by_type"]:
                summary["by_type"][issue_type] = 0
            summary["by_type"][issue_type] += 1
            
            if issue.box_id:
                box_id = issue.box_id
                if box_id not in summary["by_box"]:
                    summary["by_box"][box_id] = 0
                summary["by_box"][box_id] += 1
        
        if audit.reviews:
            summary["review_status"] = {
                "total_reviews": len(audit.reviews),
                "by_status": self._count_reviews_by_status(audit.reviews),
                "by_conclusion": self._count_reviews_by_conclusion(audit.reviews),
            }
        
        return summary
    
    def _count_reviews_by_status(self, reviews: list) -> dict:
        """按状态统计复核记录"""
        from ..models import ReviewStatus
        
        counts = {
            "pending": 0,
            "under_review": 0,
            "approved": 0,
            "rejected": 0,
            "needs_clarification": 0,
        }
        
        for review in reviews:
            status = review.status.value
            if status in counts:
                counts[status] += 1
        
        return counts
    
    def _count_reviews_by_conclusion(self, reviews: list) -> dict:
        """按结论统计复核记录"""
        from ..models import ReviewConclusion
        
        counts = {
            "acceptable": 0,
            "acceptable_with_comments": 0,
            "unacceptable": 0,
            "requires_further_investigation": 0,
            "no_conclusion": 0,
        }
        
        for review in reviews:
            if review.conclusion is None:
                counts["no_conclusion"] += 1
            else:
                conclusion = review.conclusion.value
                if conclusion in counts:
                    counts[conclusion] += 1
        
        return counts


def export_json_audit(
    audit: AuditPackage,
    output_path: str | Path,
    include_sensor_data: bool = False,
) -> Path:
    """便捷函数：导出JSON审计包"""
    exporter = JsonAuditExporter()
    return exporter.export(audit, output_path, include_sensor_data)
