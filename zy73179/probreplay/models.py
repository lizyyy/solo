from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any


@dataclass
class Revision:
    at: str
    by: str
    stance: str
    reason: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Material:
    id: str
    type: str
    title: str
    author: str
    stance: str
    revisions: List[Revision] = field(default_factory=list)
    payload: Dict[str, Any] = field(default_factory=dict)
    path: str = ""

    @property
    def latest_revision(self) -> Optional[Revision]:
        return self.revisions[-1] if self.revisions else None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        return d


@dataclass
class StanceChange:
    material_id: str
    title: str
    author: str
    from_stance: str
    to_stance: str
    at: str
    reason: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Record:
    id: str
    name: str
    base_score: float
    effective_score: float
    meta: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class SortInstability:
    sort_key: str
    tied_value: float
    record_ids: List[str]
    reason_pending: str
    resolution: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class SimParams:
    pass_threshold: float = 60.0
    sigma: float = 1.0
    unit: str = "point"
    n_trials: int = 2000
    seed: int = 42

    PARAM_NOTCHES: Dict[str, List] = field(
        default_factory=lambda: {
            "pass_threshold": [58.0, 60.0, 62.0],
            "sigma": [0.5, 1.0, 2.0],
            "unit": ["point", "percent"],
        },
        repr=False,
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "pass_threshold": self.pass_threshold,
            "sigma": self.sigma,
            "unit": self.unit,
            "n_trials": self.n_trials,
            "seed": self.seed,
        }

    def notches(self, name: str) -> List:
        return list(self.PARAM_NOTCHES.get(name, []))


@dataclass
class RecordResult:
    record_id: str
    name: str
    base_score: float
    effective_score: float
    pass_prob: float
    is_boundary: bool
    passed: Optional[bool] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class RunResult:
    params: SimParams
    aggregate_pass_rate: float
    records: List[RecordResult]
    distribution: List[float]
    formula: str
    unit: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "params": self.params.to_dict(),
            "aggregate_pass_rate": self.aggregate_pass_rate,
            "records": [r.to_dict() for r in self.records],
            "distribution": self.distribution,
            "formula": self.formula,
            "unit": self.unit,
        }


@dataclass
class DeltaAttribution:
    param_name: str
    baseline_value: float
    adjusted_value: float
    baseline_rate: float
    adjusted_rate: float
    delta: float
    formula_explanation: str
    unit_explanation: str
    boundary_explanation: str
    boundary_effect: float
    boundary_flips: List[str]
    non_boundary_effect: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class AuditEntry:
    run_id: str
    at: str
    operator: str
    input_dir: str
    output_dir: str
    params: Dict[str, Any]
    adjusted_param: Optional[str]
    material_ids: List[str]
    stance_changes: List[Dict[str, Any]]
    sort_instabilities: List[Dict[str, Any]]
    summary: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
