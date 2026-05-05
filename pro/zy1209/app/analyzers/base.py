from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from ..models.enums import AnalysisType, SeverityLevel


@dataclass
class Finding:
    id: str
    title: str
    description: str
    severity: SeverityLevel
    category: str
    evidence: Optional[Dict[str, Any]] = None
    impact: Optional[str] = None


@dataclass
class Recommendation:
    id: str
    finding_id: str
    title: str
    description: str
    priority: str
    estimated_effort: Optional[str] = None
    expected_improvement: Optional[str] = None


@dataclass
class AnalysisResult:
    analysis_type: AnalysisType
    severity: SeverityLevel
    title: str
    description: str
    findings: List[Finding]
    recommendations: List[Recommendation]
    metrics: Dict[str, Any]
    raw_data: Optional[Dict[str, Any]] = None


class BaseAnalyzer(ABC):
    analysis_type: AnalysisType
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
    
    @abstractmethod
    def analyze(self, inputs: Dict[str, Any]) -> AnalysisResult:
        pass
    
    def _calculate_severity(self, findings: List[Finding]) -> SeverityLevel:
        if not findings:
            return SeverityLevel.INFO
        
        severity_order = [
            SeverityLevel.CRITICAL,
            SeverityLevel.HIGH,
            SeverityLevel.MEDIUM,
            SeverityLevel.LOW,
            SeverityLevel.INFO
        ]
        
        for severity in severity_order:
            if any(f.severity == severity for f in findings):
                return severity
        
        return SeverityLevel.INFO
    
    def _generate_summary(self, findings: List[Finding]) -> str:
        if not findings:
            return "未发现明显问题"
        
        by_severity = {}
        for f in findings:
            by_severity[f.severity.value] = by_severity.get(f.severity.value, 0) + 1
        
        parts = []
        for severity in ["critical", "high", "medium", "low"]:
            if severity in by_severity:
                parts.append(f"{severity}: {by_severity[severity]} 项")
        
        return "发现问题: " + ", ".join(parts)
