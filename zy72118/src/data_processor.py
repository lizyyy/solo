import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import sys
sys.path.append(str(Path(__file__).parent.parent))
from config import COLUMN_MAPPINGS, UNITS


class DataProcessor:
    def __init__(self):
        self.raw_data = None
        self.processed_data = None
        self.column_mapping = {}
        self.warnings = []
        
    def detect_columns(self, df: pd.DataFrame) -> Dict[str, str]:
        mapping = {}
        df_columns_lower = {col.lower(): col for col in df.columns}
        
        for standard_name, candidates in COLUMN_MAPPINGS.items():
            for candidate in candidates:
                candidate_lower = candidate.lower()
                if candidate_lower in df_columns_lower:
                    mapping[standard_name] = df_columns_lower[candidate_lower]
                    break
                    
        self.column_mapping = mapping
        return mapping
    
    def load_experiment_table(self, file_path: str) -> pd.DataFrame:
        file_ext = Path(file_path).suffix.lower()
        
        if file_ext in ['.xlsx', '.xls']:
            df = pd.read_excel(file_path)
        elif file_ext == '.csv':
            df = pd.read_csv(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {file_ext}")
            
        self.raw_data = df
        self.detect_columns(df)
        
        return df
    
    def parse_photo_notes(self, photo_notes: List[Dict]) -> pd.DataFrame:
        records = []
        for note in photo_notes:
            record = {
                'timestamp': note.get('time', ''),
                'distance_raw': note.get('distance', ''),
                'direction': note.get('direction', ''),
                'remark': note.get('note', ''),
                'photo_path': note.get('photo_path', '')
            }
            records.append(record)
            
        return pd.DataFrame(records)
    
    def parse_working_conditions(self, conditions_text: str) -> Dict:
        conditions = {}
        lines = conditions_text.split('\n')
        
        for line in lines:
            line = line.strip()
            if ':' in line or '：' in line:
                separator = ':' if ':' in line else '：'
                key, value = line.split(separator, 1)
                conditions[key.strip()] = value.strip()
                
        return conditions
    
    def convert_units(self, df: pd.DataFrame, column: str, 
                     from_unit: str, to_unit: str = 'mm') -> pd.DataFrame:
        if from_unit not in UNITS['distance'] or to_unit not in UNITS['distance']:
            raise ValueError(f"不支持的单位: {from_unit} -> {to_unit}")
            
        factor = UNITS['distance'][from_unit] / UNITS['distance'][to_unit]
        df[f'{column}_{to_unit}'] = df[column] * factor
        
        return df
    
    def merge_data_sources(self, experiment_df: pd.DataFrame, 
                          photo_df: Optional[pd.DataFrame] = None,
                          conditions: Optional[Dict] = None) -> pd.DataFrame:
        result_df = experiment_df.copy()
        
        if photo_df is not None and not photo_df.empty:
            if 'timestamp' in self.column_mapping:
                time_col = self.column_mapping['timestamp']
                result_df = pd.concat([result_df, photo_df], ignore_index=True)
                
        if conditions:
            for key, value in conditions.items():
                result_df[f'condition_{key}'] = value
                
        self.processed_data = result_df
        return result_df
    
    def get_processed_data(self) -> Optional[pd.DataFrame]:
        return self.processed_data
