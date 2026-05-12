from dataclasses import dataclass, field
from typing import Any, Dict, Optional
from .base import BaseModel


@dataclass
class ManualCorrection(BaseModel):
    target_type: str = ""
    target_id: str = ""
    operator: str = ""
    correction_reason: str = ""
    before_data: Dict[str, Any] = field(default_factory=dict)
    after_data: Dict[str, Any] = field(default_factory=dict)
    changed_fields: list = field(default_factory=list)
    notes: Optional[str] = None
