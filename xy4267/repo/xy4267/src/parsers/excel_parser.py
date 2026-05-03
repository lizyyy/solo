from typing import Any, Dict, List
try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

from .base_parser import BaseParser


class ExcelParser(BaseParser):
    
    def __init__(self):
        if not PANDAS_AVAILABLE:
            raise ImportError("pandas and openpyxl required for Excel parsing")
    
    def parse(self, file_path: str) -> List[Dict[str, Any]]:
        if not PANDAS_AVAILABLE:
            return []
        
        df = pd.read_excel(file_path)
        results = []
        for _, row in df.iterrows():
            processed_row = self._process_row(row.to_dict())
            results.append(processed_row)
        return results
    
    def _process_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        processed = {}
        for key, value in row.items():
            if pd.isna(value):
                processed[str(key).strip()] = None
            elif isinstance(value, pd.Timestamp):
                processed[str(key).strip()] = value.to_pydatetime()
            elif isinstance(value, str):
                processed[str(key).strip()] = self._auto_parse(value)
            else:
                processed[str(key).strip()] = value
        return processed
    
    def _auto_parse(self, value: str) -> Any:
        if not value or str(value).strip() == "":
            return None
        
        value_str = str(value).strip()
        
        dt = self._parse_datetime(value_str)
        if dt:
            return dt
        
        return value_str
