import pandas as pd
import numpy as np
from typing import Tuple, Optional, List, Dict, Any
from dataclasses import dataclass, field
from .config import Config
from .unit_converter import UnitConverter, UnitConversionResult, UnitDetectionResult


@dataclass
class UnitInfo:
    column: str
    detection_result: Optional[UnitDetectionResult] = None
    conversion_results: List[UnitConversionResult] = field(default_factory=list)
    target_unit: str = ""


@dataclass
class LoadedData:
    raw_data: pd.DataFrame
    data: pd.DataFrame
    file_path: str
    columns_map: dict
    unit_infos: Dict[str, UnitInfo] = field(default_factory=dict)


class DataLoader:
    def __init__(self, config: Config):
        self.config = config
        self.unit_converter = UnitConverter(config)
        self._validate_config()
    
    def _validate_config(self):
        cols = self.config.columns
        if not hasattr(cols, 'timestamp'):
            raise ValueError("配置文件中缺少时间戳列配置")
    
    def load(self, file_path: Optional[str] = None) -> LoadedData:
        if file_path is None:
            file_path = self.config.data.input_path
        
        df = self._read_file(file_path)
        df, unit_infos = self._initial_clean(df)
        
        return LoadedData(
            raw_data=df.copy(),
            data=df,
            file_path=file_path,
            columns_map=self._get_columns_map(),
            unit_infos=unit_infos
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
    
    def _initial_clean(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, UnitInfo]]:
        df = df.copy()
        cols = self.config.columns
        unit_infos = {}
        
        if cols.timestamp in df.columns:
            df[cols.timestamp] = pd.to_datetime(
                df[cols.timestamp],
                errors='coerce'
            )
        
        numeric_cols_with_units = [
            (cols.charging_power, self.config.quality_control.charging_power.get('unit', 'kW')),
            (cols.energy_consumed, self.config.quality_control.energy_consumed.get('unit', 'kWh')),
            (cols.charging_duration, self.config.quality_control.charging_duration.get('unit', 'minutes')),
            (cols.electricity_price, self.config.quality_control.electricity_price.get('unit', 'yuan/kWh'))
        ]
        
        for col, target_unit in numeric_cols_with_units:
            if col in df.columns:
                unit_info = self._process_column_with_units(df, col, target_unit)
                unit_infos[col] = unit_info
        
        return df, unit_infos
    
    def _process_column_with_units(self, df: pd.DataFrame,
                                    column_name: str,
                                    target_unit: str) -> UnitInfo:
        """
        处理带单位的列：检测单位、自动换算、记录问题
        """
        detection_result = self.unit_converter.analyze_column_units(
            df[column_name], column_name
        )
        
        converted_series, conversion_results = self.unit_converter.convert_series(
            df[column_name], column_name, target_unit
        )
        
        df[column_name] = converted_series
        
        return UnitInfo(
            column=column_name,
            detection_result=detection_result,
            conversion_results=conversion_results,
            target_unit=target_unit
        )
    
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
