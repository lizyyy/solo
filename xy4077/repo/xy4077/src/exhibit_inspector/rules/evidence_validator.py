"""交接证据验证器"""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from ..models import (
    RouteBook,
    RouteNode,
    IssueType,
    IssueSeverity,
    MissingEvidenceIssue,
)
from .base import BaseRule, RuleResult


@dataclass
class EvidenceValidationResult:
    """证据验证结果"""
    node_id: str
    location: str
    required_evidence: list[str]
    available_evidence: list[str]
    missing_evidence: list[str]
    is_complete: bool


class EvidenceValidator(BaseRule[tuple[list[str], RouteBook]]):
    """交接证据验证器"""
    
    DEFAULT_REQUIRED_EVIDENCE = [
        "seal_check",
        "condition_report",
        "sign_off",
    ]
    
    def __init__(self):
        super().__init__("evidence_validator")
    
    def execute(self, data: tuple[list[str], RouteBook]) -> RuleResult:
        """执行证据验证"""
        available_evidence, route_book = data
        result = RuleResult(
            rule_name=self.name,
            executed_at=datetime.now().isoformat(),
        )
        
        validation_results = self._validate_node_evidence(available_evidence, route_book)
        
        for vr in validation_results:
            if not vr.is_complete:
                issue = self._create_missing_evidence_issue(vr)
                result.issues.append(issue)
        
        result.stats = {
            "total_nodes": len(route_book.nodes),
            "nodes_with_evidence": sum(1 for vr in validation_results if vr.available_evidence),
            "complete_nodes": sum(1 for vr in validation_results if vr.is_complete),
            "incomplete_nodes": sum(1 for vr in validation_results if not vr.is_complete),
        }
        
        return result
    
    def _validate_node_evidence(
        self,
        available_evidence: list[str],
        route_book: RouteBook,
    ) -> list[EvidenceValidationResult]:
        """验证每个路书节点的证据"""
        results: list[EvidenceValidationResult] = []
        
        for node in route_book.nodes:
            required = node.evidence_required
            if not required:
                required = self._get_default_evidence(node)
            
            available = self._get_node_evidence(node, available_evidence)
            
            missing = [
                e for e in required
                if e not in available
            ]
            
            is_complete = len(missing) == 0
            
            result = EvidenceValidationResult(
                node_id=node.node_id,
                location=node.location,
                required_evidence=required,
                available_evidence=available,
                missing_evidence=missing,
                is_complete=is_complete,
            )
            results.append(result)
        
        return results
    
    def _get_default_evidence(self, node: RouteNode) -> list[str]:
        """获取节点的默认证据要求"""
        from ..models import RoutePhase
        
        defaults = {
            RoutePhase.DEPARTURE: [
                "seal_check",
                "loading_sign_off",
            ],
            RoutePhase.STOPOVER: [
                "seal_check",
            ],
            RoutePhase.ARRIVAL: [
                "seal_check",
                "condition_report",
                "unloading_sign_off",
                "handover_document",
                "final_sign_off",
            ],
            RoutePhase.CHECKPOINT: [
                "seal_check",
                "condition_report",
            ],
        }
        
        return defaults.get(node.phase, [])
    
    def _get_node_evidence(
        self,
        node: RouteNode,
        available_evidence: list[str],
    ) -> list[str]:
        """获取节点的可用证据"""
        node_prefix = f"{node.node_id}_"
        node_evidence = []
        
        for evidence in available_evidence:
            if evidence.startswith(node_prefix):
                node_evidence.append(evidence[len(node_prefix):])
            elif "_" not in evidence:
                if evidence in self._get_default_evidence(node):
                    node_evidence.append(evidence)
        
        return node_evidence
    
    def _create_missing_evidence_issue(
        self,
        validation_result: EvidenceValidationResult,
    ) -> MissingEvidenceIssue:
        """创建证据缺失问题"""
        severity = self._calculate_severity(validation_result)
        
        description = (
            f"节点 {validation_result.location} (ID: {validation_result.node_id}) "
            f"缺少交接证据: {', '.join(validation_result.missing_evidence)}"
        )
        
        issue_id = self._generate_issue_id()
        now = datetime.now().isoformat()
        
        return MissingEvidenceIssue(
            issue_id=issue_id,
            severity=severity,
            route_node_id=validation_result.node_id,
            description=description,
            detected_at=now,
            source_data={
                "location": validation_result.location,
                "required": validation_result.required_evidence,
                "available": validation_result.available_evidence,
                "missing": validation_result.missing_evidence,
            },
            required_evidence=validation_result.required_evidence,
            available_evidence=validation_result.available_evidence,
            missing_evidence=validation_result.missing_evidence,
        )
    
    def _calculate_severity(
        self,
        validation_result: EvidenceValidationResult,
    ) -> IssueSeverity:
        """根据缺失的证据计算严重程度"""
        critical_types = {
            "seal_check",
            "condition_report",
            "final_sign_off",
            "handover_document",
        }
        
        critical_missing = [
            e for e in validation_result.missing_evidence
            if e in critical_types
        ]
        
        if len(critical_missing) >= 2:
            return IssueSeverity.CRITICAL
        elif critical_missing:
            return IssueSeverity.HIGH
        elif len(validation_result.missing_evidence) >= 3:
            return IssueSeverity.MEDIUM
        else:
            return IssueSeverity.LOW
