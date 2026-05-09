import pandas as pd
import numpy as np
from typing import Tuple, Optional
from dataclasses import dataclass
from .config import Config


@dataclass
class LoadedData:
    raw_data: pd.DataFrame
    data: pd.DataFrame
    file_path: str
    columns_map: dict


class DataLoader:
    def __init__(self, config: Config):
        self.config = config
        self._validate_config()
    
    def _validate_config(self):
        cols = self.config.columns
        if not hasattr(cols, 'timestamp'):
            raise ValueError("配置文件中缺少时间戳列配置")
    
    def load(self, file_path: Optional[str] = None) -> LoadedData:
        if file_path is None:
            file_path = self.config.data.input_path
        
        df = self._read_file(file_path)
        df = self._initial_clean(df)
        
        return LoadedData(
            raw_data=df.copy(),
            data=df,
            file_path=file_path,
            columns_map=self._get_columns_map()
        )
    
    def _read_file(self, file_path: str) -> pd.DataFrame:
        if file_path.endswith('.csv'):
            df = pd.read_csv(
                file_path,
                encoding=self.config.data.encoding,
                delimiter=self.config.data.delimiter,
                low_memory=False
            )
        elif file_path.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {file_path}")
        
        return df
    
    def _initial_clean(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        cols = self.config.columns
        
        if cols.timestamp in df.columns:
            df[cols.timestamp] = pd.to_datetime(
                df[cols.timestamp],
                errors='coerce'
            )
        
        numeric_cols = [
            cols.charging_power,
            cols.energy_consumed,
            cols.charging_duration,
            cols.electricity_price
        ]
        
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
        
        return df
    
    def _get_columns_map(self) -> dict:
        cols = self.config.columns
        return {
            'timestamp': cols.timestamp,
            'charging_power': cols.charging_power,
            'energy_consumed': cols.energy_consumed,
            'charging_duration': cols.charging_duration,
            'station_id': cols.station_id,
            'charger_id': cols.charger_id,
            'electricity_price': cols.electricity_price
        }
