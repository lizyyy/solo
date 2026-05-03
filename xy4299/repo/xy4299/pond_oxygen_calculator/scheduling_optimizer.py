import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
from datetime import timedelta

from .model_params import ModelParameters
from .calculation_engine import CalculationEngine, PondCalculationResult
from .config import DEFAULT_CONFIG


@dataclass
class AeratorSchedule:
    pond_id: str
    start_time: pd.Timestamp
    end_time: pd.Timestamp
    duration_hours: float
    aerator_count: int
    estimated_power_kwh: float
    estimated_cost: float
    reason: str
    priority: int


@dataclass
class ScheduleResult:
    pond_id: str
    schedules: List[AeratorSchedule]
    total_hours: float
    total_kwh: float
    total_cost: float
    risk_mitigation_score: float
    optimization_notes: List[str]


class ElectricityPricing:
    PEAK = "peak"
    MID_PEAK = "mid_peak"
    OFF_PEAK = "off_peak"

    def __init__(
        self,
        peak_price: float = 1.2,
        mid_peak_price: float = 0.8,
        off_peak_price: float = 0.4,
        peak_hours: Tuple[int, int] = (9, 12),
        mid_peak_hours_1: Tuple[int, int] = (7, 9),
        mid_peak_hours_2: Tuple[int, int] = (12, 23),
        off_peak_hours: Tuple[int, int] = (23, 7),
    ):
        self.peak_price = peak_price
        self.mid_peak_price = mid_peak_price
        self.off_peak_price = off_peak_price
        self.peak_hours = peak_hours
        self.mid_peak_hours_1 = mid_peak_hours_1
        self.mid_peak_hours_2 = mid_peak_hours_2
        self.off_peak_hours = off_peak_hours

    def get_price_for_hour(self, hour: int) -> Tuple[float, str]:
        if self._is_in_hours(hour, self.peak_hours):
            return self.peak_price, self.PEAK
        elif self._is_in_hours(hour, self.mid_peak_hours_1) or self._is_in_hours(
            hour, self.mid_peak_hours_2
        ):
            return self.mid_peak_price, self.MID_PEAK
        else:
            return self.off_peak_price, self.OFF_PEAK

    def _is_in_hours(self, hour: int, hours_range: Tuple[int, int]) -> bool:
        start, end = hours_range
        if start < end:
            return start <= hour < end
        else:
            return hour >= start or hour < end


class SchedulingOptimizer:
    def __init__(
        self,
        config: Optional[Dict] = None,
        model_params: Optional[ModelParameters] = None,
        calculation_engine: Optional[CalculationEngine] = None,
    ):
        self.config = config or DEFAULT_CONFIG
        self.model_params = model_params or ModelParameters(config)
        self.calculation_engine = calculation_engine or CalculationEngine(
            config, model_params
        )

        self.critical_do = self.config["oxygen"]["critical_level"]
        self.warning_do = self.config["oxygen"]["warning_level"]
        self.aerator_power_per_unit = self.config["aerator"]["power_per_unit"]
        self.electricity_price = self.config["electricity"]["price_per_kwh"]

        self.electricity_pricing = ElectricityPricing()

    def optimize_schedules(
        self,
        pond_results: Dict[str, PondCalculationResult],
        df: pd.DataFrame,
        aerator_count: int = 4,
        pond_area: float = 1.0,
        water_depth: float = 1.5,
        fish_species: str = "tilapia",
        optimization_strategy: str = "balanced",
    ) -> Dict[str, ScheduleResult]:
        results = {}

        for pond_id, pond_result in pond_results.items():
            pond_df = df[df["pond_id"] == pond_id]

            schedule_result = self._optimize_single_pond(
                pond_result,
                pond_df,
                aerator_count,
                pond_area,
                water_depth,
                fish_species,
                optimization_strategy,
            )
            results[pond_id] = schedule_result

        return results

    def _optimize_single_pond(
        self,
        pond_result: PondCalculationResult,
        pond_df: pd.DataFrame,
        aerator_count: int,
        pond_area: float,
        water_depth: float,
        fish_species: str,
        optimization_strategy: str,
    ) -> ScheduleResult:
        schedules: List[AeratorSchedule] = []
        optimization_notes = []

        timestamps, predicted_do, risk_levels = self.calculation_engine.predict_night_do(
            pond_df,
            aerator_count=aerator_count,
            pond_area=pond_area,
            water_depth=water_depth,
            fish_species=fish_species,
        )

        historical_timestamps = list(pond_df["timestamp"])
        historical_do = list(pond_df["dissolved_oxygen"])
        historical_risk_levels = [
            self.model_params.get_risk_level(do) for do in historical_do
        ]

        all_timestamps = historical_timestamps + timestamps
        all_do = historical_do + predicted_do
        all_risk_levels = historical_risk_levels + risk_levels

        critical_periods = self._identify_critical_periods(
            all_timestamps, all_do, all_risk_levels
        )

        if optimization_strategy == "cost_saving":
            schedules = self._optimize_for_cost(
                critical_periods, aerator_count, pond_df
            )
            optimization_notes.append("采用成本节约策略：优先在谷电时段开机")
        elif optimization_strategy == "safety_first":
            schedules = self._optimize_for_safety(
                critical_periods, aerator_count, predicted_do, timestamps
            )
            optimization_notes.append("采用安全优先策略：提前开机预防缺氧")
        else:
            schedules = self._optimize_balanced(
                critical_periods, aerator_count, pond_df, predicted_do, timestamps
            )
            optimization_notes.append("采用平衡策略：在安全与成本间优化")

        schedules = self._merge_adjacent_schedules(schedules)

        total_hours = sum(s.duration_hours for s in schedules)
        total_kwh = sum(s.estimated_power_kwh for s in schedules)
        total_cost = sum(s.estimated_cost for s in schedules)

        risk_score = self._calculate_risk_mitigation_score(
            predicted_do, risk_levels, schedules
        )

        if not schedules:
            optimization_notes.append("无需增氧：预测溶氧水平安全")

        return ScheduleResult(
            pond_id=pond_result.pond_id,
            schedules=schedules,
            total_hours=round(total_hours, 1),
            total_kwh=round(total_kwh, 2),
            total_cost=round(total_cost, 2),
            risk_mitigation_score=round(risk_score, 2),
            optimization_notes=optimization_notes,
        )

    def _identify_critical_periods(
        self,
        timestamps: List[pd.Timestamp],
        predicted_do: List[float],
        risk_levels: List[str],
    ) -> List[Dict]:
        critical_periods = []
        current_period = None

        for i, (ts, do, risk) in enumerate(zip(timestamps, predicted_do, risk_levels)):
            if risk in ["critical", "warning"] or do < self.warning_do:
                if current_period is None:
                    current_period = {
                        "start_index": i,
                        "start_time": ts,
                        "min_do": do,
                        "max_risk": risk,
                    }
                else:
                    current_period["min_do"] = min(current_period["min_do"], do)
                    if risk == "critical":
                        current_period["max_risk"] = "critical"
            else:
                if current_period is not None:
                    current_period["end_index"] = i - 1
                    current_period["end_time"] = timestamps[i - 1]
                    current_period["duration_hours"] = (
                        current_period["end_time"] - current_period["start_time"]
                    ).total_seconds() / 3600
                    critical_periods.append(current_period)
                    current_period = None

        if current_period is not None:
            current_period["end_index"] = len(timestamps) - 1
            current_period["end_time"] = timestamps[-1]
            current_period["duration_hours"] = (
                current_period["end_time"] - current_period["start_time"]
            ).total_seconds() / 3600
            critical_periods.append(current_period)

        return critical_periods

    def _optimize_for_cost(
        self,
        critical_periods: List[Dict],
        aerator_count: int,
        pond_df: pd.DataFrame,
    ) -> List[AeratorSchedule]:
        schedules = []

        for period in critical_periods:
            start_hour = period["start_time"].hour
            end_hour = period["end_time"].hour

            if period["max_risk"] == "critical":
                schedule = self._create_aerator_schedule(
                    period["start_time"] - timedelta(hours=1),
                    period["end_time"] + timedelta(hours=1),
                    aerator_count,
                    "严重缺氧风险 - 必须开机",
                    1,
                )
                schedules.append(schedule)
            else:
                price, period_type = self.electricity_pricing.get_price_for_hour(start_hour)

                if period_type == ElectricityPricing.OFF_PEAK:
                    schedule = self._create_aerator_schedule(
                        period["start_time"] - timedelta(hours=0.5),
                        period["end_time"],
                        aerator_count,
                        "警告风险 - 谷电时段增氧",
                        2,
                    )
                    schedules.append(schedule)
                else:
                    schedule = self._create_aerator_schedule(
                        period["start_time"],
                        period["start_time"] + timedelta(hours=2),
                        aerator_count,
                        "警告风险 - 临时增氧",
                        2,
                    )
                    schedules.append(schedule)

        return schedules

    def _optimize_for_safety(
        self,
        critical_periods: List[Dict],
        aerator_count: int,
        predicted_do: List[float],
        timestamps: List[pd.Timestamp],
    ) -> List[AeratorSchedule]:
        schedules = []

        if not critical_periods:
            return schedules

        first_period = critical_periods[0]
        last_period = critical_periods[-1]

        start_time = first_period["start_time"] - timedelta(hours=2)
        end_time = last_period["end_time"] + timedelta(hours=1)

        schedule = self._create_aerator_schedule(
            start_time,
            end_time,
            aerator_count,
            "安全策略 - 预防性连续增氧",
            1,
        )
        schedules.append(schedule)

        return schedules

    def _optimize_balanced(
        self,
        critical_periods: List[Dict],
        aerator_count: int,
        pond_df: pd.DataFrame,
        predicted_do: List[float],
        timestamps: List[pd.Timestamp],
    ) -> List[AeratorSchedule]:
        schedules = []

        for period in critical_periods:
            if period["max_risk"] == "critical":
                schedule = self._create_aerator_schedule(
                    period["start_time"] - timedelta(hours=1),
                    period["end_time"] + timedelta(hours=1),
                    aerator_count,
                    "严重缺氧风险 - 紧急增氧",
                    1,
                )
                schedules.append(schedule)
            else:
                start_hour = period["start_time"].hour
                price, period_type = self.electricity_pricing.get_price_for_hour(start_hour)

                if period_type == ElectricityPricing.OFF_PEAK:
                    schedule = self._create_aerator_schedule(
                        period["start_time"] - timedelta(hours=1),
                        period["end_time"],
                        aerator_count,
                        "警告风险 - 谷电时段增氧",
                        2,
                    )
                    schedules.append(schedule)
                else:
                    schedule = self._create_aerator_schedule(
                        period["start_time"],
                        period["end_time"],
                        aerator_count,
                        "警告风险 - 按需增氧",
                        2,
                    )
                    schedules.append(schedule)

        return schedules

    def _create_aerator_schedule(
        self,
        start_time: pd.Timestamp,
        end_time: pd.Timestamp,
        aerator_count: int,
        reason: str,
        priority: int,
    ) -> AeratorSchedule:
        duration = (end_time - start_time).total_seconds() / 3600
        duration = max(duration, 0.5)

        power_kwh = duration * self.aerator_power_per_unit * aerator_count

        total_cost = 0.0
        current_time = start_time
        while current_time < end_time:
            hour = current_time.hour
            price, _ = self.electricity_pricing.get_price_for_hour(hour)
            next_hour = current_time + timedelta(hours=1)
            actual_end = min(next_hour, end_time)
            hour_duration = (actual_end - current_time).total_seconds() / 3600
            hour_power = hour_duration * self.aerator_power_per_unit * aerator_count
            total_cost += hour_power * price
            current_time = next_hour

        return AeratorSchedule(
            pond_id="",
            start_time=start_time,
            end_time=end_time,
            duration_hours=round(duration, 1),
            aerator_count=aerator_count,
            estimated_power_kwh=round(power_kwh, 2),
            estimated_cost=round(total_cost, 2),
            reason=reason,
            priority=priority,
        )

    def _merge_adjacent_schedules(
        self, schedules: List[AeratorSchedule]
    ) -> List[AeratorSchedule]:
        if not schedules:
            return schedules

        schedules.sort(key=lambda s: s.start_time)
        merged = [schedules[0]]

        for schedule in schedules[1:]:
            last = merged[-1]
            time_gap = (schedule.start_time - last.end_time).total_seconds() / 3600

            if time_gap <= 0.5 and last.aerator_count == schedule.aerator_count:
                merged[-1] = AeratorSchedule(
                    pond_id=last.pond_id,
                    start_time=last.start_time,
                    end_time=schedule.end_time,
                    duration_hours=round(
                        (schedule.end_time - last.start_time).total_seconds() / 3600, 1
                    ),
                    aerator_count=last.aerator_count,
                    estimated_power_kwh=round(
                        last.estimated_power_kwh + schedule.estimated_power_kwh, 2
                    ),
                    estimated_cost=round(last.estimated_cost + schedule.estimated_cost, 2),
                    reason=f"{last.reason} + {schedule.reason}",
                    priority=min(last.priority, schedule.priority),
                )
            else:
                merged.append(schedule)

        return merged

    def _calculate_risk_mitigation_score(
        self,
        predicted_do: List[float],
        risk_levels: List[str],
        schedules: List[AeratorSchedule],
    ) -> float:
        if not risk_levels:
            return 1.0

        critical_count = risk_levels.count("critical")
        warning_count = risk_levels.count("warning")
        total_hours = len(risk_levels)

        if total_hours == 0:
            return 1.0

        base_risk = (critical_count * 3 + warning_count) / (total_hours * 3)

        if schedules:
            total_schedule_hours = sum(s.duration_hours for s in schedules)
            coverage_ratio = min(1.0, total_schedule_hours / total_hours)
            mitigation = coverage_ratio * 0.8
        else:
            mitigation = 0

        score = 1.0 - base_risk + mitigation
        score = max(0.0, min(1.0, score))

        return score

    def schedules_to_dataframe(
        self,
        schedule_results: Dict[str, ScheduleResult],
    ) -> pd.DataFrame:
        all_rows = []

        for pond_id, result in schedule_results.items():
            for schedule in result.schedules:
                row = {
                    "pond_id": pond_id,
                    "start_time": schedule.start_time,
                    "end_time": schedule.end_time,
                    "duration_hours": schedule.duration_hours,
                    "aerator_count": schedule.aerator_count,
                    "estimated_power_kwh": schedule.estimated_power_kwh,
                    "estimated_cost": schedule.estimated_cost,
                    "reason": schedule.reason,
                    "priority": schedule.priority,
                }
                all_rows.append(row)

        return pd.DataFrame(all_rows)

    def summary_to_dataframe(
        self,
        schedule_results: Dict[str, ScheduleResult],
    ) -> pd.DataFrame:
        rows = []

        for pond_id, result in schedule_results.items():
            row = {
                "pond_id": pond_id,
                "total_hours": result.total_hours,
                "total_kwh": result.total_kwh,
                "total_cost": result.total_cost,
                "risk_mitigation_score": result.risk_mitigation_score,
                "schedule_count": len(result.schedules),
                "notes": "; ".join(result.optimization_notes),
            }
            rows.append(row)

        return pd.DataFrame(rows)
