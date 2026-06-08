"""核心数据模型 - 支持变更历史、原始值保留、复核追踪、多源字段归一"""

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
    REVIEWED = "reviewed"
    MODIFIED = "modified"


class ImportStatus(Enum):
    INITIAL = "initial"
    DUPLICATE = "duplicate"
    ANNOTATED = "annotated"
    PARAMS_UPDATED = "params_updated"
    REVIEWED = "reviewed"
    RESIDUALS_RECALCULATED = "residuals_recalculated"


class ChangeType(Enum):
    IMPORT = "import"
    DELETE = "delete"
    SUPPLEMENT = "supplement"
    MODIFY = "modify"
    ANNOTATE = "annotate"
    REVIEW = "review"
    RECALC = "recalc"
    PARAM_UPDATE = "param_update"


@dataclass
class ChangeLogEntry:
    timestamp: datetime
    change_type: ChangeType
    original_line_no: int
    author: str
    original_value_x: Optional[float] = None
    original_value_y: Optional[float] = None
    new_value_x: Optional[float] = None
    new_value_y: Optional[float] = None
    original_status: Optional[str] = None
    new_status: Optional[str] = None
    reason: str = ""
    next_action: str = ""
    params_version_before: Optional[int] = None
    params_version_after: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["timestamp"] = self.timestamp.isoformat()
        data["change_type"] = self.change_type.value
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ChangeLogEntry":
        data = data.copy()
        data["timestamp"] = datetime.fromisoformat(data["timestamp"])
        data["change_type"] = ChangeType(data["change_type"])
        return cls(**data)


@dataclass
class OriginalRow:
    original_line_no: int
    current_line_no: Optional[int]
    x_value: float
    y_value: float
    status: RowStatus

    original_x_value: Optional[float] = None
    original_y_value: Optional[float] = None

    residual: Optional[float] = None
    predicted: Optional[float] = None

    deleted_at: Optional[datetime] = None
    supplemented_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None

    reviewed_by: str = ""
    review_comment: str = ""
    next_owner: str = ""

    notes: str = ""
    source_field_x: str = "x"
    source_field_y: str = "y"
    source_file_ref: str = ""

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["status"] = self.status.value
        for key in ["deleted_at", "supplemented_at", "reviewed_at"]:
            if data[key]:
                data[key] = data[key].isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "OriginalRow":
        data = data.copy()
        data["status"] = RowStatus(data["status"])
        for key in ["deleted_at", "supplemented_at", "reviewed_at"]:
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
    regression_params_history: List[Dict[str, Any]] = field(default_factory=list)
    params_version: int = 1
    change_log: List[ChangeLogEntry] = field(default_factory=list)
    field_mapping: Dict[str, str] = field(default_factory=dict)
    source_format: str = "csv"
    data_owner: str = ""

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["import_time"] = self.import_time.isoformat()
        data["status"] = self.status.value
        data["rows"] = [r.to_dict() for r in self.rows]
        data["change_log"] = [c.to_dict() for c in self.change_log]
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ImportRecord":
        data = data.copy()
        data["import_time"] = datetime.fromisoformat(data["import_time"])
        data["status"] = ImportStatus(data["status"])
        data["rows"] = [OriginalRow.from_dict(r) for r in data["rows"]]
        data["change_log"] = [ChangeLogEntry.from_dict(c) for c in data.get("change_log", [])]
        return cls(**data)

    def add_change_log(self, entry: ChangeLogEntry):
        self.change_log.append(entry)

    def snapshot_params(self, trigger: str = ""):
        if self.regression_params:
            self.regression_params_history.append(
                {
                    "params_version": self.params_version,
                    "snapshot_time": datetime.now().isoformat(),
                    "params": self.regression_params.copy(),
                    "trigger": trigger,
                }
            )


def calculate_file_hash(content: str) -> str:
    return hashlib.md5(content.encode("utf-8")).hexdigest()


def generate_import_id() -> str:
    return datetime.now().strftime("IMP%Y%m%d%H%M%S")


FIELD_NORMALIZATION_MAP = {
    "x": ["x", "X", "自变量", "x值", "X值", "x_value", "X轴", "横坐标"],
    "y": ["y", "Y", "因变量", "y值", "Y值", "y_value", "Y轴", "纵坐标", "目标值", "label"],
}


def normalize_field_name(raw_name: str) -> Optional[str]:
    raw_stripped = raw_name.strip()
    for canonical, aliases in FIELD_NORMALIZATION_MAP.items():
        if raw_stripped in aliases:
            return canonical
    return None
