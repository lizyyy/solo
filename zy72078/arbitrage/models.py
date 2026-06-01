from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime


@dataclass
class RateRecord:
    row_index: int
    from_currency: str
    to_currency: str
    rate: Optional[float]
    unit: str
    original_source: str
    original_notes: str
    raw_row: dict
    loaded_at: str
    compute_status: str = "ok"
    compute_reason: str = ""

    def mark_uncomputable(self, reason: str):
        self.compute_status = "uncomputable"
        self.compute_reason = reason


@dataclass
class ArbitragePath:
    cycle: list
    profit_rate: float
    profit_pct: float
    reasoning: str
    contributing_records: list
    detected_at: str
    original_sources: list
    original_notes: list


@dataclass
class AnomalyRecord:
    row_index: int
    from_currency: str
    to_currency: str
    anomaly_type: str
    detail: str
    original_notes: str
    original_source: str
    detected_at: str


@dataclass
class SearchResult:
    paths: list
    anomalies: list
    valid_records: list
    uncomputable_records: list
    search_timestamp: str
    total_rows_loaded: int
    total_rows_valid: int
    total_rows_uncomputable: int


@dataclass
class AnnotationEntry:
    row_index: int
    annotation: str
    annotated_at: str
    annotated_by: str


@dataclass
class AnnotationDiff:
    row_index: int
    field: str
    before: str
    after: str
    explanation: str
    diff_timestamp: str
