"""存储数据模型"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from rov_tension_checker.analysis.risk_engine import RiskEvent, RiskAnalysisResult


@dataclass
class AnalysisSampleRecord:
    sample_index: int
    timestamp: datetime
    
    vessel_latitude: Optional[float] = None
    vessel_longitude: Optional[float] = None
    vessel_x: Optional[float] = None
    vessel_y: Optional[float] = None
    vessel_heading: Optional[float] = None
    
    rov_depth: Optional[float] = None
    rov_cable_length: Optional[float] = None
    rov_thrust_forward: Optional[float] = None
    rov_thrust_vertical: Optional[float] = None
    
    current_speed: Optional[float] = None
    current_direction: Optional[float] = None
    
    horizontal_offset: Optional[float] = None
    top_tension: Optional[float] = None
    bottom_tension: Optional[float] = None
    tension_ratio: Optional[float] = None
    safety_margin: Optional[float] = None
    
    minimum_bending_radius: Optional[float] = None
    bending_radius_location: Optional[str] = None
    
    top_angle: Optional[float] = None
    bottom_angle: Optional[float] = None
    
    risks: List[RiskEvent] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample_index": self.sample_index,
            "timestamp": self.timestamp.isoformat(),
            "vessel_latitude": self.vessel_latitude,
            "vessel_longitude": self.vessel_longitude,
            "vessel_x": self.vessel_x,
            "vessel_y": self.vessel_y,
            "vessel_heading": self.vessel_heading,
            "rov_depth": self.rov_depth,
            "rov_cable_length": self.rov_cable_length,
            "rov_thrust_forward": self.rov_thrust_forward,
            "rov_thrust_vertical": self.rov_thrust_vertical,
            "current_speed": self.current_speed,
            "current_direction": self.current_direction,
            "horizontal_offset": self.horizontal_offset,
            "top_tension": self.top_tension,
            "bottom_tension": self.bottom_tension,
            "tension_ratio": self.tension_ratio,
            "safety_margin": self.safety_margin,
            "minimum_bending_radius": self.minimum_bending_radius,
            "bending_radius_location": self.bending_radius_location,
            "top_angle": self.top_angle,
            "bottom_angle": self.bottom_angle,
            "risks": [r.to_dict() for r in self.risks]
        }


@dataclass
class AnalysisRecord:
    analysis_id: str
    project_name: str
    pipeline_id: str
    survey_date: datetime
    created_at: datetime
    
    sample_count: int
    critical_risk_count: int
    warning_risk_count: int
    
    risk_summary: Dict[str, int] = field(default_factory=dict)
    
    max_top_tension: Optional[float] = None
    min_top_tension: Optional[float] = None
    avg_top_tension: Optional[float] = None
    
    min_bending_radius: Optional[float] = None
    min_bending_radius_location: Optional[str] = None
    
    min_cable_length: Optional[float] = None
    max_cable_length: Optional[float] = None
    avg_cable_length: Optional[float] = None
    
    max_depth: Optional[float] = None
    min_depth: Optional[float] = None
    avg_depth: Optional[float] = None
    
    max_current_speed: Optional[float] = None
    avg_current_speed: Optional[float] = None
    
    max_horizontal_offset: Optional[float] = None
    avg_horizontal_offset: Optional[float] = None
    
    samples: List[AnalysisSampleRecord] = field(default_factory=list)
    
    config_snapshot: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "analysis_id": self.analysis_id,
            "project_name": self.project_name,
            "pipeline_id": self.pipeline_id,
            "survey_date": self.survey_date.isoformat(),
            "created_at": self.created_at.isoformat(),
            "sample_count": self.sample_count,
            "critical_risk_count": self.critical_risk_count,
            "warning_risk_count": self.warning_risk_count,
            "risk_summary": self.risk_summary,
            "max_top_tension": self.max_top_tension,
            "min_top_tension": self.min_top_tension,
            "avg_top_tension": self.avg_top_tension,
            "min_bending_radius": self.min_bending_radius,
            "min_bending_radius_location": self.min_bending_radius_location,
            "min_cable_length": self.min_cable_length,
            "max_cable_length": self.max_cable_length,
            "avg_cable_length": self.avg_cable_length,
            "max_depth": self.max_depth,
            "min_depth": self.min_depth,
            "avg_depth": self.avg_depth,
            "max_current_speed": self.max_current_speed,
            "avg_current_speed": self.avg_current_speed,
            "max_horizontal_offset": self.max_horizontal_offset,
            "avg_horizontal_offset": self.avg_horizontal_offset,
            "samples": [s.to_dict() for s in self.samples],
            "config_snapshot": self.config_snapshot
        }


@dataclass
class ScenarioRecord:
    scenario_id: str
    analysis_id: str
    scenario_name: str
    created_at: datetime
    
    modifications: List[Dict[str, Any]] = field(default_factory=list)
    
    original_top_tension: Optional[float] = None
    scenario_top_tension: Optional[float] = None
    original_bending_radius: Optional[float] = None
    scenario_bending_radius: Optional[float] = None
    
    original_critical_count: int = 0
    scenario_critical_count: int = 0
    original_warning_count: int = 0
    scenario_warning_count: int = 0
    
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "scenario_id": self.scenario_id,
            "analysis_id": self.analysis_id,
            "scenario_name": self.scenario_name,
            "created_at": self.created_at.isoformat(),
            "modifications": self.modifications,
            "original_top_tension": self.original_top_tension,
            "scenario_top_tension": self.scenario_top_tension,
            "original_bending_radius": self.original_bending_radius,
            "scenario_bending_radius": self.scenario_bending_radius,
            "original_critical_count": self.original_critical_count,
            "scenario_critical_count": self.scenario_critical_count,
            "original_warning_count": self.original_warning_count,
            "scenario_warning_count": self.scenario_warning_count,
            "details": self.details
        }


@dataclass
class HistoryIndex:
    version: str = "1.0"
    analyses: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": self.version,
            "analyses": self.analyses
        }
