from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple, NamedTuple

import numpy as np
import pandas as pd

from .models import ProjectConfig, Sensor, SensorType


class LoadLevel(NamedTuple):
    index: int
    start_time: datetime
    end_time: datetime
    load_value: float
    is_loading: bool


class StructuralAnalyzer:
    def __init__(self, config: ProjectConfig):
        self.config = config
        self.thresholds = config.thresholds
        self.alerts: List[Dict[str, Any]] = []

    def _add_alert(
        self,
        alert_type: str,
        severity: str,
        message: str,
        sensor_id: Optional[str] = None,
        time: Optional[datetime] = None,
        value: Optional[float] = None,
    ) -> None:
        alert = {
            "alert_type": alert_type,
            "severity": severity,
            "message": message,
            "sensor_id": sensor_id,
            "time": time.isoformat() if time else None,
            "value": value,
        }
        self.alerts.append(alert)

    def detect_load_levels(
        self,
        df: pd.DataFrame,
        load_sensor: Optional[str] = None,
        threshold: float = 0.1,
    ) -> List[LoadLevel]:
        if load_sensor and load_sensor in df.columns:
            load_series = df[load_sensor].dropna()
        else:
            strain_cols = [
                c for c in df.columns
                if not c.startswith("_") and self._is_strain_column(c)
            ]
            if not strain_cols:
                return self._detect_load_levels_by_time(df)
            load_series = df[strain_cols].abs().mean(axis=1).dropna()

        load_series = load_series.sort_index()
        load_diff = load_series.diff().abs()

        change_points = load_diff[load_diff > load_diff.mean() * 3].index.tolist()

        if not change_points:
            return self._detect_load_levels_by_time(df)

        levels = []
        for i, (start, end) in enumerate(zip(
            [load_series.index[0]] + change_points,
            change_points + [load_series.index[-1]]
        )):
            segment = load_series[start:end]
            if not segment.empty:
                avg_load = segment.mean()
                levels.append(LoadLevel(
                    index=i,
                    start_time=start,
                    end_time=end,
                    load_value=float(avg_load),
                    is_loading=avg_load > threshold,
                ))

        return levels

    def _detect_load_levels_by_time(self, df: pd.DataFrame) -> List[LoadLevel]:
        total_duration = (df.index[-1] - df.index[0]).total_seconds()
        segment_duration = total_duration / 10

        levels = []
        for i in range(10):
            start_time = df.index[0] + pd.Timedelta(seconds=i * segment_duration)
            end_time = df.index[0] + pd.Timedelta(seconds=(i + 1) * segment_duration)

            if i == 9:
                end_time = df.index[-1]

            segment = df[(df.index >= start_time) & (df.index <= end_time)]
            if not segment.empty:
                levels.append(LoadLevel(
                    index=i,
                    start_time=start_time,
                    end_time=end_time,
                    load_value=float(i * 10),
                    is_loading=i > 0,
                ))

        return levels

    def _is_strain_column(self, col: str) -> bool:
        sensor_map = {s.sensor_id: s for s in self.config.sensors}
        if col in sensor_map:
            return sensor_map[col].type == SensorType.STRAIN_GAUGE
        return "strain" in col.lower() or "应变" in col

    def calculate_peak_strains(
        self,
        df: pd.DataFrame,
        levels: List[LoadLevel],
    ) -> Dict[str, List[Dict[str, Any]]]:
        results: Dict[str, List[Dict[str, Any]]] = {}

        for col in df.columns:
            if col.startswith("_"):
                continue

            col_results = []
            for level in levels:
                segment = df.loc[level.start_time:level.end_time, col]
                valid_data = segment.dropna()

                if valid_data.empty:
                    continue

                peak_idx = valid_data.abs().idxmax()
                peak_value = float(valid_data.loc[peak_idx])

                col_results.append({
                    "level_index": level.index,
                    "peak_time": peak_idx.isoformat() if hasattr(peak_idx, "isoformat") else str(peak_idx),
                    "peak_value": peak_value,
                    "level_load": level.load_value,
                })

            if col_results:
                results[col] = col_results

        return results

    def calculate_residual_deformation(
        self,
        df: pd.DataFrame,
        levels: List[LoadLevel],
        zero_reference_interval: Optional[Tuple[datetime, datetime]] = None,
    ) -> Dict[str, float]:
        residuals: Dict[str, float] = {}

        if zero_reference_interval:
            start, end = zero_reference_interval
            zero_segment = df.loc[start:end]
        else:
            zero_segment = df.iloc[:int(len(df) * 0.1)]

        for col in df.columns:
            if col.startswith("_"):
                continue

            zero_mean = zero_segment[col].dropna().mean()

            unload_levels = [l for l in levels if not l.is_loading or l.load_value < 1.0]
            if unload_levels:
                last_unload = unload_levels[-1]
                unload_segment = df.loc[last_unload.start_time:last_unload.end_time]
                unload_mean = unload_segment[col].dropna().mean()
                residual = float(unload_mean - zero_mean)
            else:
                final_segment = df.iloc[-int(len(df) * 0.1):]
                final_mean = final_segment[col].dropna().mean()
                residual = float(final_mean - zero_mean)

            residuals[col] = residual

            max_strain = self.thresholds.get("max_strain", 2000.0)
            if abs(residual) > max_strain * self.thresholds.get("residual_strain_ratio", 0.1):
                self._add_alert(
                    alert_type="residual_exceeded",
                    severity="warning",
                    message=f"传感器 {col} 残余变形超限: {residual:.2f}",
                    sensor_id=col,
                    value=residual,
                )

        return residuals

    def calculate_curvature(
        self,
        df: pd.DataFrame,
        sensors: List[Sensor],
    ) -> pd.Series:
        strain_sensors = [s for s in sensors if s.type == SensorType.STRAIN_GAUGE]

        if len(strain_sensors) < 2:
            return pd.Series(dtype=float)

        strain_sensors.sort(key=lambda s: s.location_y if s.location_y else 0)

        top_sensor = strain_sensors[-1]
        bottom_sensor = strain_sensors[0]

        if top_sensor.sensor_id not in df.columns or bottom_sensor.sensor_id not in df.columns:
            return pd.Series(dtype=float)

        if top_sensor.location_y is None or bottom_sensor.location_y is None:
            return pd.Series(dtype=float)

        y_top = top_sensor.location_y
        y_bottom = bottom_sensor.location_y
        distance = y_top - y_bottom

        if distance == 0:
            return pd.Series(dtype=float)

        strain_top = df[top_sensor.sensor_id] * 1e-6
        strain_bottom = df[bottom_sensor.sensor_id] * 1e-6

        curvature = (strain_top - strain_bottom) / distance

        return curvature

    def calculate_neutral_axis(
        self,
        df: pd.DataFrame,
        sensors: List[Sensor],
    ) -> pd.Series:
        strain_sensors = [
            s for s in sensors
            if s.type == SensorType.STRAIN_GAUGE and s.location_y is not None
        ]

        if len(strain_sensors) < 2:
            return pd.Series(dtype=float)

        na_positions = []
        times = []

        for idx, row in df.iterrows():
            valid_strains = []
            valid_ys = []

            for sensor in strain_sensors:
                if sensor.sensor_id in row.index:
                    strain = row[sensor.sensor_id]
                    if not pd.isna(strain):
                        valid_strains.append(strain * 1e-6)
                        valid_ys.append(sensor.location_y)

            if len(valid_strains) >= 2:
                coeffs = np.polyfit(valid_ys, valid_strains, 1)
                slope = coeffs[0]
                intercept = coeffs[1]

                if abs(slope) > 1e-12:
                    na_y = -intercept / slope
                    na_positions.append(na_y)
                    times.append(idx)

        return pd.Series(na_positions, index=times)

    def calculate_moment(
        self,
        df: pd.DataFrame,
        sensors: List[Sensor],
    ) -> pd.Series:
        if self.config.cross_section is None:
            return pd.Series(dtype=float)

        E = self.config.material.elastic_modulus
        I = self.config.cross_section.moment_of_inertia

        curvature = self.calculate_curvature(df, sensors)

        if I is None and self.config.cross_section:
            h = self.config.cross_section.height
            b = self.config.cross_section.width
            I = (b * h ** 3) / 12

        moment = E * I * curvature

        return moment

    def detect_anomalies(
        self,
        df: pd.DataFrame,
        sensors: List[Sensor],
    ) -> None:
        self.alerts = []
        max_strain = self.thresholds.get("max_strain", 2000.0)
        jump_threshold = self.thresholds.get("strain_jump_threshold", 100.0)

        for sensor in sensors:
            if sensor.sensor_id not in df.columns:
                continue

            series = df[sensor.sensor_id].dropna()
            if series.empty:
                continue

            exceed_high = series[series > max_strain]
            exceed_low = series[series < -max_strain]

            for idx in exceed_high.index:
                self._add_alert(
                    alert_type="strain_exceeded",
                    severity="critical",
                    message=f"传感器 {sensor.sensor_id} 拉应变超限: {exceed_high[idx]:.2f}",
                    sensor_id=sensor.sensor_id,
                    time=idx,
                    value=float(exceed_high[idx]),
                )

            for idx in exceed_low.index:
                self._add_alert(
                    alert_type="strain_exceeded",
                    severity="critical",
                    message=f"传感器 {sensor.sensor_id} 压应变超限: {exceed_low[idx]:.2f}",
                    sensor_id=sensor.sensor_id,
                    time=idx,
                    value=float(exceed_low[idx]),
                )

            diffs = series.diff().abs()
            jumps = diffs[diffs > jump_threshold]

            for idx in jumps.index:
                self._add_alert(
                    alert_type="strain_jump",
                    severity="warning",
                    message=f"传感器 {sensor.sensor_id} 突变: {jumps[idx]:.2f}",
                    sensor_id=sensor.sensor_id,
                    time=idx,
                    value=float(jumps[idx]),
                )

            if sensor.type == SensorType.STRAIN_GAUGE:
                zero_count = (series.abs() < 1e-3).sum()
                if zero_count > len(series) * 0.8:
                    self._add_alert(
                        alert_type="no_response",
                        severity="warning",
                        message=f"传感器 {sensor.sensor_id} 疑似无响应",
                        sensor_id=sensor.sensor_id,
                    )

    def analyze(
        self,
        df: pd.DataFrame,
        sensors: List[Sensor],
        load_sensor: Optional[str] = None,
    ) -> Dict[str, Any]:
        levels = self.detect_load_levels(df, load_sensor)

        peaks = self.calculate_peak_strains(df, levels)
        residuals = self.calculate_residual_deformation(df, levels)

        curvature = self.calculate_curvature(df, sensors)
        neutral_axis = self.calculate_neutral_axis(df, sensors)
        moment = self.calculate_moment(df, sensors)

        self.detect_anomalies(df, sensors)

        peak_strains_summary = {}
        for sensor_id, level_peaks in peaks.items():
            if level_peaks:
                max_peak = max(level_peaks, key=lambda x: abs(x["peak_value"]))
                peak_strains_summary[sensor_id] = max_peak["peak_value"]

        na_summary = []
        if not neutral_axis.empty:
            na_summary = [float(neutral_axis.mean()), float(neutral_axis.std())]

        moment_summary = []
        if not moment.empty:
            valid_moments = moment.dropna()
            if not valid_moments.empty:
                moment_summary = [float(valid_moments.max()), float(valid_moments.abs().mean())]

        return {
            "load_levels": [
                {
                    "index": l.index,
                    "start_time": l.start_time.isoformat(),
                    "end_time": l.end_time.isoformat(),
                    "load_value": l.load_value,
                    "is_loading": l.is_loading,
                }
                for l in levels
            ],
            "peak_strains": peak_strains_summary,
            "residual_deformations": residuals,
            "neutral_axis_statistics": {
                "mean": na_summary[0] if na_summary else None,
                "std": na_summary[1] if len(na_summary) > 1 else None,
            },
            "moment_statistics": {
                "max": moment_summary[0] if moment_summary else None,
                "mean_abs": moment_summary[1] if len(moment_summary) > 1 else None,
            },
            "alerts": self.alerts,
            "curvature_timeseries": curvature.to_dict() if not curvature.empty else {},
            "neutral_axis_timeseries": neutral_axis.to_dict() if not neutral_axis.empty else {},
            "moment_timeseries": moment.to_dict() if not moment.empty else {},
        }
