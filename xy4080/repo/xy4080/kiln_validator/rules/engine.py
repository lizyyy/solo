"""校验规则引擎 - 执行所有烧成校验规则"""

from typing import List, Optional, Dict, Any
from dataclasses import dataclass

from kiln_validator.models import (
    KilnConfig,
    FiringPlan,
    FiringSegment,
    WorkpieceList,
    Workpiece,
    ProbeDataPoint,
    ThermoSimulationResult,
    ThermoStep,
    ValidationResult,
    ValidationIssue,
    IssueSeverity,
    IssueCategory,
    SegmentType,
)


CRITICAL_DELTA_THRESHOLD_C = 80.0
WARNING_DELTA_THRESHOLD_C = 40.0

CRITICAL_SOAK_MIN_TEMP_C = 500.0


class ValidationEngine:
    """校验规则引擎"""

    def __init__(self, config: KilnConfig):
        self.config = config

    def validate(
        self,
        plan: FiringPlan,
        workpieces: WorkpieceList,
        simulation_result: Optional[ThermoSimulationResult] = None,
        probe_data: Optional[List[ProbeDataPoint]] = None,
    ) -> ValidationResult:
        """
        执行完整校验
        
        Args:
            plan: 烧成计划
            workpieces: 作品清单
            simulation_result: 热模拟结果（可选）
            probe_data: 实际探头数据（可选，用于探头漂移检查）
            
        Returns:
            ValidationResult 完整校验结果
        """
        result = ValidationResult(
            plan_name=plan.name,
            workpiece_count=workpieces.count,
        )
        
        self._check_ramp_rates(plan, result)
        self._check_soak_times(plan, result)
        self._check_cooling_segments(plan, result)
        
        if workpieces.count > 0:
            self._check_thickness_conflicts(workpieces, result)
            self._check_glaze_compatibility(plan, workpieces, result)
        
        if simulation_result:
            self._check_thermal_deltas(simulation_result, result)
        
        if probe_data:
            self._check_probe_drift(plan, probe_data, result)
        
        return result

    def _check_ramp_rates(self, plan: FiringPlan, result: ValidationResult) -> None:
        """检查升温速率是否超限"""
        max_allowed = self.config.max_ramp_rate_c_per_hour
        
        for segment in plan.segments:
            if not segment.is_ramp_up:
                continue
            
            rate = segment.ramp_rate_c_per_hour
            if rate is None:
                continue
            
            if rate > max_allowed:
                excess = rate - max_allowed
                result.add_issue(
                    category=IssueCategory.RAMP_RATE,
                    severity=IssueSeverity.CRITICAL,
                    message=f"升温速率超限：{rate:.1f} °C/小时，限制为 {max_allowed:.1f} °C/小时",
                    location_segment=segment.name,
                    details={
                        "actual_rate": rate,
                        "max_allowed": max_allowed,
                        "excess": excess,
                        "segment": segment.name,
                        "start_temp": segment.start_temperature_c,
                        "end_temp": segment.end_temperature_c,
                        "duration_min": segment.duration_minutes,
                    },
                    suggestion=f"建议将升温段时间延长约 {int(excess / max_allowed * segment.duration_minutes)} 分钟，或分段升温",
                )
            elif rate > max_allowed * 0.85:
                result.add_issue(
                    category=IssueCategory.RAMP_RATE,
                    severity=IssueSeverity.WARNING,
                    message=f"升温速率接近上限：{rate:.1f} °C/小时，限制为 {max_allowed:.1f} °C/小时",
                    location_segment=segment.name,
                    details={
                        "actual_rate": rate,
                        "max_allowed": max_allowed,
                    },
                    suggestion="注意厚坯作品可能需要更慢的升温速率",
                )

    def _check_soak_times(self, plan: FiringPlan, result: ValidationResult) -> None:
        """检查保温时间是否充足"""
        soak_segments = [s for s in plan.segments if s.is_soak]
        
        if not soak_segments:
            result.add_issue(
                category=IssueCategory.SOAK_TIME,
                severity=IssueSeverity.WARNING,
                message="计划中未包含任何保温段",
                details={"firing_type": plan.firing_type},
                suggestion="素烧和釉烧通常都需要在关键温度点进行保温",
            )
            return
        
        critical_soaks = [
            s for s in soak_segments 
            if s.start_temperature_c >= CRITICAL_SOAK_MIN_TEMP_C
        ]
        
        for segment in critical_soaks:
            temp = segment.start_temperature_c
            duration = segment.duration_minutes
            
            if temp >= 1000:
                min_recommended = 30
            elif temp >= 573:
                min_recommended = 20
            else:
                min_recommended = 15
            
            if duration < min_recommended:
                result.add_issue(
                    category=IssueCategory.SOAK_TIME,
                    severity=IssueSeverity.WARNING,
                    message=f"{segment.name} 保温时间可能不足：{duration} 分钟（建议至少 {min_recommended} 分钟）",
                    location_segment=segment.name,
                    details={
                        "actual_minutes": duration,
                        "recommended_min": min_recommended,
                        "temperature_c": temp,
                    },
                    suggestion=f"建议将保温时间延长至 {min_recommended} 分钟以上，确保坯体内外温度均匀",
                )

    def _check_cooling_segments(self, plan: FiringPlan, result: ValidationResult) -> None:
        """检查降温段对釉色的影响"""
        cooling_segments = [
            s for s in plan.segments 
            if s.segment_type in (SegmentType.RAMP_DOWN, SegmentType.NATURAL_COOL)
        ]
        
        for segment in cooling_segments:
            if segment.segment_type == SegmentType.NATURAL_COOL:
                result.add_issue(
                    category=IssueCategory.COOLING_RATE,
                    severity=IssueSeverity.INFO,
                    message=f"{segment.name} 使用自然冷却，釉色效果较好但时间较长",
                    location_segment=segment.name,
                    details={"type": "natural_cool"},
                )
                continue
            
            rate = segment.ramp_rate_c_per_hour
            if rate is None:
                continue
            
            abs_rate = abs(rate)
            
            if abs_rate > 120:
                result.add_issue(
                    category=IssueCategory.COOLING_RATE,
                    severity=IssueSeverity.WARNING,
                    message=f"强制降温速率较快：{abs_rate:.1f} °C/小时，可能影响釉色效果或导致开裂",
                    location_segment=segment.name,
                    details={
                        "cooling_rate": abs_rate,
                        "start_temp": segment.start_temperature_c,
                        "end_temp": segment.end_temperature_c,
                    },
                    suggestion="建议在573°C（石英相转变）和关键釉料成熟温度段采用更慢的降温速率",
                )
            elif abs_rate > 60:
                result.add_issue(
                    category=IssueCategory.COOLING_RATE,
                    severity=IssueSeverity.INFO,
                    message=f"降温速率中等：{abs_rate:.1f} °C/小时，注意对釉色的影响",
                    location_segment=segment.name,
                )

    def _check_thickness_conflicts(self, workpieces: WorkpieceList, result: ValidationResult) -> None:
        """检查坯体厚度冲突"""
        if workpieces.count < 2:
            return
        
        max_thickness = workpieces.max_thickness_cm
        min_thickness = workpieces.min_thickness_cm
        thickness_ratio = max_thickness / min_thickness if min_thickness > 0 else 1.0
        
        warning_threshold = self.config.thickness_warning_threshold_cm
        critical_threshold = self.config.thickness_critical_threshold_cm
        
        for workpiece in workpieces.workpieces:
            thickness = workpiece.thickness_cm
            
            if thickness >= critical_threshold:
                result.add_issue(
                    category=IssueCategory.THICKNESS_CONFLICT,
                    severity=IssueSeverity.CRITICAL,
                    message=f"作品 {workpiece.id} 厚度 {thickness}cm 超过临界阈值 {critical_threshold}cm，炸坯风险极高",
                    details={
                        "workpiece_id": workpiece.id,
                        "workpiece_name": workpiece.name,
                        "thickness_cm": thickness,
                        "critical_threshold_cm": critical_threshold,
                    },
                    suggestion="建议单独烧制厚坯作品，或大幅降低升温速率（建议 50-80 °C/小时），增加关键温度点的保温时间",
                )
            elif thickness >= warning_threshold:
                result.add_issue(
                    category=IssueCategory.THICKNESS_CONFLICT,
                    severity=IssueSeverity.WARNING,
                    message=f"作品 {workpiece.id} 厚度 {thickness}cm 接近警告阈值 {warning_threshold}cm",
                    details={
                        "workpiece_id": workpiece.id,
                        "thickness_cm": thickness,
                        "warning_threshold_cm": warning_threshold,
                    },
                    suggestion="建议降低升温速率，增加石英相转变点(573°C)的保温时间",
                )
        
        if thickness_ratio > 2.5:
            result.add_issue(
                category=IssueCategory.THICKNESS_CONFLICT,
                severity=IssueSeverity.WARNING,
                message=f"本次装窑作品厚度差异大（最厚 {max_thickness}cm，最薄 {min_thickness}cm），厚度比 {thickness_ratio:.1f}:1",
                details={
                    "max_thickness_cm": max_thickness,
                    "min_thickness_cm": min_thickness,
                    "thickness_ratio": thickness_ratio,
                },
                suggestion="厚度差异过大建议分窑烧制，否则按最厚作品的要求设置升温曲线",
            )

    def _check_glaze_compatibility(
        self,
        plan: FiringPlan,
        workpieces: WorkpieceList,
        result: ValidationResult,
    ) -> None:
        """检查釉料温区与计划是否匹配"""
        glazed_workpieces = workpieces.get_glazed_workpieces()
        if not glazed_workpieces:
            return
        
        plan_peak = plan.peak_temperature_c
        tolerance = self.config.glaze_temperature_tolerance
        
        for workpiece in glazed_workpieces:
            for glaze in workpiece.get_all_glazes():
                in_range = glaze.is_compatible_with_peak(plan_peak, tolerance)
                
                if not in_range:
                    if plan_peak < glaze.maturing_temp_min_c - tolerance:
                        diff = glaze.maturing_temp_min_c - plan_peak
                        result.add_issue(
                            category=IssueCategory.GLAZE_COMPATIBILITY,
                            severity=IssueSeverity.CRITICAL,
                            message=f"作品 {workpiece.id} 的釉料'{glaze.name}'成熟温度不足：计划峰值 {plan_peak}°C，釉料需要 {glaze.maturing_temp_min_c}°C 以上",
                            details={
                                "workpiece_id": workpiece.id,
                                "glaze_name": glaze.name,
                                "plan_peak_c": plan_peak,
                                "glaze_min_c": glaze.maturing_temp_min_c,
                                "glaze_max_c": glaze.maturing_temp_max_c,
                                "deficit_c": diff,
                            },
                            suggestion=f"需要将烧成峰值温度提高至少 {diff}°C，或更换低温釉料",
                        )
                    elif plan_peak > glaze.maturing_temp_max_c + tolerance:
                        diff = plan_peak - glaze.maturing_temp_max_c
                        result.add_issue(
                            category=IssueCategory.GLAZE_COMPATIBILITY,
                            severity=IssueSeverity.CRITICAL,
                            message=f"作品 {workpiece.id} 的釉料'{glaze.name}'温度过高：计划峰值 {plan_peak}°C，釉料上限 {glaze.maturing_temp_max_c}°C",
                            details={
                                "workpiece_id": workpiece.id,
                                "glaze_name": glaze.name,
                                "plan_peak_c": plan_peak,
                                "glaze_min_c": glaze.maturing_temp_min_c,
                                "glaze_max_c": glaze.maturing_temp_max_c,
                                "excess_c": diff,
                            },
                            suggestion=f"需要将烧成峰值温度降低至少 {diff}°C，避免釉料过烧或流釉",
                        )
                else:
                    optimal = glaze.optimal_maturing_temp_c
                    if abs(plan_peak - optimal) > tolerance * 0.5:
                        result.add_issue(
                            category=IssueCategory.GLAZE_COMPATIBILITY,
                            severity=IssueSeverity.INFO,
                            message=f"作品 {workpiece.id} 的釉料'{glaze.name}'最佳成熟温度 {optimal}°C，计划峰值 {plan_peak}°C",
                            details={
                                "workpiece_id": workpiece.id,
                                "glaze_name": glaze.name,
                                "optimal_temp_c": optimal,
                                "plan_peak_c": plan_peak,
                            },
                        )

    def _check_thermal_deltas(
        self,
        simulation: ThermoSimulationResult,
        result: ValidationResult,
    ) -> None:
        """检查热模拟中的内外温差（炸坯风险）"""
        max_delta = simulation.max_internal_delta_c
        max_step = simulation.max_internal_delta_at_step
        
        if max_delta >= CRITICAL_DELTA_THRESHOLD_C:
            result.add_issue(
                category=IssueCategory.THERMAL_DELTA,
                severity=IssueSeverity.CRITICAL,
                message=f"热模拟显示坯体内外温差过大：最大 {max_delta:.1f}°C（厚度 {simulation.workpiece_thickness_cm}cm）",
                location_minutes=max_step.time_minutes if max_step else None,
                location_segment=max_step.segment_name if max_step else None,
                details={
                    "max_delta_c": max_delta,
                    "critical_threshold_c": CRITICAL_DELTA_THRESHOLD_C,
                    "workpiece_thickness_cm": simulation.workpiece_thickness_cm,
                    "at_time_minutes": max_step.time_minutes if max_step else None,
                    "at_segment": max_step.segment_name if max_step else None,
                },
                suggestion="温差过大极易导致炸坯。请降低升温速率，增加573°C和关键温度点的保温时间",
            )
        elif max_delta >= WARNING_DELTA_THRESHOLD_C:
            result.add_issue(
                category=IssueCategory.THERMAL_DELTA,
                severity=IssueSeverity.WARNING,
                message=f"热模拟显示坯体内外温差偏高：最大 {max_delta:.1f}°C",
                location_minutes=max_step.time_minutes if max_step else None,
                location_segment=max_step.segment_name if max_step else None,
                details={
                    "max_delta_c": max_delta,
                    "warning_threshold_c": WARNING_DELTA_THRESHOLD_C,
                    "workpiece_thickness_cm": simulation.workpiece_thickness_cm,
                },
                suggestion="注意观察升温速率，厚坯作品可考虑增加保温时间",
            )

    def _check_probe_drift(
        self,
        plan: FiringPlan,
        probe_data: List[ProbeDataPoint],
        result: ValidationResult,
    ) -> None:
        """检查探头数据与计划的偏差（探头漂移）"""
        threshold = self.config.probe_drift_threshold_c
        
        if not probe_data:
            return
        
        probe_ids = sorted(set(p.probe_id for p in probe_data))
        
        for probe_id in probe_ids:
            probe_points = [p for p in probe_data if p.probe_id == probe_id]
            probe_points.sort(key=lambda p: p.time_minutes)
            
            drift_points = []
            max_drift = 0.0
            max_drift_time = 0
            
            for point in probe_points:
                plan_temp = plan.get_temperature_at_time(point.time_minutes)
                if plan_temp is None:
                    continue
                
                drift = abs(point.temperature_c - plan_temp)
                
                if drift > max_drift:
                    max_drift = drift
                    max_drift_time = point.time_minutes
                
                if drift > threshold:
                    drift_points.append({
                        "time_minutes": point.time_minutes,
                        "plan_temp_c": plan_temp,
                        "actual_temp_c": point.temperature_c,
                        "drift_c": drift,
                    })
            
            if drift_points:
                result.add_issue(
                    category=IssueCategory.PROBE_DRIFT,
                    severity=IssueSeverity.CRITICAL if max_drift > threshold * 1.5 else IssueSeverity.WARNING,
                    message=f"探头'{probe_id}'与计划偏差较大：最大偏差 {max_drift:.1f}°C，阈值 {threshold}°C",
                    location_minutes=max_drift_time,
                    details={
                        "probe_id": probe_id,
                        "max_drift_c": max_drift,
                        "threshold_c": threshold,
                        "at_time_minutes": max_drift_time,
                        "drift_points_count": len(drift_points),
                    },
                    suggestion="检查探头是否损坏或位置偏移，或校准温控器。偏差过大可能导致欠烧或过烧",
                )
            elif max_drift > threshold * 0.5:
                result.add_issue(
                    category=IssueCategory.PROBE_DRIFT,
                    severity=IssueSeverity.INFO,
                    message=f"探头'{probe_id}'与计划存在偏差：最大偏差 {max_drift:.1f}°C",
                    details={
                        "probe_id": probe_id,
                        "max_drift_c": max_drift,
                    },
                )


def run_full_validation(
    plan: FiringPlan,
    workpieces: WorkpieceList,
    config: Optional[KilnConfig] = None,
    simulation_result: Optional[ThermoSimulationResult] = None,
    probe_data: Optional[List[ProbeDataPoint]] = None,
) -> ValidationResult:
    """
    便捷函数：执行完整校验
    
    Args:
        plan: 烧成计划
        workpieces: 作品清单
        config: 窑炉配置
        simulation_result: 热模拟结果（可选）
        probe_data: 探头数据（可选）
        
    Returns:
        ValidationResult 校验结果
    """
    if config is None:
        config = KilnConfig.create_default()
    
    engine = ValidationEngine(config)
    return engine.validate(plan, workpieces, simulation_result, probe_data)
