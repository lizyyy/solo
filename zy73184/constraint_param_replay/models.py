from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class SourceType(Enum):
    HISTORY_LATEST = "history_latest"
    HISTORY_OLD = "history_old"
    ATTACHMENT_LATE = "attachment_late"
    VERBAL_NOTE = "verbal_note"
    FORMULA = "formula"
    MANUAL_JUDGMENT = "manual_judgment"

    @property
    def label(self):
        labels = {
            "history_latest": "历史答案(最新)",
            "history_old": "历史答案(旧版)",
            "attachment_late": "晚到附件",
            "verbal_note": "口头备注",
            "formula": "公式计算",
            "manual_judgment": "人工判断",
        }
        return labels[self.value]


class RowStatus(Enum):
    PROCESSED = "processed"
    BAD = "bad"
    SKIPPED = "skipped"
    SORT_UNSTABLE = "sort_unstable"

    @property
    def label(self):
        labels = {
            "processed": "已处理",
            "bad": "坏行",
            "skipped": "跳过行",
            "sort_unstable": "排序不稳定",
        }
        return labels[self.value]


@dataclass
class UnitConversion:
    from_unit: str
    to_unit: str
    factor: float
    description: str = ""


@dataclass
class FormulaDef:
    name: str
    expression: str
    unit: str
    params: List[str] = field(default_factory=list)
    description: str = ""
    version: str = "v1"


@dataclass
class JudgmentRecord:
    timestamp: str
    old_judgment: str
    new_judgment: str
    reason: str
    operator: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")


@dataclass
class SourceDetail:
    source_type: SourceType
    file_name: str = ""
    content_summary: str = ""
    affects_value: bool = False
    affects_judgment: bool = False
    impact_description: str = ""
    version: str = ""


@dataclass
class HistoryAnswer:
    id: str
    content: Any
    unit: str
    source: SourceType
    version: str = ""
    timestamp: str = ""
    formula_name: Optional[str] = None
    attachment_name: Optional[str] = None
    note_text: Optional[str] = None
    description: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")


@dataclass
class ProcessRow:
    row_id: str
    status: RowStatus
    value: Any = None
    unit: str = ""
    formula_name: str = ""
    formula_version: str = ""
    sources: List[SourceType] = field(default_factory=list)
    source_details: List[SourceDetail] = field(default_factory=list)
    error_msg: str = ""
    skip_reason: str = ""
    sort_order: Optional[int] = None
    sort_unstable_reason: str = ""
    judgments: List[JudgmentRecord] = field(default_factory=list)
    raw_data: Dict[str, Any] = field(default_factory=dict)
    base_value: Any = None
    base_unit: str = ""
    base_formula_name: str = ""
    base_source: str = ""
    affected_by_attachment: bool = False
    affected_by_note: bool = False
    affected_by_old_history: bool = False
    value_diff: str = ""
    unit_conversion_basis: str = ""
    explanation: str = ""


@dataclass
class ReplaySummary:
    total: int = 0
    processed: int = 0
    bad: int = 0
    skipped: int = 0
    sort_unstable: int = 0
    affected_by_attachment: int = 0
    affected_by_note: int = 0
    affected_by_old_history: int = 0
    has_unit_conversion: int = 0
    by_source: Dict[str, int] = field(default_factory=dict)
    by_formula: Dict[str, int] = field(default_factory=dict)

    def to_dict(self):
        return {
            "总计": self.total,
            "已处理": self.processed,
            "坏行": self.bad,
            "跳过行": self.skipped,
            "排序不稳定": self.sort_unstable,
            "受晚到附件影响": self.affected_by_attachment,
            "受口头备注影响": self.affected_by_note,
            "受旧版答案影响": self.affected_by_old_history,
            "有单位换算": self.has_unit_conversion,
            "按来源分布": self.by_source,
            "按公式分布": self.by_formula,
        }


@dataclass
class ReplayReport:
    param_version: str
    timestamp: str
    summary: ReplaySummary
    rows: List[ProcessRow]
    sort_unstable_rows: List[ProcessRow] = field(default_factory=list)
    bad_rows: List[ProcessRow] = field(default_factory=list)
    skipped_rows: List[ProcessRow] = field(default_factory=list)
    unit_mismatch_notes: List[str] = field(default_factory=list)
    judgment_changes: List[JudgmentRecord] = field(default_factory=list)
    abnormal_points: List[Dict[str, Any]] = field(default_factory=list)

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
