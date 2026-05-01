"""照片缺失检测器"""

from datetime import datetime
from typing import Optional

from ..models import (
    PhotoRecord,
    PhotoType,
    RouteBook,
    RouteNode,
    IssueType,
    IssueSeverity,
    MissingPhotoIssue,
)
from .base import BaseRule, RuleResult


class MissingPhotoDetector(BaseRule[dict]):
    """照片缺失检测器"""
    
    def __init__(
        self,
        required_photo_types: Optional[list[str]] = None,
    ):
        super().__init__("missing_photo_detector")
        self.required_photo_types = required_photo_types or [
            "loading_photo",
            "unloading_photo",
            "seal_photo",
        ]
    
    def execute(self, data: dict) -> RuleResult:
        """执行照片缺失检测
        
        Args:
            data: 字典，包含:
                - photos: PhotoRecord 列表
                - route_book: RouteBook
        """
        result = RuleResult(
            rule_name=self.name,
            executed_at=datetime.now().isoformat(),
        )
        
        photos = data.get("photos", [])
        route_book = data.get("route_book")
        
        if not route_book:
            result.stats["warning"] = "未提供路书，跳过照片缺失检测"
            return result
        
        available_types = [p.photo_type.value if hasattr(p.photo_type, 'value') else str(p.photo_type) for p in photos]
        
        missing_types = [
            rt for rt in self.required_photo_types
            if rt not in available_types
        ]
        
        if missing_types:
            issue = self._create_missing_photo_issue(
                available_types=available_types,
                missing_types=missing_types,
            )
            result.issues.append(issue)
        
        result.stats = {
            "total_photos": len(photos),
            "available_types": available_types,
            "required_types": self.required_photo_types,
            "missing_types": missing_types,
        }
        
        return result
    
    def _create_missing_photo_issue(
        self,
        available_types: list[str],
        missing_types: list[str],
    ) -> MissingPhotoIssue:
        """创建照片缺失问题"""
        description = (
            f"缺少 {len(missing_types)} 类照片: {', '.join(missing_types)}"
        )
        
        severity = IssueSeverity.MEDIUM
        if len(missing_types) >= 2:
            severity = IssueSeverity.HIGH
        if len(missing_types) >= 3:
            severity = IssueSeverity.CRITICAL
        
        issue_id = self._generate_issue_id()
        now = datetime.now().isoformat()
        
        return MissingPhotoIssue(
            issue_id=issue_id,
            severity=severity,
            description=description,
            detected_at=now,
            source_data={
                "available": available_types,
                "missing": missing_types,
                "required": self.required_photo_types,
            },
            required_photo_types=self.required_photo_types,
            available_photo_types=available_types,
            missing_types=missing_types,
        )
