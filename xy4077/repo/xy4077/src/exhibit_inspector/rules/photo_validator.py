"""照片验证器"""

from dataclasses import dataclass, field
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


@dataclass
class PhotoValidationResult:
    """照片验证结果"""
    node_id: str
    location: str
    required_types: list[str]
    available_types: list[str]
    missing_types: list[str]
    is_complete: bool


class PhotoValidator(BaseRule[tuple[list[PhotoRecord], RouteBook]]):
    """照片验证器"""
    
    def __init__(self):
        super().__init__("photo_validator")
    
    def execute(self, data: tuple[list[PhotoRecord], RouteBook]) -> RuleResult:
        """执行照片验证"""
        photos, route_book = data
        result = RuleResult(
            rule_name=self.name,
            executed_at=datetime.now().isoformat(),
        )
        
        validation_results = self._validate_node_photos(photos, route_book)
        
        for vr in validation_results:
            if not vr.is_complete:
                issue = self._create_missing_photo_issue(vr)
                result.issues.append(issue)
        
        result.stats = {
            "total_nodes": len(route_book.nodes),
            "nodes_with_photos": sum(1 for vr in validation_results if vr.available_types),
            "complete_nodes": sum(1 for vr in validation_results if vr.is_complete),
            "incomplete_nodes": sum(1 for vr in validation_results if not vr.is_complete),
        }
        
        return result
    
    def _validate_node_photos(
        self,
        photos: list[PhotoRecord],
        route_book: RouteBook,
    ) -> list[PhotoValidationResult]:
        """验证每个路书节点的照片"""
        results: list[PhotoValidationResult] = []
        
        for node in route_book.nodes:
            required_types = node.required_photos
            if not required_types:
                required_types = self._get_default_photo_types(node)
            
            node_photos = [
                p for p in photos
                if p.route_node_id == node.node_id
            ]
            
            available_types = [p.photo_type.value for p in node_photos]
            
            missing_types = [
                rt for rt in required_types
                if rt not in available_types
            ]
            
            is_complete = len(missing_types) == 0
            
            result = PhotoValidationResult(
                node_id=node.node_id,
                location=node.location,
                required_types=required_types,
                available_types=available_types,
                missing_types=missing_types,
                is_complete=is_complete,
            )
            results.append(result)
        
        return results
    
    def _get_default_photo_types(self, node: RouteNode) -> list[str]:
        """获取节点的默认照片类型"""
        from ..models import RoutePhase, PhotoType
        
        defaults = {
            RoutePhase.DEPARTURE: [
                PhotoType.LOADING_START.value,
                PhotoType.LOADING_END.value,
                PhotoType.BOX_CLOSED.value,
                PhotoType.SEAL_INTACT.value,
            ],
            RoutePhase.TRANSIT: [
                PhotoType.TRANSIT.value,
            ],
            RoutePhase.STOPOVER: [
                PhotoType.SEAL_INTACT.value,
            ],
            RoutePhase.ARRIVAL: [
                PhotoType.ARRIVAL.value,
                PhotoType.UNLOADING_START.value,
                PhotoType.UNLOADING_END.value,
                PhotoType.SEAL_INTACT.value,
                PhotoType.OPENING_START.value,
                PhotoType.OPENING_END.value,
                PhotoType.CONDITION_CHECK.value,
                PhotoType.SIGNATURE.value,
                PhotoType.HANDOVER.value,
            ],
            RoutePhase.CHECKPOINT: [
                PhotoType.SEAL_INTACT.value,
                PhotoType.CONDITION_CHECK.value,
            ],
        }
        
        return defaults.get(node.phase, [])
    
    def _create_missing_photo_issue(
        self,
        validation_result: PhotoValidationResult,
    ) -> MissingPhotoIssue:
        """创建照片缺失问题"""
        severity = self._calculate_severity(validation_result)
        
        description = (
            f"节点 {validation_result.location} (ID: {validation_result.node_id}) "
            f"缺少照片: {', '.join(validation_result.missing_types)}"
        )
        
        issue_id = self._generate_issue_id()
        now = datetime.now().isoformat()
        
        return MissingPhotoIssue(
            issue_id=issue_id,
            severity=severity,
            route_node_id=validation_result.node_id,
            description=description,
            detected_at=now,
            source_data={
                "location": validation_result.location,
                "required": validation_result.required_types,
                "available": validation_result.available_types,
                "missing": validation_result.missing_types,
            },
            required_photo_types=validation_result.required_types,
            available_photo_types=validation_result.available_types,
            missing_types=validation_result.missing_types,
        )
    
    def _calculate_severity(
        self,
        validation_result: PhotoValidationResult,
    ) -> IssueSeverity:
        """根据缺失的照片类型计算严重程度"""
        from ..models import PhotoType
        
        critical_types = {
            PhotoType.SEAL_INTACT.value,
            PhotoType.OPENING_START.value,
            PhotoType.OPENING_END.value,
            PhotoType.CONDITION_CHECK.value,
            PhotoType.SIGNATURE.value,
            PhotoType.HANDOVER.value,
        }
        
        critical_missing = [
            t for t in validation_result.missing_types
            if t in critical_types
        ]
        
        if len(critical_missing) >= 2:
            return IssueSeverity.CRITICAL
        elif critical_missing:
            return IssueSeverity.HIGH
        elif len(validation_result.missing_types) >= 3:
            return IssueSeverity.MEDIUM
        else:
            return IssueSeverity.LOW
