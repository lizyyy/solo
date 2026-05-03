import json
from typing import Any, Dict, List
from .base_parser import BaseParser


class JSONParser(BaseParser):
    
    def parse(self, file_path: str) -> List[Dict[str, Any]]:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        if isinstance(data, list):
            return [self._process_item(item) for item in data]
        elif isinstance(data, dict):
            if "records" in data:
                return [self._process_item(item) for item in data["records"]]
            elif "data" in data:
                return [self._process_item(item) for item in data["data"]]
            else:
                return [self._process_item(data)]
        else:
            return []
    
    def _process_item(self, item: Dict[str, Any]) -> Dict[str, Any]:
        processed = {}
        for key, value in item.items():
            if isinstance(value, str):
                processed[key] = self._auto_parse(value)
            else:
                processed[key] = value
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
