import csv
import json
import yaml
import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class ThermocoupleData:
    """热电偶数据类"""
    name: str
    time_series: pd.DatetimeIndex
    temperatures: pd.Series
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def data_frame(self) -> pd.DataFrame:
        return pd.DataFrame({
            'time': self.time_series,
            'temperature': self.temperatures
        }).set_index('time')


@dataclass
class KilnPosition:
    """窑位数据类"""
    id: str
    name: str
    position_x: float
    position_y: float
    position_z: float
    thermocouple_id: str
    items: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class GlazeRecipe:
    """釉料配方类"""
    id: str
    name: str
    components: Dict[str, float]
    firing_profile: Dict[str, Any]
    risk_rules: Dict[str, Any]


class DataParser:
    """数据解析器 - 支持CSV、JSON、YAML格式"""
    
    def __init__(self):
        self.thermocouples: Dict[str, ThermocoupleData] = {}
        self.kiln_positions: Dict[str, KilnPosition] = {}
        self.glaze_recipes: Dict[str, GlazeRecipe] = {}
        
    def parse_thermocouple_csv(self, file_path: str, interpolation_method: str = 'linear') -> ThermocoupleData:
        """
        解析热电偶CSV文件并进行数据清洗
        
        CSV格式期望:
        - 时间列: 'time' 或 'timestamp' 或第一列
        - 温度列: 'temperature' 或 'temp' 或第二列
        
        Args:
            file_path: CSV文件路径
            interpolation_method: 缺测点插值方法 ('linear', 'time', 'ffill', 'bfill')
            
        Returns:
            ThermocoupleData对象
        """
        path = Path(file_path)
        name = path.stem
        
        df = self._read_csv_with_flexible_encoding(file_path)
        
        time_col, temp_col = self._identify_columns(df)
        
        if time_col is None or temp_col is None:
            raise ValueError(f"无法在 {file_path} 中识别时间列和温度列")
        
        time_series = self._parse_time_column(df[time_col])
        temperatures = pd.to_numeric(df[temp_col], errors='coerce')
        
        temp_series = pd.Series(temperatures.values, index=time_series, name='temperature')
        
        temp_series_clean = self._clean_missing_data(temp_series, interpolation_method)
        
        tc_data = ThermocoupleData(
            name=name,
            time_series=temp_series_clean.index,
            temperatures=temp_series_clean.reset_index(drop=True),
            metadata={
                'original_file': file_path,
                'missing_points_count': temp_series.isna().sum(),
                'total_points': len(temp_series),
                'cleaning_method': interpolation_method
            }
        )
        
        self.thermocouples[name] = tc_data
        return tc_data
    
    def _read_csv_with_flexible_encoding(self, file_path: str) -> pd.DataFrame:
        """尝试多种编码读取CSV文件"""
        encodings = ['utf-8', 'gbk', 'gb2312', 'latin1']
        
        for encoding in encodings:
            try:
                df = pd.read_csv(file_path, encoding=encoding)
                return df
            except (UnicodeDecodeError, UnicodeError):
                continue
            except Exception:
                continue
        
        raise ValueError(f"无法使用标准编码读取 {file_path}")
    
    def _identify_columns(self, df: pd.DataFrame) -> Tuple[Optional[str], Optional[str]]:
        """识别数据框中的时间列和温度列"""
        time_columns = ['time', 'timestamp', 'datetime', '时间', '时刻', '日期时间']
        temp_columns = ['temperature', 'temp', 't', '温度', '窑温', '热电偶温度']
        
        time_col = None
        temp_col = None
        
        lower_columns = {col.lower(): col for col in df.columns}
        
        for tc in time_columns:
            if tc.lower() in lower_columns:
                time_col = lower_columns[tc.lower()]
                break
        
        for tc in temp_columns:
            if tc.lower() in lower_columns:
                temp_col = lower_columns[tc.lower()]
                break
        
        if time_col is None and len(df.columns) >= 2:
            time_col = df.columns[0]
        
        if temp_col is None and len(df.columns) >= 2:
            temp_col = df.columns[1]
        
        return time_col, temp_col
    
    def _parse_time_column(self, time_column: pd.Series) -> pd.DatetimeIndex:
        """解析时间列，支持多种时间格式"""
        try:
            time_series = pd.to_datetime(time_column)
            return time_series
        except Exception:
            pass
        
        try:
            if time_column.dtype == 'object':
                first_val = str(time_column.iloc[0])
                if ':' in first_val and ' ' not in first_val:
                    base_date = pd.Timestamp('2024-01-01')
                    time_series = pd.to_timedelta(time_column.astype(str))
                    return pd.DatetimeIndex(base_date + time_series)
        except Exception:
            pass
        
        numeric_index = pd.RangeIndex(len(time_column))
        time_series = pd.to_datetime(numeric_index, unit='s', origin='2024-01-01')
        return time_series
    
    def _clean_missing_data(self, temp_series: pd.Series, method: str) -> pd.Series:
        """
        清洗缺测数据
        
        支持的插值方法:
        - 'linear': 线性插值
        - 'time': 时间加权插值
        - 'ffill': 向前填充
        - 'bfill': 向后填充
        """
        if temp_series.isna().sum() == 0:
            return temp_series
        
        temp_series = temp_series.sort_index()
        
        if method == 'linear':
            return temp_series.interpolate(method='linear')
        elif method == 'time':
            return temp_series.interpolate(method='time')
        elif method == 'ffill':
            return temp_series.ffill()
        elif method == 'bfill':
            return temp_series.bfill()
        else:
            return temp_series.interpolate(method='linear')
    
    def parse_kiln_positions_json(self, file_path: str) -> Dict[str, KilnPosition]:
        """
        解析窑位摆放JSON文件
        
        JSON格式期望:
        {
            "positions": [
                {
                    "id": "pos_1",
                    "name": "上层左前",
                    "position_x": 0.2,
                    "position_y": 0.8,
                    "position_z": 0.5,
                    "thermocouple_id": "tc_1",
                    "items": [{"glaze_id": "glaze_001", "count": 2}]
                }
            ]
        }
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        positions_data = data.get('positions', []) if isinstance(data, dict) else data
        
        for pos_data in positions_data:
            position = KilnPosition(
                id=pos_data.get('id', ''),
                name=pos_data.get('name', ''),
                position_x=float(pos_data.get('position_x', 0)),
                position_y=float(pos_data.get('position_y', 0)),
                position_z=float(pos_data.get('position_z', 0)),
                thermocouple_id=pos_data.get('thermocouple_id', ''),
                items=pos_data.get('items', [])
            )
            self.kiln_positions[position.id] = position
        
        return self.kiln_positions
    
    def parse_glaze_recipes_yaml(self, file_path: str) -> Dict[str, GlazeRecipe]:
        """
        解析釉料配方YAML文件
        
        YAML格式期望:
        recipes:
          - id: glaze_001
            name: 青瓷釉
            components:
              长石: 40.0
              石英: 30.0
            firing_profile:
              max_temp: 1280
              holding_time_min: 30
            risk_rules:
              max_heating_rate: 150
              critical_cooling_range: [500, 300]
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        recipes_data = data.get('recipes', []) if isinstance(data, dict) else data
        
        for recipe_data in recipes_data:
            recipe = GlazeRecipe(
                id=recipe_data.get('id', ''),
                name=recipe_data.get('name', ''),
                components=recipe_data.get('components', {}),
                firing_profile=recipe_data.get('firing_profile', {}),
                risk_rules=recipe_data.get('risk_rules', {})
            )
            self.glaze_recipes[recipe.id] = recipe
        
        return self.glaze_recipes
    
    def get_all_data(self) -> Dict[str, Any]:
        """获取所有已解析的数据"""
        return {
            'thermocouples': {k: v.__dict__ for k, v in self.thermocouples.items()},
            'kiln_positions': {k: v.__dict__ for k, v in self.kiln_positions.items()},
            'glaze_recipes': {k: v.__dict__ for k, v in self.glaze_recipes.items()}
        }
