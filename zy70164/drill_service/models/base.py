from dataclasses import dataclass, asdict
from typing import Dict, Any
import json


@dataclass
class BaseModel:
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        return cls(**data)
    
    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)
