import json
import os
import uuid
from datetime import datetime
from typing import List, Dict, Optional
from .models import (
    ManualReviewRecord,
    ReviewStatus,
    FailReason,
    CleanedRecord,
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
        for rec in cleaned_records:
            latest = self.get_latest_review(rec.record_id)
            if latest:
                rec.review = latest
                if latest.status == ReviewStatus.MANUAL_OVERRIDDEN:
                    rec.is_valid = True
        return cleaned_records

    def get_fail_reason_summary(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for rec_list in self.reviews.values():
            for rec in rec_list:
                key = rec.fail_reason.value
                counts[key] = counts.get(key, 0) + 1
        return counts
