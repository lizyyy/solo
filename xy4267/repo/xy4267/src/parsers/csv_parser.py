import csv
from typing import Any, Dict, List
from .base_parser import BaseParser


class CSVParser(BaseParser):
    
    def __init__(self):
        self.encoding = "utf-8"
        self.delimiter = ","
    
    def parse(self, file_path: str) -> List[Dict[str, Any]]:
        results = []
        with open(file_path, "r", encoding=self.encoding, errors="ignore") as f:
            reader = csv.DictReader(f)
            for row in reader:
                processed_row = self._process_row(row)
                results.append(processed_row)
        return results
    
    def _process_row(self, row: Dict[str, str]) -> Dict[str, Any]:
        processed = {}
        for key, value in row.items():
            key = key.strip()
            processed[key] = self._auto_parse(value)
        return processed
    
    def _auto_parse(self, value: str) -> Any:
        if not value or value.strip() == "":
            return None
        
        value = value.strip()
        
        dt = self._parse_datetime(value)
        if dt:
            return dt
        
        if "." in value:
            f = self._parse_float(value)
            if f is not None:
                return f
        
        i = self._parse_int(value)
        if i is not None:
            return i
        
        return value
