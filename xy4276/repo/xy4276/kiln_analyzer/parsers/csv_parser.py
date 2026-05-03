import csv
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

from kiln_analyzer.models import ThermocoupleData
from kiln_analyzer.parsers.base import BaseParser


class ThermocoupleCSVParser(BaseParser[List[ThermocoupleData]]):
    DEFAULT_TIME_FORMAT = "%Y-%m-%d %H:%M:%S"
    EXPECTED_HEADERS = ["timestamp", "elapsed_seconds", "TC1", "TC2", "TC3", "TC4"]

    def __init__(
        self,
        time_format: str = DEFAULT_TIME_FORMAT,
        tc_names: Optional[Dict[str, str]] = None,
    ):
        self.time_format = time_format
        self.tc_names = tc_names or {}

    def parse(self, file_path: Path) -> List[ThermocoupleData]:
        if not file_path.exists():
            raise FileNotFoundError(f"热电偶CSV文件不存在: {file_path}")

        df = pd.read_csv(file_path)
        data_list: List[ThermocoupleData] = []

        if "timestamp" in df.columns:
            timestamps = pd.to_datetime(df["timestamp"], format=self.time_format)
        else:
            timestamps = None

        if "elapsed_seconds" in df.columns:
            elapsed = df["elapsed_seconds"].astype(float)
        else:
            elapsed = None

        tc_columns = [col for col in df.columns if col.startswith("TC") or col in self.tc_names.keys()]

        for idx, row in df.iterrows():
            temperatures: Dict[str, float] = {}
            for col in tc_columns:
                col_name = self.tc_names.get(col, col)
                try:
                    temp = float(row[col])
                    temperatures[col_name] = temp
                except (ValueError, TypeError):
                    continue

            if not temperatures:
                continue

            timestamp: datetime
            if timestamps is not None:
                timestamp = timestamps.iloc[idx]
            else:
                timestamp = datetime.now()

            elapsed_sec: Optional[float] = None
            if elapsed is not None:
                elapsed_sec = float(elapsed.iloc[idx])

            data_list.append(
                ThermocoupleData(
                    timestamp=timestamp,
                    temperatures=temperatures,
                    elapsed_seconds=elapsed_sec,
                )
            )

        if not data_list:
            raise ValueError(f"CSV文件中没有有效的热电偶数据: {file_path}")

        if elapsed is None and len(data_list) > 1:
            start_time = data_list[0].timestamp
            for data in data_list:
                delta = data.timestamp - start_time
                data.elapsed_seconds = delta.total_seconds()

        return data_list

    def validate(self, data: Any) -> bool:
        if not isinstance(data, list):
            return False
        if not all(isinstance(item, ThermocoupleData) for item in data):
            return False
        if len(data) == 0:
            return False
        return True

    @classmethod
    def from_template(cls) -> "ThermocoupleCSVParser":
        return cls(
            time_format="%Y-%m-%d %H:%M:%S",
            tc_names={
                "TC1": "top",
                "TC2": "middle",
                "TC3": "bottom",
                "TC4": "exhaust",
            },
        )
