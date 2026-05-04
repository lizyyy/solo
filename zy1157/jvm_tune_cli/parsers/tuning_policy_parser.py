"""
Tuning Policies YAML Parser
"""

import yaml
from typing import Dict, Any, List, Optional
import logging

from ..models.tuning_policy import (
    RiskLevel, RecommendationType, TuningParameter, TuningRecommendation
)

logger = logging.getLogger(__name__)


class TuningPolicyParser:
    def __init__(self):
        self.policies: Dict[str, Any] = {}
        self.risk_thresholds: Dict[str, Any] = {}
        self.slo_config: Dict[str, Any] = {}
    
    def parse_file(self, filepath: str) -> Dict[str, Any]:
        self.policies = {}
        self.risk_thresholds = {}
        self.slo_config = {}
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        if data:
            self.policies = data.get('policies', {})
            self.risk_thresholds = data.get('riskThresholds', self._default_thresholds())
            self.slo_config = data.get('sloConfig', self._default_slo())
        
        return {
            'policies': self.policies,
            'risk_thresholds': self.risk_thresholds,
            'slo_config': self.slo_config
        }
    
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
    
    def create_recommendation(
        self,
        rec_id: str,
        rec_type: RecommendationType,
        risk_level: RiskLevel,
        priority: int,
        title: str,
        description: str,
        root_cause: str,
        impact: str,
        current_config: str,
        recommended_config: str,
        parameters: List[TuningParameter] = None
    ) -> TuningRecommendation:
        return TuningRecommendation(
            id=rec_id,
            type=rec_type,
            risk_level=risk_level,
            priority=priority,
            title=title,
            description=description,
            root_cause=root_cause,
            impact=impact,
            current_config=current_config,
            recommended_config=recommended_config,
            parameters=parameters or []
        )
    
    def create_parameter(
        self,
        name: str,
        current_value: Any,
        recommended_value: Any,
        unit: str = "",
        description: str = ""
    ) -> TuningParameter:
        return TuningParameter(
            name=name,
            current_value=current_value,
            recommended_value=recommended_value,
            unit=unit,
            description=description
        )
    
    def get_container_reserve_policy(self) -> Dict[str, Any]:
        return self.policies.get('containerReserve', {
            'recommended_reserve_percent': 20,
            'min_reserve_percent': 15,
            'max_heap_ratio': 0.75
        })
    
    def get_young_gen_policy(self) -> Dict[str, Any]:
        return self.policies.get('youngGen', {
            'min_percent': 20,
            'max_percent': 60,
            'recommended_percent': 30
        })
    
    def get_g1_specific_policy(self) -> Dict[str, Any]:
        return self.policies.get('g1Specific', {
            'min_region_size_mb': 1,
            'max_region_size_mb': 32,
            'recommended_ihop_percent': 45,
            'recommended_reserve_percent': 15
        })
    
    def get_zgc_specific_policy(self) -> Dict[str, Any]:
        return self.policies.get('zgcSpecific', {
            'recommended_pause_ms': 200,
            'large_page_enabled': True
        })
