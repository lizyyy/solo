from __future__ import annotations

import hashlib
import json
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ExperimentStatus(str, Enum):
    DRAFT = "draft"
    VERIFIED = "verified"
    APPROVED = "approved"


class ImportType(str, Enum):
    NEW = "new"
    RE_IMPORT_NOTE = "re_import_note"
    RE_IMPORT_CONFIG = "re_import_config"


class IssueType(str, Enum):
    LABEL_LEAK = "label_leak"
    TRAIN_LEAK = "train_leak"
    MISSING_LABEL = "missing_label"
    THRESHOLD_MISMATCH = "threshold_mismatch"
    SAMPLE_RANGE_SHIFT = "sample_range_shift"


class IssueSeverity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class SampleRange(BaseModel):
    split: str = "test"
    start_idx: Optional[int] = None
    end_idx: Optional[int] = None
    filters: Dict[str, Any] = Field(default_factory=dict)


class DatasetVersion(BaseModel):
    dataset_name: str
    version_hash: str
    source_path: str
    sample_count: int
    label_schema: Dict[str, Any] = Field(default_factory=dict)
    sample_range: SampleRange = Field(default_factory=SampleRange)

    @classmethod
    def from_file(cls, path: Path, name: Optional[str] = None) -> DatasetVersion:
        content = path.read_bytes()
        version_hash = hashlib.sha256(content).hexdigest()[:16]
        data = json.loads(content) if content.strip() else {}
        sample_count = data.get("sample_count", 0)
        label_schema = data.get("label_schema", {})
        sample_range_data = data.get("sample_range", {})
        return cls(
            dataset_name=name or path.stem,
            version_hash=version_hash,
            source_path=str(path),
            sample_count=sample_count,
            label_schema=label_schema,
            sample_range=SampleRange(**sample_range_data) if sample_range_data else SampleRange(),
        )


class MetricScript(BaseModel):
    script_path: str
    script_hash: str
    script_version_tag: str = ""
    parameters: Dict[str, Any] = Field(default_factory=dict)

    def parameters_json(self) -> str:
        return json.dumps(self.parameters, sort_keys=True)

    @classmethod
    def from_file(cls, path: Path, version_tag: str = "", parameters: Optional[Dict] = None) -> MetricScript:
        content = path.read_bytes()
        script_hash = hashlib.sha256(content).hexdigest()[:16]
        return cls(
            script_path=str(path),
            script_hash=script_hash,
            script_version_tag=version_tag,
            parameters=parameters or {},
        )


class ThresholdConfig(BaseModel):
    config_path: str
    config_hash: str
    thresholds: Dict[str, float] = Field(default_factory=dict)
    custom_rules: Dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def from_file(cls, path: Path) -> ThresholdConfig:
        content = path.read_bytes()
        config_hash = hashlib.sha256(content).hexdigest()[:16]
        data = json.loads(content) if content.strip() else {}
        return cls(
            config_path=str(path),
            config_hash=config_hash,
            thresholds=data.get("thresholds", {}),
            custom_rules=data.get("custom_rules", {}),
        )


class ExcludedSample(BaseModel):
    sample_ids: List[str]
    reason: str
    excluded_by: str = ""
    excluded_at: datetime = Field(default_factory=datetime.now)


class EvaluationResult(BaseModel):
    metric_name: str
    metric_value: float
    sample_group: str = "all"
    computed_at: datetime = Field(default_factory=datetime.now)
    computed_by: str = ""


class VerificationIssue(BaseModel):
    issue_type: IssueType
    severity: IssueSeverity
    description: str
    affected_samples: List[str] = Field(default_factory=list)
    suggestion: str = ""


class ImportChange(BaseModel):
    field: str
    old_value: Any = None
    new_value: Any = None


class Experiment(BaseModel):
    name: str
    round_tag: str = ""
    note: str = ""
    status: ExperimentStatus = ExperimentStatus.DRAFT
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    dataset: Optional[DatasetVersion] = None
    metric_script: Optional[MetricScript] = None
    threshold_config: Optional[ThresholdConfig] = None
    excluded_samples: List[ExcludedSample] = Field(default_factory=list)
    results: List[EvaluationResult] = Field(default_factory=list)
    issues: List[VerificationIssue] = Field(default_factory=list)

    def fingerprint(self) -> str:
        return self.config_fingerprint()

    def config_fingerprint(self) -> str:
        parts = [
            self.dataset.version_hash if self.dataset else "",
            self.metric_script.script_hash if self.metric_script else "",
            self.metric_script.parameters_json() if self.metric_script else "",
            self.threshold_config.config_hash if self.threshold_config else "",
            json.dumps(self.threshold_config.thresholds, sort_keys=True) if self.threshold_config else "",
            json.dumps(self.threshold_config.custom_rules, sort_keys=True) if self.threshold_config else "",
        ]
        combined = "|".join(parts)
        return hashlib.sha256(combined.encode()).hexdigest()[:16]

    def note_fingerprint(self) -> str:
        return hashlib.sha256(self.note.encode()).hexdigest()[:16]
