import pandas as pd
import numpy as np
import logging
from typing import Dict, List, Tuple, Any
from config import CONFIG, DATA_DIR


logger = logging.getLogger(__name__)


class DataLoader:
    def __init__(self, config: Dict = None):
        self.config = config or CONFIG
        self.loading_errors: List[Dict] = []
        
    def load_data(self, file_path: str = None) -> pd.DataFrame:
        if file_path is None:
            file_path = self._find_latest_data_file()
            
        logger.info(f"正在加载数据文件: {file_path}")
        
        file_ext = file_path.split('.')[-1].lower()
        
        try:
            if file_ext in ['csv', 'txt']:
                df = self._load_csv(file_path)
            elif file_ext in ['xlsx', 'xls']:
                df = self._load_excel(file_path)
            else:
                raise ValueError(f"不支持的文件格式: {file_ext}")
            
            df = self._validate_columns(df)
            df = self._convert_units(df)
            df = self._parse_time(df)
            df = self._sort_and_deduplicate(df)
            
            logger.info(f"数据加载完成，共 {len(df)} 条记录")
            return df
            
        except Exception as e:
            self.loading_errors.append({
                'step': 'data_loading',
                'error_type': type(e).__name__,
                'error_message': str(e),
                'file_path': file_path
            })
            logger.error(f"数据加载失败: {e}")
            raise
            
    def _find_latest_data_file(self) -> str:
        import os
        files = [f for f in os.listdir(DATA_DIR) 
                if f.endswith(('.csv', '.txt', '.xlsx', '.xls'))]
        
        if not files:
            raise FileNotFoundError(f"在 {DATA_DIR} 中未找到数据文件")
        
        files.sort()
        return os.path.join(DATA_DIR, files[-1])
        
    def _load_csv(self, file_path: str) -> pd.DataFrame:
        encodings = ['utf-8', 'gbk', 'gb2312', 'utf-8-sig']
        
        for encoding in encodings:
            try:
                df = pd.read_csv(file_path, encoding=encoding)
                logger.info(f"使用编码 {encoding} 成功读取CSV")
                return df
            except UnicodeDecodeError:
                continue
            except Exception as e:
                logger.warning(f"使用 {encoding} 编码读取失败: {e}")
                
        raise ValueError("无法使用任何编码读取CSV文件")
        
    def _load_excel(self, file_path: str) -> pd.DataFrame:
        df = pd.read_excel(file_path)
        logger.info("成功读取Excel文件")
        return df
        
    def _validate_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        required_cols = [self.config['time_column'], self.config['value_column']]
        station_col = self.config['station_column']
        
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            raise ValueError(f"缺少必要列: {missing_cols}")
            
        if station_col not in df.columns:
            logger.warning(f"未找到站点列 {station_col}，默认添加 'default' 站点")
            df[station_col] = 'default'
            
        return df
        
    def _convert_units(self, df: pd.DataFrame) -> pd.DataFrame:
        value_col = self.config['value_column']
        
        if df[value_col].dtype == 'object':
            df = self._extract_numeric_values(df, value_col)
            
        df[value_col] = pd.to_numeric(df[value_col], errors='coerce')
        
        return df
        
    def _extract_numeric_values(self, df: pd.DataFrame, value_col: str) -> pd.DataFrame:
        for idx, val in enumerate(df[value_col]):
            if isinstance(val, str):
                original_val = val
                val = val.strip()
                
                for unit in ['mm', 'cm', 'm', '毫米', '厘米', '米']:
                    if unit in val:
                        val = val.replace(unit, '')
                        
                        if unit in ['cm', '厘米']:
                            multiplier = 10.0
                        elif unit in ['m', '米']:
                            multiplier = 1000.0
                        else:
                            multiplier = 1.0
                            
                        try:
                            numeric_val = float(val.strip())
                            df.at[idx, value_col] = numeric_val * multiplier
                            
                            if multiplier != 1.0:
                                self.loading_errors.append({
                                    'step': 'unit_conversion',
                                    'row_index': idx,
                                    'original_value': original_val,
                                    'converted_value': df.at[idx, value_col],
                                    'unit_found': unit,
                                    'multiplier_applied': multiplier
                                })
                        except ValueError:
                            pass
                            
        return df
        
    def _parse_time(self, df: pd.DataFrame) -> pd.DataFrame:
        time_col = self.config['time_column']
        
        df[time_col] = pd.to_datetime(
            df[time_col],
            errors='coerce',
            infer_datetime_format=True
        )
        
        invalid_times = df[df[time_col].isna()].index.tolist()
        if invalid_times:
            for idx in invalid_times:
                self.loading_errors.append({
                    'step': 'time_parsing',
                    'row_index': idx,
                    'error_type': 'invalid_datetime',
                    'original_value': df.iloc[idx][time_col]
                })
            logger.warning(f"发现 {len(invalid_times)} 条无效时间记录")
            
        df = df.dropna(subset=[time_col])
        df = df.set_index(time_col).sort_index().reset_index()
        
        return df
        
    def _sort_and_deduplicate(self, df: pd.DataFrame) -> pd.DataFrame:
        station_col = self.config['station_column']
        time_col = self.config['time_column']
        
        df = df.sort_values([station_col, time_col])
        
        before_dedup = len(df)
        df = df.drop_duplicates(subset=[station_col, time_col], keep='first')
        duplicates_removed = before_dedup - len(df)
        
        if duplicates_removed > 0:
            logger.info(f"移除了 {duplicates_removed} 条重复记录")
            self.loading_errors.append({
                'step': 'deduplication',
                'duplicates_removed': duplicates_removed
            })
            
        return df
        
    def get_loading_errors(self) -> List[Dict]:
        return self.loading_errors.copy()
