"""Statistics module for capacity outlier detection using IQR method."""

from dataclasses import dataclass
from typing import Any, Optional

import numpy as np


@dataclass
class CapacityStats:
    channel: int
    capacity: float
    z_score: float
    is_outlier: bool
    outlier_type: Optional[str]


class OutlierDetector:
    @staticmethod
    def detect_iqr(values: list[float], multiplier: float = 1.5) -> tuple[list[int], float, float]:
        if len(values) < 4:
            return [], 0.0, 0.0
        q1 = np.percentile(values, 25)
        q3 = np.percentile(values, 75)
        iqr = q3 - q1
        lower = q1 - multiplier * iqr
        upper = q3 + multiplier * iqr
        outlier_indices = [i for i, v in enumerate(values) if v < lower or v > upper]
        return outlier_indices, lower, upper

    @staticmethod
    def detect_zscore(values: list[float], threshold: float = 3.0) -> list[int]:
        if len(values) < 3:
            return []
        mean = np.mean(values)
        std = np.std(values, ddof=1)
        if std == 0:
            return []
        z_scores = [(v - mean) / std for v in values]
        return [i for i, z in enumerate(z_scores) if abs(z) > threshold]

    def detect_capacity_outliers(
        self, channel_capacities: dict[int, float], method: str = "iqr"
    ) -> list[CapacityStats]:
        if not channel_capacities:
            return []
        channels = sorted(channel_capacities.keys())
        capacities = [channel_capacities[ch] for ch in channels]
        mean = np.mean(capacities)
        std = np.std(capacities, ddof=1)

        if method == "iqr":
            outlier_indices, _, _ = self.detect_iqr(capacities)
        else:
            outlier_indices = self.detect_zscore(capacities)

        outlier_set = set(outlier_indices)
        results = []
        for i, ch in enumerate(channels):
            cap = capacities[i]
            z = (cap - mean) / std if std > 0 else 0.0
            is_outlier = i in outlier_set
            outlier_type = None
            if is_outlier:
                q1 = np.percentile(capacities, 25)
                q3 = np.percentile(capacities, 75)
                iqr = q3 - q1
                if cap < q1 - 1.5 * iqr:
                    outlier_type = "low"
                elif cap > q3 + 1.5 * iqr:
                    outlier_type = "high"
                else:
                    outlier_type = "zscore"
            results.append(CapacityStats(channel=ch, capacity=cap, z_score=z, is_outlier=is_outlier, outlier_type=outlier_type))
        return results


class StepStatistics:
    @staticmethod
    def compute_step_stats(data: list[dict[str, Any]]) -> dict[str, float]:
        if not data:
            return {}
        voltages = [d["voltage"] for d in data]
        currents = [d["current"] for d in data]
        temps = [d["temperature"] for d in data]
        capacities = [d["capacity"] for d in data]
        return {
            "voltage_mean": np.mean(voltages),
            "voltage_std": np.std(voltages, ddof=1),
            "voltage_min": np.min(voltages),
            "voltage_max": np.max(voltages),
            "current_mean": np.mean(currents),
            "current_std": np.std(currents, ddof=1),
            "temperature_mean": np.mean(temps),
            "temperature_max": np.max(temps),
            "temperature_min": np.min(temps),
            "capacity_final": capacities[-1] if capacities else 0.0,
        }
