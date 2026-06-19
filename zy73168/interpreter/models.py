"""数据模型与状态枚举。

设计要点：
- 来源分三类，权威度用 SOURCE_PRIORITY 表达。同题冲突时取权威度最高的作为基准版本。
- 状态枚举覆盖“算不出”的每一种卡点，确保记录不消失。
- FitResult 把法方程矩阵、求解步骤、SS_res/SS_tot 全部留痕，满足“中间计算过程别藏起来”。
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class SourceType(str, Enum):
    NORMAL_RECORD = "normal_record"
    STUDENT_DRAFT_OLD = "student_draft_old"
    VERBAL_NOTE = "verbal_note"


SOURCE_PRIORITY: Dict[SourceType, int] = {
    SourceType.NORMAL_RECORD: 3,
    SourceType.STUDENT_DRAFT_OLD: 2,
    SourceType.VERBAL_NOTE: 1,
}

SOURCE_LABEL: Dict[SourceType, str] = {
    SourceType.NORMAL_RECORD: "正式记录",
    SourceType.STUDENT_DRAFT_OLD: "学生草稿旧版",
    SourceType.VERBAL_NOTE: "口头备注",
}


class Status(str, Enum):
    OK = "OK"
    STUCK_FORMULA = "STUCK_FORMULA"
    STUCK_UNIT = "STUCK_UNIT"
    STUCK_THRESHOLD = "STUCK_THRESHOLD"
    PENDING_PM = "PENDING_PM"


STATUS_LABEL: Dict[Status, str] = {
    Status.OK: "成功（给稳定结论）",
    Status.STUCK_FORMULA: "卡在公式",
    Status.STUCK_UNIT: "卡在单位",
    Status.STUCK_THRESHOLD: "卡在阈值",
    Status.PENDING_PM: "挂起，等项目经理确认",
}


@dataclass
class RawRecord:
    question_id: str
    title: str
    model: str
    x_unit: str
    y_unit: str
    points: List[List[float]]
    threshold: Dict[str, Any]
    source: SourceType
    source_meta: Dict[str, Any] = field(default_factory=dict)
    file_origin: str = ""


@dataclass
class VerbalNote:
    question_id: str
    note: str
    source: SourceType = SourceType.VERBAL_NOTE
    source_meta: Dict[str, Any] = field(default_factory=dict)
    file_origin: str = ""


@dataclass
class QuestionBundle:
    question_id: str
    records: List[RawRecord] = field(default_factory=list)
    notes: List[VerbalNote] = field(default_factory=list)

    @property
    def sorted_records(self) -> List[RawRecord]:
        return sorted(self.records, key=lambda r: -SOURCE_PRIORITY.get(r.source, 0))

    @property
    def canonical_record(self) -> Optional[RawRecord]:
        recs = self.sorted_records
        return recs[0] if recs else None

    @property
    def conflicting_records(self) -> List[RawRecord]:
        canon = self.canonical_record
        if canon is None:
            return []
        out: List[RawRecord] = []
        for r in self.records:
            if r is canon:
                continue
            if _records_conflict(canon, r):
                out.append(r)
        return out


def _records_conflict(a: RawRecord, b: RawRecord) -> bool:
    if a.model != b.model:
        return True
    if (a.x_unit or "") != (b.x_unit or ""):
        return True
    if (a.y_unit or "") != (b.y_unit or ""):
        return True
    if _norm_points(a.points) != _norm_points(b.points):
        return True
    return False


def _norm_points(points: List[List[float]]) -> List[tuple]:
    return [(round(float(x), 9), round(float(y), 9)) for x, y in points]


@dataclass
class FitResult:
    model: str
    success: bool
    coefficients: Dict[str, float] = field(default_factory=dict)
    coefficient_order: List[str] = field(default_factory=list)
    r_squared: Optional[float] = None
    ss_res: Optional[float] = None
    ss_tot: Optional[float] = None
    normal_matrix: List[List[float]] = field(default_factory=list)
    normal_vector: List[float] = field(default_factory=list)
    solve_steps: List[str] = field(default_factory=list)
    predictions: List[float] = field(default_factory=list)
    error: str = ""


@dataclass
class ParameterSet:
    label: str
    source: SourceType
    source_meta: Dict[str, Any]
    unit_x: str
    unit_y: str
    fit: FitResult
    unit_conversion: Dict[str, Any] = field(default_factory=dict)
    intermediate_calculations: List[str] = field(default_factory=list)


@dataclass
class QuestionReport:
    question_id: str
    title: str
    status: Status
    status_reason: str
    influenced_by: List[str] = field(default_factory=list)
    audit_sources: List[str] = field(default_factory=list)
    canonical_record: Optional[RawRecord] = None
    parameter_sets: List[ParameterSet] = field(default_factory=list)
    verbal_notes: List[VerbalNote] = field(default_factory=list)
    conflict: bool = False
    conflict_detail: str = ""
    pending_items: List[str] = field(default_factory=list)
    chart_path: Optional[str] = None


@dataclass
class BatchReport:
    batch_id: str
    received: str
    questions: List[QuestionReport] = field(default_factory=list)
    summary: Dict[str, int] = field(default_factory=dict)
