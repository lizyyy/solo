"""场景推演模块"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from rov_tension_checker.analysis.alignment import AlignedSample
from rov_tension_checker.analysis.bending import BendingCalculationResult, BendingRadiusCalculator
from rov_tension_checker.analysis.risk_engine import RiskAnalysisResult, RiskEngine
from rov_tension_checker.analysis.tension import TensionCalculationResult, TensionCalculator
from rov_tension_checker.config.models import CableSpec, ROVSpec, RiskThresholds


class ScenarioModificationType(Enum):
    CURRENT_SPEED = "current_speed"
    CURRENT_DIRECTION = "current_direction"
    CABLE_LENGTH = "cable_length"
    ROV_DEPTH = "rov_depth"
    THRUST_FORWARD = "thrust_forward"
    THRUST_VERTICAL = "thrust_vertical"
    HORIZONTAL_OFFSET = "horizontal_offset"


@dataclass
class ScenarioModification:
    modification_type: ScenarioModificationType
    target_value: float
    is_absolute: bool = True
    sample_index: Optional[int] = None
    
    def apply(self, sample: AlignedSample, original_value: Optional[float]) -> float:
        if self.is_absolute:
            return self.target_value
        else:
            if original_value is None:
                return self.target_value
            return original_value + self.target_value


@dataclass
class ScenarioResult:
    scenario_name: str
    created_at: datetime
    modifications: List[ScenarioModification]
    
    original_top_tension: Optional[float] = None
    scenario_top_tension: Optional[float] = None
    original_bottom_tension: Optional[float] = None
    scenario_bottom_tension: Optional[float] = None
    original_min_bending_radius: Optional[float] = None
    scenario_min_bending_radius: Optional[float] = None
    original_risks: Optional[RiskAnalysisResult] = None
    scenario_risks: Optional[RiskAnalysisResult] = None
    
    details: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def tension_change_percent(self) -> float:
        if self.original_top_tension and self.original_top_tension > 0:
            return ((self.scenario_top_tension or 0) - self.original_top_tension) / self.original_top_tension * 100
        return 0.0
    
    @property
    def bending_radius_change_percent(self) -> float:
        if self.original_min_bending_radius and self.original_min_bending_radius > 0:
            return ((self.scenario_min_bending_radius or 0) - self.original_min_bending_radius) / self.original_min_bending_radius * 100
        return 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "scenario_name": self.scenario_name,
            "created_at": self.created_at.isoformat(),
            "modifications": [
                {
                    "type": m.modification_type.value,
                    "target_value": m.target_value,
                    "is_absolute": m.is_absolute,
                    "sample_index": m.sample_index
                }
                for m in self.modifications
            ],
            "original_top_tension": self.original_top_tension,
            "scenario_top_tension": self.scenario_top_tension,
            "original_bottom_tension": self.original_bottom_tension,
            "scenario_bottom_tension": self.scenario_bottom_tension,
            "original_min_bending_radius": self.original_min_bending_radius,
            "scenario_min_bending_radius": self.scenario_min_bending_radius,
            "tension_change_percent": self.tension_change_percent,
            "bending_radius_change_percent": self.bending_radius_change_percent,
            "details": self.details
        }


class ScenarioSimulator:
    def __init__(
        self,
        cable_spec: CableSpec,
        rov_spec: ROVSpec,
        thresholds: Optional[RiskThresholds] = None
    ):
        self.cable_spec = cable_spec
        self.rov_spec = rov_spec
        self.thresholds = thresholds or RiskThresholds()
        
        self.tension_calc = TensionCalculator(cable_spec, rov_spec, thresholds)
        self.bending_calc = BendingRadiusCalculator(cable_spec)
        self.risk_engine = RiskEngine(thresholds)
    
    def _create_modified_sample(
        self,
        original_sample: AlignedSample,
        modifications: List[ScenarioModification]
    ) -> AlignedSample:
        modified = AlignedSample(
            timestamp=original_sample.timestamp,
            reference_latitude=original_sample.reference_latitude,
            reference_longitude=original_sample.reference_longitude
        )
        
        modified.vessel_latitude = original_sample.vessel_latitude
        modified.vessel_longitude = original_sample.vessel_longitude
        modified.vessel_x = original_sample.vessel_x
        modified.vessel_y = original_sample.vessel_y
        modified.vessel_heading = original_sample.vessel_heading
        modified.vessel_speed = original_sample.vessel_speed
        
        modified.rov_depth = original_sample.rov_depth
        modified.rov_cable_length = original_sample.rov_cable_length
        modified.rov_heading = original_sample.rov_heading
        modified.rov_thrust_forward = original_sample.rov_thrust_forward
        modified.rov_thrust_vertical = original_sample.rov_thrust_vertical
        modified.rov_altitude = original_sample.rov_altitude
        
        modified.current_speed = original_sample.current_speed
        modified.current_direction = original_sample.current_direction
        
        for mod in modifications:
            if mod.sample_index is not None:
                continue
            
            if mod.modification_type == ScenarioModificationType.CABLE_LENGTH:
                modified.rov_cable_length = mod.apply(
                    original_sample, original_sample.rov_cable_length
                )
            elif mod.modification_type == ScenarioModificationType.ROV_DEPTH:
                modified.rov_depth = mod.apply(
                    original_sample, original_sample.rov_depth
                )
            elif mod.modification_type == ScenarioModificationType.CURRENT_SPEED:
                modified.current_speed = mod.apply(
                    original_sample, original_sample.current_speed
                )
            elif mod.modification_type == ScenarioModificationType.CURRENT_DIRECTION:
                modified.current_direction = mod.apply(
                    original_sample, original_sample.current_direction
                )
            elif mod.modification_type == ScenarioModificationType.THRUST_FORWARD:
                modified.rov_thrust_forward = mod.apply(
                    original_sample, original_sample.rov_thrust_forward
                )
            elif mod.modification_type == ScenarioModificationType.THRUST_VERTICAL:
                modified.rov_thrust_vertical = mod.apply(
                    original_sample, original_sample.rov_thrust_vertical
                )
        
        return modified
    
    def simulate_single_sample(
        self,
        sample: AlignedSample,
        modifications: List[ScenarioModification],
        horizontal_offset: Optional[float] = None
    ) -> tuple[Optional[TensionCalculationResult], Optional[BendingCalculationResult]]:
        modified_sample = self._create_modified_sample(sample, modifications)
        
        if horizontal_offset is None:
            if modified_sample.rov_cable_length and modified_sample.rov_depth:
                horizontal_offset = self.tension_calc.estimate_horizontal_offset(
                    modified_sample.rov_cable_length,
                    modified_sample.rov_depth
                )
            else:
                horizontal_offset = 0.0
        
        if modified_sample.rov_cable_length is None or modified_sample.rov_depth is None:
            return None, None
        
        tension_result = self.tension_calc.calculate(
            cable_length=modified_sample.rov_cable_length,
            rov_depth=modified_sample.rov_depth,
            horizontal_offset=horizontal_offset,
            rov_thrust_forward=modified_sample.rov_thrust_forward,
            rov_thrust_vertical=modified_sample.rov_thrust_vertical,
            current_speed=modified_sample.current_speed
        )
        
        bending_result = None
        if tension_result.catenary_result:
            bending_result = self.bending_calc.calculate_from_catenary(
                tension_result.catenary_result
            )
            bending_result = self.bending_calc.check_criticality(
                bending_result,
                warning_ratio=self.thresholds.bending_radius_warning_ratio,
                critical_ratio=self.thresholds.bending_radius_critical_ratio
            )
        
        return tension_result, bending_result
    
    def simulate_single_point(
        self,
        sample: AlignedSample,
        modifications: List[ScenarioModification],
        scenario_name: str,
        horizontal_offset: Optional[float] = None,
        original_tension_result: Optional[TensionCalculationResult] = None,
        original_bending_result: Optional[BendingCalculationResult] = None
    ) -> ScenarioResult:
        tension_result, bending_result = self.simulate_single_sample(
            sample, modifications, horizontal_offset
        )
        
        result = ScenarioResult(
            scenario_name=scenario_name,
            created_at=datetime.now(),
            modifications=modifications
        )
        
        if original_tension_result:
            result.original_top_tension = original_tension_result.top_tension
            result.original_bottom_tension = original_tension_result.bottom_tension
        
        if original_bending_result:
            result.original_min_bending_radius = original_bending_result.minimum_radius
        
        if tension_result:
            result.scenario_top_tension = tension_result.top_tension
            result.scenario_bottom_tension = tension_result.bottom_tension
        
        if bending_result:
            result.scenario_min_bending_radius = bending_result.minimum_radius
        
        result.details = {
            "sample_timestamp": sample.timestamp.isoformat(),
            "original_cable_length": sample.rov_cable_length,
            "original_depth": sample.rov_depth,
            "original_current_speed": sample.current_speed,
            "horizontal_offset": horizontal_offset
        }
        
        return result
    
    def compare_scenarios(
        self,
        original_samples: List[AlignedSample],
        original_tensions: List[Optional[TensionCalculationResult]],
        original_bendings: List[Optional[BendingCalculationResult]],
        original_offsets: List[Optional[float]],
        modifications: List[ScenarioModification],
        scenario_name: str,
        time_step: float = 1.0
    ) -> ScenarioResult:
        scenario_tensions: List[Optional[TensionCalculationResult]] = []
        scenario_bendings: List[Optional[BendingCalculationResult]] = []
        scenario_offsets: List[Optional[float]] = []
        
        for i, sample in enumerate(original_samples):
            offset = original_offsets[i] if i < len(original_offsets) else None
            tension, bending = self.simulate_single_sample(
                sample, modifications, offset
            )
            scenario_tensions.append(tension)
            scenario_bendings.append(bending)
            scenario_offsets.append(offset)
        
        avg_original_tension = 0.0
        avg_scenario_tension = 0.0
        avg_original_bending = 0.0
        avg_scenario_bending = 0.0
        count = 0
        
        for i in range(len(original_samples)):
            orig_t = original_tensions[i] if i < len(original_tensions) else None
            scen_t = scenario_tensions[i] if i < len(scenario_tensions) else None
            orig_b = original_bendings[i] if i < len(original_bendings) else None
            scen_b = scenario_bendings[i] if i < len(scenario_bendings) else None
            
            if orig_t and scen_t:
                avg_original_tension += orig_t.top_tension
                avg_scenario_tension += scen_t.top_tension
                if orig_b and scen_b:
                    avg_original_bending += orig_b.minimum_radius
                    avg_scenario_bending += scen_b.minimum_radius
                count += 1
        
        if count > 0:
            avg_original_tension /= count
            avg_scenario_tension /= count
            avg_original_bending /= count
            avg_scenario_bending /= count
        else:
            avg_original_tension = None
            avg_scenario_tension = None
            avg_original_bending = None
            avg_scenario_bending = None
        
        scenario_risks = self.risk_engine.analyze_all(
            samples=original_samples,
            tension_results=scenario_tensions,
            bending_results=scenario_bendings,
            horizontal_offsets=scenario_offsets,
            time_step=time_step,
            min_bending_radius_spec=self.cable_spec.min_bending_radius
        )
        
        original_risks = self.risk_engine.analyze_all(
            samples=original_samples,
            tension_results=original_tensions,
            bending_results=original_bendings,
            horizontal_offsets=original_offsets,
            time_step=time_step,
            min_bending_radius_spec=self.cable_spec.min_bending_radius
        )
        
        result = ScenarioResult(
            scenario_name=scenario_name,
            created_at=datetime.now(),
            modifications=modifications,
            original_top_tension=avg_original_tension,
            scenario_top_tension=avg_scenario_tension,
            original_min_bending_radius=avg_original_bending,
            scenario_min_bending_radius=avg_scenario_bending,
            original_risks=original_risks,
            scenario_risks=scenario_risks
        )
        
        result.details = {
            "total_samples": len(original_samples),
            "analyzed_samples": count,
            "original_risk_summary": original_risks.summary,
            "scenario_risk_summary": scenario_risks.summary,
            "original_critical_count": original_risks.critical_count,
            "scenario_critical_count": scenario_risks.critical_count,
            "original_warning_count": original_risks.warning_count,
            "scenario_warning_count": scenario_risks.warning_count
        }
        
        return result
    
    def create_modification(
        self,
        mod_type: str,
        value: float,
        is_absolute: bool = True
    ) -> ScenarioModification:
        type_map = {
            "current_speed": ScenarioModificationType.CURRENT_SPEED,
            "current_direction": ScenarioModificationType.CURRENT_DIRECTION,
            "cable_length": ScenarioModificationType.CABLE_LENGTH,
            "cable_len": ScenarioModificationType.CABLE_LENGTH,
            "depth": ScenarioModificationType.ROV_DEPTH,
            "rov_depth": ScenarioModificationType.ROV_DEPTH,
            "thrust_forward": ScenarioModificationType.THRUST_FORWARD,
            "thrust_h": ScenarioModificationType.THRUST_FORWARD,
            "thrust_vertical": ScenarioModificationType.THRUST_VERTICAL,
            "thrust_v": ScenarioModificationType.THRUST_VERTICAL,
            "horizontal_offset": ScenarioModificationType.HORIZONTAL_OFFSET,
            "offset": ScenarioModificationType.HORIZONTAL_OFFSET,
        }
        
        mod_enum = type_map.get(mod_type.lower())
        if mod_enum is None:
            raise ValueError(f"未知的修改类型: {mod_type}")
        
        return ScenarioModification(
            modification_type=mod_enum,
            target_value=value,
            is_absolute=is_absolute
        )
