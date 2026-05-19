from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from datetime import datetime


@dataclass
class CorrectionRecord:
    correction_id: str
    user_id: str
    correction_type: str
    field_name: Optional[str] = None
    old_value: Any = None
    new_value: Any = None
    reason: str = ""
    corrected_by: str = ""
    corrected_at: datetime = field(default_factory=datetime.now)
    source_file: str = ""
    line_number: int = 0
    applied: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "correction_id": self.correction_id,
            "user_id": self.user_id,
            "correction_type": self.correction_type,
            "field_name": self.field_name,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "reason": self.reason,
            "corrected_by": self.corrected_by,
            "corrected_at": self.corrected_at.isoformat(),
            "source_file": self.source_file,
            "line_number": self.line_number,
            "applied": self.applied,
        }
