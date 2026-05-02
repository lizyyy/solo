from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple

import numpy as np
import pandas as pd

from .models import ProjectConfig, Sensor, SensorType


class ZeroDriftCorrector:
    def __init__(self, config: ProjectConfig):
        self.config = config
        self.drift_offsets: Dict[str, float] = {}
        self.zero_load_interval: Optional[Tuple[datetime, datetime]] = None

    def detect_zero_load_interval(
        self,
        df: pd.DataFrame,
        duration_seconds: Optional[float] = None,
    ) -> Tuple[datetime, datetime]:
        if duration_seconds is None:
            duration_seconds = self.config.zero_load_duration

        if df.empty:
            raise ValueError("数据为空，无法检测空载区间")

        times = df.index
        start_time = times[0]
        end_time = start_time + timedelta(seconds=duration_seconds)

        if end_time > times[-1]:
            end_time = times[-1]

        self.zero_load_interval = (start_time, end_time)
        return start_time, end_time

    def calculate_drift_offsets(
        self,
        df: pd.DataFrame,
        sensors: List[Sensor],
        zero_load_interval: Optional[Tuple[datetime, datetime]] = None,
    ) -> Dict[str, float]:
        if zero_load_interval is None:
            if self.zero_load_interval is None:
                zero_load_interval = self.detect_zero_load_interval(df)
            else:
                zero_load_interval = self.zero_load_interval

        start_time, end_time = zero_load_interval
        zero_load_data = df[(df.index >= start_time) & (df.index <= end_time)]

        if zero_load_data.empty:
            raise ValueError("空载区间内没有数据")

        sensor_map = {s.sensor_id: s for s in sensors}
        offsets: Dict[str, float] = {}

        for col in df.columns:
            if col.startswith("_"):
                continue

            if col in sensor_map:
                sensor = sensor_map[col]
                if sensor.type in [SensorType.STRAIN_GAUGE, SensorType.DISPLACEMENT_METER]:
                    zero_vals = zero_load_data[col].dropna()
                    if not zero_vals.empty:
                        offset = zero_vals.mean()
                        offsets[col] = offset
                        self.drift_offsets[col] = offset

        return offsets

    def apply_drift_correction(
        self,
        df: pd.DataFrame,
        offsets: Optional[Dict[str, float]] = None,
    ) -> pd.DataFrame:
        if offsets is None:
            offsets = self.drift_offsets

        corrected_df = df.copy()

        for sensor_id, offset in offsets.items():
            if sensor_id in corrected_df.columns:
                corrected_df[sensor_id] = corrected_df[sensor_id] - offset

        return corrected_df


class TemperatureCompensator:
    def __init__(self, config: ProjectConfig):
        self.config = config
        self.compensation_factors: Dict[str, Dict[str, float]] = {}

    def calculate_compensation(
        self,
        df: pd.DataFrame,
        sensors: List[Sensor],
        zero_load_interval: Tuple[datetime, datetime],
    ) -> Dict[str, Dict[str, float]]:
        start_time, end_time = zero_load_interval
        zero_load_data = df[(df.index >= start_time) & (df.index <= end_time)]

        if zero_load_data.empty:
            raise ValueError("空载区间内没有数据")

        sensor_map = {s.sensor_id: s for s in sensors}
        factors: Dict[str, Dict[str, float]] = {}

        for sensor in sensors:
            if sensor.type != SensorType.STRAIN_GAUGE:
                continue

            temp_sensor_id = sensor.temperature_compensation_sensor
            if not temp_sensor_id:
                continue

            if temp_sensor_id not in df.columns or sensor.sensor_id not in df.columns:
                continue

            temp_zero = zero_load_data[temp_sensor_id].dropna().mean()
            strain_zero = zero_load_data[sensor.sensor_id].dropna().mean()

            temp_vals = df[temp_sensor_id].dropna()
            strain_vals = df[sensor.sensor_id].dropna()

            if len(temp_vals) > 1 and len(strain_vals) > 1:
                valid_indices = temp_vals.index.intersection(strain_vals.index)
                if len(valid_indices) > 1:
                    temp_valid = temp_vals[valid_indices]
                    strain_valid = strain_vals[valid_indices]

                    temp_diff = temp_valid - temp_zero
                    strain_diff = strain_valid - strain_zero

                    temp_diff_nonzero = temp_diff[temp_diff != 0]
                    if len(temp_diff_nonzero) > 0:
                        alpha = np.mean(
                            strain_diff[temp_diff_nonzero.index] / temp_diff_nonzero
                        )
                    else:
                        alpha = self.config.material.thermal_expansion_coefficient * 1e6
                else:
                    alpha = self.config.material.thermal_expansion_coefficient * 1e6
            else:
                alpha = self.config.material.thermal_expansion_coefficient * 1e6

            factors[sensor.sensor_id] = {
                "temperature_sensor": temp_sensor_id,
                "zero_temperature": float(temp_zero),
                "zero_strain": float(strain_zero),
                "compensation_coefficient": float(alpha),
            }
            self.compensation_factors[sensor.sensor_id] = factors[sensor.sensor_id]

        return factors

    def apply_temperature_compensation(
        self,
        df: pd.DataFrame,
        factors: Optional[Dict[str, Dict[str, float]]] = None,
    ) -> pd.DataFrame:
        if factors is None:
            factors = self.compensation_factors

        compensated_df = df.copy()

        for sensor_id, factor in factors.items():
            if sensor_id not in compensated_df.columns:
                continue

            temp_sensor_id = factor.get("temperature_sensor")
            if not temp_sensor_id or temp_sensor_id not in compensated_df.columns:
                continue

            alpha = factor.get("compensation_coefficient", 0.0)
            zero_temp = factor.get("zero_temperature", 0.0)

            temp_diff = compensated_df[temp_sensor_id] - zero_temp
            thermal_strain = alpha * temp_diff

            compensated_df[sensor_id] = compensated_df[sensor_id] - thermal_strain

        return compensated_df


class TimeAligner:
    def __init__(self, config: ProjectConfig):
        self.config = config
        self.target_sampling_rate: float = config.default_sampling_rate
        self.aligned_columns: List[str] = []

    def align_multiple_dataframes(
        self,
        dataframes: Dict[str, pd.DataFrame],
        target_sampling_rate: Optional[float] = None,
        method: str = "linear",
    ) -> pd.DataFrame:
        if target_sampling_rate is None:
            target_sampling_rate = self.target_sampling_rate

        self.target_sampling_rate = target_sampling_rate
        interval = pd.Timedelta(seconds=1.0 / target_sampling_rate)

        all_times = []
        for name, df in dataframes.items():
            if not df.empty:
                all_times.extend(df.index.tolist())

        if not all_times:
            raise ValueError("没有可用的时间数据")

        min_time = min(all_times)
        max_time = max(all_times)

        target_times = pd.date_range(
            start=min_time,
            end=max_time,
            freq=interval,
        )

        aligned_df = pd.DataFrame(index=target_times)

        for name, df in dataframes.items():
            if df.empty:
                continue

            for col in df.columns:
                if col.startswith("_"):
                    continue

                col_name = f"{name}_{col}" if len(dataframes) > 1 else col

                series = df[col].dropna()
                if series.empty:
                    continue

                aligned_series = self._interpolate_series(
                    series, target_times, method=method
                )
                aligned_df[col_name] = aligned_series
                self.aligned_columns.append(col_name)

        return aligned_df

    def _interpolate_series(
        self,
        series: pd.Series,
        target_times: pd.DatetimeIndex,
        method: str = "linear",
    ) -> pd.Series:
        original_times = series.index
        original_values = series.values

        if len(original_times) < 2:
            return pd.Series(index=target_times, dtype=float)

        target_numeric = target_times.astype(np.int64) / 1e9
        original_numeric = original_times.astype(np.int64) / 1e9

        if method == "linear":
            from scipy.interpolate import interp1d

            try:
                interp_func = interp1d(
                    original_numeric,
                    original_values,
                    kind="linear",
                    bounds_error=False,
                    fill_value=np.nan,
                )
                interpolated = interp_func(target_numeric)
            except ImportError:
                interpolated = np.interp(
                    target_numeric, original_numeric, original_values, left=np.nan, right=np.nan
                )
        elif method == "time":
            interpolated = np.interp(
                target_numeric, original_numeric, original_values, left=np.nan, right=np.nan
            )
        else:
            interpolated = np.interp(
                target_numeric, original_numeric, original_values, left=np.nan, right=np.nan
            )

        return pd.Series(interpolated, index=target_times)

    def resample_single_dataframe(
        self,
        df: pd.DataFrame,
        target_sampling_rate: float,
        method: str = "linear",
    ) -> pd.DataFrame:
        interval = pd.Timedelta(seconds=1.0 / target_sampling_rate)

        min_time = df.index[0]
        max_time = df.index[-1]

        target_times = pd.date_range(
            start=min_time,
            end=max_time,
            freq=interval,
        )

        resampled_df = pd.DataFrame(index=target_times)

        for col in df.columns:
            if col.startswith("_"):
                continue

            series = df[col].dropna()
            if series.empty:
                continue

            aligned_series = self._interpolate_series(series, target_times, method=method)
            resampled_df[col] = aligned_series
            if col not in self.aligned_columns:
                self.aligned_columns.append(col)

        return resampled_df


class CalibrationPipeline:
    def __init__(self, config: ProjectConfig):
        self.config = config
        self.zero_corrector = ZeroDriftCorrector(config)
        self.temp_compensator = TemperatureCompensator(config)
        self.aligner = TimeAligner(config)
        self.calibrated_data: Optional[pd.DataFrame] = None
        self.aligned_data: Optional[pd.DataFrame] = None

    def calibrate(
        self,
        df: pd.DataFrame,
        sensors: List[Sensor],
        zero_load_interval: Optional[Tuple[datetime, datetime]] = None,
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        if zero_load_interval is None:
            zero_load_interval = self.zero_corrector.detect_zero_load_interval(df)

        drift_offsets = self.zero_corrector.calculate_drift_offsets(
            df, sensors, zero_load_interval
        )
        corrected_df = self.zero_corrector.apply_drift_correction(df, drift_offsets)

        temp_factors = self.temp_compensator.calculate_compensation(
            corrected_df, sensors, zero_load_interval
        )
        compensated_df = self.temp_compensator.apply_temperature_compensation(
            corrected_df, temp_factors
        )

        self.calibrated_data = compensated_df

        calibration_info = {
            "zero_load_interval": {
                "start": zero_load_interval[0],
                "end": zero_load_interval[1],
            },
            "drift_correction": drift_offsets,
            "temperature_compensation": temp_factors,
        }

        return compensated_df, calibration_info

    def align(
        self,
        dataframes: Dict[str, pd.DataFrame],
        target_sampling_rate: Optional[float] = None,
        method: str = "linear",
    ) -> pd.DataFrame:
        aligned_df = self.aligner.align_multiple_dataframes(
            dataframes, target_sampling_rate, method
        )
        self.aligned_data = aligned_df
        return aligned_df

    def get_calibration_summary(self) -> Dict[str, Any]:
        return {
            "drift_offsets": self.zero_corrector.drift_offsets,
            "temperature_factors": self.temp_compensator.compensation_factors,
            "aligned_columns": self.aligner.aligned_columns,
        }
