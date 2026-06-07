import json
import uuid
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

from .models import (
    ExperimentBucket, SampleLabel, NegativeSample,
    ConflictEvidence, ConflictType, ThresholdHistory
)
from .config import DATA_DIR


class ExperimentManager:
    def __init__(self):
        self.buckets: Dict[str, ExperimentBucket] = {}
        self.negative_samples: Dict[str, NegativeSample] = {}
        self._import_history: List[Tuple[str, datetime]] = []
        self._load_from_disk()

    def _load_from_disk(self):
        bucket_file = DATA_DIR / "buckets.json"
        neg_file = DATA_DIR / "negative_samples.json"

        if bucket_file.exists():
            with open(bucket_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                for item in data:
                    bucket = ExperimentBucket(**item)
                    self.buckets[bucket.bucket_id] = bucket

        if neg_file.exists():
            with open(neg_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                for item in data:
                    neg = NegativeSample(**item)
                    self.negative_samples[neg.sample_id] = neg

    def _save_to_disk(self):
        DATA_DIR.mkdir(exist_ok=True)

        with open(DATA_DIR / "buckets.json", "w", encoding="utf-8") as f:
            json.dump(
                [b.model_dump() for b in self.buckets.values()],
                f, ensure_ascii=False, indent=2, default=str
            )

        with open(DATA_DIR / "negative_samples.json", "w", encoding="utf-8") as f:
            json.dump(
                [n.model_dump() for n in self.negative_samples.values()],
                f, ensure_ascii=False, indent=2, default=str
            )

    def import_experiment_bucket(
        self,
        bucket_id: str,
        name: str,
        samples: List[dict],
        imported_by: str,
        threshold: float = 0.5,
        threshold_report_value: Optional[float] = None,
        params_version: str = "v1.0",
        params_reason: str = "默认参数配置"
    ) -> ExperimentBucket:
        sample_labels = []
        for s in samples:
            s.setdefault("params_version", params_version)
            s.setdefault("params_reason", params_reason)
            sample_labels.append(SampleLabel(**s))

        bucket = ExperimentBucket(
            bucket_id=bucket_id,
            name=name,
            imported_by=imported_by,
            samples=sample_labels,
            current_threshold=threshold
        )

        if threshold_report_value is not None or bucket.threshold_history:
            bucket.threshold_history.append(
                ThresholdHistory(
                    threshold=threshold,
                    report_value=threshold_report_value,
                    changed_by=imported_by,
                    reason="初始导入阈值配置"
                )
            )

        self.buckets[bucket_id] = bucket
        self._import_history.append((bucket_id, datetime.now()))
        self._save_to_disk()
        return bucket

    def add_negative_samples(
        self,
        samples: List[dict],
        added_by: str
    ) -> List[NegativeSample]:
        added = []
        for s in samples:
            s["added_by"] = added_by
            neg = NegativeSample(**s)
            self.negative_samples[neg.sample_id] = neg
            added.append(neg)
        self._save_to_disk()
        return added

    def check_duplicate_import(self, bucket_id: str) -> bool:
        count = sum(1 for bid, _ in self._import_history if bid == bucket_id)
        return count > 1

    def update_threshold(
        self,
        bucket_id: str,
        new_threshold: float,
        report_value: Optional[float],
        changed_by: str,
        reason: str
    ) -> ThresholdHistory:
        bucket = self.buckets.get(bucket_id)
        if not bucket:
            raise ValueError(f"实验桶 {bucket_id} 不存在")

        history = ThresholdHistory(
            threshold=new_threshold,
            report_value=report_value,
            changed_by=changed_by,
            reason=reason
        )
        bucket.threshold_history.append(history)
        bucket.current_threshold = new_threshold
        self._save_to_disk()
        return history

    def detect_conflicts(self, bucket_id: str) -> List[ConflictEvidence]:
        bucket = self.buckets.get(bucket_id)
        if not bucket:
            return []

        conflicts = []
        bucket_sample_ids = {s.sample_id for s in bucket.samples}
        neg_sample_ids = set(self.negative_samples.keys())

        for sample in bucket.samples:
            neg = self.negative_samples.get(sample.sample_id)
            if not neg:
                continue

            if sample.predicted_label != neg.true_label:
                conflicts.append(ConflictEvidence(
                    sample_id=sample.sample_id,
                    conflict_type=ConflictType.LABEL_MISMATCH,
                    experiment_value=sample.predicted_label,
                    negative_value=neg.true_label,
                    description=f"实验桶预测标签={sample.predicted_label}，负样本列表真实标签={neg.true_label}"
                ))

            latest_th = bucket.get_latest_threshold()
            if latest_th.has_mismatch:
                conflicts.append(ConflictEvidence(
                    sample_id=sample.sample_id,
                    conflict_type=ConflictType.THRESHOLD_MISMATCH,
                    experiment_value=latest_th.threshold,
                    negative_value=latest_th.report_value,
                    description=f"阈值实际={latest_th.threshold}，但报告写={latest_th.report_value}，需要数据科学家复核"
                ))

        missing_in_neg = bucket_sample_ids - neg_sample_ids
        for sid in missing_in_neg:
            conflicts.append(ConflictEvidence(
                sample_id=sid,
                conflict_type=ConflictType.SAMPLE_MISSING,
                experiment_value="存在",
                negative_value="缺失",
                description=f"样本在实验桶中存在，但负样本列表中缺失"
            ))

        return conflicts

    def get_bucket(self, bucket_id: str) -> Optional[ExperimentBucket]:
        return self.buckets.get(bucket_id)

    def list_buckets(self) -> List[ExperimentBucket]:
        return list(self.buckets.values())

    def mark_supplemented(self, bucket_id: str):
        bucket = self.buckets.get(bucket_id)
        if bucket:
            bucket.is_supplemented = True
            self._save_to_disk()
