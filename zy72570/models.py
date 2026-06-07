from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum
from datetime import datetime


class RecordStatus(str, Enum):
    NORMAL = "normal"
    DUPLICATE_TRAINING = "duplicate_training"
    SUPPLEMENTARY_OLD_CALIBER = "supplementary_old_caliber"
    PENDING_PRODUCT_REVIEW = "pending_product_review"
    CONFLICT_DETECTED = "conflict_detected"
    CONFIRMED_BY_SCIENTIST = "confirmed_by_scientist"
    REJECTED_BY_SCIENTIST = "rejected_by_scientist"


class RecordSource(str, Enum):
    ONLINE_EXPERIMENT_BUCKET = "online_experiment_bucket"
    NEGATIVE_SAMPLE_LIST = "negative_sample_list"
    SUPPLEMENTARY = "supplementary"


@dataclass
class ParameterVersion:
    param_name: str
    version: str
    value: Any
    reason: str
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class FeatureRecord:
    feature_id: str
    feature_name: str
    feature_version: str
    caliber: str
    source: RecordSource
    import_timestamp: datetime
    status: RecordStatus
    training_batch_id: str
    parameter_versions: List[ParameterVersion] = field(default_factory=list)
    conflict_evidence: List[str] = field(default_factory=list)
    review_notes: List[str] = field(default_factory=list)
    supplementary_from: Optional[str] = None
    duplicate_of: Optional[str] = None


@dataclass
class FeatureVersionTable:
    version: str
    records: Dict[str, FeatureRecord] = field(default_factory=dict)
    update_timestamp: datetime = field(default_factory=datetime.now)

    def add_record(self, record: FeatureRecord):
        self.records[record.feature_id] = record
        self.update_timestamp = datetime.now()

    def get_record(self, feature_id: str) -> Optional[FeatureRecord]:
        return self.records.get(feature_id)


@dataclass
class NegativeSampleList:
    version: str
    feature_ids: List[str] = field(default_factory=list)
    caliber_notes: Dict[str, str] = field(default_factory=dict)


@dataclass
class OnlineExperimentBucket:
    bucket_id: str
    version: str
    feature_ids: List[str] = field(default_factory=list)
    caliber_notes: Dict[str, str] = field(default_factory=dict)


@dataclass
class HistoryLog:
    timestamp: datetime
    action: str
    feature_id: str
    before_status: Optional[RecordStatus]
    after_status: RecordStatus
    operator: str
    details: str
    parameter_versions: List[ParameterVersion] = field(default_factory=list)


@dataclass
class DistillationResult:
    feature_version_table: FeatureVersionTable
    history_logs: List[HistoryLog]
    pending_reviews: List[FeatureRecord]
    conflicts: List[FeatureRecord]
