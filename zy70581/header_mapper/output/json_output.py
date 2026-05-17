import json
from dataclasses import asdict
from ..core.models import MappingResult, MatchType
from datetime import datetime
from pathlib import Path


class JsonOutput:
    @staticmethod
    def _serialize(obj):
        if isinstance(obj, MatchType):
            return obj.value
        if isinstance(obj, datetime):
            return obj.isoformat()
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
    
    @classmethod
    def generate(cls, result: MappingResult, output_path: str) -> None:
        result_dict = asdict(result)
        
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(
                result_dict,
                f,
                ensure_ascii=False,
                indent=2,
                default=cls._serialize
            )
