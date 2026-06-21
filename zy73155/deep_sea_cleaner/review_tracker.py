import json
import os
import uuid
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from .models import (
    ManualReviewRecord,
    ReviewStatus,
    FailReason,
    CleanedRecord,
    RawSampleRecord,
    CleanAnomaly,
    AnomalyType,
)


class ReviewTracker:
    def __init__(self, storage_path: str = "data/reviews.json"):
        self.storage_path = storage_path
        self.reviews: Dict[str, List[ManualReviewRecord]] = {}
        self._load()

    def _load(self):
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for rec_data in data:
                    rec = ManualReviewRecord(
                        review_id=rec_data["review_id"],
                        record_id=rec_data["record_id"],
                        reviewer=rec_data["reviewer"],
                        review_time=datetime.fromisoformat(rec_data["review_time"]),
                        status=ReviewStatus(rec_data["status"]),
                        fail_reason=FailReason(rec_data["fail_reason"]),
                        field_name=rec_data.get("field_name"),
                        original_value=rec_data.get("original_value"),
                        overridden_value=rec_data.get("overridden_value"),
                        justification=rec_data.get("justification", ""),
                        source_note=rec_data.get("source_note", ""),
                    )
                    if rec.record_id not in self.reviews:
                        self.reviews[rec.record_id] = []
                    self.reviews[rec.record_id].append(rec)
            except Exception:
                self.reviews = {}

    def _save(self):
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        all_reviews = []
        for rec_list in self.reviews.values():
            for rec in rec_list:
                all_reviews.append({
                    "review_id": rec.review_id,
                    "record_id": rec.record_id,
                    "reviewer": rec.reviewer,
                    "review_time": rec.review_time.isoformat(),
                    "status": rec.status.value,
                    "fail_reason": rec.fail_reason.value,
                    "field_name": rec.field_name,
                    "original_value": rec.original_value,
                    "overridden_value": rec.overridden_value,
                    "justification": rec.justification,
                    "source_note": rec.source_note,
                })
        with open(self.storage_path, "w", encoding="utf-8") as f:
            json.dump(all_reviews, f, ensure_ascii=False, indent=2)

    def add_review(
        self,
        record_id: str,
        reviewer: str,
        fail_reason: FailReason,
        field_name: Optional[str] = None,
        status: ReviewStatus = ReviewStatus.MANUAL_OVERRIDDEN,
        original_value: Optional[str] = None,
        overridden_value: Optional[str] = None,
        justification: str = "",
        source_note: str = "",
    ) -> ManualReviewRecord:
        review = ManualReviewRecord(
            review_id=f"rev_{uuid.uuid4().hex[:8]}",
            record_id=record_id,
            reviewer=reviewer,
            review_time=datetime.now(),
            status=status,
            fail_reason=fail_reason,
            field_name=field_name,
            original_value=original_value,
            overridden_value=overridden_value,
            justification=justification,
            source_note=source_note,
        )
        if record_id not in self.reviews:
            self.reviews[record_id] = []
        self.reviews[record_id].append(review)
        self._save()
        return review

    def get_latest_review(self, record_id: str) -> Optional[ManualReviewRecord]:
        if record_id not in self.reviews or not self.reviews[record_id]:
            return None
        return sorted(self.reviews[record_id], key=lambda r: r.review_time, reverse=True)[0]

    def get_review_chain(self, record_id: str) -> List[ManualReviewRecord]:
        if record_id not in self.reviews:
            return []
        return sorted(self.reviews[record_id], key=lambda r: r.review_time)

    def apply_reviews_to_records(self, cleaned_records: List[CleanedRecord]) -> List[CleanedRecord]:
        from .cleaner import convert_temperature, convert_salinity, convert_depth, parse_lat_lon

        for rec in cleaned_records:
            latest = self.get_latest_review(rec.record_id)
            if not latest or latest.status != ReviewStatus.MANUAL_OVERRIDDEN:
                if latest:
                    rec.review = latest
                continue

            rec.review = latest

            if not latest.field_name or latest.overridden_value is None:
                rec.is_valid = True
                continue

            field = latest.field_name
            new_val_str = latest.overridden_value

            new_anomaly: Optional[CleanAnomaly] = None

            try:
                if field == "temperature":
                    val = float(new_val_str)
                    new_val, new_anomaly = convert_temperature(val, "°C")
                    if new_val is not None:
                        rec.temperature_c = new_val
                elif field == "salinity":
                    val = float(new_val_str)
                    new_val, new_anomaly = convert_salinity(val, "PSU")
                    if new_val is not None:
                        rec.salinity_psu = new_val
                elif field == "depth":
                    val = float(new_val_str)
                    new_val, new_anomaly = convert_depth(val, "m")
                    if new_val is not None:
                        rec.depth_m = new_val
                elif field == "latitude":
                    new_val, new_anomaly = parse_lat_lon(new_val_str, is_lat=True)
                    if new_val is not None:
                        rec.latitude = new_val
                elif field == "longitude":
                    new_val, new_anomaly = parse_lat_lon(new_val_str, is_lat=False)
                    if new_val is not None:
                        rec.longitude = new_val
            except (ValueError, TypeError):
                pass

            if field:
                rec.anomalies = [
                    a for a in rec.anomalies
                    if not (a.field_name == field and a.fail_reason == latest.fail_reason)
                ]

            if new_anomaly:
                rec.anomalies.append(new_anomaly)

            has_blocking_anomaly = any(
                a.anomaly_type in (
                    AnomalyType.MISSING_VALUE,
                    AnomalyType.INVALID_VALUE,
                    AnomalyType.LAT_LON_FORMAT,
                )
                for a in rec.anomalies
            )
            rec.is_valid = not has_blocking_anomaly

        return cleaned_records

    def get_fail_reason_summary(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for rec_list in self.reviews.values():
            for rec in rec_list:
                key = rec.fail_reason.value
                counts[key] = counts.get(key, 0) + 1
        return counts
