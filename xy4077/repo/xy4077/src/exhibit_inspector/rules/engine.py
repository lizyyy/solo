"""规则引擎主类"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from ..models import (
    SensorRecord,
    PhotoRecord,
    RouteBook,
    ThresholdSettings,
    Issue,
)
from .base import RuleResult
from .shock_detector import ShockDetector
from .temp_humid_detector import TempHumidDetector
from .photo_validator import PhotoValidator
from .evidence_validator import EvidenceValidator


@dataclass
class AnalysisResult:
    """分析结果"""
    shipment_id: str
    analyzed_at: str
    total_issues: int = 0
    critical_issues: int = 0
    high_issues: int = 0
    medium_issues: int = 0
    low_issues: int = 0
    issues: list[Issue] = field(default_factory=list)
    rule_results: dict[str, RuleResult] = field(default_factory=dict)
    stats: dict = field(default_factory=dict)
    
    @property
    def has_critical(self) -> bool:
        return self.critical_issues > 0
    
    @property
    def severity_summary(self) -> dict:
        return {
            "critical": self.critical_issues,
            "high": self.high_issues,
            "medium": self.medium_issues,
            "low": self.low_issues,
        }


class RuleEngine:
    """规则引擎"""
    
    def __init__(self, thresholds: ThresholdSettings):
        self.thresholds = thresholds
        self._shock_detector = ShockDetector(thresholds)
        self._temp_humid_detector = TempHumidDetector(thresholds)
        self._photo_validator = PhotoValidator()
        self._evidence_validator = EvidenceValidator()
    
    def analyze(
        self,
        shipment_id: str,
        sensor_records: list[SensorRecord],
        photo_records: list[PhotoRecord],
        route_book: RouteBook,
        available_evidence: Optional[list[str]] = None,
    ) -> AnalysisResult:
        """
        执行完整分析
        
        Args:
            shipment_id: 运输批次编号
            sensor_records: 传感器记录列表
            photo_records: 照片记录列表
            route_book: 路书
            available_evidence: 可用的交接证据列表
            
        Returns:
            分析结果
        """
        result = AnalysisResult(
            shipment_id=shipment_id,
            analyzed_at=datetime.now().isoformat(),
        )
        
        shock_result = self._shock_detector.execute(sensor_records)
        result.rule_results["shock"] = shock_result
        result.issues.extend(shock_result.issues)
        
        temp_humid_result = self._temp_humid_detector.execute(sensor_records)
        result.rule_results["temp_humid"] = temp_humid_result
        result.issues.extend(temp_humid_result.issues)
        
        photo_data = (photo_records, route_book)
        photo_result = self._photo_validator.execute(photo_data)
        result.rule_results["photos"] = photo_result
        result.issues.extend(photo_result.issues)
        
        if available_evidence is None:
            available_evidence = []
        evidence_data = (available_evidence, route_book)
        evidence_result = self._evidence_validator.execute(evidence_data)
        result.rule_results["evidence"] = evidence_result
        result.issues.extend(evidence_result.issues)
        
        result = self._count_issues(result)
        result.stats = self._compile_stats(result)
        
        return result
    
    def _count_issues(self, result: AnalysisResult) -> AnalysisResult:
        """统计问题数量"""
        from ..models import IssueSeverity
        
        result.total_issues = len(result.issues)
        result.critical_issues = sum(
            1 for issue in result.issues
            if issue.severity == IssueSeverity.CRITICAL
        )
        result.high_issues = sum(
            1 for issue in result.issues
            if issue.severity == IssueSeverity.HIGH
        )
        result.medium_issues = sum(
            1 for issue in result.issues
            if issue.severity == IssueSeverity.MEDIUM
        )
        result.low_issues = sum(
            1 for issue in result.issues
            if issue.severity == IssueSeverity.LOW
        )
        
        return result
    
    def _compile_stats(self, result: AnalysisResult) -> dict:
        """编译统计信息"""
        from ..models import IssueType
        
        stats = {
            "by_type": {},
            "by_severity": result.severity_summary,
            "total_issues": result.total_issues,
        }
        
        for issue in result.issues:
            issue_type = issue.issue_type.value
            if issue_type not in stats["by_type"]:
                stats["by_type"][issue_type] = 0
            stats["by_type"][issue_type] += 1
        
        for rule_name, rule_result in result.rule_results.items():
            stats[f"{rule_name}_stats"] = rule_result.stats
        
        return stats
    
    def analyze_shock_only(
        self,
        sensor_records: list[SensorRecord],
    ) -> RuleResult:
        """仅执行冲击峰值检测"""
        return self._shock_detector.execute(sensor_records)
    
    def analyze_temp_humid_only(
        self,
        sensor_records: list[SensorRecord],
    ) -> RuleResult:
        """仅执行温湿度超限检测"""
        return self._temp_humid_detector.execute(sensor_records)
    
    def validate_photos_only(
        self,
        photo_records: list[PhotoRecord],
        route_book: RouteBook,
    ) -> RuleResult:
        """仅执行照片验证"""
        return self._photo_validator.execute((photo_records, route_book))
    
    def validate_evidence_only(
        self,
        available_evidence: list[str],
        route_book: RouteBook,
    ) -> RuleResult:
        """仅执行证据验证"""
        return self._evidence_validator.execute((available_evidence, route_book))
