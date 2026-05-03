from typing import Dict, List, Optional, Tuple
from datetime import datetime
import math

from .models import (
    BuildingUnit,
    ValveSetting,
    SensorReading,
    WeatherLoadPoint,
    TimeSliceResult,
    AnalysisResult,
    AnomalyType,
)


WATER_SPECIFIC_HEAT = 4.186
WATER_DENSITY = 1000.0


class HydraulicBalanceCalculator:
    def __init__(
        self,
        units: Dict[str, BuildingUnit],
        valves: Dict[str, ValveSetting],
        sensor_readings: List[SensorReading],
        weather_points: List[WeatherLoadPoint],
        balance_threshold: float = 0.15,
    ):
        self.units = units
        self.valves = valves
        self.sensor_readings = sensor_readings
        self.weather_points = weather_points
        self.balance_threshold = balance_threshold

        self._readings_by_time_unit: Dict[datetime, Dict[str, SensorReading]] = {}
        self._weather_by_time: Dict[datetime, WeatherLoadPoint] = {}
        self._unit_valve_map: Dict[str, ValveSetting] = {}

        self._build_indices()

    def _build_indices(self):
        for reading in self.sensor_readings:
            if reading.timestamp not in self._readings_by_time_unit:
                self._readings_by_time_unit[reading.timestamp] = {}
            self._readings_by_time_unit[reading.timestamp][reading.unit_id] = reading

        for point in self.weather_points:
            self._weather_by_time[point.timestamp] = point

        for valve in self.valves.values():
            if valve.unit_id:
                self._unit_valve_map[valve.unit_id] = valve

    def get_time_slices(self) -> List[datetime]:
        return sorted(self._readings_by_time_unit.keys())

    def _get_weather_for_time(self, ts: datetime) -> Optional[WeatherLoadPoint]:
        if ts in self._weather_by_time:
            return self._weather_by_time[ts]

        sorted_points = sorted(self._weather_by_time.keys())
        for i in range(len(sorted_points) - 1):
            if sorted_points[i] <= ts <= sorted_points[i + 1]:
                return self._weather_by_time[sorted_points[i]]

        if sorted_points:
            if ts < sorted_points[0]:
                return self._weather_by_time[sorted_points[0]]
            else:
                return self._weather_by_time[sorted_points[-1]]

        return None

    def _get_valve_for_unit(self, unit_id: str) -> Optional[ValveSetting]:
        if unit_id in self._unit_valve_map:
            return self._unit_valve_map[unit_id]

        unit = self.units.get(unit_id)
        if unit and unit.valve_id and unit.valve_id in self.valves:
            return self.valves[unit.valve_id]

        return None

    def calculate_temp_diff(
        self, supply_temp: Optional[float], return_temp: Optional[float]
    ) -> Optional[float]:
        if supply_temp is None or return_temp is None:
            return None
        return supply_temp - return_temp

    def calculate_resistance_estimate(
        self,
        flow_rate: Optional[float],
        temp_diff: Optional[float],
        valve_open_rate: Optional[float],
        reference_flow: float = 1.0,
    ) -> Optional[float]:
        if flow_rate is None or flow_rate <= 0:
            return None

        if temp_diff is None:
            return None

        if valve_open_rate is None or valve_open_rate <= 0:
            return None

        try:
            resistance_ratio = (reference_flow / flow_rate) ** 2 if flow_rate > 0 else 0
            valve_factor = 1.0 / (valve_open_rate / 100.0) if valve_open_rate > 0 else float("inf")
            return resistance_ratio * valve_factor
        except (ZeroDivisionError, OverflowError):
            return None

    def calculate_actual_heat_rate(
        self,
        flow_rate: Optional[float],
        temp_diff: Optional[float],
        flow_unit: str = "m3/h",
    ) -> Optional[float]:
        if flow_rate is None or temp_diff is None:
            return None

        if flow_rate <= 0 or temp_diff <= 0:
            return None

        if flow_unit == "m3/h":
            flow_kg_s = flow_rate * WATER_DENSITY / 3600.0
        elif flow_unit == "kg/h":
            flow_kg_s = flow_rate / 3600.0
        elif flow_unit == "L/s":
            flow_kg_s = flow_rate * 1.0
        else:
            flow_kg_s = flow_rate * WATER_DENSITY / 3600.0

        heat_rate_kw = flow_kg_s * WATER_SPECIFIC_HEAT * temp_diff
        return heat_rate_kw

    def calculate_required_heat_rate(
        self,
        unit: BuildingUnit,
        weather_point: Optional[WeatherLoadPoint],
    ) -> Optional[float]:
        if unit.design_heat_load <= 0:
            return None

        if weather_point is None:
            return unit.design_heat_load

        required_heat = unit.design_heat_load * weather_point.design_load_ratio
        required_heat *= weather_point.ambient_heat_loss_factor

        return required_heat

    def calculate_heat_deficit(
        self, actual_heat: Optional[float], required_heat: Optional[float]
    ) -> Tuple[Optional[float], Optional[float]]:
        if actual_heat is None or required_heat is None:
            return None, None

        deficit = required_heat - actual_heat
        deficit_ratio = deficit / required_heat if required_heat > 0 else None

        return deficit, deficit_ratio

    def calculate_valve_adjustment(
        self,
        current_open: Optional[float],
        heat_deficit_ratio: Optional[float],
        valve_min: float = 0.0,
        valve_max: float = 100.0,
    ) -> Optional[float]:
        if current_open is None or heat_deficit_ratio is None:
            return None

        adjustment_factor = 1.0 + heat_deficit_ratio

        if adjustment_factor > 1.0:
            adjust_ratio = min(adjustment_factor - 1.0, 0.5)
            target_open = current_open + adjust_ratio * (valve_max - current_open)
        elif adjustment_factor < 1.0:
            adjust_ratio = min(1.0 - adjustment_factor, 0.5)
            target_open = current_open - adjust_ratio * (current_open - valve_min)
        else:
            target_open = current_open

        target_open = max(valve_min, min(valve_max, target_open))
        adjustment = target_open - current_open

        return adjustment

    def is_balanced(
        self, heat_deficit_ratio: Optional[float], threshold: Optional[float] = None
    ) -> bool:
        if heat_deficit_ratio is None:
            return True

        if threshold is None:
            threshold = self.balance_threshold

        return abs(heat_deficit_ratio) <= threshold

    def analyze_time_slice(
        self, ts: datetime, unit_id: str
    ) -> TimeSliceResult:
        unit = self.units.get(unit_id)
        if unit is None:
            return TimeSliceResult(
                timestamp=ts,
                unit_id=unit_id,
                supply_temp=None,
                return_temp=None,
                flow_rate=None,
                temp_diff=None,
                resistance_estimate=None,
                actual_heat_rate=None,
                required_heat_rate=None,
                heat_deficit=None,
                current_valve_open=None,
                recommended_valve_adjust=None,
                anomalies=[{"type": "missing_unit", "message": f"单元 {unit_id} 不存在"}],
                is_balanced=False,
            )

        reading = None
        if ts in self._readings_by_time_unit:
            reading = self._readings_by_time_unit[ts].get(unit_id)

        weather_point = self._get_weather_for_time(ts)
        valve = self._get_valve_for_unit(unit_id)

        anomalies: List[Dict] = []

        supply_temp = reading.supply_temp if reading else None
        return_temp = reading.return_temp if reading else None
        flow_rate = reading.flow_rate if reading else None

        if reading is None:
            anomalies.append(
                {
                    "type": AnomalyType.SENSOR_MISSING.value,
                    "unit_id": unit_id,
                    "timestamp": ts.isoformat(),
                    "missing_fields": ["supply_temp", "return_temp", "flow_rate"],
                    "message": f"时间片 {ts} 无传感器数据",
                }
            )
        elif not reading.is_valid:
            anomalies.append(
                {
                    "type": "invalid_reading",
                    "unit_id": unit_id,
                    "timestamp": ts.isoformat(),
                    "message": f"传感器数据无效",
                }
            )

        if valve and valve.is_enabled:
            current_open = valve.current_open_rate
            valve_min = valve.min_open_rate
            valve_max = valve.max_open_rate

            if current_open < valve_min or current_open > valve_max:
                anomalies.append(
                    {
                        "type": AnomalyType.VALVE_OUT_OF_BOUNDS.value,
                        "valve_id": valve.valve_id,
                        "unit_id": unit_id,
                        "current_value": current_open,
                        "min_bound": valve_min,
                        "max_bound": valve_max,
                        "message": f"阀门开度 {current_open}% 超出范围 [{valve_min}%, {valve_max}%]",
                    }
                )
        else:
            current_open = None
            valve_min = 0.0
            valve_max = 100.0

        temp_diff = self.calculate_temp_diff(supply_temp, return_temp)

        resistance = self.calculate_resistance_estimate(
            flow_rate, temp_diff, current_open
        )

        actual_heat = self.calculate_actual_heat_rate(flow_rate, temp_diff)

        required_heat = self.calculate_required_heat_rate(unit, weather_point)

        heat_deficit, heat_deficit_ratio = self.calculate_heat_deficit(
            actual_heat, required_heat
        )

        valve_adjust = self.calculate_valve_adjustment(
            current_open, heat_deficit_ratio, valve_min, valve_max
        )

        is_balanced = self.is_balanced(heat_deficit_ratio)

        return TimeSliceResult(
            timestamp=ts,
            unit_id=unit_id,
            supply_temp=supply_temp,
            return_temp=return_temp,
            flow_rate=flow_rate,
            temp_diff=temp_diff,
            resistance_estimate=resistance,
            actual_heat_rate=actual_heat,
            required_heat_rate=required_heat,
            heat_deficit=heat_deficit,
            current_valve_open=current_open,
            recommended_valve_adjust=valve_adjust,
            anomalies=anomalies,
            is_balanced=is_balanced,
        )

    def run_full_analysis(self, project_name: str = "未命名项目") -> AnalysisResult:
        time_slices = self.get_time_slices()
        all_results: List[TimeSliceResult] = []

        for ts in time_slices:
            for unit_id in self.units.keys():
                result = self.analyze_time_slice(ts, unit_id)
                all_results.append(result)

        summary = self._generate_summary(all_results, time_slices)

        return AnalysisResult(
            project_name=project_name,
            analysis_time=datetime.now(),
            time_slices=time_slices,
            units=self.units,
            valves=self.valves,
            results=all_results,
            summary=summary,
        )

    def _generate_summary(
        self, results: List[TimeSliceResult], time_slices: List[datetime]
    ) -> Dict:
        total_units = len(self.units)
        total_slices = len(time_slices)
        total_measurements = len(results)

        unbalanced_count = sum(1 for r in results if not r.is_balanced)
        units_with_issues = set()
        anomaly_count = 0
        sensor_missing_count = 0
        valve_out_of_bounds_count = 0

        for r in results:
            anomaly_count += len(r.anomalies)
            for a in r.anomalies:
                a_type = a.get("type", "")
                if a_type == AnomalyType.SENSOR_MISSING.value:
                    sensor_missing_count += 1
                if a_type == AnomalyType.VALVE_OUT_OF_BOUNDS.value:
                    valve_out_of_bounds_count += 1
                if r.unit_id:
                    units_with_issues.add(r.unit_id)

        all_heat_deficits = [
            r.heat_deficit for r in results if r.heat_deficit is not None
        ]
        avg_heat_deficit = sum(all_heat_deficits) / len(all_heat_deficits) if all_heat_deficits else None
        max_heat_deficit = max(all_heat_deficits) if all_heat_deficits else None
        min_heat_deficit = min(all_heat_deficits) if all_heat_deficits else None

        return {
            "total_units": total_units,
            "total_time_slices": total_slices,
            "total_measurements": total_measurements,
            "unbalanced_count": unbalanced_count,
            "unbalanced_ratio": unbalanced_count / total_measurements if total_measurements > 0 else 0,
            "units_with_issues_count": len(units_with_issues),
            "units_with_issues": list(units_with_issues),
            "total_anomalies": anomaly_count,
            "sensor_missing_count": sensor_missing_count,
            "valve_out_of_bounds_count": valve_out_of_bounds_count,
            "heat_deficit_stats": {
                "average": avg_heat_deficit,
                "maximum": max_heat_deficit,
                "minimum": min_heat_deficit,
            },
            "balance_threshold_used": self.balance_threshold,
        }
