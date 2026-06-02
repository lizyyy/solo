import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .models import Sample
from .store import Store


@dataclass
class DedupResult:
    sample_id: str
    is_duplicate: bool
    existing_ids: List[str] = field(default_factory=list)
    action: str = "inserted"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample_id": self.sample_id,
            "is_duplicate": self.is_duplicate,
            "existing_ids": self.existing_ids,
            "action": self.action,
        }


class DedupManager:
    def __init__(self, store: Store):
        self.store = store

    def check_duplicate(self, sample: Sample) -> DedupResult:
        existing = self.store.find_by_fingerprint(sample.fingerprint)
        if not existing:
            return DedupResult(
                sample_id=sample.sample_id,
                is_duplicate=False,
                existing_ids=[],
                action="inserted",
            )
        existing_ids = [s.sample_id for s in existing]
        same_id = any(s.sample_id == sample.sample_id for s in existing)
        if same_id:
            return DedupResult(
                sample_id=sample.sample_id,
                is_duplicate=True,
                existing_ids=existing_ids,
                action="updated",
            )
        return DedupResult(
            sample_id=sample.sample_id,
            is_duplicate=True,
            existing_ids=existing_ids,
            action="skipped",
        )

    def import_samples(
        self, samples: List[Sample], skip_duplicates: bool = True
    ) -> List[DedupResult]:
        results: List[DedupResult] = []
        for sample in samples:
            dedup = self.check_duplicate(sample)
            if dedup.is_duplicate and dedup.action == "skipped":
                if skip_duplicates:
                    results.append(dedup)
                    continue
            self.store.upsert_sample(sample)
            results.append(dedup)
        return results

    @staticmethod
    def load_samples_from_file(path: str) -> List[Sample]:
        raw = Path(path).read_text(encoding="utf-8")
        data = json.loads(raw)
        samples: List[Sample] = []
        for item in data:
            s = Sample(
                sample_id=item["sample_id"],
                raw_log=item["raw_log"],
                source=item.get("source", "import"),
                metadata=item.get("metadata", {}),
            )
            samples.append(s)
        return samples


class Stratifier:
    def __init__(self, store: Store):
        self.store = store

    def stratify(self) -> Dict[str, List[Dict[str, Any]]]:
        result: Dict[str, List[Dict[str, Any]]] = {
            "model_only": [],
            "manual_corrected": [],
            "needs_review": [],
            "conflict": [],
        }
        evaluations = self.store.list_evaluations()
        for ev in evaluations:
            record: Dict[str, Any] = {
                "eval_id": ev.eval_id,
                "sample_id": ev.sample_id,
                "cluster_label": ev.cluster_label,
                "root_cause": ev.root_cause,
                "confidence": ev.confidence,
                "evaluated_at": ev.evaluated_at,
                "model_version": ev.model_version,
                "evidence_count": len(ev.evidence),
                "status": ev.status.value,
            }
            sample = self.store.get_sample(ev.sample_id)
            if sample:
                record["raw_log_preview"] = sample.raw_log[:120]
                record["sample_source"] = sample.source

            corrections = self.store.get_corrections_for_eval(ev.eval_id)
            if corrections:
                record["correction_count"] = len(corrections)
                record["latest_corrector"] = corrections[-1].corrector

            if ev.status == EvalStatus.AUTO and not corrections:
                result["model_only"].append(record)
            elif ev.status == EvalStatus.MANUAL_CORRECTED or corrections:
                record["status"] = "manual_corrected"
                result["manual_corrected"].append(record)
            elif ev.status == EvalStatus.CONFLICT:
                result["conflict"].append(record)
            elif ev.status == EvalStatus.NEEDS_REVIEW:
                result["needs_review"].append(record)
        return result


from .models import EvalStatus
