"""样例数据生成器 - 生成正常和异常测试数据"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Tuple, Dict
import os
import logging
from .config import DEFAULT_DATA_DIR, DEFAULT_TIME_FORMAT

logger = logging.getLogger(__name__)


class SampleDataGenerator:
    """样例数据生成器"""

    def __init__(self, data_dir: str = DEFAULT_DATA_DIR):
        self.data_dir = data_dir
        self._ensure_dir()

    def _ensure_dir(self):
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
            logger.info(f"创建数据目录: {self.data_dir}")

    def _generate_timestamp_sequence(self, start_time: datetime,
                                     hours: int, interval_minutes: int = 60):
        """生成时间戳序列"""
        timestamps = []
        current = start_time
        for _ in range(int(hours * 60 / interval_minutes)):
            timestamps.append(current.strftime(DEFAULT_TIME_FORMAT))
            current += timedelta(minutes=interval_minutes)
        return timestamps

    def generate_normal_data(self, start_time: datetime,
                           hours: int = 48,
                           station_id: str = "ST001") -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """生成正常数据（无异常）"""
        timestamps = self._generate_timestamp_sequence(start_time, hours)
        n = len(timestamps)

        np.random.seed(42)

        base_level = 5.0
        water_levels = base_level + 0.1 * np.sin(np.linspace(0, 8 * np.pi, n))
        water_levels += np.random.normal(0, 0.02, n)

        rainfall = np.zeros(n)
        rain_times = np.random.choice(range(10, n - 10), size=5, replace=False)
        for idx in rain_times:
            rainfall[idx - 1:idx + 3] = np.random.uniform(2, 8, 4)

        gate_openings = np.ones(n) * 2.0
        for i in range(1, n):
            if np.random.random() < 0.05:
                change = np.random.choice([-0.2, 0.2])
                gate_openings[i] = max(0.5, min(5.0, gate_openings[i - 1] + change))
            else:
                gate_openings[i] = gate_openings[i - 1]

        water_df = pd.DataFrame({
            "timestamp": timestamps,
            "station_id": [station_id] * n,
            "water_level_m": water_levels,
            "inspector_id": ["INS001"] * n
        })

        rain_df = pd.DataFrame({
            "timestamp": timestamps,
            "station_id": [station_id] * n,
            "rainfall_mm": rainfall,
            "inspector_id": ["INS002"] * n
        })

        gate_df = pd.DataFrame({
            "timestamp": timestamps,
            "station_id": [station_id] * n,
            "gate_opening_m": gate_openings,
            "inspector_id": ["INS003"] * n
        })

        return water_df, rain_df, gate_df

    def generate_anomaly_data(self, start_time: datetime,
                            hours: int = 48,
                            station_id: str = "ST001") -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """生成带异常的数据"""
        timestamps = self._generate_timestamp_sequence(start_time, hours)
        n = len(timestamps)

        np.random.seed(123)

        base_level = 5.0
        water_levels = base_level + 0.1 * np.sin(np.linspace(0, 8 * np.pi, n))
        water_levels += np.random.normal(0, 0.02, n)

        anomaly_idx = int(n * 0.4)
        water_levels[anomaly_idx] = water_levels[anomaly_idx - 1] + 0.5
        anomaly_idx2 = int(n * 0.7)
        water_levels[anomaly_idx2] = water_levels[anomaly_idx2 - 1] + 0.4

        rainfall = np.zeros(n)
        rain_anomaly_idx = int(n * 0.38)
        rainfall[rain_anomaly_idx - 1:rain_anomaly_idx + 2] = [15, 25, 18]

        gate_openings = np.ones(n) * 2.0
        gate_anomaly_idx = int(n * 0.39)
        gate_openings[gate_anomaly_idx:] = 3.5

        for i in range(1, n):
            if gate_openings[i] != 3.5 and np.random.random() < 0.05:
                change = np.random.choice([-0.2, 0.2])
                gate_openings[i] = max(0.5, min(5.0, gate_openings[i - 1] + change))
            elif gate_openings[i] != 3.5:
                gate_openings[i] = gate_openings[i - 1]

        water_df = pd.DataFrame({
            "timestamp": timestamps,
            "station_id": [station_id] * n,
            "water_level_m": water_levels,
            "inspector_id": ["INS001"] * n
        })

        rain_df = pd.DataFrame({
            "timestamp": timestamps,
            "station_id": [station_id] * n,
            "rainfall_mm": rainfall,
            "inspector_id": ["INS002"] * n
        })

        gate_df = pd.DataFrame({
            "timestamp": timestamps,
            "station_id": [station_id] * n,
            "gate_opening_m": gate_openings,
            "inspector_id": ["INS003"] * n
        })

        return water_df, rain_df, gate_df

    def generate_misaligned_data(self, start_time: datetime,
                               hours: int = 48,
                               station_id: str = "ST001") -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """生成时间戳不齐的数据（模拟巡测员不同步上传）"""
        np.random.seed(999)

        water_timestamps = []
        current = start_time
        for _ in range(48):
            water_timestamps.append(current.strftime(DEFAULT_TIME_FORMAT))
            offset = np.random.choice([0, 5, 10, -5])
            current += timedelta(minutes=60 + offset)

        rain_timestamps = []
        current = start_time + timedelta(minutes=15)
        for _ in range(48):
            rain_timestamps.append(current.strftime(DEFAULT_TIME_FORMAT))
            offset = np.random.choice([0, 8, 12, -8])
            current += timedelta(minutes=60 + offset)

        gate_timestamps = []
        current = start_time + timedelta(minutes=30)
        for _ in range(45):
            gate_timestamps.append(current.strftime(DEFAULT_TIME_FORMAT))
            offset = np.random.choice([0, 10, 15, -10])
            current += timedelta(minutes=60 + offset)

        n_water = len(water_timestamps)
        n_rain = len(rain_timestamps)
        n_gate = len(gate_timestamps)

        base_level = 5.0
        water_levels = base_level + 0.1 * np.sin(np.linspace(0, 6 * np.pi, n_water))
        water_levels += np.random.normal(0, 0.02, n_water)

        rainfall = np.random.exponential(2, n_rain)
        rainfall = np.where(rainfall > 5, 5, rainfall)

        gate_openings = np.linspace(1.5, 3.0, n_gate)
        gate_openings += np.random.normal(0, 0.1, n_gate)

        water_df = pd.DataFrame({
            "timestamp": water_timestamps,
            "station_id": [station_id] * n_water,
            "water_level_m": water_levels,
            "inspector_id": ["INS001"] * n_water
        })

        rain_df = pd.DataFrame({
            "timestamp": rain_timestamps,
            "station_id": [station_id] * n_rain,
            "rainfall_mm": rainfall,
            "inspector_id": ["INS002"] * n_rain
        })

        gate_df = pd.DataFrame({
            "timestamp": gate_timestamps,
            "station_id": [station_id] * n_gate,
            "gate_opening_m": gate_openings,
            "inspector_id": ["INS003"] * n_gate
        })

        return water_df, rain_df, gate_df

    def save_sample_data(self, data_type: str = "normal",
                       start_time: datetime = None) -> Dict[str, str]:
        """保存样例数据到文件"""
        if start_time is None:
            start_time = datetime(2024, 6, 1, 8, 0, 0)

        if data_type == "normal":
            water_df, rain_df, gate_df = self.generate_normal_data(start_time)
        elif data_type == "anomaly":
            water_df, rain_df, gate_df = self.generate_anomaly_data(start_time)
        elif data_type == "misaligned":
            water_df, rain_df, gate_df = self.generate_misaligned_data(start_time)
        else:
            raise ValueError(f"未知数据类型: {data_type}")

        water_path = os.path.join(self.data_dir, f"water_level_{data_type}.csv")
        rain_path = os.path.join(self.data_dir, f"rainfall_{data_type}.csv")
        gate_path = os.path.join(self.data_dir, f"gate_opening_{data_type}.csv")

        water_df.to_csv(water_path, index=False)
        rain_df.to_csv(rain_path, index=False)
        gate_df.to_csv(gate_path, index=False)

        logger.info(f"保存样例数据到: {water_path}, {rain_path}, {gate_path}")

        return {
            "water_level": water_path,
            "rainfall": rain_path,
            "gate_opening": gate_path
        }
