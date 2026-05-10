"""数据模型定义"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime


@dataclass
class PestCount:
    """虫害计数记录"""
    pest_type: str
    pest_name: str
    ai_count: int = 0
    manual_count_round1: Optional[int] = None
    manual_count_round2: Optional[int] = None
    final_count: int = 0
    is_manual_corrected: bool = False
    correction_reason: Optional[str] = None

    def get_count_difference_percent(self) -> Optional[float]:
        """计算人工修正与AI计数的差异百分比"""
        if not self.is_manual_corrected or self.ai_count == 0:
            return None
        diff = abs(self.final_count - self.ai_count)
        return (diff / self.ai_count) * 100

    def get_rounds_difference_percent(self) -> Optional[float]:
        """计算多轮复核之间的差异百分比"""
        if self.manual_count_round1 is None or self.manual_count_round2 is None:
            return None
        if self.manual_count_round1 == 0:
            return 100.0 if self.manual_count_round2 != 0 else 0.0
        diff = abs(self.manual_count_round2 - self.manual_count_round1)
        return (diff / self.manual_count_round1) * 100


@dataclass
class TrapRecord:
    """诱捕板记录 - 单张诱捕板的单日数据"""
    record_id: str
    trap_board_id: str
    greenhouse_id: str
    capture_date: str
    board_type: str
    board_type_name: str

    image_path: Optional[str] = None
    capture_time: Optional[str] = None
    operator: Optional[str] = None
    remark: Optional[str] = None

    pest_counts: List[PestCount] = field(default_factory=list)
    total_ai_count: int = 0
    total_final_count: int = 0

    created_at: datetime = field(default_factory=datetime.now)
    raw_data: Dict[str, Any] = field(default_factory=dict)

    def get_pest_by_type(self, pest_type: str) -> Optional[PestCount]:
        """根据虫害类型获取计数记录"""
        for pc in self.pest_counts:
            if pc.pest_type == pest_type:
                return pc
        return None

    def get_all_pest_types(self) -> List[str]:
        """获取所有虫害类型"""
        return [pc.pest_type for pc in self.pest_counts]

    def get_total_ai_count(self) -> int:
        """计算AI计数总和"""
        return sum(pc.ai_count for pc in self.pest_counts)

    def get_total_final_count(self) -> int:
        """计算最终计数总和"""
        return sum(pc.final_count for pc in self.pest_counts)

    def get_duplicate_key(self) -> str:
        """获取用于检测重复记录的键"""
        return f"{self.trap_board_id}_{self.capture_date}"


@dataclass
class ValidationIssue:
    """校验问题"""
    issue_id: str
    rule_id: str
    rule_name: str
    level: str
    level_name: str
    severity: str
    description: str
    reason: str
    suggestion: str
    related_fields: List[str] = field(default_factory=list)
    related_values: Dict[str, Any] = field(default_factory=dict)
    score_penalty: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_id": self.issue_id,
            "rule_id": self.rule_id,
            "rule_name": self.rule_name,
            "level": self.level,
            "level_name": self.level_name,
            "severity": self.severity,
            "description": self.description,
            "reason": self.reason,
            "suggestion": self.suggestion,
            "related_fields": self.related_fields,
            "related_values": self.related_values,
            "score_penalty": self.score_penalty
        }


@dataclass
class AnalysisResult:
    """分析结果"""
    record_id: str
    trap_board_id: str
    greenhouse_id: str
    capture_date: str

    quality_score: float = 100.0
    quality_grade: str = "A"
    quality_grade_name: str = "优秀"

    issues: List[ValidationIssue] = field(default_factory=list)
    total_penalty: int = 0

    pest_summary: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    alert_level: str = "normal"
    alert_message: str = ""

    confidence_notes: List[str] = field(default_factory=list)

    def add_issue(self, issue: ValidationIssue):
        """添加问题"""
        self.issues.append(issue)
        self.total_penalty += issue.score_penalty
        self.quality_score = max(0, 100.0 - self.total_penalty)

    def get_issues_by_level(self, level: str) -> List[ValidationIssue]:
        """按等级获取问题"""
        return [i for i in self.issues if i.level == level]

    def count_issues_by_level(self, level: str) -> int:
        """统计某等级的问题数量"""
        return len(self.get_issues_by_level(level))

    def has_critical_issues(self) -> bool:
        """是否有严重问题"""
        return self.count_issues_by_level("critical") > 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "trap_board_id": self.trap_board_id,
            "greenhouse_id": self.greenhouse_id,
            "capture_date": self.capture_date,
            "quality_score": round(self.quality_score, 1),
            "quality_grade": self.quality_grade,
            "quality_grade_name": self.quality_grade_name,
            "total_penalty": self.total_penalty,
            "issues_count": {
                "critical": self.count_issues_by_level("critical"),
                "high": self.count_issues_by_level("high"),
                "medium": self.count_issues_by_level("medium"),
                "low": self.count_issues_by_level("low")
            },
            "issues": [i.to_dict() for i in self.issues],
            "pest_summary": self.pest_summary,
            "alert_level": self.alert_level,
            "alert_message": self.alert_message,
            "confidence_notes": self.confidence_notes
        }


@dataclass
class BatchAnalysisResult:
    """批量分析结果"""
    batch_id: str
    total_records: int = 0
    valid_records: int = 0
    invalid_records: int = 0

    results: List[AnalysisResult] = field(default_factory=list)

    grade_distribution: Dict[str, int] = field(default_factory=lambda: {"A": 0, "B": 0, "C": 0, "D": 0})
    issue_summary: Dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "batch_id": self.batch_id,
            "summary": {
                "total_records": self.total_records,
                "valid_records": self.valid_records,
                "invalid_records": self.invalid_records,
                "grade_distribution": self.grade_distribution,
                "issue_summary": self.issue_summary
            },
            "results": [r.to_dict() for r in self.results]
        }
