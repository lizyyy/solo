from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Any


@dataclass
class Sample:
    sample_id: str
    batch_id: str
    is_defective: bool
    inspection_time: Optional[datetime] = None
    inspector: Optional[str] = None
    remark: Optional[str] = None
    rework_count: int = 0
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RecheckRecord:
    sample_id: str
    original_result: bool
    recheck_result: bool
    recheck_time: datetime
    rechecker: Optional[str] = None
    reason: Optional[str] = None


@dataclass
class Batch:
    batch_id: str
    product: str
    total_quantity: int
    sample_quantity: int
    production_date: Optional[datetime] = None
    line: Optional[str] = None
    samples: List[Sample] = field(default_factory=list)
    rechecks: List[RecheckRecord] = field(default_factory=list)
    merged_from: List[str] = field(default_factory=list)
    extra: Dict[str, Any] = field(default_factory=dict)

    @property
    def defective_count(self) -> int:
        return sum(1 for s in self.samples if self._is_effectively_defective(s))

    @property
    def pass_rate(self) -> float:
        if not self.samples:
            return 1.0
        passed = len(self.samples) - self.defective_count
        return passed / len(self.samples)

    def _is_effectively_defective(self, sample: Sample) -> bool:
        recheck = self._get_latest_recheck(sample.sample_id)
        if recheck:
            return recheck.recheck_result
        return sample.is_defective

    def _get_latest_recheck(self, sample_id: str) -> Optional[RecheckRecord]:
        matching = [r for r in self.rechecks if r.sample_id == sample_id]
        if not matching:
            return None
        return max(matching, key=lambda r: r.recheck_time)


@dataclass
class SamplingRule:
    rule_id: str
    name: str
    description: str
    sample_size: int
    pass_threshold: float
    batch_size_range: Optional[tuple] = None
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AuditReport:
    report_id: str
    created_at: datetime
    batches: List[Batch]
    rules: List[SamplingRule]
    discrepancies: List[Dict[str, Any]]
    summary: Dict[str, Any]
    dirty_data_warnings: List[Dict[str, Any]]
