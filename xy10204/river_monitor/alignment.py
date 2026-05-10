"""多源 CSV 对齐模块 - 处理时间戳不齐问题"""

import pandas as pd
from datetime import timedelta
from typing import Dict, List
import logging
from .config import DEFAULT_TIME_FORMAT, DEFAULT_SAMPLE_INTERVAL, DATA_COLUMNS

logger = logging.getLogger(__name__)


class TimeSeriesAligner:
    """时间序列对齐器"""

    def __init__(self, time_format: str = DEFAULT_TIME_FORMAT,
                 sample_interval: int = DEFAULT_SAMPLE_INTERVAL):
        self.time_format = time_format
        self.sample_interval = sample_interval

    def _parse_timestamp(self, df: pd.DataFrame,
                           col_name: str = "timestamp") -> pd.DataFrame:
        """解析时间戳列"""
        df = df.copy()
        df[col_name] = pd.to_datetime(df[col_name], format=self.time_format)
        df = df.sort_values(by=col_name).reset_index(drop=True)
        return df

    def align_dataframe(self, df: pd.DataFrame, data_type: str,
                      station_id: str = None) -> pd.DataFrame:
        """对单个数据源进行对齐"""
        df = self._parse_timestamp(df)

        if station_id:
            df = df[df["station_id"] == station_id]

        df = df.drop_duplicates(subset=["timestamp"], keep="last").reset_index(drop=True)

        if df.empty:
            return df

        min_time = df["timestamp"].min().floor(f"{self.sample_interval}T")
        max_time = df["timestamp"].max().ceil(f"{self.sample_interval}T")

        time_index = pd.date_range(
            start=min_time,
            end=max_time,
            freq=f"{self.sample_interval}T"
        )

        aligned = pd.DataFrame({"timestamp": time_index})

        df_rounded = df.copy()
        df_rounded["timestamp"] = df_rounded["timestamp"].dt.floor(f"{self.sample_interval}T")

        merged = pd.merge_asof(
            aligned,
            df_rounded,
            on="timestamp",
            tolerance=timedelta(minutes=self.sample_interval),
            direction="nearest"
        )

        logger.info(f"对齐完成: 原始 {len(df)} 条记录，对齐后 {len(merged)} 条记录")
        return merged

    def align_multisource(
        self,
        data_frames: Dict[str, pd.DataFrame],
        station_id: str = None
    ) -> pd.DataFrame:
        """对多源数据对齐到统一时间轴"""
        aligned_frames = {}
        all_timestamps = []

        for data_type, df in data_frames.items():
            if data_type not in DATA_COLUMNS:
                logger.warning(f"未知数据类型: {data_type}")
                continue

            aligned = self.align_dataframe(df, data_type, station_id)
            aligned_frames[data_type] = aligned

            if not aligned.empty:
                all_timestamps.extend(aligned["timestamp"].tolist())

        if not all_timestamps:
            raise ValueError("没有有效的数据可对齐")

        unified_start = min(all_timestamps)
        unified_end = max(all_timestamps)

        unified_index = pd.date_range(
            start=unified_start,
            end=unified_end,
            freq=f"{self.sample_interval}T"
        )

        result = pd.DataFrame({"timestamp": unified_index})

        for data_type, df in aligned_frames.items():
            if df.empty:
                continue

            value_col = self._get_value_column(data_type)
            df_keep = df[["timestamp", value_col]].copy()
            result = pd.merge_asof(
                result,
                df_keep,
                on="timestamp",
                tolerance=timedelta(minutes=self.sample_interval),
                direction="nearest")

        result = result.sort_values("timestamp").reset_index(drop=True)
        logger.info(f"多源对齐完成: 共 {len(result)} 个时间点")
        return result

    def _get_value_column(self, data_type: str) -> str:
        """获取数据类型对应的数值列名"""
        mapping = {
            "water_level": "water_level_m",
            "rainfall": "rainfall_mm",
            "gate_opening": "gate_opening_m"
        }
        return mapping.get(data_type, "value")
