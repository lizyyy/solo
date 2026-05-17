from typing import Any
import json
from datetime import datetime
from .models import FieldType


class TypeInferencer:
    TIMESTAMP_FORMATS = [
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S.%f",
        "%d/%b/%Y:%H:%M:%S",
    ]

    @classmethod
    def infer(cls, value: Any) -> FieldType:
        if value is None:
            return FieldType.NULL
        
        if isinstance(value, bool):
            return FieldType.BOOLEAN
        
        if isinstance(value, int):
            return FieldType.INTEGER
        
        if isinstance(value, float):
            return FieldType.FLOAT
        
        if isinstance(value, dict):
            return FieldType.OBJECT
        
        if isinstance(value, list):
            return FieldType.ARRAY
        
        if isinstance(value, str):
            if cls._is_timestamp(value):
                return FieldType.TIMESTAMP
            return FieldType.STRING
        
        return FieldType.UNKNOWN

    @classmethod
    def _is_timestamp(cls, value: str) -> bool:
        for fmt in cls.TIMESTAMP_FORMATS:
            try:
                datetime.strptime(value, fmt)
                return True
            except (ValueError, TypeError):
                continue
        return False
