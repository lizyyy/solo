"""数据模型定义。"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class PitfallType(Enum):
    """迭代器坑点类型枚举。"""

    ITERATOR_PROTOCOL = "iterator_protocol"
    STOP_ITERATION = "stop_iteration"
    SINGLE_USE = "single_use"
    TEE_CACHE = "tee_cache"
    SEND_THROW_CLOSE = "send_throw_close"
    LAZY_EVALUATION = "lazy_evaluation"
    YIELD_FROM = "yield_from"
    CLOSURE_CAPTURE = "closure_capture"


class Severity(Enum):
    """问题严重程度。"""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class Location:
    """代码位置信息。"""

    file_path: str
    line_number: Optional[int] = None
    column_number: Optional[int] = None
    function_name: Optional[str] = None
    class_name: Optional[str] = None


@dataclass
class Finding:
    """单个问题发现。"""

    pitfall_type: PitfallType
    severity: Severity
    title: str
    description: str
    location: Optional[Location] = None
    context: Dict[str, Any] = field(default_factory=dict)
    suggestion: Optional[str] = None
    code_snippet: Optional[str] = None


@dataclass
class CodeSnippet:
    """代码片段信息。"""

    file_path: str
    content: str
    findings: List[Finding] = field(default_factory=list)


@dataclass
class PipelineRisk:
    """流水线风险定义。"""

    risk_type: str
    stage: str
    description: str
    severity: Severity = Severity.MEDIUM


@dataclass
class Pipeline:
    """流水线定义。"""

    name: str
    description: str
    stages: List[Dict[str, Any]] = field(default_factory=list)
    risks: List[PipelineRisk] = field(default_factory=list)


@dataclass
class Event:
    """事件日志条目。"""

    timestamp: datetime
    event_type: str
    level: str
    message: str
    context: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AnalysisResult:
    """完整分析结果。"""

    id: Optional[int] = None
    name: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)

    code_snippets: List[CodeSnippet] = field(default_factory=list)
    pipelines: List[Pipeline] = field(default_factory=list)
    events: List[Event] = field(default_factory=list)

    summary: Dict[str, Any] = field(default_factory=dict)

    def compute_summary(self):
        """计算分析摘要统计。"""
        total_findings = 0
        findings_by_type: Dict[str, int] = {}
        findings_by_severity: Dict[str, int] = {}
        files_analyzed = len(self.code_snippets)

        for snippet in self.code_snippets:
            total_findings += len(snippet.findings)
            for finding in snippet.findings:
                pitfall_type = finding.pitfall_type.value
                severity = finding.severity.value
                findings_by_type[pitfall_type] = findings_by_type.get(pitfall_type, 0) + 1
                findings_by_severity[severity] = findings_by_severity.get(severity, 0) + 1

        for pipeline in self.pipelines:
            total_findings += len(pipeline.risks)
            for risk in pipeline.risks:
                severity = risk.severity.value
                findings_by_severity[severity] = findings_by_severity.get(severity, 0) + 1

        self.summary = {
            "total_findings": total_findings,
            "files_analyzed": files_analyzed,
            "pipelines_analyzed": len(self.pipelines),
            "events_found": len(self.events),
            "findings_by_type": findings_by_type,
            "findings_by_severity": findings_by_severity,
        }

        return self.summary


@dataclass
class ComparisonResult:
    """两次分析的对比结果。"""

    analysis_id_1: int
    analysis_id_2: int
    analysis_name_1: Optional[str]
    analysis_name_2: Optional[str]

    new_findings: List[Finding] = field(default_factory=list)
    resolved_findings: List[Finding] = field(default_factory=list)
    improved_findings: List[Dict[str, Any]] = field(default_factory=list)
    worsened_findings: List[Dict[str, Any]] = field(default_factory=list)

    summary: Dict[str, Any] = field(default_factory=dict)

    def compute_summary(self):
        """计算对比摘要。"""
        self.summary = {
            "new_findings_count": len(self.new_findings),
            "resolved_findings_count": len(self.resolved_findings),
            "improved_count": len(self.improved_findings),
            "worsened_count": len(self.worsened_findings),
        }
        return self.summary
