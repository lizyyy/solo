from abc import ABC
from dataclasses import dataclass
from typing import Dict


@dataclass
class BaseModel(ABC):
    def to_dict(self) -> Dict:
        raise NotImplementedError("Subclasses must implement to_dict method")

    @classmethod
    def from_dict(cls, data: Dict) -> "BaseModel":
        raise NotImplementedError("Subclasses must implement from_dict method")
