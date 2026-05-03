"""
评分模块
负责计算缺陷的风险等级和证据来源：
- 基于缺陷类型、严重程度、证据数量计算风险分数
- 确定证据来源（哪些机器人/巡检包发现了该缺陷）
"""

from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime

from .merger import MergedDefect, MergeResult


class RiskLevel(Enum):
    """风险等级枚举"""
    CRITICAL = "critical"    # 紧急 - 需要立即处理
    HIGH = "high"            # 高风险 - 近期需要处理
    MEDIUM = "medium"        # 中等风险 - 计划内处理
    LOW = "low"              # 低风险 - 监控观察
    INFO = "info"            # 信息性 - 无需处理


@dataclass
class EvidenceSource:
    """证据来源信息"""
    package_name: str
    defect_id: Optional[str]
    source_type: str  # "robot", "human", "auto"
    timestamp: Optional[float]
    mileage: Optional[float]
    confidence: float = 1.0  # 置信度
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "package_name": self.package_name,
            "defect_id": self.defect_id,
            "source_type": self.source_type,
            "timestamp": self.timestamp,
            "timestamp_formatted": self._format_timestamp(),
            "mileage": self.mileage,
            "confidence": self.confidence,
            "details": self.details
        }
    
    def _format_timestamp(self) -> Optional[str]:
        if self.timestamp is None:
            return None
        try:
            return datetime.fromtimestamp(self.timestamp).strftime("%Y-%m-%d %H:%M:%S")
        except (ValueError, OSError):
            return str(self.timestamp)


@dataclass
class RiskScore:
    """风险评分结果"""
    merged_id: str
    risk_level: RiskLevel
    total_score: float
    score_breakdown: Dict[str, float]
    
    # 缺陷基本信息
    defect_type: str = "unknown"
    primary_mileage: float = 0.0
    min_mileage: float = 0.0
    max_mileage: float = 0.0
    description: str = ""
    
    # 证据来源
    evidence_sources: List[EvidenceSource] = field(default_factory=list)
    source_count: int = 0
    unique_packages: int = 0
    
    # 时间信息
    first_seen: Optional[float] = None
    last_seen: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "merged_id": self.merged_id,
            "risk_level": self.risk_level.value,
            "total_score": self.total_score,
            "score_breakdown": self.score_breakdown,
            "source_count": self.source_count,
            "unique_packages": self.unique_packages,
            "evidence_sources": [s.to_dict() for s in self.evidence_sources],
            "first_seen": self.first_seen,
            "first_seen_formatted": self._format_timestamp(self.first_seen),
            "last_seen": self.last_seen,
            "last_seen_formatted": self._format_timestamp(self.last_seen)
        }
    
    def _format_timestamp(self, ts: Optional[float]) -> Optional[str]:
        if ts is None:
            return None
        try:
            return datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")
        except (ValueError, OSError):
            return str(ts)


@dataclass
class ScoringResult:
    """评分结果汇总"""
    total_defects: int = 0
    by_risk_level: Dict[str, int] = field(default_factory=dict)
    scored_defects: List[RiskScore] = field(default_factory=list)
    statistics: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_defects": self.total_defects,
            "by_risk_level": self.by_risk_level,
            "statistics": self.statistics,
            "scored_defects": [s.to_dict() for s in self.scored_defects]
        }


class DefectScorer:
    """
    缺陷评分器
    负责计算缺陷的风险等级和证据来源
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        
        # 风险评分权重配置
        self.weights = self.config.get("weights", {
            "severity": 0.4,           # 严重程度权重
            "defect_type": 0.3,         # 缺陷类型权重
            "evidence_count": 0.2,      # 证据数量权重
            "time_freshness": 0.1,      # 时间新鲜度权重
        })
        
        # 缺陷类型风险映射
        self.type_risk = self.config.get("type_risk", {
            "crack": 80,        # 裂缝 - 高风险
            "leak": 90,         # 漏水 - 很高风险
            "corrosion": 70,    # 腐蚀 - 中高风险
            "deformation": 85,  # 变形 - 高风险
            "blockage": 75,     # 堵塞 - 中高风险
            "unknown": 50,      # 未知类型 - 中等风险
        })
        
        # 严重程度映射
        self.severity_score = self.config.get("severity_score", {
            "critical": 100,
            "high": 75,
            "medium": 50,
            "low": 25,
            "严重": 100,
            "高": 75,
            "中": 50,
            "低": 25,
        })
        
        # 风险等级阈值
        self.risk_thresholds = self.config.get("risk_thresholds", {
            "critical": 85,    # >= 85 为紧急
            "high": 70,        # >= 70 且 < 85 为高风险
            "medium": 40,      # >= 40 且 < 70 为中等风险
            "low": 20,         # >= 20 且 < 40 为低风险
            # < 20 为 info
        })
        
        # 证据来源类型映射
        self.source_type_map = self.config.get("source_type_map", {
            "robot": "robot",
            "机器人": "robot",
            "human": "human",
            "人工": "human",
            "auto": "auto",
            "自动": "auto",
        })
    
    def score_defects(self, merge_result: MergeResult) -> ScoringResult:
        """
        对所有合并后的缺陷进行评分
        """
        result = ScoringResult()
        scored_defects = []
        
        # 评分合并后的缺陷
        for merged_defect in merge_result.merged_defects:
            risk_score = self._score_merged_defect(merged_defect)
            scored_defects.append(risk_score)
        
        # 评分唯一缺陷
        for unique_defect in merge_result.unique_defects:
            risk_score = self._score_unique_defect(unique_defect)
            scored_defects.append(risk_score)
        
        result.scored_defects = scored_defects
        result.total_defects = len(scored_defects)
        
        # 按风险等级统计
        for risk_level in RiskLevel:
            count = sum(1 for s in scored_defects if s.risk_level == risk_level)
            result.by_risk_level[risk_level.value] = count
        
        # 生成统计信息
        result.statistics = self._generate_statistics(scored_defects)
        
        return result
    
    def _score_merged_defect(self, merged_defect: MergedDefect) -> RiskScore:
        """
        评分合并后的缺陷
        """
        score_breakdown = {}
        
        # 1. 严重程度评分
        severity = merged_defect.severity
        severity_score = self._get_severity_score(severity)
        score_breakdown["severity"] = severity_score * self.weights["severity"]
        
        # 2. 缺陷类型评分
        defect_type = merged_defect.defect_type
        type_score = self._get_type_score(defect_type)
        score_breakdown["defect_type"] = type_score * self.weights["defect_type"]
        
        # 3. 证据数量评分（多来源可信度更高）
        source_count = merged_defect.get_source_count()
        package_count = merged_defect.get_package_count()
        evidence_score = self._get_evidence_score(source_count, package_count)
        score_breakdown["evidence_count"] = evidence_score * self.weights["evidence_count"]
        
        # 4. 时间新鲜度评分（越新发现的缺陷越重要）
        freshness_score = self._get_freshness_score(
            merged_defect.earliest_timestamp,
            merged_defect.latest_timestamp
        )
        score_breakdown["time_freshness"] = freshness_score * self.weights["time_freshness"]
        
        # 计算总分
        total_score = sum(score_breakdown.values())
        
        # 确定风险等级
        risk_level = self._determine_risk_level(total_score)
        
        # 收集证据来源
        evidence_sources = self._extract_evidence_sources(merged_defect)
        
        return RiskScore(
            merged_id=merged_defect.merged_id,
            risk_level=risk_level,
            total_score=round(total_score, 2),
            score_breakdown={k: round(v, 2) for k, v in score_breakdown.items()},
            # 缺陷基本信息
            defect_type=merged_defect.defect_type,
            primary_mileage=merged_defect.primary_mileage,
            min_mileage=merged_defect.min_mileage,
            max_mileage=merged_defect.max_mileage,
            description=merged_defect.description,
            # 证据来源
            evidence_sources=evidence_sources,
            source_count=len(evidence_sources),
            unique_packages=len(merged_defect.source_packages),
            # 时间信息
            first_seen=merged_defect.earliest_timestamp,
            last_seen=merged_defect.latest_timestamp
        )
    
    def _score_unique_defect(self, defect: Dict[str, Any]) -> RiskScore:
        """
        评分唯一缺陷（没有被合并的缺陷）
        """
        score_breakdown = {}
        
        # 1. 严重程度评分
        severity = defect.get("severity")
        severity_score = self._get_severity_score(severity)
        score_breakdown["severity"] = severity_score * self.weights["severity"]
        
        # 2. 缺陷类型评分
        defect_type = defect.get("_normalized_type", defect.get("defect_type", "unknown"))
        type_score = self._get_type_score(defect_type)
        score_breakdown["defect_type"] = type_score * self.weights["defect_type"]
        
        # 3. 证据数量评分（唯一缺陷通常只有一个来源）
        evidence_score = self._get_evidence_score(1, 1)
        score_breakdown["evidence_count"] = evidence_score * self.weights["evidence_count"]
        
        # 4. 时间新鲜度评分
        timestamp = defect.get("timestamp")
        freshness_score = self._get_freshness_score(timestamp, timestamp)
        score_breakdown["time_freshness"] = freshness_score * self.weights["time_freshness"]
        
        # 计算总分
        total_score = sum(score_breakdown.values())
        
        # 确定风险等级
        risk_level = self._determine_risk_level(total_score)
        
        # 收集证据来源
        evidence_sources = []
        package_name = defect.get("_package_name", "unknown")
        source = EvidenceSource(
            package_name=package_name,
            defect_id=defect.get("defect_id"),
            source_type=self._infer_source_type(defect),
            timestamp=defect.get("timestamp"),
            mileage=defect.get("mileage")
        )
        evidence_sources.append(source)
        
        # 生成merged_id
        mileage = defect.get("mileage", 0)
        segment = defect.get("_pipe_segment", "unknown")
        merged_id = f"unique_{segment}_{defect_type}_{int(mileage)}"
        
        # 获取缺陷基本信息
        mileage = defect.get("mileage", 0) if isinstance(defect.get("mileage"), (int, float)) else 0
        description = defect.get("description", "")
        
        return RiskScore(
            merged_id=merged_id,
            risk_level=risk_level,
            total_score=round(total_score, 2),
            score_breakdown={k: round(v, 2) for k, v in score_breakdown.items()},
            # 缺陷基本信息
            defect_type=defect_type,
            primary_mileage=mileage,
            min_mileage=mileage,
            max_mileage=mileage,
            description=description,
            # 证据来源
            evidence_sources=evidence_sources,
            source_count=1,
            unique_packages=1,
            # 时间信息
            first_seen=defect.get("timestamp"),
            last_seen=defect.get("timestamp")
        )
    
    def _get_severity_score(self, severity: Optional[str]) -> float:
        """
        根据严重程度获取分数
        """
        if severity is None:
            return 50.0  # 默认中等
        
        severity_lower = str(severity).lower()
        return self.severity_score.get(severity_lower, 50.0)
    
    def _get_type_score(self, defect_type: str) -> float:
        """
        根据缺陷类型获取分数
        """
        type_lower = str(defect_type).lower()
        return self.type_risk.get(type_lower, self.type_risk.get("unknown", 50.0))
    
    def _get_evidence_score(self, source_count: int, package_count: int) -> float:
        """
        根据证据数量获取分数
        多来源、多巡检包的证据可信度更高
        """
        # 基础分
        base_score = 40.0
        
        # 来源数量加分
        source_bonus = min(source_count * 10, 30)  # 最多加30分
        
        # 多巡检包加分（不同机器人发现的同一缺陷，可信度更高）
        package_bonus = 0
        if package_count > 1:
            package_bonus = min((package_count - 1) * 15, 30)  # 最多加30分
        
        return min(base_score + source_bonus + package_bonus, 100.0)
    
    def _get_freshness_score(
        self, 
        earliest: Optional[float], 
        latest: Optional[float]
    ) -> float:
        """
        根据时间新鲜度获取分数
        最近发现的缺陷分数更高
        """
        now = datetime.now().timestamp()
        
        # 使用最新发现时间
        ref_time = latest if latest is not None else earliest
        
        if ref_time is None:
            return 50.0  # 默认中等
        
        # 计算时间差（天）
        days_ago = (now - ref_time) / (24 * 60 * 60)
        
        # 时间越近分数越高
        if days_ago < 1:  # 1天内
            return 100.0
        elif days_ago < 7:  # 1周内
            return 90.0
        elif days_ago < 30:  # 1个月内
            return 70.0
        elif days_ago < 90:  # 3个月内
            return 50.0
        elif days_ago < 180:  # 6个月内
            return 30.0
        else:  # 超过6个月
            return 10.0
    
    def _determine_risk_level(self, score: float) -> RiskLevel:
        """
        根据分数确定风险等级
        """
        if score >= self.risk_thresholds["critical"]:
            return RiskLevel.CRITICAL
        elif score >= self.risk_thresholds["high"]:
            return RiskLevel.HIGH
        elif score >= self.risk_thresholds["medium"]:
            return RiskLevel.MEDIUM
        elif score >= self.risk_thresholds["low"]:
            return RiskLevel.LOW
        else:
            return RiskLevel.INFO
    
    def _extract_evidence_sources(self, merged_defect: MergedDefect) -> List[EvidenceSource]:
        """
        从合并的缺陷中提取证据来源
        """
        sources = []
        
        for source_info in merged_defect.sources:
            package_name = source_info.get("package_name", "unknown")
            
            # 推断来源类型
            source_type = self._infer_source_type(source_info)
            
            source = EvidenceSource(
                package_name=package_name,
                defect_id=source_info.get("defect_id"),
                source_type=source_type,
                timestamp=source_info.get("timestamp"),
                mileage=source_info.get("mileage"),
                confidence=1.0
            )
            sources.append(source)
        
        return sources
    
    def _infer_source_type(self, data: Dict[str, Any]) -> str:
        """
        推断数据来源类型
        """
        # 尝试从source字段获取
        source = data.get("source", "")
        if source:
            source_lower = str(source).lower()
            for key, value in self.source_type_map.items():
                if key in source_lower:
                    return value
        
        # 默认认为是机器人自动检测
        return "robot"
    
    def _generate_statistics(self, scored_defects: List[RiskScore]) -> Dict[str, Any]:
        """
        生成评分统计信息
        """
        stats = {
            "average_score": 0.0,
            "max_score": 0.0,
            "min_score": 100.0,
            "score_distribution": [],
            "source_analysis": {
                "single_source": 0,
                "multi_source": 0,
                "multi_package": 0,
            }
        }
        
        if not scored_defects:
            return stats
        
        scores = [s.total_score for s in scored_defects]
        stats["average_score"] = round(sum(scores) / len(scores), 2)
        stats["max_score"] = max(scores)
        stats["min_score"] = min(scores)
        
        # 分数分布
        bins = [0, 20, 40, 60, 80, 100]
        for i in range(len(bins) - 1):
            low, high = bins[i], bins[i + 1]
            count = sum(1 for s in scores if low <= s < high)
            stats["score_distribution"].append({
                "range": f"{low}-{high}",
                "count": count
            })
        
        # 来源分析
        for defect in scored_defects:
            if defect.source_count == 1:
                stats["source_analysis"]["single_source"] += 1
            else:
                stats["source_analysis"]["multi_source"] += 1
            
            if defect.unique_packages > 1:
                stats["source_analysis"]["multi_package"] += 1
        
        return stats
