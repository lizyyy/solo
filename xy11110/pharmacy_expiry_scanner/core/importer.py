import pandas as pd
from pathlib import Path
from typing import List, Dict, Tuple, Optional
import logging


class FileImporter:
    def __init__(self, field_mapping: Dict, config: Dict):
        self.field_mapping = field_mapping
        self.config = config
        self.logger = logging.getLogger("pharmacy_scanner")
    
    def import_file(self, file_path: str) -> Tuple[Optional[List[Dict]], Optional[str]]:
        path = Path(file_path)
        
        if not path.exists():
            return None, f"文件不存在: {file_path}"
        
        try:
            if path.suffix.lower() in ['.csv']:
                df = pd.read_csv(file_path, dtype=str)
            elif path.suffix.lower() in ['.xlsx', '.xls']:
                df = pd.read_excel(file_path, dtype=str)
            else:
                return None, f"不支持的文件格式: {path.suffix}"
            
            records = self._normalize_fields(df, path.name)
            
            self.logger.info(f"成功导入文件 {path.name}: {len(records)} 条记录")
            return records, None
            
        except Exception as e:
            return None, f"导入文件失败: {str(e)}"
    
    def _normalize_fields(self, df: pd.DataFrame, filename: str) -> List[Dict]:
        records = []
        columns = df.columns.tolist()
        
        column_mapping = self._map_columns(columns)
        
        for idx, row in df.iterrows():
            if self.config.get('skip_empty_rows', True) and row.isna().all():
                continue
            
            record = {
                'source_file': filename,
                'row_number': idx + 2,
                'original_data': row.to_dict()
            }
            
            for standard_field, possible_names in self.field_mapping.items():
                for col in possible_names:
                    if col in column_mapping and column_mapping[col] in columns:
                        value = row.get(column_mapping[col], '')
                        if pd.notna(value) and str(value).strip() != '':
                            record[standard_field] = str(value).strip()
                            break
            
            records.append(record)
        
        return records
    
    def _map_columns(self, columns: List[str]) -> Dict[str, str]:
        mapping = {}
        for col in columns:
            mapping[col] = col
            mapping[col.lower()] = col
            mapping[col.strip()] = col
        return mapping
