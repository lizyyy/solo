"""核心数据模型"""

import json
import hashlib
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import List, Dict, Optional, Any


class RowStatus(Enum):
    NORMAL = "normal"
    DELETED = "deleted"
    GAP = "gap"
    SUPPLEMENTED = "supplemented"
    PENDING_REVIEW = "pending_review"


class ImportStatus(Enum):
    INITIAL = "initial"
    DUPLICATE = "duplicate"
    ANNOTATED = "annotated"
    PARAMS_UPDATED = "params_updated"
    REVIEWED = "reviewed"


@dataclass
class OriginalRow:
    original_line_no: int
    current_line_no: Optional[int]
    x_value: float
    y_value: float
    status: RowStatus
    residual: Optional[float] = None
    predicted: Optional[float] = None
    deleted_at: Optional[datetime] = None
    supplemented_at: Optional[datetime] = None
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["status"] = self.status.value
        for key in ["deleted_at", "supplemented_at"]:
            if data[key]:
                data[key] = data[key].isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "OriginalRow":
        data = data.copy()
        data["status"] = RowStatus(data["status"])
        for key in ["deleted_at", "supplemented_at"]:
            if data[key]:
                data[key] = datetime.fromisoformat(data[key])
        return cls(**data)


@dataclass
class ImportRecord:
    import_id: str
    import_time: datetime
    source_file: str
    file_hash: str
    status: ImportStatus
    total_rows: int
    rows: List[OriginalRow] = field(default_factory=list)
    annotations: List[Dict[str, Any]] = field(default_factory=list)
    regression_params: Optional[Dict[str, float]] = None
    params_version: int = 1

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["import_time"] = self.import_time.isoformat()
        data["status"] = self.status.value
        data["rows"] = [r.to_dict() for r in self.rows]
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ImportRecord":
        data = data.copy()
        data["import_time"] = datetime.fromisoformat(data["import_time"])
        data["status"] = ImportStatus(data["status"])
        data["rows"] = [OriginalRow.from_dict(r) for r in data["rows"]]
        return cls(**data)


def calculate_file_hash(content: str) -> str:
    return hashlib.md5(content.encode("utf-8")).hexdigest()


def generate_import_id() -> str:
    return datetime.now().strftime("IMP%Y%m%d%H%M%S")
