from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime


@dataclass
class ParamItem:
    material_name: str
    param_name: str
    standard_value: float
    tolerance: float
    unit: str = ""
    version: str = "v1"
    remark: str = ""

    @property
    def lower_bound(self) -> float:
        return self.standard_value - self.tolerance

    @property
    def upper_bound(self) -> float:
        return self.standard_value + self.tolerance

    def is_within_range(self, value: float) -> bool:
        return self.lower_bound <= value <= self.upper_bound


@dataclass
class TestRecord:
    material_name: str
    param_name: str
    measured_value: float
    batch_no: str = ""
    test_date: str = ""
    operator: str = ""
    remark: str = ""


@dataclass
class CheckResult:
    record: TestRecord
    param: Optional[ParamItem]
    is_pass: bool
    is_pending: bool = False
    pending_reason: str = ""
    is_abnormal: bool = False
    abnormal_reason: str = ""
    sort_unstable: bool = False
    sort_original_note: str = ""
    deviation: float = 0.0
    deviation_pct: float = 0.0


@dataclass
class RejudgeRecord:
    batch_no: str
    material_name: str
    param_name: str
    original_result: str
    new_result: str
    reason: str
    operator: str
    timestamp: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))


@dataclass
class CheckSummary:
    total: int = 0
    passed: int = 0
    failed: int = 0
    pending: int = 0
    abnormal: int = 0
    sort_unstable: int = 0
    rejudged: int = 0
    param_version: str = "v1"
    check_time: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
