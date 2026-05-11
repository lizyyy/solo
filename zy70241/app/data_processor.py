import pandas as pd
from datetime import datetime
from typing import List, Dict, Tuple
from io import StringIO, BytesIO

class DataCleaner:
    def __init__(self):
        self.warnings = []
        self.errors = []
        
    def clean_water_quality_data(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str], List[str]]:
        self.warnings = []
        self.errors = []
        cleaned_df = df.copy()
        
        cleaned_df = self._handle_missing_values(cleaned_df, ['filter_id', 'record_date'])
        
        cleaned_df['record_date'] = pd.to_datetime(cleaned_df['record_date'], errors='coerce')
        invalid_dates = cleaned_df['record_date'].isna().sum()
        if invalid_dates > 0:
            self.errors.append(f"发现 {invalid_dates} 条无效日期记录，已删除")
            cleaned_df = cleaned_df.dropna(subset=['record_date'])
        
        numeric_cols = ['turbidity', 'ph', 'residual_chlorine', 'conductivity', 'total_dissolved_solids', 'color']
        for col in numeric_cols:
            if col in cleaned_df.columns:
                cleaned_df[col] = pd.to_numeric(cleaned_df[col], errors='coerce')
                out_of_range = self._check_quality_ranges(cleaned_df, col)
                if out_of_range > 0:
                    self.warnings.append(f"列 {col} 有 {out_of_range} 条超出正常范围的记录")
        
        if 'ph' in cleaned_df.columns:
            ph_invalid = ((cleaned_df['ph'] < 0) | (cleaned_df['ph'] > 14) | cleaned_df['ph'].isna()).sum()
            if ph_invalid > 0:
                self.errors.append(f"pH值有 {ph_invalid} 条无效记录")
        
        cleaned_df['is_valid'] = self._calculate_validity_quality(cleaned_df)
        
        return cleaned_df, self.warnings, self.errors
    
    def clean_water_volume_data(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str], List[str]]:
        self.warnings = []
        self.errors = []
        cleaned_df = df.copy()
        
        cleaned_df = self._handle_missing_values(cleaned_df, ['filter_id', 'record_date', 'daily_volume_liters'])
        
        cleaned_df['record_date'] = pd.to_datetime(cleaned_df['record_date'], errors='coerce')
        invalid_dates = cleaned_df['record_date'].isna().sum()
        if invalid_dates > 0:
            self.errors.append(f"发现 {invalid_dates} 条无效日期记录，已删除")
            cleaned_df = cleaned_df.dropna(subset=['record_date'])
        
        cleaned_df['daily_volume_liters'] = pd.to_numeric(cleaned_df['daily_volume_liters'], errors='coerce')
        cleaned_df['cumulative_volume_liters'] = pd.to_numeric(cleaned_df.get('cumulative_volume_liters', 0), errors='coerce')
        
        negative_volume = (cleaned_df['daily_volume_liters'] < 0).sum()
        if negative_volume > 0:
            self.errors.append(f"发现 {negative_volume} 条负水量记录，已标记为无效")
        
        if 'cumulative_volume_liters' not in cleaned_df.columns or cleaned_df['cumulative_volume_liters'].isna().all():
            self.warnings.append("缺少累积水量数据，将基于日用水量计算")
            cleaned_df = self._calculate_cumulative_volume(cleaned_df)
        
        cleaned_df['is_valid'] = self._calculate_validity_volume(cleaned_df)
        
        return cleaned_df, self.warnings, self.errors
    
    def clean_complaint_data(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str], List[str]]:
        self.warnings = []
        self.errors = []
        cleaned_df = df.copy()
        
        cleaned_df = self._handle_missing_values(cleaned_df, ['filter_id', 'complaint_date', 'complaint_type', 'description', 'severity'])
        
        cleaned_df['complaint_date'] = pd.to_datetime(cleaned_df['complaint_date'], errors='coerce')
        invalid_dates = cleaned_df['complaint_date'].isna().sum()
        if invalid_dates > 0:
            self.errors.append(f"发现 {invalid_dates} 条无效日期记录，已删除")
            cleaned_df = cleaned_df.dropna(subset=['complaint_date'])
        
        valid_severities = ['low', 'medium', 'high', 'critical']
        invalid_severity = (~cleaned_df['severity'].str.lower().isin(valid_severities)).sum()
        if invalid_severity > 0:
            self.warnings.append(f"发现 {invalid_severity} 条严重程度不在标准范围内的记录")
        
        if 'status' not in cleaned_df.columns:
            cleaned_df['status'] = 'open'
        
        return cleaned_df, self.warnings, self.errors
    
    def _handle_missing_values(self, df: pd.DataFrame, required_cols: List[str]) -> pd.DataFrame:
        for col in required_cols:
            if col not in df.columns:
                self.errors.append(f"缺少必需列: {col}")
                continue
            
            missing = df[col].isna().sum()
            if missing > 0:
                self.errors.append(f"列 {col} 有 {missing} 条缺失记录，已删除")
                df = df.dropna(subset=[col])
        
        return df
    
    def _check_quality_ranges(self, df: pd.DataFrame, column: str) -> int:
        ranges = {
            'turbidity': (0, 100),
            'ph': (0, 14),
            'residual_chlorine': (0, 10),
            'conductivity': (0, 2000),
            'total_dissolved_solids': (0, 2000),
            'color': (0, 500)
        }
        
        if column in ranges:
            min_val, max_val = ranges[column]
            return ((df[column] < min_val) | (df[column] > max_val)).sum()
        return 0
    
    def _calculate_validity_quality(self, df: pd.DataFrame) -> pd.Series:
        validity = pd.Series(True, index=df.index)
        
        if 'ph' in df.columns:
            validity = validity & ~((df['ph'] < 0) | (df['ph'] > 14))
        
        if 'turbidity' in df.columns:
            validity = validity & (df['turbidity'] >= 0)
        
        return validity
    
    def _calculate_validity_volume(self, df: pd.DataFrame) -> pd.Series:
        return df['daily_volume_liters'] >= 0
    
    def _calculate_cumulative_volume(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.sort_values(['filter_id', 'record_date'])
        df['cumulative_volume_liters'] = df.groupby('filter_id')['daily_volume_liters'].cumsum()
        return df

class DataImporter:
    def __init__(self):
        self.cleaner = DataCleaner()
    
    def import_from_file(self, file_content: bytes, file_type: str, data_type: str) -> Dict:
        if file_type == 'csv':
            df = pd.read_csv(BytesIO(file_content))
        elif file_type in ['xlsx', 'xls']:
            df = pd.read_excel(BytesIO(file_content))
        else:
            return {
                'success': False,
                'error': '不支持的文件格式，请使用 CSV 或 Excel 文件'
            }
        
        return self._process_data(df, data_type)
    
    def import_from_string(self, data_string: str, data_type: str) -> Dict:
        try:
            df = pd.read_csv(StringIO(data_string))
        except:
            return {
                'success': False,
                'error': '无法解析 CSV 数据'
            }
        
        return self._process_data(df, data_type)
    
    def _process_data(self, df: pd.DataFrame, data_type: str) -> Dict:
        total_records = len(df)
        
        if data_type == 'water_quality':
            cleaned_df, warnings, errors = self.cleaner.clean_water_quality_data(df)
        elif data_type == 'water_volume':
            cleaned_df, warnings, errors = self.cleaner.clean_water_volume_data(df)
        elif data_type == 'complaints':
            cleaned_df, warnings, errors = self.cleaner.clean_complaint_data(df)
        else:
            return {
                'success': False,
                'error': f'未知的数据类型: {data_type}'
            }
        
        valid_records = len(cleaned_df[cleaned_df.get('is_valid', True)]) if 'is_valid' in cleaned_df.columns else len(cleaned_df)
        invalid_records = len(cleaned_df) - valid_records
        
        return {
            'success': True,
            'total_records': total_records,
            'valid_records': valid_records,
            'invalid_records': invalid_records,
            'warnings': warnings,
            'errors': errors,
            'cleaned_data': cleaned_df
        }
