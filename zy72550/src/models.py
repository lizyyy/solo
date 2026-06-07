from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from datetime import datetime
import hashlib
import json


@dataclass
class ExperimentRecord:
    record_id: str
    experiment_name: str
    data_batch_id: str
    feature_version: str
    model_version: str
    params: Dict[str, Any]
    training_date: str
    status: str = "PENDING"
    dedup_status: str = "NEW"
    duplicate_of: Optional[str] = None
    notes: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    review_required: bool = False
    reviewer: Optional[str] = None
    review_comment: Optional[str] = None

    def get_data_signature(self) -> str:
        sig_data = {
            "data_batch_id": self.data_batch_id,
            "feature_version": self.feature_version,
            "params": {k: v for k, v in sorted(self.params.items()) 
                      if k not in ["random_seed", "run_id", "timestamp"]}
        }
        sig_str = json.dumps(sig_data, sort_keys=True, default=str)
        return hashlib.md5(sig_str.encode()).hexdigest()


@dataclass
class EvalSlice:
    slice_id: str
    slice_name: str
    data_batch_id: str
    eval_date: str
    metrics: Dict[str, float]
    feature_version: str
    is_backfill: bool = False
    source: str = "EVAL_PLATFORM"
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    notes: str = ""


@dataclass
class FeatureVersion:
    version_id: str
    version_name: str
    feature_list: List[str]
    data_source: str
    effective_date: str
    is_active: bool = True
    created_by: str = "system"
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    notes: str = ""
