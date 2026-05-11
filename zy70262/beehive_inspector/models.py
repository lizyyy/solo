"""蜂箱档案模型"""
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import List, Optional, Dict, Any
import json
import os


@dataclass
class Beehive:
    beehive_id: str
    location: str
    established_date: str
    current_status: str
    queen_status: str
    last_inspection_date: Optional[str] = None
    notes: str = ""
    history: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Beehive":
        return cls(
            beehive_id=data["beehive_id"],
            location=data["location"],
            established_date=data["established_date"],
            current_status=data["current_status"],
            queen_status=data["queen_status"],
            last_inspection_date=data.get("last_inspection_date"),
            notes=data.get("notes", ""),
            history=data.get("history", []),
        )

    def add_history(self, event: Dict[str, Any]):
        event["timestamp"] = datetime.now().isoformat()
        self.history.append(event)
