from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional


class MonotonicDirection(str, Enum):
    ASCENDING = "ascending"
    DESCENDING = "descending"
    AUTO = "auto"


class Severity(str, Enum):
    PASS = "PASS"
    WARNING = "WARNING"
    FAIL = "FAIL"


@dataclass(frozen=True)
class BinRecord:
    bin_name: str
    bad_count: int
    total_count: int
    score_weight: float
    is_missing: bool = False

    @property
    def bad_rate(self) -> float:
        if self.total_count == 0:
            return 0.0
        return self.bad_count / self.total_count

    @property
    def sample_proportion(self) -> float:
        return self.total_count

    def to_dict(self) -> dict:
        return {
            "bin_name": self.bin_name,
            "bad_count": self.bad_count,
            "total_count": self.total_count,
            "bad_rate": round(self.bad_rate, 6),
            "score_weight": self.score_weight,
            "is_missing": self.is_missing,
        }


@dataclass(frozen=True)
class Violation:
    bin_index: int
    bin_name: str
    prev_bin_index: int
    prev_bin_name: str
    bad_rate: float
    prev_bad_rate: float
    severity: Severity
    reason: str

    def to_dict(self) -> dict:
        return {
            "bin_index": self.bin_index,
            "bin_name": self.bin_name,
            "prev_bin_index": self.prev_bin_index,
            "prev_bin_name": self.prev_bin_name,
            "bad_rate": round(self.bad_rate, 6),
            "prev_bad_rate": round(self.prev_bad_rate, 6),
            "severity": self.severity.value,
            "reason": self.reason,
        }


@dataclass(frozen=True)
class AnomalyFlag:
    bin_index: int
    bin_name: str
    flag_type: str
    detail: str
    severity: Severity

    def to_dict(self) -> dict:
        return {
            "bin_index": self.bin_index,
            "bin_name": self.bin_name,
            "flag_type": self.flag_type,
            "detail": self.detail,
            "severity": self.severity.value,
        }


@dataclass
class WeightInterpretation:
    direction_aligned: bool
    weight_order: List[str]
    risk_order: List[str]
    explanation: str

    def to_dict(self) -> dict:
        return {
            "direction_aligned": self.direction_aligned,
            "weight_order": self.weight_order,
            "risk_order": self.risk_order,
            "explanation": self.explanation,
        }


@dataclass
class FeatureCheckResult:
    feature_name: str
    model_version: str
    bins: List[BinRecord]
    detected_direction: MonotonicDirection
    overall_severity: Severity
    violations: List[Violation]
    anomaly_flags: List[AnomalyFlag]
    weight_interpretation: Optional[WeightInterpretation]
    total_samples: int
    total_bad: int
    overall_bad_rate: float

    def to_dict(self) -> dict:
        return {
            "feature_name": self.feature_name,
            "model_version": self.model_version,
            "bins": [b.to_dict() for b in self.bins],
            "detected_direction": self.detected_direction.value,
            "overall_severity": self.overall_severity.value,
            "violations": [v.to_dict() for v in self.violations],
            "anomaly_flags": [a.to_dict() for a in self.anomaly_flags],
            "weight_interpretation": (
                self.weight_interpretation.to_dict()
                if self.weight_interpretation
                else None
            ),
            "total_samples": self.total_samples,
            "total_bad": self.total_bad,
            "overall_bad_rate": round(self.overall_bad_rate, 6),
        }


@dataclass
class CheckReport:
    model_version: str
    check_timestamp: str
    input_hash: str
    config_hash: str
    results: List[FeatureCheckResult]
    overall_pass: bool
    summary: str

    def to_dict(self) -> dict:
        return {
            "model_version": self.model_version,
            "check_timestamp": self.check_timestamp,
            "input_hash": self.input_hash,
            "config_hash": self.config_hash,
            "overall_pass": self.overall_pass,
            "summary": self.summary,
            "results": [r.to_dict() for r in self.results],
        }


def compute_hash(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()[:16]


def compute_input_hash(
    feature_bins: dict[str, List[BinRecord]],
    model_version: str,
) -> str:
    payload = {
        "model_version": model_version,
        "features": {
            name: [b.to_dict() for b in bins]
            for name, bins in sorted(feature_bins.items())
        },
    }
    return compute_hash(json.dumps(payload, sort_keys=True, ensure_ascii=True))


def compute_config_hash(config_dict: dict) -> str:
    return compute_hash(json.dumps(config_dict, sort_keys=True, ensure_ascii=True))
