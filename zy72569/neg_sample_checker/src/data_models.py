from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import pandas as pd
import uuid


@dataclass
class CheckResult:
    check_name: str
    passed: bool
    details: Dict = field(default_factory=dict)
    severity: str = "info"
    suggestion: str = ""
    check_id: str = ""
    batch_id: str = ""

    def __post_init__(self):
        if not self.check_id:
            self.check_id = f"chk_{uuid.uuid4().hex[:8]}"


@dataclass
class ConflictEvidence:
    conflict_id: str
    description: str
    neg_sample_data: Dict
    recall_candidate_data: Dict
    field: str
    record_trace_id: str = ""
    resolution: str = "pending"
    resolved_by: str = ""
    resolved_at: Optional[datetime] = None
    resolution_reason: str = ""


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
    batch_id: str = ""
    export_path: str = ""


@dataclass
class BatchInfo:
    batch_id: str
    batch_type: str
    source_path: str
    created_at: datetime
    record_count: int
    record_start_idx: int
    record_end_idx: int
    parent_batch_id: str = ""
    note: str = ""


@dataclass
class ExportRecord:
    export_id: str
    export_time: datetime
    export_path: str
    source_batch_ids: List[str]
    record_count: int
    checksum: str = ""
    exported_by: str = "system"


@dataclass
class RunHistory:
    run_id: str
    timestamp: datetime
    data_source: str
    threshold: float
    metrics: Dict
    step_results: Dict[str, bool]
    batch_ids: List[str] = field(default_factory=list)
    export_paths: List[str] = field(default_factory=list)
    minority_samples: List[Dict] = field(default_factory=list)
    note: str = ""


def generate_trace_id(user_id, item_id, timestamp, batch_id=""):
    base = f"{user_id}_{item_id}_{timestamp}"
    if batch_id:
        base = f"{batch_id}_{base}"
    return f"rec_{hash(base) & 0xFFFFFFFFFFFFFFFF:016x}"


class NegSampleDataset:
    def __init__(self, name: str, df: pd.DataFrame = None):
        self.name = name
        self.df = df if df is not None else pd.DataFrame()
        self.import_time: Optional[datetime] = None
        self.version: str = "initial"
        self.original_hash: str = ""
        self.supplement_count: int = 0
        self.batches: List[BatchInfo] = []
        self._next_idx: int = 0

    def _ensure_trace_id_column(self):
        if self.df.empty:
            return
        if "_trace_id" not in self.df.columns:
            self.df["_trace_id"] = ""
        if "_batch_id" not in self.df.columns:
            self.df["_batch_id"] = ""
        if "_row_idx" not in self.df.columns:
            self.df["_row_idx"] = range(len(self.df))

    def _assign_trace_ids(self, batch_id: str, start_idx: int, end_idx: int):
        for i in range(start_idx, end_idx):
            row = self.df.iloc[i]
            tid = generate_trace_id(
                row.get("user_id", ""),
                row.get("item_id", ""),
                row.get("timestamp", ""),
                batch_id
            )
            self.df.at[i, "_trace_id"] = tid
            self.df.at[i, "_batch_id"] = batch_id

    def load_from_csv(self, file_path: str, batch_id: str = "") -> BatchInfo:
        new_df = pd.read_csv(file_path)
        start_idx = len(self.df)
        self.df = pd.concat([self.df, new_df], ignore_index=True)
        end_idx = len(self.df)

        if not batch_id:
            batch_id = f"batch_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"

        self._ensure_trace_id_column()
        self._assign_trace_ids(batch_id, start_idx, end_idx)

        batch_info = BatchInfo(
            batch_id=batch_id,
            batch_type="initial_import" if self.supplement_count == 0 and not self.batches else "import",
            source_path=file_path,
            created_at=datetime.now(),
            record_count=end_idx - start_idx,
            record_start_idx=start_idx,
            record_end_idx=end_idx
        )
        self.batches.append(batch_info)
        self.import_time = datetime.now()
        self._update_hash()
        return batch_info

    def _update_hash(self) -> None:
        if not self.df.empty:
            cols = [c for c in self.df.columns if not c.startswith("_")]
            self.original_hash = str(hash(tuple(map(tuple, self.df[cols].values))))

    def append_supplement(self, supplement_df: pd.DataFrame, batch_id: str = "", note: str = "") -> Tuple[int, BatchInfo]:
        before_count = len(self.df)
        self.df = pd.concat([self.df, supplement_df], ignore_index=True)
        after_count = len(self.df)
        self.supplement_count += (after_count - before_count)
        self.version = f"supplemented_{self.supplement_count}"

        if not batch_id:
            batch_id = f"batch_supp_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"

        self._ensure_trace_id_column()
        self._assign_trace_ids(batch_id, before_count, after_count)

        parent_id = self.batches[-1].batch_id if self.batches else ""
        batch_info = BatchInfo(
            batch_id=batch_id,
            batch_type="supplement",
            source_path="supplement_data",
            created_at=datetime.now(),
            record_count=after_count - before_count,
            record_start_idx=before_count,
            record_end_idx=after_count,
            parent_batch_id=parent_id,
            note=note
        )
        self.batches.append(batch_info)
        self._update_hash()
        return after_count - before_count, batch_info

    def append_supplement_from_csv(self, file_path: str, note: str = "") -> Tuple[int, BatchInfo]:
        supp_df = pd.read_csv(file_path)
        return self.append_supplement(supp_df, note=note)

    def get_minority_samples(self, label_col: str = "label", minority_threshold: float = 0.05, threshold: float = None) -> pd.DataFrame:
        if threshold is not None:
            minority_threshold = threshold
        if self.df.empty or label_col not in self.df.columns:
            return pd.DataFrame()
        label_counts = self.df[label_col].value_counts(normalize=True)
        minority_labels = label_counts[label_counts < minority_threshold].index.tolist()
        return self.df[self.df[label_col].isin(minority_labels)].copy()

    def get_records_by_batch(self, batch_id: str) -> pd.DataFrame:
        if self.df.empty or "_batch_id" not in self.df.columns:
            return pd.DataFrame()
        return self.df[self.df["_batch_id"] == batch_id].copy()

    def get_record_by_trace_id(self, trace_id: str) -> Optional[Dict]:
        if self.df.empty or "_trace_id" not in self.df.columns:
            return None
        matches = self.df[self.df["_trace_id"] == trace_id]
        if matches.empty:
            return None
        return matches.iloc[0].to_dict()

    def get_current_batch_ids(self) -> List[str]:
        return [b.batch_id for b in self.batches]

    def export_to_csv(self, export_path: str, include_trace_cols: bool = True) -> str:
        export_df = self.df.copy()
        if not include_trace_cols:
            export_df = export_df[[c for c in export_df.columns if not c.startswith("_")]]
        export_df.to_csv(export_path, index=False)
        return export_path
