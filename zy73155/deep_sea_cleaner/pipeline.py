import os
import sys
import uuid
import json
from datetime import datetime
from typing import Optional, Dict, Any

from .loader import load_from_csv, list_sample_packs
from .cleaner import clean_record
from .detector import run_full_detection
from .review_tracker import ReviewTracker
from .reporter import (
    build_summary,
    summary_to_dict,
    record_to_dict,
    get_anomaly_detail,
    get_duplicate_detail,
)
from .models import FailReason


class DeepSeaCleaner:
    def __init__(
        self,
        samples_dir: str = "samples",
        output_dir: str = "output",
        review_store: str = "data/reviews.json",
    ):
        self.samples_dir = samples_dir
        self.output_dir = output_dir
        self.review_tracker = ReviewTracker(review_store)
        self.last_result: Optional[Dict[str, Any]] = None
        self.last_batch_id: Optional[str] = None

    def list_samples(self) -> list:
        return list_sample_packs(self.samples_dir)

    def run_clean(self, sample_file: str, batch_id: str = None) -> Dict[str, Any]:
        if batch_id is None:
            batch_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"

        file_path = os.path.join(self.samples_dir, sample_file)
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"样例文件不存在: {file_path}")

        raw_records = load_from_csv(file_path)
        cleaned = [clean_record(r) for r in raw_records]
        cleaned, duplicates = run_full_detection(raw_records, cleaned)
        cleaned = self.review_tracker.apply_reviews_to_records(cleaned)

        fail_reason_counts = self._count_fail_reasons(cleaned)
        summary = build_summary(cleaned, duplicates, batch_id, fail_reason_counts)

        result = {
            "batch_id": batch_id,
            "sample_file": sample_file,
            "run_time": datetime.now().isoformat(),
            "summary": summary_to_dict(summary),
            "records": [record_to_dict(r) for r in cleaned],
            "anomaly_details": get_anomaly_detail(cleaned),
            "duplicate_details": get_duplicate_detail(duplicates),
        }

        self.last_result = result
        self.last_batch_id = batch_id
        self._save_result(result)

        return result

    def _count_fail_reasons(self, cleaned_records) -> Dict[str, int]:
        counts = {}
        for rec in cleaned_records:
            for a in rec.anomalies:
                if a.fail_reason:
                    key = a.fail_reason.value
                    counts[key] = counts.get(key, 0) + 1
        return counts

    def _save_result(self, result: Dict[str, Any]):
        os.makedirs(self.output_dir, exist_ok=True)
        batch_id = result["batch_id"]
        out_file = os.path.join(self.output_dir, f"{batch_id}.json")
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

    def get_last_result(self) -> Optional[Dict[str, Any]]:
        return self.last_result

    def get_summary(self, batch_id: str = None) -> Optional[Dict[str, Any]]:
        if batch_id and batch_id != self.last_batch_id:
            result = self._load_result(batch_id)
            if result:
                return result["summary"]
            return None
        if self.last_result:
            return self.last_result["summary"]
        return None

    def get_anomalies(self, batch_id: str = None, anomaly_type: str = None):
        if batch_id and batch_id != self.last_batch_id:
            result = self._load_result(batch_id)
            if not result:
                return []
            return get_anomaly_detail(
                [self._dict_to_record(r) for r in result["records"]],
                anomaly_type,
            )
        if self.last_result:
            return self.last_result["anomaly_details"]
        return []

    def get_duplicates(self, batch_id: str = None):
        if batch_id and batch_id != self.last_batch_id:
            result = self._load_result(batch_id)
            if result:
                return result["duplicate_details"]
            return []
        if self.last_result:
            return self.last_result["duplicate_details"]
        return []

    def _load_result(self, batch_id: str) -> Optional[Dict[str, Any]]:
        out_file = os.path.join(self.output_dir, f"{batch_id}.json")
        if os.path.exists(out_file):
            with open(out_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return None

    def _dict_to_record(self, d: Dict):
        from .models import CleanedRecord, CleanAnomaly, AnomalyType, ReviewStatus
        rec = CleanedRecord(
            record_id=d["record_id"],
            station=d["station"],
            bottle_id=d["bottle_id"],
            depth_m=d.get("depth_m"),
            temperature_c=d.get("temperature_c"),
            salinity_psu=d.get("salinity_psu"),
            latitude=d.get("latitude"),
            longitude=d.get("longitude"),
            sample_time=d.get("sample_time"),
            is_valid=d["is_valid"],
            anomalies=[
                CleanAnomaly(
                    anomaly_type=AnomalyType(a["type"]),
                    field_name=a.get("field"),
                    message=a["message"],
                    detail=a.get("detail", {}),
                    fail_reason=FailReason(a["fail_reason"]) if a.get("fail_reason") else None,
                )
                for a in d.get("anomalies", [])
            ],
        )
        return rec

    def add_manual_review(
        self,
        record_id: str,
        reviewer: str,
        fail_reason: str,
        field_name: str = None,
        original_value: str = None,
        overridden_value: str = None,
        justification: str = "",
        source_note: str = "",
    ):
        return self.review_tracker.add_review(
            record_id=record_id,
            reviewer=reviewer,
            fail_reason=FailReason(fail_reason),
            field_name=field_name,
            original_value=original_value,
            overridden_value=overridden_value,
            justification=justification,
            source_note=source_note,
        )

    def get_review_chain(self, record_id: str):
        reviews = self.review_tracker.get_review_chain(record_id)
        return [
            {
                "review_id": r.review_id,
                "record_id": r.record_id,
                "reviewer": r.reviewer,
                "review_time": r.review_time.isoformat(),
                "status": r.status.value,
                "fail_reason": r.fail_reason.value,
                "field_name": r.field_name,
                "original_value": r.original_value,
                "overridden_value": r.overridden_value,
                "justification": r.justification,
                "source_note": r.source_note,
            }
            for r in reviews
        ]
