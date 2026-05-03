"""
数据模型定义
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any
from collections import defaultdict


class SampleType(Enum):
    UNKNOWN = "unknown"
    CALIBRATOR = "calibrator"
    QC = "qc"
    BLANK = "blank"
    INTERNAL_STANDARD = "is"


class QCIssueType(Enum):
    DUPLICATE_SAMPLE_ID = "duplicate_sample_id"
    CHAIN_OF_CUSTODY_BREAK = "chain_of_custody_break"
    CROSS_MIDNIGHT_INJECTION = "cross_midnight_injection"
    INTERNAL_STANDARD_MISSING = "internal_standard_missing"
    INTERNAL_STANDARD_DRIFT = "internal_standard_drift"
    QC_OUT_OF_RANGE = "qc_out_of_range"
    LOD_HIT = "lod_hit"
    LOQ_HIT = "loq_hit"
    CALIBRATION_FAILED = "calibration_failed"


@dataclass
class InjectionRecord:
    sample_id: str
    vial_position: str
    injection_time: datetime
    sample_type: SampleType
    peak_data: Dict[str, float] = field(default_factory=dict)
    internal_standard_area: Dict[str, float] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CalibrationPoint:
    concentration: float
    peak_area: float
    internal_standard_area: float
    ratio: float
    injection_index: int


@dataclass
class CalibrationCurve:
    compound: str
    internal_standard: str
    slope: float
    intercept: float
    r_squared: float
    points: List[CalibrationPoint]
    lod: float
    loq: float


@dataclass
class ChainOfCustodyEntry:
    sample_id: str
    timestamp: datetime
    action: str
    actor: str
    location: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class QCIssue:
    issue_type: QCIssueType
    severity: str
    sample_ids: List[str]
    description: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class BatchData:
    run_sequence: List[InjectionRecord]
    calibration_curves: Dict[str, CalibrationCurve]
    chain_of_custody: Dict[str, List[ChainOfCustodyEntry]]
    peak_table: Dict[str, Dict[str, float]]
    
    qc_issues: List[QCIssue] = field(default_factory=list)
    internal_standard_drift: Dict[str, Dict[str, float]] = field(default_factory=dict)
    qc_deviations: Dict[str, Dict[str, float]] = field(default_factory=dict)
    
    def get_samples_by_type(self, sample_type: SampleType) -> List[InjectionRecord]:
        return [inj for inj in self.run_sequence if inj.sample_type == sample_type]
