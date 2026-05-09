import os
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Optional, Dict, List, Any

from config import config
from logger import get_logger


class DataLoader:
    def __init__(self):
        self.logger = get_logger()
        self.mapping = {
            'energy': None,
            'production': None,
            'pressure': None,
            'leak': None,
            'datetime': None,
            'unit': None,
            'id': None
        }
        self.original_columns = []
    
    def load_data(self, file_path: str) -> pd.DataFrame:
        self.logger.log_info(f"开始加载数据: {file_path}")
        
        if not os.path.exists(file_path):
            self.logger.log_error(f"文件不存在: {file_path}")
            return pd.DataFrame()
        
        ext = Path(file_path).suffix.lower()
        
        try:
            if ext in ['.csv', '.txt']:
                df = self._load_csv(file_path)
            elif ext in ['.xlsx', '.xls']:
                df = self._load_excel(file_path)
            else:
                self.logger.log_error(f"不支持的文件格式: {ext}")
                return pd.DataFrame()
            
            df = df.reset_index(drop=True)
            df['_original_index'] = df.index
            
            self.original_columns = list(df.columns)
            self._detect_columns(df)
            
            self.logger.log_info(f"成功加载 {len(df)} 行数据, {len(df.columns)} 列")
            return df
            
        except Exception as e:
            self.logger.log_error(f"加载数据失败: {str(e)}")
            return pd.DataFrame()
    
    def _load_csv(self, file_path: str) -> pd.DataFrame:
        encodings = ['utf-8', 'utf-8-sig', 'gbk', 'gb2312', 'latin1']
        for encoding in encodings:
            try:
                return pd.read_csv(file_path, encoding=encoding)
            except UnicodeDecodeError:
                continue
            except Exception:
                continue
        self.logger.log_error("无法解析CSV文件，尝试了多种编码均失败")
        return pd.DataFrame()
    
    def _load_excel(self, file_path: str) -> pd.DataFrame:
        return pd.read_excel(file_path)
    
    def _detect_columns(self, df: pd.DataFrame):
        def match_column(patterns: List[str]) -> Optional[str]:
            for col in df.columns:
                col_lower = str(col).lower().strip()
                for pattern in patterns:
                    if pattern.lower() in col_lower:
                        return col
            return None
        
        self.mapping['energy'] = match_column(config.energy_columns)
        self.mapping['production'] = match_column(config.production_columns)
        self.mapping['pressure'] = match_column(config.pressure_columns)
        self.mapping['leak'] = match_column(config.leak_columns)
        self.mapping['datetime'] = match_column(config.datetime_columns)
        self.mapping['unit'] = match_column(config.unit_columns)
        self.mapping['id'] = match_column(config.id_columns)
        
        self.logger.log_info(f"检测到的列映射: {self.mapping}")
    
    def get_column(self, df: pd.DataFrame, col_type: str) -> Optional[pd.Series]:
        col_name = self.mapping.get(col_type)
        if col_name and col_name in df.columns:
            return df[col_name]
        return None
    
    def set_column(self, df: pd.DataFrame, col_type: str, series: pd.Series) -> pd.DataFrame:
        col_name = self.mapping.get(col_type)
        if col_name:
            df[col_name] = series
        else:
            new_col_name = self._get_default_col_name(col_type)
            df[new_col_name] = series
            self.mapping[col_type] = new_col_name
        return df
    
    def _get_default_col_name(self, col_type: str) -> str:
        mapping = {
            'energy': '能耗',
            'production': '产量',
            'pressure': '压力',
            'leak': '泄漏',
            'datetime': '时间',
            'unit': '单位',
            'id': 'ID'
        }
        return mapping.get(col_type, col_type)


class DataPreprocessor:
    def __init__(self, data_loader: DataLoader):
        self.loader = data_loader
        self.logger = get_logger()
    
    def preprocess_datetime(self, df: pd.DataFrame) -> pd.DataFrame:
        datetime_col = self.loader.mapping['datetime']
        if not datetime_col or datetime_col not in df.columns:
            self.logger.log_warning("未检测到时间列，跳过时间预处理")
            return df
        
        try:
            df[datetime_col] = pd.to_datetime(df[datetime_col], errors='coerce')
            
            invalid_rows = df[df[datetime_col].isna()].index
            for idx in invalid_rows:
                self.logger.record_failed_sample(
                    idx,
                    df.loc[idx].to_dict(),
                    f"时间格式无法解析: {df.loc[idx, datetime_col]}",
                    'datetime_error'
                )
            
            df = df.dropna(subset=[datetime_col]).reset_index(drop=True)
            
            df['_year'] = df[datetime_col].dt.year
            df['_month'] = df[datetime_col].dt.month
            df['_day'] = df[datetime_col].dt.day
            df['_hour'] = df[datetime_col].dt.hour
            
            self.logger.log_info(f"时间列预处理完成，剩余有效记录: {len(df)}")
            return df
            
        except Exception as e:
            self.logger.log_error(f"时间列预处理失败: {str(e)}")
            return df
    
    def standardize_units(self, df: pd.DataFrame) -> pd.DataFrame:
        self.logger.log_info("开始单位标准化")
        
        unit_col = self.loader.mapping['unit']
        
        for col_type in ['energy', 'production', 'pressure', 'leak']:
            col_name = self.loader.mapping.get(col_type)
            if not col_name or col_name not in df.columns:
                continue
            
            unit_map = self._get_unit_map(col_type)
            default_unit = self._get_default_unit(col_type)
            
            for idx, row in df.iterrows():
                value = row[col_name]
                unit = None
                
                if unit_col and unit_col in df.columns:
                    unit = row.get(unit_col, None)
                
                if unit is None:
                    unit = self._extract_unit_from_value(value)
                
                converted, unit_detected = self._convert_value(value, unit, unit_map)
                
                if converted is None and pd.notna(value):
                    if unit_detected:
                        reason = f"{col_type}值 {value} 的单位 {unit_detected} 无法识别"
                    else:
                        reason = f"{col_type}值 {value} 无法转换或单位缺失"
                    self.logger.record_failed_sample(
                        row.get('_original_index', idx),
                        row.to_dict(),
                        reason,
                        'unit_error'
                    )
                
                df.at[idx, col_name] = converted
            
            df[f'_{col_type}_unit'] = default_unit
            self.logger.log_info(f"{col_type}列已标准化为 {default_unit}")
        
        return df
    
    def _extract_unit_from_value(self, value) -> Optional[str]:
        if pd.isna(value):
            return None
        value_str = str(value).strip().lower()
        
        units = []
        for unit_map in [
            config.energy_unit_map,
            config.production_unit_map,
            config.pressure_unit_map,
            config.leak_unit_map
        ]:
            units.extend(unit_map.keys())
        
        for unit in sorted(units, key=len, reverse=True):
            if unit in value_str:
                return unit
        return None
    
    def _convert_value(self, value, unit: Optional[str], unit_map: Dict[str, float]):
        if pd.isna(value):
            return None, None
        
        numeric_value = None
        detected_unit = unit
        
        if isinstance(value, (int, float, np.number)):
            numeric_value = float(value)
        else:
            value_str = str(value).strip().lower()
            for u in sorted(unit_map.keys(), key=len, reverse=True):
                if u in value_str:
                    try:
                        numeric_str = value_str.replace(u, '').strip()
                        numeric_value = float(numeric_str)
                        detected_unit = u
                        break
                    except ValueError:
                        continue
            
            if numeric_value is None:
                try:
                    numeric_value = float(value_str)
                except ValueError:
                    return None, None
        
        if detected_unit:
            unit_key = detected_unit.lower().replace(' ', '')
            if unit_key in unit_map:
                return numeric_value * unit_map[unit_key], detected_unit
        
        if not unit and numeric_value is not None:
            return numeric_value, None
        
        return None, detected_unit
    
    def _get_unit_map(self, col_type: str) -> Dict[str, float]:
        mapping = {
            'energy': config.energy_unit_map,
            'production': config.production_unit_map,
            'pressure': config.pressure_unit_map,
            'leak': config.leak_unit_map
        }
        return mapping.get(col_type, {})
    
    def _get_default_unit(self, col_type: str) -> str:
        mapping = {
            'energy': config.default_energy_unit,
            'production': config.default_production_unit,
            'pressure': config.default_pressure_unit,
            'leak': config.default_leak_unit
        }
        return mapping.get(col_type, '')
    
    def convert_to_numeric(self, df: pd.DataFrame) -> pd.DataFrame:
        for col_type in ['energy', 'production', 'pressure', 'leak']:
            col_name = self.loader.mapping.get(col_type)
            if not col_name or col_name not in df.columns:
                continue
            
            original_values = df[col_name].copy()
            
            def safe_convert(val):
                if pd.isna(val):
                    return val
                if isinstance(val, (int, float, np.number)):
                    return float(val)
                try:
                    val_str = str(val).strip()
                    for unit in list(config.energy_unit_map.keys()) + \
                                list(config.production_unit_map.keys()) + \
                                list(config.pressure_unit_map.keys()) + \
                                list(config.leak_unit_map.keys()):
                        val_str = val_str.lower().replace(unit, '')
                    return float(val_str.strip())
                except (ValueError, TypeError):
                    return np.nan
            
            df[col_name] = df[col_name].apply(safe_convert)
            
            converted_count = df[col_name].notna().sum()
            failed_count = original_values.notna().sum() - converted_count
            
            if failed_count > 0:
                for idx in df[original_values.notna() & df[col_name].isna()].index:
                    self.logger.record_failed_sample(
                        df.loc[idx, '_original_index'],
                        df.loc[idx].to_dict(),
                        f"{col_type}值 {original_values[idx]} 无法转换为数字",
                        'numeric_error'
                    )
            
            self.logger.log_info(f"{col_name} 列转换完成: 成功 {converted_count}, 失败 {failed_count}")
        
        return df
