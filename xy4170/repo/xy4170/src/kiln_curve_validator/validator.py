"""规则校验模块 - 升温速率、热功、保温时间、冷却风险、传感器异常检查"""

from typing import List, Tuple, Optional, Dict, Any
import numpy as np
from dataclasses import dataclass

from .models import (
    MeasuredCurve,
    TemperaturePoint,
    PlannedCurve,
    CurveSegment,
    SegmentType,
    KilnParameters,
    FiringRecipe,
    SimulationResult,
    ValidationResult,
    ValidationIssue,
    ComparisonResult,
    AdjustmentSuggestion,
)


@dataclass
class RateSample:
    """升温速率采样点"""
    time_start: float
    time_end: float
    temp_start: float
    temp_end: float
    rate: float
    duration: float


class HeatingRateValidator:
    """升温速率校验器"""

    def __init__(self, kiln: KilnParameters, recipe: FiringRecipe):
        self.kiln = kiln
        self.recipe = recipe
        self.max_safe_rate = min(
            recipe.max_allowed_heating_rate or 5.0,
            kiln.max_heating_rate
        )

    def validate(
        self,
        measured_curve: MeasuredCurve,
        window_minutes: float = 5.0
    ) -> List[ValidationIssue]:
        """校验升温速率"""
        issues: List[ValidationIssue] = []

        rates = self._calculate_rates(measured_curve, window_minutes)

        if not rates:
            return issues

        for rate_sample in rates:
            if rate_sample.rate <= 0:
                continue

            thickness_factor = self.recipe.total_thickness
            safe_rate = self._calculate_safe_rate_for_thickness(thickness_factor)

            if rate_sample.rate > safe_rate * 1.2:
                issues.append(ValidationIssue(
                    severity="critical",
                    category="heating_rate",
                    message=f"升温速率过快: {rate_sample.rate:.2f}°C/min, 安全限值: {safe_rate:.2f}°C/min",
                    location=f"{rate_sample.temp_start:.0f}°C ~ {rate_sample.temp_end:.0f}°C",
                    suggested_action="建议降低升温速率，延长该阶段升温时间",
                    measured_value=round(rate_sample.rate, 2),
                    threshold_value=round(safe_rate, 2)
                ))
            elif rate_sample.rate > safe_rate:
                issues.append(ValidationIssue(
                    severity="warning",
                    category="heating_rate",
                    message=f"升温速率接近上限: {rate_sample.rate:.2f}°C/min, 安全限值: {safe_rate:.2f}°C/min",
                    location=f"{rate_sample.temp_start:.0f}°C ~ {rate_sample.temp_end:.0f}°C",
                    suggested_action="建议密切关注，考虑略微降低升温速率",
                    measured_value=round(rate_sample.rate, 2),
                    threshold_value=round(safe_rate, 2)
                ))

        return issues

    def _calculate_rates(
        self,
        curve: MeasuredCurve,
        window_minutes: float
    ) -> List[RateSample]:
        """计算各时间段的升温速率"""
        points = [p for p in curve.data_points if p.is_valid]
        if len(points) < 2:
            return []

        rates: List[RateSample] = []

        start_idx = 0
        while start_idx < len(points):
            start_point = points[start_idx]
            end_idx = start_idx

            while end_idx < len(points) - 1:
                next_point = points[end_idx + 1]
                elapsed = (next_point.timestamp - start_point.timestamp).total_seconds() / 60.0

                if elapsed >= window_minutes:
                    break
                end_idx += 1

            if end_idx > start_idx:
                end_point = points[end_idx]
                duration = (end_point.timestamp - start_point.timestamp).total_seconds() / 60.0

                if duration > 0:
                    rate = (end_point.temperature - start_point.temperature) / duration

                    rates.append(RateSample(
                        time_start=duration,
                        time_end=duration,
                        temp_start=start_point.temperature,
                        temp_end=end_point.temperature,
                        rate=rate,
                        duration=duration
                    ))

            start_idx = end_idx + 1

        return rates

    def _calculate_safe_rate_for_thickness(self, thickness_cm: float) -> float:
        """根据厚度计算安全升温速率"""
        base_rate = self.max_safe_rate

        if thickness_cm > 2.0:
            return base_rate * 0.5
        elif thickness_cm > 1.5:
            return base_rate * 0.7
        elif thickness_cm > 1.0:
            return base_rate * 0.85

        return base_rate


class ThermalWorkValidator:
    """热功校验器"""

    def __init__(self, kiln: KilnParameters, recipe: FiringRecipe):
        self.kiln = kiln
        self.recipe = recipe

    def validate(
        self,
        measured_curve: MeasuredCurve,
        planned_curve: Optional[PlannedCurve] = None
    ) -> List[ValidationIssue]:
        """校验热功是否充足"""
        issues: List[ValidationIssue] = []

        if planned_curve is None:
            return issues

        temps = measured_curve.get_temperatures_array()
        if len(temps) < 2:
            return issues

        peak_temp = max(temps)
        target_temp = self.recipe.target_temperature

        peak_deviation = peak_temp - target_temp

        hold_segments = [s for s in planned_curve.segments if s.segment_type == SegmentType.HOLD]
        total_hold_time = sum(s.duration for s in hold_segments)

        measured_hold_time = self._estimate_hold_time(measured_curve, target_temp)

        if peak_deviation < -20.0:
            issues.append(ValidationIssue(
                severity="critical",
                category="thermal_work",
                message=f"峰值温度严重不足: 实测 {peak_temp:.1f}°C, 目标 {target_temp:.1f}°C",
                location=f"峰值区域",
                suggested_action="热功严重不足，建议提高目标温度或延长保温时间",
                measured_value=round(peak_temp, 1),
                threshold_value=round(target_temp, 1)
            ))
        elif peak_deviation < -10.0:
            issues.append(ValidationIssue(
                severity="warning",
                category="thermal_work",
                message=f"峰值温度偏低: 实测 {peak_temp:.1f}°C, 目标 {target_temp:.1f}°C",
                location=f"峰值区域",
                suggested_action="考虑略微提高设定温度或延长保温时间",
                measured_value=round(peak_temp, 1),
                threshold_value=round(target_temp, 1)
            ))

        hold_min_threshold = max(15.0, total_hold_time * 0.7)
        if measured_hold_time < hold_min_threshold:
            issues.append(ValidationIssue(
                severity="warning",
                category="hold_time",
                message=f"保温时间不足: 实测约 {measured_hold_time:.0f}min, 计划 {total_hold_time:.0f}min",
                location=f"高温保温段",
                suggested_action="建议延长保温时间以确保釉料充分成熟",
                measured_value=round(measured_hold_time, 0),
                threshold_value=round(total_hold_time, 0)
            ))

        return issues

    def _estimate_hold_time(self, curve: MeasuredCurve, target_temp: float) -> float:
        """估算实际保温时间"""
        points = [p for p in curve.data_points if p.is_valid]
        if len(points) < 2:
            return 0.0

        hold_start_idx = None
        hold_end_idx = None
        hold_threshold = target_temp - 20.0

        for i, p in enumerate(points):
            if p.temperature >= hold_threshold:
                if hold_start_idx is None:
                    hold_start_idx = i
                hold_end_idx = i
            elif hold_start_idx is not None:
                break

        if hold_start_idx is None or hold_end_idx is None:
            return 0.0

        start_time = points[hold_start_idx].timestamp
        end_time = points[hold_end_idx].timestamp

        return (end_time - start_time).total_seconds() / 60.0


class CoolingValidator:
    """冷却风险校验器"""

    def __init__(self, kiln: KilnParameters, recipe: FiringRecipe):
        self.kiln = kiln
        self.recipe = recipe
        self.critical_cool_rate = recipe.body.critical_cooling_rate

    def validate(
        self,
        measured_curve: MeasuredCurve,
        simulation_result: Optional[SimulationResult] = None
    ) -> List[ValidationIssue]:
        """校验冷却风险"""
        issues: List[ValidationIssue] = []

        cooling_rates = self._calculate_cooling_rates(measured_curve)

        if not cooling_rates:
            return issues

        critical_temp_range = (500.0, 300.0)

        for rate_sample in cooling_rates:
            avg_temp = (rate_sample.temp_start + rate_sample.temp_end) / 2
            cooling_rate = abs(rate_sample.rate)

            if critical_temp_range[1] <= avg_temp <= critical_temp_range[0]:
                safe_rate = self.critical_cool_rate * 0.8

                if cooling_rate > safe_rate * 1.3:
                    issues.append(ValidationIssue(
                        severity="critical",
                        category="cooling",
                        message=f"临界温度区间冷却过快: {cooling_rate:.2f}°C/min, 安全限值: {safe_rate:.2f}°C/min",
                        location=f"{rate_sample.temp_start:.0f}°C ~ {rate_sample.temp_end:.0f}°C (石英转化区间)",
                        suggested_action="冷却过快，存在极高开裂风险！建议关闭窑门减缓冷却，或在后续批次中调整冷却曲线",
                        measured_value=round(cooling_rate, 2),
                        threshold_value=round(safe_rate, 2)
                    ))
                elif cooling_rate > safe_rate:
                    issues.append(ValidationIssue(
                        severity="warning",
                        category="cooling",
                        message=f"临界区间冷却偏快: {cooling_rate:.2f}°C/min, 安全限值: {safe_rate:.2f}°C/min",
                        location=f"{rate_sample.temp_start:.0f}°C ~ {rate_sample.temp_end:.0f}°C",
                        suggested_action="存在一定开裂风险，建议关注",
                        measured_value=round(cooling_rate, 2),
                        threshold_value=round(safe_rate, 2)
                    ))

            elif cooling_rate > self.kiln.max_cooling_rate:
                issues.append(ValidationIssue(
                    severity="warning",
                    category="cooling",
                    message=f"冷却速率超过窑炉自然冷却能力: {cooling_rate:.2f}°C/min",
                    location=f"{rate_sample.temp_start:.0f}°C ~ {rate_sample.temp_end:.0f}°C",
                    suggested_action="可能是强制冷却，注意观察是否有异常",
                    measured_value=round(cooling_rate, 2),
                    threshold_value=round(self.kiln.max_cooling_rate, 2)
                ))

        return issues

    def _calculate_cooling_rates(self, curve: MeasuredCurve) -> List[RateSample]:
        """计算冷却速率"""
        points = [p for p in curve.data_points if p.is_valid]
        if len(points) < 3:
            return []

        peak_temp = max(p.temperature for p in points)
        peak_idx = next(i for i, p in enumerate(points) if p.temperature == peak_temp)

        if peak_idx >= len(points) - 1:
            return []

        cooling_points = points[peak_idx:]
        rates: List[RateSample] = []

        window_size = 5
        for i in range(0, len(cooling_points) - window_size, window_size // 2):
            start_p = cooling_points[i]
            end_p = cooling_points[min(i + window_size, len(cooling_points) - 1)]

            duration = (end_p.timestamp - start_p.timestamp).total_seconds() / 60.0

            if duration > 0:
                rate = (end_p.temperature - start_p.temperature) / duration

                if rate < -0.5:
                    rates.append(RateSample(
                        time_start=duration,
                        time_end=duration,
                        temp_start=start_p.temperature,
                        temp_end=end_p.temperature,
                        rate=rate,
                        duration=duration
                    ))

        return rates


class SensorValidator:
    """传感器异常校验器"""

    def __init__(self, kiln: KilnParameters):
        self.kiln = kiln
        self.sensor_accuracy = kiln.sensor_accuracy

    def validate(self, measured_curve: MeasuredCurve) -> List[ValidationIssue]:
        """校验传感器数据异常"""
        issues: List[ValidationIssue] = []

        points = measured_curve.data_points
        if len(points) < 3:
            return issues

        invalid_count = sum(1 for p in points if not p.is_valid)
        if invalid_count > len(points) * 0.1:
            issues.append(ValidationIssue(
                severity="warning",
                category="sensor",
                message=f"存在较多无效数据点: {invalid_count}个，占比 {(invalid_count/len(points))*100:.1f}%",
                location="全曲线",
                suggested_action="检查传感器连接或数据记录器"
            ))

        temp_jumps = self._detect_temperature_jumps(points)
        for jump in temp_jumps:
            issues.append(ValidationIssue(
                severity="critical" if abs(jump) > 50 else "warning",
                category="sensor",
                message=f"检测到温度突变: {jump:.1f}°C",
                location="数据异常区域",
                suggested_action="可能是传感器接触不良或信号干扰"
            ))

        flat_periods = self._detect_flat_periods(points)
        for flat in flat_periods:
            issues.append(ValidationIssue(
                severity="warning",
                category="sensor",
                message=f"检测到异常平坦区域: 持续约 {flat:.0f}分钟温度无变化",
                location="传感器疑似失效区域",
                suggested_action="检查传感器是否正常工作"
            ))

        return issues

    def _detect_temperature_jumps(self, points: List[TemperaturePoint]) -> List[float]:
        """检测温度突变"""
        jumps: List[float] = []
        threshold = 20.0

        for i in range(1, len(points)):
            prev_p = points[i-1]
            curr_p = points[i]

            if not prev_p.is_valid or not curr_p.is_valid:
                continue

            time_delta = (curr_p.timestamp - prev_p.timestamp).total_seconds() / 60.0

            if time_delta > 0 and time_delta < 10:
                temp_delta = curr_p.temperature - prev_p.temperature
                rate = abs(temp_delta) / time_delta

                if rate > threshold and abs(temp_delta) > 30:
                    jumps.append(temp_delta)

        return jumps

    def _detect_flat_periods(self, points: List[TemperaturePoint]) -> List[float]:
        """检测异常平坦区域（传感器疑似失效）"""
        flat_periods: List[float] = []
        min_flat_duration = 30.0
        temp_tolerance = 2.0

        i = 0
        while i < len(points) - 1:
            start_p = points[i]
            if not start_p.is_valid:
                i += 1
                continue

            j = i + 1
            while j < len(points):
                curr_p = points[j]
                if not curr_p.is_valid:
                    break

                temp_diff = abs(curr_p.temperature - start_p.temperature)
                duration = (curr_p.timestamp - start_p.timestamp).total_seconds() / 60.0

                if temp_diff > temp_tolerance:
                    if duration > min_flat_duration:
                        flat_periods.append(duration)
                    break

                j += 1

            if j == len(points):
                duration = (points[j-1].timestamp - start_p.timestamp).total_seconds() / 60.0
                if duration > min_flat_duration:
                    flat_periods.append(duration)

            i = j

        return flat_periods


class FullValidator:
    """完整校验器"""

    def __init__(self, kiln: KilnParameters, recipe: FiringRecipe):
        self.kiln = kiln
        self.recipe = recipe
        self.heating_validator = HeatingRateValidator(kiln, recipe)
        self.thermal_validator = ThermalWorkValidator(kiln, recipe)
        self.cooling_validator = CoolingValidator(kiln, recipe)
        self.sensor_validator = SensorValidator(kiln)

    def run_full_validation(
        self,
        measured_curve: MeasuredCurve,
        planned_curve: Optional[PlannedCurve] = None,
        simulation_result: Optional[SimulationResult] = None
    ) -> ValidationResult:
        """运行完整校验流程"""
        all_issues: List[ValidationIssue] = []

        heating_issues = self.heating_validator.validate(measured_curve)
        all_issues.extend(heating_issues)

        thermal_issues = self.thermal_validator.validate(measured_curve, planned_curve)
        all_issues.extend(thermal_issues)

        cooling_issues = self.cooling_validator.validate(measured_curve, simulation_result)
        all_issues.extend(cooling_issues)

        sensor_issues = self.sensor_validator.validate(measured_curve)
        all_issues.extend(sensor_issues)

        heating_rate_ok = not any(i.category == "heating_rate" and i.severity == "critical" for i in all_issues)
        thermal_work_ok = not any(i.category == "thermal_work" and i.severity == "critical" for i in all_issues)
        hold_time_ok = not any(i.category == "hold_time" and i.severity == "critical" for i in all_issues)
        cooling_risk_ok = not any(i.category == "cooling" and i.severity == "critical" for i in all_issues)
        sensor_ok = not any(i.category == "sensor" and i.severity == "critical" for i in all_issues)

        critical_count = sum(1 for i in all_issues if i.severity == "critical")
        warning_count = sum(1 for i in all_issues if i.severity == "warning")

        if critical_count > 0:
            overall_status = "fail"
            summary = f"校验失败: 发现 {critical_count} 个严重问题，{warning_count} 个警告"
        elif warning_count > 0:
            overall_status = "warning"
            summary = f"存在警告: 发现 {warning_count} 个警告项，建议关注"
        else:
            overall_status = "pass"
            summary = "校验通过: 所有检查项均在正常范围内"

        return ValidationResult(
            overall_status=overall_status,
            issues=all_issues,
            heating_rate_ok=heating_rate_ok,
            thermal_work_ok=thermal_work_ok,
            hold_time_ok=hold_time_ok,
            cooling_risk_ok=cooling_risk_ok,
            sensor_ok=sensor_ok,
            summary=summary
        )


class CurveComparator:
    """计划与实测曲线对比器"""

    @staticmethod
    def compare(
        planned_curve: PlannedCurve,
        measured_curve: MeasuredCurve
    ) -> ComparisonResult:
        """对比计划与实测曲线"""
        planned_duration = planned_curve.get_total_duration()
        measured_duration = measured_curve.get_duration_minutes()

        planned_peak = planned_curve.get_peak_temperature()
        measured_temps = measured_curve.get_temperatures_array()
        measured_peak = max(measured_temps) if measured_temps else 0.0

        planned_peak_time = CurveComparator._find_peak_time_planned(planned_curve)
        measured_peak_time = CurveComparator._find_peak_time_measured(measured_curve)
        peak_time_diff = measured_peak_time - planned_peak_time

        deviations = CurveComparator._calculate_deviations(planned_curve, measured_curve)

        avg_deviation = float(np.mean(deviations)) if deviations else 0.0
        max_deviation = float(np.max(np.abs(deviations))) if deviations else 0.0

        return ComparisonResult(
            planned_duration=planned_duration,
            measured_duration=measured_duration,
            planned_peak=planned_peak,
            measured_peak=measured_peak,
            peak_time_diff=peak_time_diff,
            temperature_deviation=deviations,
            avg_deviation=avg_deviation,
            max_deviation=max_deviation
        )

    @staticmethod
    def _find_peak_time_planned(planned: PlannedCurve) -> float:
        """计算计划曲线到达峰值的时间"""
        accumulated_time = 0.0
        peak_temp = planned.get_peak_temperature()

        for segment in planned.segments:
            if segment.end_temp >= peak_temp and segment.segment_type == SegmentType.RAMP:
                start_temp = segment.start_temp
                end_temp = segment.end_temp
                if end_temp > start_temp:
                    ratio = (peak_temp - start_temp) / (end_temp - start_temp)
                    return accumulated_time + segment.duration * ratio
            accumulated_time += segment.duration

        return accumulated_time

    @staticmethod
    def _find_peak_time_measured(measured: MeasuredCurve) -> float:
        """计算实测曲线到达峰值的时间（分钟）"""
        points = [p for p in measured.data_points if p.is_valid]
        if not points:
            return 0.0

        peak_temp = max(p.temperature for p in points)
        start_time = points[0].timestamp

        for p in points:
            if p.temperature >= peak_temp:
                return (p.timestamp - start_time).total_seconds() / 60.0

        return (points[-1].timestamp - start_time).total_seconds() / 60.0

    @staticmethod
    def _calculate_deviations(
        planned: PlannedCurve,
        measured: MeasuredCurve
    ) -> List[float]:
        """计算各时间点的温度偏差"""
        deviations: List[float] = []

        measured_points = [p for p in measured.data_points if p.is_valid]
        if not measured_points:
            return deviations

        start_time = measured_points[0].timestamp

        for p in measured_points:
            elapsed = (p.timestamp - start_time).total_seconds() / 60.0

            planned_temp = CurveComparator._get_planned_temp_at_time(planned, elapsed)

            if planned_temp is not None:
                deviations.append(p.temperature - planned_temp)

        return deviations

    @staticmethod
    def _get_planned_temp_at_time(planned: PlannedCurve, time_minutes: float) -> Optional[float]:
        """获取计划曲线在指定时间的温度"""
        accumulated_time = 0.0

        for segment in planned.segments:
            if accumulated_time <= time_minutes <= accumulated_time + segment.duration:
                segment_elapsed = time_minutes - accumulated_time
                segment_ratio = segment_elapsed / segment.duration if segment.duration > 0 else 0

                temp = segment.start_temp + (segment.end_temp - segment.start_temp) * segment_ratio
                return temp

            accumulated_time += segment.duration

        return None
