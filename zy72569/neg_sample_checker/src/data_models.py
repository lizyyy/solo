from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import pandas as pd


@dataclass
class CheckResult:
    check_name: str
    passed: bool
    details: Dict = field(default_factory=dict)
    severity: str = "info"
    suggestion: str = ""


@dataclass
class ConflictEvidence:
    conflict_id: str
    description: str
    neg_sample_data: Dict
    recall_candidate_data: Dict
    field: str
    resolution: str = "pending"


@dataclass
class WorkflowStep:
    step_id: str
    step_name: str
    status: str = "pending"
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    results: List[CheckResult] = field(default_factory=list)
    conflicts: List[ConflictEvidence] = field(default_factory=list)
    data_version: str = ""


@dataclass
class RunHistory:
    run_id: str
    timestamp: datetime
    data_source: str
    threshold: float
    metrics: Dict
    step_results: Dict[str, bool]
    minority_samples: List[Dict] = field(default_factory=list)


class NegSampleDataset:
    def __init__(self, name: str, df: pd.DataFrame = None):
        self.name = name
        self.df = df if df is not None else pd.DataFrame()
        self.import_time: Optional[datetime] = None
        self.version: str = "initial"
        self.original_hash: str = ""
        self.supplement_count: int = 0

    def load_from_csv(self, file_path: str) -> None:
        self.df = pd.read_csv(file_path)
        self.import_time = datetime.now()
        self._update_hash()

    def _update_hash(self) -> None:
        if not self.df.empty:
            self.original_hash = hash(tuple(map(tuple, self.df.values)))

    def append_supplement(self, supplement_df: pd.DataFrame) -> int:
        before_count = len(self.df)
        self.df = pd.concat([self.df, supplement_df], ignore_index=True)
        self.supplement_count += len(supplement_df)
        self.version = f"supplemented_{self.supplement_count}"
        return len(self.df) - before_count

    def get_minority_samples(self, label_col: str = "label", minority_threshold: float = 0.05, threshold: float = None) -> pd.DataFrame:
        if threshold is not None:
            minority_threshold = threshold
        if self.df.empty or label_col not in self.df.columns:
            return pd.DataFrame()
        label_counts = self.df[label_col].value_counts(normalize=True)
        minority_labels = label_counts[label_counts < minority_threshold].index.tolist()
        return self.df[self.df[label_col].isin(minority_labels)].copy()
