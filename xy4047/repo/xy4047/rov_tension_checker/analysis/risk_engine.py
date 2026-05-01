"""风险规则引擎"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

from rov_tension_checker.analysis.alignment import AlignedSample
from rov_tension_checker.analysis.bending import BendingCalculationResult
from rov_tension_checker.analysis.tension import TensionCalculationResult
from rov_tension_checker.config.models import (
    ProtectionFrame,
    RiskThresholds,
)
from rov_tension_checker.data_import.unit_converters import UnitConverter


class RiskSeverity(Enum):
    LOW = "low"
    WARNING = "warning"
    CRITICAL = "critical"


class RiskType(Enum):
    TENSION_EXCEEDED = "tension_exceeded"
    TENSION_WARNING = "tension_warning"
    BENDING_RADIUS_VIOLATION = "bending_radius_violation"
    BENDING_RADIUS_WARNING = "bending_radius_warning"
    INSUFFICIENT_CABLE = "insufficient_cable"
    ANGLE_ABRUPT_CHANGE = "angle_abrupt_change"
    CURRENT_ABRUPT_CHANGE = "current_abrupt_change"
    COLLISION_RISK = "collision_risk"
    SLACK_CABLE = "slack_cable"


@dataclass
class RiskEvent:
    risk_type: RiskType
    severity: RiskSeverity
    timestamp: datetime
    description: str
    details: Dict[str, Any]
    sample_index: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "risk_type": self.risk_type.value,
            "severity": self.severity.value,
            "timestamp": self.timestamp.isoformat(),
            "description": self.description,
            "details": self.details,
            "sample_index": self.sample_index
        }


@dataclass
class RiskAnalysisResult:
    risks: List[RiskEvent]
    summary: Dict[str, int]
    
    @property
    def critical_count(self) -> int:
        return sum(1 for r in self.risks if r.severity == RiskSeverity.CRITICAL)
    
    @property
    def warning_count(self) -> int:
        return sum(1 for r in self.risks if r.severity == RiskSeverity.WARNING)
    
    @property
    def total_count(self) -> int:
        return len(self.risks)


class RiskEngine:
    def __init__(
        self,
        thresholds: Optional[RiskThresholds] = None,
        protection_frames: Optional[List[ProtectionFrame]] = None
    ):
        self.thresholds = thresholds or RiskThresholds()
        self.protection_frames = protection_frames or []
    
    def check_tension(
        self,
        tension_result: TensionCalculationResult,
        sample: AlignedSample,
        sample_index: int
    ) -> List[RiskEvent]:
        risks: List[RiskEvent] = []
        
        if tension_result.tension_ratio >= self.thresholds.tension_critical_ratio:
            risks.append(RiskEvent(
                risk_type=RiskType.TENSION_EXCEEDED,
                severity=RiskSeverity.CRITICAL,
                timestamp=sample.timestamp,
                description=f"张力超过工作极限的 {tension_result.tension_ratio*100:.1f}%",
                details={
                    "top_tension": tension_result.top_tension,
                    "bottom_tension": tension_result.bottom_tension,
                    "tension_ratio": tension_result.tension_ratio,
                    "safety_margin": tension_result.safety_margin
                },
                sample_index=sample_index
            ))
        elif tension_result.tension_ratio >= self.thresholds.tension_warning_ratio:
            risks.append(RiskEvent(
                risk_type=RiskType.TENSION_WARNING,
                severity=RiskSeverity.WARNING,
                timestamp=sample.timestamp,
                description=f"张力接近工作极限 ({tension_result.tension_ratio*100:.1f}%)",
                details={
                    "top_tension": tension_result.top_tension,
                    "bottom_tension": tension_result.bottom_tension,
                    "tension_ratio": tension_result.tension_ratio,
                    "safety_margin": tension_result.safety_margin
                },
                sample_index=sample_index
            ))
        
        if tension_result.top_tension < self.thresholds.slack_cable_tension:
            risks.append(RiskEvent(
                risk_type=RiskType.SLACK_CABLE,
                severity=RiskSeverity.WARNING,
                timestamp=sample.timestamp,
                description="缆线张力过低，可能处于松弛状态",
                details={
                    "top_tension": tension_result.top_tension,
                    "threshold": self.thresholds.slack_cable_tension
                },
                sample_index=sample_index
            ))
        
        return risks
    
    def check_bending_radius(
        self,
        bending_result: BendingCalculationResult,
        sample: AlignedSample,
        sample_index: int,
        min_bending_radius_spec: float
    ) -> List[RiskEvent]:
        risks: List[RiskEvent] = []
        
        if min_bending_radius_spec <= 0:
            return risks
        
        radius_ratio = bending_result.minimum_radius / min_bending_radius_spec
        
        if radius_ratio <= self.thresholds.bending_radius_critical_ratio:
            risks.append(RiskEvent(
                risk_type=RiskType.BENDING_RADIUS_VIOLATION,
                severity=RiskSeverity.CRITICAL,
                timestamp=sample.timestamp,
                description=f"弯曲半径违反规范，在{bending_result.minimum_radius_location}处",
                details={
                    "minimum_radius": bending_result.minimum_radius,
                    "spec_radius": min_bending_radius_spec,
                    "ratio": radius_ratio,
                    "location": bending_result.minimum_radius_location
                },
                sample_index=sample_index
            ))
        elif radius_ratio <= self.thresholds.bending_radius_warning_ratio:
            risks.append(RiskEvent(
                risk_type=RiskType.BENDING_RADIUS_WARNING,
                severity=RiskSeverity.WARNING,
                timestamp=sample.timestamp,
                description=f"弯曲半径接近最小极限，在{bending_result.minimum_radius_location}处",
                details={
                    "minimum_radius": bending_result.minimum_radius,
                    "spec_radius": min_bending_radius_spec,
                    "ratio": radius_ratio,
                    "location": bending_result.minimum_radius_location
                },
                sample_index=sample_index
            ))
        
        return risks
    
    def check_cable_length(
        self,
        cable_length: Optional[float],
        depth: Optional[float],
        horizontal_offset: Optional[float],
        sample: AlignedSample,
        sample_index: int
    ) -> List[RiskEvent]:
        risks: List[RiskEvent] = []
        
        if cable_length is None or depth is None:
            return risks
        
        if horizontal_offset is None:
            horizontal_offset = 0
        
        min_required = depth + horizontal_offset * 0.1
        
        if cable_length < min_required * 1.05:
            risks.append(RiskEvent(
                risk_type=RiskType.INSUFFICIENT_CABLE,
                severity=RiskSeverity.WARNING,
                timestamp=sample.timestamp,
                description="放缆长度可能不足，建议增加放出长度",
                details={
                    "cable_length": cable_length,
                    "min_required": min_required,
                    "depth": depth,
                    "horizontal_offset": horizontal_offset
                },
                sample_index=sample_index
            ))
        
        return risks
    
    def check_angle_change(
        self,
        current_sample: AlignedSample,
        previous_sample: Optional[AlignedSample],
        sample_index: int,
        time_step: float
    ) -> List[RiskEvent]:
        risks: List[RiskEvent] = []
        
        if previous_sample is None:
            return risks
        
        current_heading = current_sample.vessel_heading or current_sample.rov_heading
        previous_heading = previous_sample.vessel_heading or previous_sample.rov_heading
        
        if current_heading is None or previous_heading is None:
            return risks
        
        angle_diff = abs(current_heading - previous_heading)
        if angle_diff > 180:
            angle_diff = 360 - angle_diff
        
        angle_rate = angle_diff / time_step if time_step > 0 else 0
        
        if angle_rate >= self.thresholds.angle_change_critical:
            risks.append(RiskEvent(
                risk_type=RiskType.ANGLE_ABRUPT_CHANGE,
                severity=RiskSeverity.CRITICAL,
                timestamp=current_sample.timestamp,
                description=f"艏向突变，速率 {angle_rate:.1f} 度/秒",
                details={
                    "previous_heading": previous_heading,
                    "current_heading": current_heading,
                    "angle_change": angle_diff,
                    "angle_rate": angle_rate,
                    "time_delta": time_step
                },
                sample_index=sample_index
            ))
        elif angle_rate >= self.thresholds.angle_change_warning:
            risks.append(RiskEvent(
                risk_type=RiskType.ANGLE_ABRUPT_CHANGE,
                severity=RiskSeverity.WARNING,
                timestamp=current_sample.timestamp,
                description=f"艏向变化较快，速率 {angle_rate:.1f} 度/秒",
                details={
                    "previous_heading": previous_heading,
                    "current_heading": current_heading,
                    "angle_change": angle_diff,
                    "angle_rate": angle_rate,
                    "time_delta": time_step
                },
                sample_index=sample_index
            ))
        
        return risks
    
    def check_current_change(
        self,
        current_sample: AlignedSample,
        previous_sample: Optional[AlignedSample],
        sample_index: int,
        time_step: float
    ) -> List[RiskEvent]:
        risks: List[RiskEvent] = []
        
        if previous_sample is None:
            return risks
        
        current_speed = current_sample.current_speed
        previous_speed = previous_sample.current_speed
        
        if current_speed is None or previous_speed is None:
            return risks
        
        speed_change = abs(current_speed - previous_speed)
        speed_rate = speed_change / time_step if time_step > 0 else 0
        
        if speed_rate >= self.thresholds.current_change_critical:
            risks.append(RiskEvent(
                risk_type=RiskType.CURRENT_ABRUPT_CHANGE,
                severity=RiskSeverity.CRITICAL,
                timestamp=current_sample.timestamp,
                description=f"海流突变，速率 {speed_rate:.2f} m/s²",
                details={
                    "previous_speed": previous_speed,
                    "current_speed": current_speed,
                    "speed_change": speed_change,
                    "speed_rate": speed_rate,
                    "time_delta": time_step
                },
                sample_index=sample_index
            ))
        elif speed_rate >= self.thresholds.current_change_warning:
            risks.append(RiskEvent(
                risk_type=RiskType.CURRENT_ABRUPT_CHANGE,
                severity=RiskSeverity.WARNING,
                timestamp=current_sample.timestamp,
                description=f"海流变化较快，速率 {speed_rate:.2f} m/s²",
                details={
                    "previous_speed": previous_speed,
                    "current_speed": current_speed,
                    "speed_change": speed_change,
                    "speed_rate": speed_rate,
                    "time_delta": time_step
                },
                sample_index=sample_index
            ))
        
        return risks
    
    def check_collision_risk(
        self,
        sample: AlignedSample,
        sample_index: int,
        ref_lat: Optional[float] = None,
        ref_lon: Optional[float] = None
    ) -> List[RiskEvent]:
        risks: List[RiskEvent] = []
        
        if not self.protection_frames:
            return risks
        
        rov_x = sample.vessel_x
        rov_y = sample.vessel_y
        rov_lat = sample.vessel_latitude
        rov_lon = sample.vessel_longitude
        
        if rov_x is None or rov_y is None:
            if rov_lat is not None and rov_lon is not None:
                if ref_lat is not None and ref_lon is not None:
                    rov_x, rov_y = UnitConverter.lat_lon_to_local(
                        rov_lat, rov_lon, ref_lat, ref_lon
                    )
        
        if rov_x is None or rov_y is None:
            return risks
        
        for frame in self.protection_frames:
            frame_x = frame.local_x
            frame_y = frame.local_y
            
            if frame_x is None or frame_y is None:
                if ref_lat is not None and ref_lon is not None:
                    frame_x, frame_y = UnitConverter.lat_lon_to_local(
                        frame.latitude, frame.longitude, ref_lat, ref_lon
                    )
                else:
                    continue
            
            distance = ((rov_x - frame_x)**2 + (rov_y - frame_y)**2)**0.5
            
            if distance <= frame.collision_radius:
                risks.append(RiskEvent(
                    risk_type=RiskType.COLLISION_RISK,
                    severity=RiskSeverity.CRITICAL,
                    timestamp=sample.timestamp,
                    description=f"ROV 接近管线保护架 '{frame.pipeline_id}'，距离 {distance:.2f}m",
                    details={
                        "pipeline_id": frame.pipeline_id,
                        "distance": distance,
                        "collision_radius": frame.collision_radius,
                        "rov_position": {"x": rov_x, "y": rov_y},
                        "frame_position": {"x": frame_x, "y": frame_y}
                    },
                    sample_index=sample_index
                ))
            elif distance <= frame.collision_radius * 2:
                risks.append(RiskEvent(
                    risk_type=RiskType.COLLISION_RISK,
                    severity=RiskSeverity.WARNING,
                    timestamp=sample.timestamp,
                    description=f"ROV 接近管线保护架预警区 '{frame.pipeline_id}'，距离 {distance:.2f}m",
                    details={
                        "pipeline_id": frame.pipeline_id,
                        "distance": distance,
                        "warning_radius": frame.collision_radius * 2,
                        "collision_radius": frame.collision_radius,
                        "rov_position": {"x": rov_x, "y": rov_y},
                        "frame_position": {"x": frame_x, "y": frame_y}
                    },
                    sample_index=sample_index
                ))
        
        return risks
    
    def analyze_sample(
        self,
        sample: AlignedSample,
        sample_index: int,
        tension_result: Optional[TensionCalculationResult] = None,
        bending_result: Optional[BendingCalculationResult] = None,
        previous_sample: Optional[AlignedSample] = None,
        time_step: float = 1.0,
        min_bending_radius_spec: float = 0.0,
        horizontal_offset: Optional[float] = None
    ) -> List[RiskEvent]:
        risks: List[RiskEvent] = []
        
        if tension_result is not None:
            risks.extend(self.check_tension(tension_result, sample, sample_index))
        
        if bending_result is not None and min_bending_radius_spec > 0:
            risks.extend(self.check_bending_radius(
                bending_result, sample, sample_index, min_bending_radius_spec
            ))
        
        risks.extend(self.check_cable_length(
            sample.rov_cable_length,
            sample.rov_depth,
            horizontal_offset,
            sample,
            sample_index
        ))
        
        risks.extend(self.check_angle_change(
            sample, previous_sample, sample_index, time_step
        ))
        
        risks.extend(self.check_current_change(
            sample, previous_sample, sample_index, time_step
        ))
        
        risks.extend(self.check_collision_risk(
            sample,
            sample_index,
            sample.reference_latitude,
            sample.reference_longitude
        ))
        
        return risks
    
    def analyze_all(
        self,
        samples: List[AlignedSample],
        tension_results: List[Optional[TensionCalculationResult]],
        bending_results: List[Optional[BendingCalculationResult]],
        horizontal_offsets: List[Optional[float]],
        time_step: float = 1.0,
        min_bending_radius_spec: float = 0.0
    ) -> RiskAnalysisResult:
        all_risks: List[RiskEvent] = []
        
        for i, sample in enumerate(samples):
            previous_sample = samples[i - 1] if i > 0 else None
            
            tension_result = tension_results[i] if i < len(tension_results) else None
            bending_result = bending_results[i] if i < len(bending_results) else None
            horizontal_offset = horizontal_offsets[i] if i < len(horizontal_offsets) else None
            
            risks = self.analyze_sample(
                sample=sample,
                sample_index=i,
                tension_result=tension_result,
                bending_result=bending_result,
                previous_sample=previous_sample,
                time_step=time_step,
                min_bending_radius_spec=min_bending_radius_spec,
                horizontal_offset=horizontal_offset
            )
            
            all_risks.extend(risks)
        
        summary: Dict[str, int] = {}
        for risk in all_risks:
            key = risk.risk_type.value
            if key not in summary:
                summary[key] = 0
            summary[key] += 1
        
        return RiskAnalysisResult(
            risks=all_risks,
            summary=summary
        )
