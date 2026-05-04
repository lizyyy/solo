"""
Analysis Result data models
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List

from .tuning_policy import RiskLevel


class RiskCategory(Enum):
    FULL_GC = "FullGC"
    PROMOTION_FAILURE = "PromotionFailure"
    HUMONGOUS_ALLOCATION = "HumongousAllocation"
    PAUSE_SLO_VIOLATION = "PauseSLOViolation"
    PARAMETER_CONFLICT = "ParameterConflict"
    OOM_RISK = "OOMRisk"
    METASPACE_ISSUE = "MetaspaceIssue"
    CONTAINER_MISMATCH = "ContainerMismatch"


@dataclass
class RiskFactor:
    id: str
    category: RiskCategory
    level: RiskLevel
    
    title: str
    description: str
    evidence: str
    
    count: int = 1
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    
    related_events: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "category": self.category.value,
            "level": self.level.value,
            "title": self.title,
            "description": self.description,
            "evidence": self.evidence,
            "count": self.count,
            "first_seen": self.first_seen.isoformat() if self.first_seen else None,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
            "related_events_count": len(self.related_events)
        }


@dataclass
class GCPauseStatistics:
    total_gc_count: int
    total_pause_ms: float
    total_runtime_ms: float
    
    pause_ms_p50: float
    pause_ms_p95: float
    pause_ms_p99: float
    pause_ms_max: float
    pause_ms_mean: float
    
    throughput_percent: float
    gc_overhead_percent: float
    
    young_gc_count: int
    young_gc_total_ms: float
    full_gc_count: int
    full_gc_total_ms: float
    mixed_gc_count: int
    mixed_gc_total_ms: int
    
    humongous_allocation_count: int
    promotion_failure_count: int
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_gc_count": self.total_gc_count,
            "total_pause_ms": round(self.total_pause_ms, 2),
            "total_runtime_ms": round(self.total_runtime_ms, 2),
            "pause_ms_p50": round(self.pause_ms_p50, 2),
            "pause_ms_p95": round(self.pause_ms_p95, 2),
            "pause_ms_p99": round(self.pause_ms_p99, 2),
            "pause_ms_max": round(self.pause_ms_max, 2),
            "pause_ms_mean": round(self.pause_ms_mean, 2),
            "throughput_percent": round(self.throughput_percent, 2),
            "gc_overhead_percent": round(self.gc_overhead_percent, 2),
            "young_gc_count": self.young_gc_count,
            "young_gc_total_ms": round(self.young_gc_total_ms, 2),
            "full_gc_count": self.full_gc_count,
            "full_gc_total_ms": round(self.full_gc_total_ms, 2),
            "mixed_gc_count": self.mixed_gc_count,
            "mixed_gc_total_ms": round(self.mixed_gc_total_ms, 2),
            "humongous_allocation_count": self.humongous_allocation_count,
            "promotion_failure_count": self.promotion_failure_count
        }


@dataclass
class HeapStatistics:
    heap_max_bytes: int
    heap_peak_bytes: int
    heap_avg_bytes: int
    
    heap_usage_percent_p50: float
    heap_usage_percent_p95: float
    heap_usage_percent_p99: float
    
    young_gen_peak_bytes: int
    old_gen_peak_bytes: int
    
    avg_reclaimed_per_gc_bytes: int
    avg_reclaimed_per_gc_percent: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "heap_max_gb": round(self.heap_max_bytes / (1024**3), 2),
            "heap_peak_gb": round(self.heap_peak_bytes / (1024**3), 2),
            "heap_avg_gb": round(self.heap_avg_bytes / (1024**3), 2),
            "heap_usage_percent_p50": round(self.heap_usage_percent_p50, 2),
            "heap_usage_percent_p95": round(self.heap_usage_percent_p95, 2),
            "heap_usage_percent_p99": round(self.heap_usage_percent_p99, 2),
            "young_gen_peak_gb": round(self.young_gen_peak_bytes / (1024**3), 2),
            "old_gen_peak_gb": round(self.old_gen_peak_bytes / (1024**3), 2),
            "avg_reclaimed_per_gc_mb": round(self.avg_reclaimed_per_gc_bytes / (1024**2), 2),
            "avg_reclaimed_per_gc_percent": round(self.avg_reclaimed_per_gc_percent, 2)
        }


@dataclass
class ContainerStatistics:
    memory_limit_bytes: int
    memory_peak_bytes: int
    memory_avg_bytes: int
    
    memory_headroom_min_bytes: int
    memory_headroom_avg_bytes: int
    
    oom_kill_risk_percent: float
    
    jvm_heap_vs_container_ratio: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "memory_limit_gb": round(self.memory_limit_bytes / (1024**3), 2),
            "memory_peak_gb": round(self.memory_peak_bytes / (1024**3), 2),
            "memory_avg_gb": round(self.memory_avg_bytes / (1024**3), 2),
            "memory_headroom_min_mb": round(self.memory_headroom_min_bytes / (1024**2), 2),
            "memory_headroom_avg_mb": round(self.memory_headroom_avg_bytes / (1024**2), 2),
            "oom_kill_risk_percent": round(self.oom_kill_risk_percent, 2),
            "jvm_heap_vs_container_ratio": round(self.jvm_heap_vs_container_ratio, 2)
        }


@dataclass
class TrafficStatistics:
    peak_rps: float
    avg_rps: float
    
    peak_response_ms_p99: float
    avg_response_ms_p99: float
    
    peak_error_rate: float
    
    traffic_correlated_gc: bool
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "peak_rps": round(self.peak_rps, 2),
            "avg_rps": round(self.avg_rps, 2),
            "peak_response_ms_p99": round(self.peak_response_ms_p99, 2),
            "avg_response_ms_p99": round(self.avg_response_ms_p99, 2),
            "peak_error_rate": round(self.peak_error_rate, 4),
            "traffic_correlated_gc": self.traffic_correlated_gc
        }


@dataclass
class AnalysisResult:
    timestamp: datetime
    
    pause_stats: GCPauseStatistics
    heap_stats: HeapStatistics
    container_stats: ContainerStatistics
    traffic_stats: Optional[TrafficStatistics] = None
    
    risk_factors: List[RiskFactor] = field(default_factory=list)
    parameter_conflicts: List[Dict[str, Any]] = field(default_factory=list)
    
    summary: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "pause_stats": self.pause_stats.to_dict(),
            "heap_stats": self.heap_stats.to_dict(),
            "container_stats": self.container_stats.to_dict(),
            "traffic_stats": self.traffic_stats.to_dict() if self.traffic_stats else None,
            "risk_factors": [r.to_dict() for r in self.risk_factors],
            "parameter_conflicts": self.parameter_conflicts,
            "summary": self.summary
        }
