"""异常识别模块 - 检测水位突涨等异常"""

import pandas as pd
import numpy as np
from typing import List, Dict, Tuple
import logging
from .config import ANOMALY_THRESHOLDS

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """异常检测器"""

    def __init__(self, thresholds: Dict = None):
        self.thresholds = thresholds or ANOMALY_THRESHOLDS
        self.anomalies = []

    def detect_water_level_spikes(self, df: pd.DataFrame) -> List[Dict]:
        """检测水位突涨"""
        anomalies = []

        if "water_level_m" not in df.columns or len(df) < 2:
            return anomalies

        df = df.copy()
        df = df.sort_values("timestamp").reset_index(drop=True)

        df["water_level_diff"] = df["water_level_m"].diff()
        df["time_diff_hours"] = df["timestamp"].diff().dt.total_seconds() / 3600

        for i in range(1, len(df)):
            level_diff = df.iloc[i]["water_level_diff"]
            time_diff = df.iloc[i]["time_diff_hours"]

            if time_diff <= 0 or np.isnan(time_diff):
                continue

            rate = level_diff / time_diff

            if rate >= self.thresholds["water_level_spike"]:
                anomaly = {
                    "type": "水位突涨",
                    "timestamp": df.iloc[i]["timestamp"],
                    "rate_m_per_hour": round(rate, 4),
                    "previous_level": df.iloc[i-1]["water_level_m"],
                    "current_level": df.iloc[i]["water_level_m"],
                    "time_diff_hours": round(time_diff, 2),
                    "threshold": self.thresholds["water_level_spike"]
                }
                anomalies.append(anomaly)

        return anomalies

    def detect_rainfall_spikes(self, df: pd.DataFrame) -> List[Dict]:
        """检测雨量突增"""
        anomalies = []

        if "rainfall_mm" not in df.columns or len(df) < 2:
            return anomalies

        df = df.copy()
        df = df.sort_values("timestamp").reset_index(drop=True)

        df["rainfall_diff"] = df["rainfall_mm"].diff()
        df["time_diff_hours"] = df["timestamp"].diff().dt.total_seconds() / 3600

        for i in range(1, len(df)):
            rain_diff = df.iloc[i]["rainfall_diff"]
            time_diff = df.iloc[i]["time_diff_hours"]

            if time_diff <= 0 or np.isnan(time_diff):
                continue

            rate = rain_diff / time_diff

            if rate >= self.thresholds["rainfall_spike"]:
                anomaly = {
                    "type": "雨量突增",
                    "timestamp": df.iloc[i]["timestamp"],
                    "rate_mm_per_hour": round(rate, 2),
                    "previous_rainfall": df.iloc[i-1]["rainfall_mm"],
                    "current_rainfall": df.iloc[i]["rainfall_mm"],
                    "time_diff_hours": round(time_diff, 2),
                    "threshold": self.thresholds["rainfall_spike"]
                }
                anomalies.append(anomaly)

        return anomalies

    def detect_gate_opening_changes(self, df: pd.DataFrame) -> List[Dict]:
        """检测闸门开度突变"""
        anomalies = []

        if "gate_opening_m" not in df.columns or len(df) < 2:
            return anomalies

        df = df.copy()
        df = df.sort_values("timestamp").reset_index(drop=True)

        df["gate_diff"] = df["gate_opening_m"].diff().abs()
        df["time_diff_hours"] = df["timestamp"].diff().dt.total_seconds() / 3600

        for i in range(1, len(df)):
            gate_diff = df.iloc[i]["gate_diff"]
            time_diff = df.iloc[i]["time_diff_hours"]

            if time_diff <= 0 or np.isnan(time_diff):
                continue

            rate = gate_diff / time_diff

            if rate >= self.thresholds["gate_opening_change"]:
                anomaly = {
                    "type": "闸门开度突变",
                    "timestamp": df.iloc[i]["timestamp"],
                    "rate_m_per_hour": round(rate, 4),
                    "previous_opening": df.iloc[i-1]["gate_opening_m"],
                    "current_opening": df.iloc[i]["gate_opening_m"],
                    "time_diff_hours": round(time_diff, 2),
                    "threshold": self.thresholds["gate_opening_change"]
                }
                anomalies.append(anomaly)

        return anomalies

    def correlate_anomalies(self, water_anomalies: List[Dict],
                          rain_anomalies: List[Dict],
                          gate_anomalies: List[Dict]) -> List[Dict]:
        """关联异常 - 分析水位突涨的可能原因"""
        correlated = []

        for water_anom in water_anomalies:
            water_time = water_anom["timestamp"]

            rain_correlated = []
            gate_correlated = []

            for rain_anom in rain_anomalies:
                time_diff = abs((rain_anom["timestamp"] - water_time).total_seconds() / 3600)
                if time_diff <= 2:
                    rain_correlated.append({
                        "anomaly": rain_anom,
                        "time_diff_hours": time_diff
                    })

            for gate_anom in gate_anomalies:
                time_diff = abs((gate_anom["timestamp"] - water_time).total_seconds() / 3600)
                if time_diff <= 2:
                    gate_correlated.append({
                        "anomaly": gate_anom,
                        "time_diff_hours": time_diff
                    })

            if rain_correlated or gate_correlated:
                water_anom["correlated_rainfall"] = rain_correlated
                water_anom["correlated_gate"] = gate_correlated

                if rain_correlated and gate_correlated:
                    water_anom["possible_cause"] = "雨量突增和闸门开度变化共同作用"
                elif rain_correlated:
                    water_anom["possible_cause"] = "可能由雨量突增导致"
                else:
                    water_anom["possible_cause"] = "可能由闸门开度变化导致"
            else:
                water_anom["possible_cause"] = "无明显关联因素，需进一步核查"

            correlated.append(water_anom)

        return correlated

    def detect_all(self, df: pd.DataFrame) -> Dict:
        """检测所有异常"""
        water_anomalies = self.detect_water_level_spikes(df)
        rain_anomalies = self.detect_rainfall_spikes(df)
        gate_anomalies = self.detect_gate_opening_changes(df)

        correlated = self.correlate_anomalies(
            water_anomalies,
            rain_anomalies,
            gate_anomalies
        )

        return {
            "water_level_spikes": water_anomalies,
            "rainfall_spikes": rain_anomalies,
            "gate_opening_changes": gate_anomalies,
            "correlated_anomalies": correlated,
            "total_count": len(water_anomalies) + len(rain_anomalies) + len(gate_anomalies)
        }
