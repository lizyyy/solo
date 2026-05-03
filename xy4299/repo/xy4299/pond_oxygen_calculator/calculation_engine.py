import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
from datetime import timedelta

from .model_params import ModelParameters
from .config import DEFAULT_CONFIG


@dataclass
class OxygenBalanceResult:
    timestamp: pd.Timestamp
    pond_id: str
    dissolved_oxygen: float
    saturation_do: float
    do_percent_saturation: float

    fish_respiration: float
    phytoplankton_respiration: float
    sediment_oxygen_demand: float
    total_oxygen_consumption: float

    photosynthesis: float
    reaeration: float
    total_oxygen_production: float

    net_oxygen_change: float
    predicted_do_next_hour: float
    risk_level: str
    aeration_needed: bool


@dataclass
class PondCalculationResult:
    pond_id: str
    hourly_results: List[OxygenBalanceResult]
    summary: Dict[str, Any]


class CalculationEngine:
    def __init__(
        self,
        config: Optional[Dict] = None,
        model_params: Optional[ModelParameters] = None,
    ):
        self.config = config or DEFAULT_CONFIG
        self.model_params = model_params or ModelParameters(config)

        self.critical_do = self.config["oxygen"]["critical_level"]
        self.warning_do = self.config["oxygen"]["warning_level"]
        self.aerator_power = self.config["aerator"]["power_per_unit"]
        self.aerator_efficiency = self.config["aerator"]["efficiency"]

    def calculate_ponds(
        self,
        df: pd.DataFrame,
        aerator_count: int = 4,
        pond_area: float = 1.0,
        water_depth: float = 1.5,
        fish_species: str = "tilapia",
    ) -> Dict[str, PondCalculationResult]:
        results = {}

        for pond_id in df["pond_id"].unique():
            pond_df = df[df["pond_id"] == pond_id].sort_values("timestamp").copy()

            if "aerator_count" in pond_df.columns:
                pond_aerator_count = int(pond_df["aerator_count"].iloc[0])
            else:
                pond_aerator_count = aerator_count

            if "pond_area" in pond_df.columns:
                pond_pond_area = float(pond_df["pond_area"].iloc[0])
            else:
                pond_pond_area = pond_area

            if "water_depth" in pond_df.columns:
                pond_water_depth = float(pond_df["water_depth"].iloc[0])
            else:
                pond_water_depth = water_depth

            pond_result = self._calculate_single_pond(
                pond_df,
                pond_aerator_count,
                pond_pond_area,
                pond_water_depth,
                fish_species,
            )
            results[pond_id] = pond_result

        return results

    def _calculate_single_pond(
        self,
        pond_df: pd.DataFrame,
        aerator_count: int,
        pond_area: float,
        water_depth: float,
        fish_species: str,
    ) -> PondCalculationResult:
        hourly_results = []

        pond_df = pond_df.sort_values("timestamp").reset_index(drop=True)

        for i in range(len(pond_df)):
            row = pond_df.iloc[i]
            timestamp = row["timestamp"]
            hour_of_day = timestamp.hour

            temperature = row["temperature"]
            dissolved_oxygen = row["dissolved_oxygen"]
            fish_density = row["fish_density"]
            feeding_rate = row["feeding_rate"]
            weather = row["weather"]

            saturation_do = self.model_params.calculate_saturation_do(temperature)
            do_percent_saturation = (dissolved_oxygen / saturation_do) * 100

            fish_respiration = self.model_params.get_fish_respiration_rate(
                temperature, fish_density, fish_species
            )

            phytoplankton_respiration = (
                self.model_params.get_phytoplankton_respiration(temperature)
            )

            sediment_oxygen_demand = self.model_params.get_sediment_oxygen_demand(
                temperature
            )

            feeding_factor = 1.0 + (feeding_rate / 150) * 0.3
            total_oxygen_consumption = (
                fish_respiration
                + phytoplankton_respiration
                + sediment_oxygen_demand
            ) * feeding_factor

            photosynthesis = self.model_params.get_photosynthesis_rate(
                hour_of_day, weather, temperature
            )

            reaeration = self.model_params.get_reaeration_rate(
                dissolved_oxygen, temperature, weather, water_depth
            )

            total_oxygen_production = photosynthesis + reaeration

            net_oxygen_change = total_oxygen_production - total_oxygen_consumption

            predicted_do_next_hour = max(
                0, dissolved_oxygen + net_oxygen_change
            )

            risk_level = self.model_params.get_risk_level(predicted_do_next_hour)
            aeration_needed = predicted_do_next_hour < self.warning_do

            hourly_result = OxygenBalanceResult(
                timestamp=timestamp,
                pond_id=row["pond_id"],
                dissolved_oxygen=dissolved_oxygen,
                saturation_do=saturation_do,
                do_percent_saturation=do_percent_saturation,
                fish_respiration=fish_respiration,
                phytoplankton_respiration=phytoplankton_respiration,
                sediment_oxygen_demand=sediment_oxygen_demand,
                total_oxygen_consumption=total_oxygen_consumption,
                photosynthesis=photosynthesis,
                reaeration=reaeration,
                total_oxygen_production=total_oxygen_production,
                net_oxygen_change=net_oxygen_change,
                predicted_do_next_hour=predicted_do_next_hour,
                risk_level=risk_level,
                aeration_needed=aeration_needed,
            )

            hourly_results.append(hourly_result)

        summary = self._generate_pond_summary(hourly_results, pond_area, water_depth)

        return PondCalculationResult(
            pond_id=pond_df["pond_id"].iloc[0],
            hourly_results=hourly_results,
            summary=summary,
        )

    def _generate_pond_summary(
        self,
        hourly_results: List[OxygenBalanceResult],
        pond_area: float,
        water_depth: float,
    ) -> Dict[str, Any]:
        do_values = [r.dissolved_oxygen for r in hourly_results]
        predicted_do_values = [r.predicted_do_next_hour for r in hourly_results]
        risk_levels = [r.risk_level for r in hourly_results]
        aeration_needed = [r.aeration_needed for r in hourly_results]

        night_start = self.config["electricity"]["night_start_hour"]
        night_end = self.config["electricity"]["night_end_hour"]

        night_results = [
            r for r in hourly_results
            if (r.timestamp.hour >= night_start or r.timestamp.hour < night_end)
        ]

        night_do_values = [r.predicted_do_next_hour for r in night_results]
        night_risk_levels = [r.risk_level for r in night_results]
        night_aeration_needed = [r.aeration_needed for r in night_results]

        min_do = min(do_values) if do_values else 0
        max_do = max(do_values) if do_values else 0
        avg_do = np.mean(do_values) if do_values else 0

        min_night_do = min(night_do_values) if night_do_values else 0
        avg_night_do = np.mean(night_do_values) if night_do_values else 0

        critical_count = risk_levels.count("critical")
        warning_count = risk_levels.count("warning")
        normal_count = risk_levels.count("normal")

        night_critical_count = night_risk_levels.count("critical")
        night_warning_count = night_risk_levels.count("warning")
        night_aeration_hours = sum(night_aeration_needed)

        overall_risk = "normal"
        if critical_count > 0 or night_critical_count > 0:
            overall_risk = "critical"
        elif warning_count > 2 or night_warning_count > 3:
            overall_risk = "warning"

        return {
            "min_do": round(min_do, 2),
            "max_do": round(max_do, 2),
            "avg_do": round(avg_do, 2),
            "min_night_do": round(min_night_do, 2),
            "avg_night_do": round(avg_night_do, 2),
            "critical_count": critical_count,
            "warning_count": warning_count,
            "normal_count": normal_count,
            "night_critical_count": night_critical_count,
            "night_warning_count": night_warning_count,
            "night_aeration_hours_needed": night_aeration_hours,
            "overall_risk": overall_risk,
            "pond_area": pond_area,
            "water_depth": water_depth,
            "water_volume": round(pond_area * 10000 * water_depth, 0),
        }

    def predict_night_do(
        self,
        pond_df: pd.DataFrame,
        start_hour: int = 18,
        end_hour: int = 6,
        aerator_count: int = 4,
        aeration_schedule: Optional[List[bool]] = None,
        pond_area: float = 1.0,
        water_depth: float = 1.5,
        fish_species: str = "tilapia",
    ) -> Tuple[List[pd.Timestamp], List[float], List[str]]:
        night_hours = 12 if start_hour < end_hour else (24 - start_hour) + end_hour

        latest_data = pond_df.sort_values("timestamp").iloc[-1]
        base_timestamp = latest_data["timestamp"]

        base_temp = latest_data["temperature"]
        base_do = latest_data["dissolved_oxygen"]
        fish_density = latest_data["fish_density"]
        feeding_rate = latest_data["feeding_rate"]
        weather = latest_data["weather"]

        timestamps = []
        predicted_do = []
        risk_levels = []

        current_do = base_do
        aerator_on = False

        for hour_offset in range(night_hours + 1):
            timestamp = base_timestamp + timedelta(hours=hour_offset)
            hour_of_day = timestamp.hour

            temp_variation = -2 * np.sin((hour_offset) * np.pi / 12)
            current_temp = base_temp + temp_variation

            saturation_do = self.model_params.calculate_saturation_do(current_temp)

            fish_respiration = self.model_params.get_fish_respiration_rate(
                current_temp, fish_density, fish_species
            )
            phytoplankton_respiration = (
                self.model_params.get_phytoplankton_respiration(current_temp)
            )
            sediment_oxygen_demand = self.model_params.get_sediment_oxygen_demand(
                current_temp
            )

            feeding_factor = 1.0 + (feeding_rate / 150) * 0.3
            total_consumption = (
                fish_respiration
                + phytoplankton_respiration
                + sediment_oxygen_demand
            ) * feeding_factor

            photosynthesis = 0

            reaeration = self.model_params.get_reaeration_rate(
                current_do, current_temp, weather, water_depth
            )

            total_production = photosynthesis + reaeration

            if aeration_schedule is not None and hour_offset < len(aeration_schedule):
                aerator_on = aeration_schedule[hour_offset]
            else:
                aerator_on = False

            if aerator_on:
                aeration_rate = self._calculate_aeration_rate(
                    current_do,
                    current_temp,
                    saturation_do,
                    aerator_count,
                    water_depth,
                )
                total_production += aeration_rate

            net_change = total_production - total_consumption
            current_do = max(0, current_do + net_change)

            risk_level = self.model_params.get_risk_level(current_do)

            timestamps.append(timestamp)
            predicted_do.append(round(current_do, 2))
            risk_levels.append(risk_level)

        return timestamps, predicted_do, risk_levels

    def _calculate_aeration_rate(
        self,
        current_do: float,
        temperature: float,
        saturation_do: float,
        aerator_count: int,
        water_depth: float,
    ) -> float:
        aerator_power = self.aerator_power * aerator_count
        efficiency = self.model_params.get_aeration_efficiency(
            aerator_power, water_depth, temperature
        )

        do_deficit = saturation_do - current_do
        transfer_efficiency = min(1.0, do_deficit / saturation_do * 1.5)

        return efficiency * aerator_power * transfer_efficiency * 0.1

    def results_to_dataframe(
        self,
        pond_results: Dict[str, PondCalculationResult],
    ) -> pd.DataFrame:
        all_rows = []

        for pond_id, result in pond_results.items():
            for hourly in result.hourly_results:
                row = {
                    "timestamp": hourly.timestamp,
                    "pond_id": hourly.pond_id,
                    "dissolved_oxygen": hourly.dissolved_oxygen,
                    "saturation_do": hourly.saturation_do,
                    "do_percent_saturation": hourly.do_percent_saturation,
                    "fish_respiration": hourly.fish_respiration,
                    "phytoplankton_respiration": hourly.phytoplankton_respiration,
                    "sediment_oxygen_demand": hourly.sediment_oxygen_demand,
                    "total_oxygen_consumption": hourly.total_oxygen_consumption,
                    "photosynthesis": hourly.photosynthesis,
                    "reaeration": hourly.reaeration,
                    "total_oxygen_production": hourly.total_oxygen_production,
                    "net_oxygen_change": hourly.net_oxygen_change,
                    "predicted_do_next_hour": hourly.predicted_do_next_hour,
                    "risk_level": hourly.risk_level,
                    "aeration_needed": hourly.aeration_needed,
                }
                all_rows.append(row)

        return pd.DataFrame(all_rows)

    def summary_to_dataframe(
        self,
        pond_results: Dict[str, PondCalculationResult],
    ) -> pd.DataFrame:
        rows = []

        for pond_id, result in pond_results.items():
            row = {"pond_id": pond_id}
            row.update(result.summary)
            rows.append(row)

        return pd.DataFrame(rows)
