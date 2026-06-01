from dataclasses import dataclass, field
from typing import Optional, Tuple
from datetime import datetime
import math


@dataclass
class TidalPredictionInput:
    record_id: str
    timestamp: datetime
    station_name: str
    tidal_range: Optional[float] = None
    tidal_range_unit: str = "m"
    flow_rate: Optional[float] = None
    flow_rate_unit: str = "m³/s"
    water_velocity: Optional[float] = None
    water_velocity_unit: str = "m/s"
    turbine_efficiency: Optional[float] = 0.8
    cross_sectional_area: Optional[float] = None
    cross_sectional_area_unit: str = "m²"
    data_source: str = "manual"
    notes: str = ""


@dataclass
class ValidationIssue:
    level: str
    field: str
    message: str
    suggestion: str = ""


@dataclass
class TidalPredictionResult:
    record_id: str
    timestamp: datetime
    station_name: str
    input: TidalPredictionInput
    predicted_power: Optional[float] = None
    power_unit: str = "kW"
    status: str = "pending"
    issues: list = field(default_factory=list)
    calculation_method: str = ""
    confidence_score: float = 0.0
    processing_notes: str = ""


class TidalPowerCalculator:
    SEA_WATER_DENSITY = 1025
    GRAVITY = 9.81
    MIN_TIDAL_RANGE = 0.5
    MAX_TIDAL_RANGE = 15.0
    MIN_EFFICIENCY = 0.3
    MAX_EFFICIENCY = 0.95

    def _convert_tidal_range(self, value: float, unit: str) -> Tuple[float, str]:
        conversions = {
            "m": 1.0,
            "meter": 1.0,
            "米": 1.0,
            "ft": 0.3048,
            "feet": 0.3048,
            "英尺": 0.3048,
            "cm": 0.01,
            "厘米": 0.01,
        }
        factor = conversions.get(unit.lower(), 1.0)
        return value * factor, "m"

    def _convert_flow_rate(self, value: float, unit: str) -> Tuple[float, str]:
        conversions = {
            "m³/s": 1.0,
            "m3/s": 1.0,
            "立方米/秒": 1.0,
            "l/s": 0.001,
            "l/min": 0.001 / 60,
            "m³/h": 1.0 / 3600,
        }
        factor = conversions.get(unit.lower(), 1.0)
        return value * factor, "m³/s"

    def _convert_velocity(self, value: float, unit: str) -> Tuple[float, str]:
        conversions = {
            "m/s": 1.0,
            "米/秒": 1.0,
            "km/h": 1000.0 / 3600,
            "节": 0.514444,
            "knot": 0.514444,
        }
        factor = conversions.get(unit.lower(), 1.0)
        return value * factor, "m/s"

    def _convert_area(self, value: float, unit: str) -> Tuple[float, str]:
        conversions = {
            "m²": 1.0,
            "m2": 1.0,
            "平方米": 1.0,
            "km²": 1_000_000.0,
            "ha": 10_000.0,
        }
        factor = conversions.get(unit.lower(), 1.0)
        return value * factor, "m²"

    def validate_input(self, data: TidalPredictionInput) -> list:
        issues = []

        if not data.station_name or len(data.station_name.strip()) == 0:
            issues.append(ValidationIssue(
                level="error",
                field="station_name",
                message="测站名称不能为空",
                suggestion="请填写测站名称，如：象山港潮汐电站"
            ))

        if data.tidal_range is None:
            issues.append(ValidationIssue(
                level="warning",
                field="tidal_range",
                message="潮差数据缺失，无法使用势能法计算",
                suggestion="如果有流速和过流面积数据，可以使用动能法计算"
            ))
        else:
            tidal_range_m, _ = self._convert_tidal_range(data.tidal_range, data.tidal_range_unit)
            if tidal_range_m <= 0:
                issues.append(ValidationIssue(
                    level="error",
                    field="tidal_range",
                    message=f"潮差数值异常：{data.tidal_range} {data.tidal_range_unit}",
                    suggestion="潮差应该是正数，请检查数据来源"
                ))
            elif tidal_range_m < self.MIN_TIDAL_RANGE:
                issues.append(ValidationIssue(
                    level="warning",
                    field="tidal_range",
                    message=f"潮差偏小：{tidal_range_m:.2f} m，小于经济开发下限 {self.MIN_TIDAL_RANGE} m",
                    suggestion="小潮差条件下发电效率可能偏低，建议人工复核"
                ))
            elif tidal_range_m > self.MAX_TIDAL_RANGE:
                issues.append(ValidationIssue(
                    level="warning",
                    field="tidal_range",
                    message=f"潮差偏大：{tidal_range_m:.2f} m，超过常见最大值 {self.MAX_TIDAL_RANGE} m",
                    suggestion="请确认数据准确性，全球最大潮差约为16米"
                ))

        has_flow = data.flow_rate is not None and data.flow_rate > 0
        has_velocity_area = (
            data.water_velocity is not None 
            and data.water_velocity > 0
            and data.cross_sectional_area is not None
            and data.cross_sectional_area > 0
        )

        if data.tidal_range is None and not has_flow and not has_velocity_area:
            issues.append(ValidationIssue(
                level="error",
                field="hydraulic_data",
                message="水力数据不足",
                suggestion="请至少提供：1) 潮差 或 2) 流量 或 3) 流速+过流面积"
            ))

        if data.turbine_efficiency is not None:
            if not (self.MIN_EFFICIENCY <= data.turbine_efficiency <= self.MAX_EFFICIENCY):
                issues.append(ValidationIssue(
                    level="warning",
                    field="turbine_efficiency",
                    message=f"效率值超出正常范围：{data.turbine_efficiency:.2%}",
                    suggestion=f"水轮机效率通常在 {self.MIN_EFFICIENCY:.0%}-{self.MAX_EFFICIENCY:.0%} 之间"
                ))

        return issues

    def calculate_power(self, data: TidalPredictionInput) -> TidalPredictionResult:
        result = TidalPredictionResult(
            record_id=data.record_id,
            timestamp=data.timestamp,
            station_name=data.station_name,
            input=data,
            issues=self.validate_input(data)
        )

        has_error = any(issue.level == "error" for issue in result.issues)
        if has_error:
            result.status = "failed"
            result.processing_notes = "存在严重数据问题，无法进行计算"
            return result

        has_warning = any(issue.level == "warning" for issue in result.issues)

        try:
            if data.tidal_range is not None and data.flow_rate is not None:
                result.predicted_power = self._calculate_by_potential_energy(data)
                result.calculation_method = "势能法（潮差+流量）"
                result.confidence_score = 0.85
            elif data.water_velocity is not None and data.cross_sectional_area is not None:
                result.predicted_power = self._calculate_by_kinetic_energy(data)
                result.calculation_method = "动能法（流速+过流面积）"
                result.confidence_score = 0.75
            elif data.tidal_range is not None:
                result.predicted_power = self._calculate_simplified(data)
                result.calculation_method = "简化估算法（仅潮差）"
                result.confidence_score = 0.6

            if result.predicted_power is not None:
                if data.data_source == "old_portal":
                    result.status = "needs_review"
                    result.processing_notes = "数据来自旧汇总页口径，计算结果仅供参考对比"
                    result.confidence_score *= 0.8
                elif has_warning:
                    result.processing_notes = "计算完成，但存在需要关注的警告项，建议人工确认"
                    result.status = "needs_review"
                else:
                    result.status = "success"
                    result.processing_notes = "计算顺利完成"

        except Exception as e:
            result.status = "failed"
            result.processing_notes = f"计算过程发生错误：{str(e)}"

        return result

    def _calculate_by_potential_energy(self, data: TidalPredictionInput) -> float:
        tidal_range_m, _ = self._convert_tidal_range(data.tidal_range, data.tidal_range_unit)
        flow_rate_m3s, _ = self._convert_flow_rate(data.flow_rate, data.flow_rate_unit)
        efficiency = data.turbine_efficiency or 0.8

        power_watts = (
            self.SEA_WATER_DENSITY
            * self.GRAVITY
            * tidal_range_m
            * flow_rate_m3s
            * efficiency
        )

        return power_watts / 1000

    def _calculate_by_kinetic_energy(self, data: TidalPredictionInput) -> float:
        velocity, _ = self._convert_velocity(data.water_velocity, data.water_velocity_unit)
        area, _ = self._convert_area(data.cross_sectional_area, data.cross_sectional_area_unit)
        efficiency = data.turbine_efficiency or 0.8

        flow_rate = velocity * area
        power_watts = 0.5 * self.SEA_WATER_DENSITY * area * (velocity ** 3) * efficiency

        return power_watts / 1000

    def _calculate_simplified(self, data: TidalPredictionInput) -> float:
        tidal_range_m, _ = self._convert_tidal_range(data.tidal_range, data.tidal_range_unit)
        efficiency = data.turbine_efficiency or 0.8
        typical_flow = 500

        power_watts = (
            self.SEA_WATER_DENSITY
            * self.GRAVITY
            * tidal_range_m
            * typical_flow
            * efficiency
        )

        return power_watts / 1000
