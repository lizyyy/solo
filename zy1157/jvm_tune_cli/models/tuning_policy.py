"""
Tuning Policy and Result data models
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List

from .gc_event import GCEventType
from .jvm_options import GCCollector


class RiskLevel(Enum):
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"
    INFO = "Info"


class RecommendationType(Enum):
    GC_COLLECTOR = "GCCollector"
    HEAP_SIZE = "HeapSize"
    PAUSE_TARGET = "PauseTarget"
    REGION_SIZE = "RegionSize"
    YOUNG_GEN = "YoungGen"
    CONTAINER_RESERVE = "ContainerReserve"
    METASPACE = "Metaspace"
    GC_THREADS = "GCThreads"
    ADVANCED = "Advanced"


@dataclass
class TuningPolicy:
    name: str = "default"
    version: str = "1.0"
    
    risk_thresholds: Dict[str, Any] = field(default_factory=dict)
    slo_config: Dict[str, Any] = field(default_factory=dict)
    policies: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        if not self.risk_thresholds:
            self.risk_thresholds = self._default_thresholds()
        if not self.slo_config:
            self.slo_config = self._default_slo()
        if not self.policies:
            self.policies = self._default_policies()
    
    def _default_thresholds(self) -> Dict[str, Any]:
        return {
            'full_gc_count': {
                'critical': 10,
                'high': 5,
                'medium': 2,
                'low': 0
            },
            'pause_time_ms': {
                'critical': 500,
                'high': 300,
                'medium': 200,
                'low': 100
            },
            'memory_usage_percent': {
                'critical': 95,
                'high': 90,
                'medium': 80,
                'low': 70
            },
            'gc_overhead_percent': {
                'critical': 20,
                'high': 15,
                'medium': 10,
                'low': 5
            },
            'humongous_count': {
                'critical': 50,
                'high': 20,
                'medium': 10,
                'low': 5
            },
            'promotion_failure_count': {
                'critical': 10,
                'high': 5,
                'medium': 2,
                'low': 1
            }
        }
    
    def _default_slo(self) -> Dict[str, Any]:
        return {
            'max_pause_ms': 200,
            'max_gc_overhead_percent': 10,
            'max_full_gc_per_hour': 1,
            'memory_headroom_min_percent': 15
        }
    
    def _default_policies(self) -> Dict[str, Any]:
        return {
            'containerReserve': {
                'recommended_reserve_percent': 20,
                'min_reserve_percent': 15,
                'max_heap_ratio': 0.75
            },
            'youngGen': {
                'min_percent': 20,
                'max_percent': 60,
                'recommended_percent': 30
            },
            'g1Specific': {
                'min_region_size_mb': 1,
                'max_region_size_mb': 32,
                'recommended_ihop_percent': 45,
                'recommended_reserve_percent': 15
            },
            'zgcSpecific': {
                'recommended_pause_ms': 200,
                'large_page_enabled': True
            }
        }
    
    def get_risk_level(self, metric: str, value: float) -> RiskLevel:
        thresholds = self.risk_thresholds.get(metric, {})
        
        critical = thresholds.get('critical', float('inf'))
        high = thresholds.get('high', float('inf'))
        medium = thresholds.get('medium', float('inf'))
        low = thresholds.get('low', float('inf'))
        
        if value >= critical:
            return RiskLevel.CRITICAL
        elif value >= high:
            return RiskLevel.HIGH
        elif value >= medium:
            return RiskLevel.MEDIUM
        elif value >= low:
            return RiskLevel.LOW
        return RiskLevel.INFO
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "version": self.version,
            "risk_thresholds": self.risk_thresholds,
            "slo_config": self.slo_config,
            "policies": self.policies
        }


@dataclass
class TuningParameter:
    name: str
    current_value: Optional[Any]
    recommended_value: Optional[Any]
    unit: str = ""
    description: str = ""
    
    @property
    def needs_change(self) -> bool:
        return self.current_value != self.recommended_value
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "current_value": self.current_value,
            "recommended_value": self.recommended_value,
            "unit": self.unit,
            "description": self.description,
            "needs_change": self.needs_change
        }


@dataclass
class TuningRecommendation:
    id: str
    type: RecommendationType
    risk_level: RiskLevel
    priority: int
    
    title: str
    description: str
    root_cause: str
    impact: str
    
    current_config: str
    recommended_config: str
    
    parameters: List[TuningParameter] = field(default_factory=list)
    references: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type.value,
            "risk_level": self.risk_level.value,
            "priority": self.priority,
            "title": self.title,
            "description": self.description,
            "root_cause": self.root_cause,
            "impact": self.impact,
            "current_config": self.current_config,
            "recommended_config": self.recommended_config,
            "parameters": [p.to_dict() for p in self.parameters],
            "references": self.references
        }


@dataclass
class SimulationResult:
    scenario_name: str
    target_gc_collector: GCCollector
    
    simulated_pause_ms_p50: float
    simulated_pause_ms_p95: float
    simulated_pause_ms_p99: float
    simulated_max_pause_ms: float
    
    simulated_throughput: float
    simulated_heap_usage_percent: float
    
    expected_full_gc_count: int
    expected_humongous_allocations: int
    expected_promotion_failures: int
    
    is_slo_violation_expected: bool
    
    parameters: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "scenario_name": self.scenario_name,
            "target_gc_collector": self.target_gc_collector.value,
            "simulated_pause_ms_p50": round(self.simulated_pause_ms_p50, 2),
            "simulated_pause_ms_p95": round(self.simulated_pause_ms_p95, 2),
            "simulated_pause_ms_p99": round(self.simulated_pause_ms_p99, 2),
            "simulated_max_pause_ms": round(self.simulated_max_pause_ms, 2),
            "simulated_throughput": round(self.simulated_throughput, 2),
            "simulated_heap_usage_percent": round(self.simulated_heap_usage_percent, 2),
            "expected_full_gc_count": self.expected_full_gc_count,
            "expected_humongous_allocations": self.expected_humongous_allocations,
            "expected_promotion_failures": self.expected_promotion_failures,
            "is_slo_violation_expected": self.is_slo_violation_expected,
            "parameters": self.parameters
        }


@dataclass
class TuningResult:
    timestamp: datetime
    original_jvm_options: Dict[str, Any]
    recommended_jvm_options: Dict[str, Any]
    
    recommendations: List[TuningRecommendation] = field(default_factory=list)
    simulations: List[SimulationResult] = field(default_factory=list)
    
    container_memory_reserve_recommendation: Optional[Dict[str, Any]] = None
    
    summary: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "original_jvm_options": self.original_jvm_options,
            "recommended_jvm_options": self.recommended_jvm_options,
            "recommendations": [r.to_dict() for r in self.recommendations],
            "simulations": [s.to_dict() for s in self.simulations],
            "container_memory_reserve_recommendation": self.container_memory_reserve_recommendation,
            "summary": self.summary
        }
