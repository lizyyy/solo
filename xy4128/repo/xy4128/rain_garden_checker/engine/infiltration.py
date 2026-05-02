import math
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

from rain_garden_checker.models.data_models import (
    RainfallSeries,
    SoilInfiltrationTest,
    CatchmentArea,
    PondGeometry,
    SimulationConfig,
    SimulationTimeStep,
    SimulationResult,
    InfiltrationModel,
    TimeUnit,
    LengthUnit,
    AreaUnit,
    UnitConversion,
)


class InfiltrationModels:
    @staticmethod
    def horton(f0: float, fc: float, k: float, time: float) -> float:
        return fc + (f0 - fc) * math.exp(-k * time)

    @staticmethod
    def horton_cumulative(f0: float, fc: float, k: float, time: float) -> float:
        if k <= 0:
            return 0.0
        return fc * time + (f0 - fc) / k * (1 - math.exp(-k * time))

    @staticmethod
    def green_ampt(
        Ks: float, theta_s: float, theta_i: float, psi_f: float,
        cumulative_infiltration: float, rainfall_rate: float, dt: float
    ) -> Tuple[float, float]:
        if cumulative_infiltration <= 0:
            f_pond = Ks * (1 + psi_f * (theta_s - theta_i) / (1e-10))
            actual_f = min(f_pond, rainfall_rate)
            return actual_f, min(actual_f * dt, rainfall_rate * dt)

        effective_depth = cumulative_infiltration / (theta_s - theta_i) if (theta_s - theta_i) > 0 else 1e10
        f_capacity = Ks * (1 + psi_f / effective_depth) if effective_depth > 0 else Ks

        if rainfall_rate <= f_capacity:
            return rainfall_rate, rainfall_rate * dt
        else:
            return f_capacity, f_capacity * dt

    @staticmethod
    def philip(S: float, A: float, time: float) -> float:
        if time <= 0:
            return 1e10
        return 0.5 * S / math.sqrt(time) + A

    @staticmethod
    def philip_cumulative(S: float, A: float, time: float) -> float:
        return S * math.sqrt(time) + A * time

    @staticmethod
    def scs_cn(CN: float, rainfall: float) -> float:
        S = (25400 / CN) - 254 if CN > 0 else 254
        if rainfall <= 0.2 * S:
            return 0.0
        return (rainfall - 0.2 * S) ** 2 / (rainfall + 0.8 * S)


class HydrologicEngine:
    def __init__(self):
        pass

    def _convert_to_standard_units(
        self,
        rainfall: RainfallSeries,
        soil: SoilInfiltrationTest,
        catchments: List[CatchmentArea],
        pond: PondGeometry,
        config: SimulationConfig,
    ) -> Dict[str, Any]:
        config_dt_hours = UnitConversion.convert_time(
            config.time_step, config.time_unit, TimeUnit.HOUR
        )

        rainfall_dt_hours = UnitConversion.convert_time(
            rainfall.time_step if rainfall.time_step > 0 else config.time_step,
            rainfall.time_unit,
            TimeUnit.HOUR
        )

        Ks_mm_h = soil.saturated_hydraulic_conductivity
        if soil.conductivity_unit != LengthUnit.MILLIMETER:
            Ks_mm_h = UnitConversion.convert_length(
                soil.saturated_hydraulic_conductivity,
                soil.conductivity_unit,
                LengthUnit.MILLIMETER
            )
        if soil.conductivity_time_unit != TimeUnit.HOUR:
            factor = UnitConversion.convert_time(1, TimeUnit.HOUR, soil.conductivity_time_unit)
            Ks_mm_h = Ks_mm_h * factor

        total_catchment_area_m2 = 0.0
        weighted_runoff_coeff = 0.0
        for c in catchments:
            area_m2 = UnitConversion.convert_area(c.area, c.area_unit, AreaUnit.SQUARE_METER)
            total_catchment_area_m2 += area_m2
            weighted_runoff_coeff += c.runoff_coefficient * area_m2

        avg_runoff_coeff = (
            weighted_runoff_coeff / total_catchment_area_m2
            if total_catchment_area_m2 > 0 else 0.5
        )

        pond_area_m2 = UnitConversion.convert_area(
            pond.surface_area, pond.area_unit, AreaUnit.SQUARE_METER
        )
        pond_depth_m = UnitConversion.convert_length(
            pond.depth, pond.depth_unit, LengthUnit.METER
        )
        pond_volume_m3 = pond.storage_volume if pond.storage_volume else pond_area_m2 * pond_depth_m

        underdrain_mm_h = 0.0
        if pond.underdrain_rate and pond.underdrain_rate > 0:
            underdrain_mm_h = pond.underdrain_rate
            if pond.underdrain_unit != LengthUnit.MILLIMETER:
                underdrain_mm_h = UnitConversion.convert_length(
                    pond.underdrain_rate, pond.underdrain_unit, LengthUnit.MILLIMETER
                )
            if pond.underdrain_time_unit != TimeUnit.HOUR:
                factor = UnitConversion.convert_time(1, TimeUnit.HOUR, pond.underdrain_time_unit)
                underdrain_mm_h = underdrain_mm_h * factor

        return {
            "config_dt_hours": config_dt_hours,
            "rainfall_dt_hours": rainfall_dt_hours,
            "Ks_mm_h": Ks_mm_h,
            "total_catchment_area_m2": total_catchment_area_m2,
            "avg_runoff_coeff": avg_runoff_coeff,
            "pond_area_m2": pond_area_m2,
            "pond_depth_m": pond_depth_m,
            "pond_volume_m3": pond_volume_m3,
            "underdrain_mm_h": underdrain_mm_h,
            "enable_underdrain": config.enable_underdrain,
            "max_drain_hours": config.max_drain_hours,
        }

    def _resample_rainfall(
        self, rainfall: RainfallSeries, target_dt_minutes: float
    ) -> List[Tuple[float, float]]:
        original_times = [dp.time for dp in rainfall.data]
        original_intensities = [dp.intensity for dp in rainfall.data]

        if rainfall.time_unit != TimeUnit.MINUTE:
            original_times = [
                UnitConversion.convert_time(t, rainfall.time_unit, TimeUnit.MINUTE)
                for t in original_times
            ]

        if len(original_times) < 2:
            return [(0.0, original_intensities[0])] if original_intensities else []

        total_duration = original_times[-1] - original_times[0]
        num_steps = max(1, int(math.ceil(total_duration / target_dt_minutes)))

        resampled: List[Tuple[float, float]] = []
        for i in range(num_steps + 1):
            target_time = original_times[0] + i * target_dt_minutes

            if target_time >= original_times[-1]:
                if target_time == original_times[-1]:
                    resampled.append((target_time, original_intensities[-1]))
                break

            idx = np.searchsorted(original_times, target_time) - 1
            if idx < 0:
                idx = 0
            if idx >= len(original_times) - 1:
                resampled.append((target_time, original_intensities[-1]))
                continue

            t1, t2 = original_times[idx], original_times[idx + 1]
            i1, i2 = original_intensities[idx], original_intensities[idx + 1]

            if t2 - t1 < 1e-10:
                intensity = i1
            else:
                alpha = (target_time - t1) / (t2 - t1)
                intensity = i1 * (1 - alpha) + i2 * alpha

            resampled.append((target_time, max(0, intensity)))

        if not resampled:
            resampled = [(t, i) for t, i in zip(original_times, original_intensities)]

        return resampled

    def simulate(
        self,
        rainfall: RainfallSeries,
        soil: SoilInfiltrationTest,
        catchments: List[CatchmentArea],
        pond: PondGeometry,
        config: SimulationConfig,
    ) -> Optional[SimulationResult]:
        if not catchments:
            return None

        units = self._convert_to_standard_units(rainfall, soil, catchments, pond, config)
        config_dt_minutes = UnitConversion.convert_time(
            config.time_step, config.time_unit, TimeUnit.MINUTE
        )

        resampled_rainfall = self._resample_rainfall(rainfall, config_dt_minutes)
        if not resampled_rainfall:
            return None

        dt_hours = units["config_dt_hours"]
        catchment_area_m2 = units["total_catchment_area_m2"]
        runoff_coeff = units["avg_runoff_coeff"]
        pond_area_m2 = units["pond_area_m2"]
        pond_volume_m3 = units["pond_volume_m3"]
        Ks_mm_h = units["Ks_mm_h"]
        underdrain_mm_h = units["underdrain_mm_h"]
        enable_underdrain = units["enable_underdrain"]

        horton_params = soil.to_horton_params()
        ga_params = soil.to_green_ampt_params()
        philip_params = soil.to_philip_params()

        time_series: List[SimulationTimeStep] = []

        current_storage = 0.0
        current_level = 0.0
        cumulative_infiltration = 0.0
        cumulative_overflow = 0.0
        total_runoff_volume = 0.0
        total_infiltration_volume = 0.0
        total_overflow_volume = 0.0
        peak_storage = 0.0
        peak_level = 0.0
        has_overflow = False
        elapsed_time_hours = 0.0

        for time_min, intensity_mm in resampled_rainfall:
            intensity_mm_h = intensity_mm / (config_dt_minutes / 60) if config_dt_minutes > 0 else 0

            runoff_mm_h = intensity_mm_h * runoff_coeff
            runoff_inflow_m3_h = (runoff_mm_h / 1000) * catchment_area_m2

            available_for_infiltration_m3_h = runoff_inflow_m3_h

            if config.infiltration_model == InfiltrationModel.HORTON:
                f0 = horton_params["f0"]
                fc = horton_params["fc"]
                k = horton_params["k"]
                infiltration_rate_mm_h = InfiltrationModels.horton(f0, fc, k, elapsed_time_hours)
                infiltration_rate_m3_h = (infiltration_rate_mm_h / 1000) * pond_area_m2

            elif config.infiltration_model == InfiltrationModel.GREEN_AMPT:
                Ks = ga_params["Ks"]
                theta_s = ga_params["theta_s"]
                theta_i = ga_params["theta_i"]
                psi_f = ga_params["psi_f"]

                cumulative_mm = cumulative_infiltration / pond_area_m2 * 1000 if pond_area_m2 > 0 else 0
                rate_mm_h, vol_mm = InfiltrationModels.green_ampt(
                    Ks, theta_s, theta_i, psi_f, cumulative_mm, runoff_mm_h, dt_hours
                )
                infiltration_rate_mm_h = rate_mm_h
                infiltration_rate_m3_h = (vol_mm / 1000) * pond_area_m2 / dt_hours if dt_hours > 0 else 0

            elif config.infiltration_model == InfiltrationModel.PHILIP:
                S = philip_params["S"]
                A = philip_params["A"]
                if elapsed_time_hours > 0:
                    infiltration_rate_mm_h = InfiltrationModels.philip(S, A, elapsed_time_hours)
                else:
                    infiltration_rate_mm_h = runoff_mm_h * 2
                infiltration_rate_m3_h = (infiltration_rate_mm_h / 1000) * pond_area_m2

            else:
                infiltration_rate_mm_h = Ks_mm_h
                infiltration_rate_m3_h = (infiltration_rate_mm_h / 1000) * pond_area_m2

            actual_infiltration_m3_h = min(
                infiltration_rate_m3_h,
                available_for_infiltration_m3_h + current_storage / dt_hours if dt_hours > 0 else 0
            )
            actual_infiltration_m3 = actual_infiltration_m3_h * dt_hours

            inflow_m3 = runoff_inflow_m3_h * dt_hours

            after_inflow = current_storage + inflow_m3 - actual_infiltration_m3

            underdrain_m3 = 0.0
            if enable_underdrain and underdrain_mm_h > 0:
                underdrain_rate_m3_h = (underdrain_mm_h / 1000) * pond_area_m2
                underdrain_m3 = underdrain_rate_m3_h * dt_hours
                underdrain_m3 = min(underdrain_m3, after_inflow)

            after_underdrain = after_inflow - underdrain_m3

            overflow_m3 = 0.0
            if after_underdrain > pond_volume_m3:
                overflow_m3 = after_underdrain - pond_volume_m3
                current_storage = pond_volume_m3
                has_overflow = True
            else:
                current_storage = max(0, after_underdrain)

            current_level = (current_storage / pond_area_m2) if pond_area_m2 > 0 else 0

            cumulative_infiltration += actual_infiltration_m3
            cumulative_overflow += overflow_m3
            total_runoff_volume += inflow_m3
            total_infiltration_volume += actual_infiltration_m3
            total_overflow_volume += overflow_m3

            if current_storage > peak_storage:
                peak_storage = current_storage
                peak_level = current_level

            step = SimulationTimeStep(
                time=elapsed_time_hours,
                rainfall_intensity=intensity_mm_h,
                runoff_inflow=runoff_inflow_m3_h,
                infiltration_rate=actual_infiltration_m3_h,
                pond_level=current_level,
                storage_volume=current_storage,
                overflow_rate=overflow_m3 / dt_hours if dt_hours > 0 else 0,
                underdrain_rate=underdrain_m3 / dt_hours if dt_hours > 0 else 0,
                cumulative_infiltration=cumulative_infiltration,
                cumulative_overflow=cumulative_overflow,
            )
            time_series.append(step)

            elapsed_time_hours += dt_hours

        drain_time_hours = 0.0
        if current_storage > 0 and enable_underdrain:
            drain_rate_m3_h = (underdrain_mm_h / 1000) * pond_area_m2 if underdrain_mm_h > 0 else (Ks_mm_h / 1000) * pond_area_m2
            if drain_rate_m3_h > 0:
                drain_time_hours = current_storage / drain_rate_m3_h
            else:
                drain_time_hours = float('inf')

            while current_storage > 1e-6:
                drain_volume = min(drain_rate_m3_h * dt_hours, current_storage)
                current_storage -= drain_volume
                drain_time_hours += dt_hours

                step = SimulationTimeStep(
                    time=elapsed_time_hours,
                    rainfall_intensity=0,
                    runoff_inflow=0,
                    infiltration_rate=drain_rate_m3_h * 0.5,
                    pond_level=current_storage / pond_area_m2 if pond_area_m2 > 0 else 0,
                    storage_volume=current_storage,
                    overflow_rate=0,
                    underdrain_rate=drain_rate_m3_h,
                    cumulative_infiltration=cumulative_infiltration,
                    cumulative_overflow=cumulative_overflow,
                )
                time_series.append(step)
                elapsed_time_hours += dt_hours

        result = SimulationResult(
            rainfall_name=rainfall.name,
            return_period=rainfall.return_period,
            config=config,
            time_series=time_series,
            total_runoff_volume=total_runoff_volume,
            total_infiltration_volume=total_infiltration_volume,
            total_overflow_volume=total_overflow_volume,
            peak_pond_level=peak_level,
            peak_storage=peak_storage,
            drain_time_hours=drain_time_hours,
            has_overflow=has_overflow,
        )

        return result

    def compare_simulations(
        self, results_a: SimulationResult, results_b: SimulationResult
    ) -> Dict[str, Any]:
        vol_diff = results_b.total_overflow_volume - results_a.total_overflow_volume
        peak_diff = results_b.peak_pond_level - results_a.peak_pond_level

        return {
            "rainfall_a_name": results_a.rainfall_name,
            "rainfall_a_return_period": results_a.return_period,
            "rainfall_b_name": results_b.rainfall_name,
            "rainfall_b_return_period": results_b.return_period,
            "volume_difference": vol_diff,
            "volume_difference_percent": (
                vol_diff / results_a.total_overflow_volume * 100
                if results_a.total_overflow_volume > 0 else 0
            ),
            "peak_difference": peak_diff,
            "overflow_a": results_a.has_overflow,
            "overflow_b": results_b.has_overflow,
            "drain_time_a": results_a.drain_time_hours,
            "drain_time_b": results_b.drain_time_hours,
            "a_total_runoff": results_a.total_runoff_volume,
            "b_total_runoff": results_b.total_runoff_volume,
            "a_total_infiltration": results_a.total_infiltration_volume,
            "b_total_infiltration": results_b.total_infiltration_volume,
        }
