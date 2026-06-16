import csv
import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import List, Optional, Dict, Tuple


def _now_iso():
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%S")


@dataclass
class ParameterEntry:
    instrument: str
    string_index: int
    harmonic_number: int
    observed_freq: float
    weight: float
    unit: str = "Hz"
    source: str = ""
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = _now_iso()
        if not self.source:
            self.source = "parameter_table"

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict):
        return cls(
            instrument=str(d.get("instrument", "")),
            string_index=int(d.get("string_index", 0)),
            harmonic_number=int(d.get("harmonic_number", 1)),
            observed_freq=float(d.get("observed_freq", 0.0)),
            weight=float(d.get("weight", 1.0)),
            unit=str(d.get("unit", "Hz")),
            source=str(d.get("source", "parameter_table")),
            timestamp=str(d.get("timestamp", "")),
        )


@dataclass
class HistoricalRecord:
    record_id: str
    instrument: str
    string_index: int
    fitted_f1: float
    fitted_B: float
    weights_used: Dict[int, float]
    notes: str = ""
    source: str = ""
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = _now_iso()
        if not self.source:
            self.source = "historical_record"

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict):
        weights = d.get("weights_used", {})
        if isinstance(weights, str):
            weights = json.loads(weights)
        return cls(
            record_id=str(d.get("record_id", "")),
            instrument=str(d.get("instrument", "")),
            string_index=int(d.get("string_index", 0)),
            fitted_f1=float(d.get("fitted_f1", 0.0)),
            fitted_B=float(d.get("fitted_B", 0.0)),
            weights_used={int(k): float(v) for k, v in weights.items()},
            notes=str(d.get("notes", "")),
            source=str(d.get("source", "historical_record")),
            timestamp=str(d.get("timestamp", "")),
        )


@dataclass
class ManualNote:
    note_id: str
    instrument: str
    string_index: int
    harmonic_number: int
    note_text: str
    author: str = ""
    source: str = ""
    timestamp: str = ""
    weight_action: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = _now_iso()
        if not self.source:
            self.source = f"manual_note_by_{self.author}" if self.author else "manual_note"
        if not self.weight_action:
            self.weight_action = self._parse_weight_action()

    def _parse_weight_action(self):
        import re
        text = self.note_text
        if re.search(r"降权|减少权重|降低权重|减权", text):
            return "reduce"
        if re.search(r"增权|增加权重|提高权重|加权", text):
            return "increase"
        if re.search(r"排除|移除|去掉|剔除|忽略", text):
            return "exclude"
        return ""

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict):
        return cls(
            note_id=str(d.get("note_id", "")),
            instrument=str(d.get("instrument", "")),
            string_index=int(d.get("string_index", 0)),
            harmonic_number=int(d.get("harmonic_number", 1)),
            note_text=str(d.get("note_text", "")),
            author=str(d.get("author", "")),
            source=str(d.get("source", "manual_note")),
            timestamp=str(d.get("timestamp", "")),
            weight_action=str(d.get("weight_action", "")),
        )


@dataclass
class OutOfBoundsSample:
    sample_id: str
    instrument: str
    string_index: int
    harmonic_number: int
    observed_freq: float
    expected_low: float
    expected_high: float
    deviation_pct: float
    unit: str = "Hz"
    source: str = ""
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = _now_iso()
        if not self.source:
            self.source = "out_of_bounds_sample"

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict):
        return cls(
            sample_id=str(d.get("sample_id", "")),
            instrument=str(d.get("instrument", "")),
            string_index=int(d.get("string_index", 0)),
            harmonic_number=int(d.get("harmonic_number", 1)),
            observed_freq=float(d.get("observed_freq", 0.0)),
            expected_low=float(d.get("expected_low", 0.0)),
            expected_high=float(d.get("expected_high", 0.0)),
            deviation_pct=float(d.get("deviation_pct", 0.0)),
            unit=str(d.get("unit", "Hz")),
            source=str(d.get("source", "out_of_bounds_sample")),
            timestamp=str(d.get("timestamp", "")),
        )


@dataclass
class FittingResult:
    result_id: str
    instrument: str
    string_index: int
    fitted_f1: float
    fitted_B: float
    residuals: Dict[int, float]
    weights_used: Dict[int, float]
    reasoning: List[str]
    boundary_alerts: List[str]
    unit_conversion_notes: List[str]
    source: str = ""
    timestamp: str = ""
    original_sources: List[str] = field(default_factory=list)
    note_refs: List[str] = field(default_factory=list)

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = _now_iso()
        if not self.source:
            self.source = "fitting_result"

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict):
        residuals = d.get("residuals", {})
        if isinstance(residuals, str):
            residuals = json.loads(residuals)
        weights = d.get("weights_used", {})
        if isinstance(weights, str):
            weights = json.loads(weights)
        return cls(
            result_id=str(d.get("result_id", "")),
            instrument=str(d.get("instrument", "")),
            string_index=int(d.get("string_index", 0)),
            fitted_f1=float(d.get("fitted_f1", 0.0)),
            fitted_B=float(d.get("fitted_B", 0.0)),
            residuals={int(k): float(v) for k, v in residuals.items()},
            weights_used={int(k): float(v) for k, v in weights.items()},
            reasoning=list(d.get("reasoning", [])),
            boundary_alerts=list(d.get("boundary_alerts", [])),
            unit_conversion_notes=list(d.get("unit_conversion_notes", [])),
            source=str(d.get("source", "fitting_result")),
            timestamp=str(d.get("timestamp", "")),
            original_sources=list(d.get("original_sources", [])),
            note_refs=list(d.get("note_refs", [])),
        )


@dataclass
class NoteDiff:
    note_id: str
    field: str
    before: str
    after: str
    reason: str
    author: str
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = _now_iso()

    def to_dict(self):
        return asdict(self)


def load_csv(path: str, cls_type: str) -> list:
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if cls_type == "parameter":
                rows.append(ParameterEntry.from_dict(row))
            elif cls_type == "historical":
                rows.append(HistoricalRecord.from_dict(row))
            elif cls_type == "note":
                rows.append(ManualNote.from_dict(row))
            elif cls_type == "out_of_bounds":
                rows.append(OutOfBoundsSample.from_dict(row))
            elif cls_type == "result":
                rows.append(FittingResult.from_dict(row))
    return rows


def save_csv(path: str, items: list):
    if not items:
        return
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(items[0].to_dict().keys()))
        writer.writeheader()
        for item in items:
            d = item.to_dict()
            for k, v in d.items():
                if isinstance(v, (dict, list)):
                    d[k] = json.dumps(v, ensure_ascii=False)
            writer.writerow(d)
