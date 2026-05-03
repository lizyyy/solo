"""
复核存储模块 - 管理复核记录的存储和管理
"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .models import (
    AnnotationRecord,
    PredictionRecord,
    ReviewDecision,
    ReviewRecord,
    SamplingFeedback,
)


class ReviewStore:
    def __init__(self, storage_path: Path):
        self.storage_path = Path(storage_path)
        self.reviews: Dict[str, ReviewRecord] = {}
        self._load()

    def _load(self) -> None:
        if self.storage_path.exists():
            with open(self.storage_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for record_data in data.get("reviews", []):
                    self._load_review_from_data(record_data)

    def _load_review_from_data(self, data: Dict[str, Any]) -> None:
        try:
            record_id = data.get("record_id", str(uuid.uuid4()))

            annot_data = data.get("annotation", {})
            annotation = AnnotationRecord(
                session_id=annot_data.get("session_id", ""),
                turn_id=annot_data.get("turn_id"),
                text=annot_data.get("text", ""),
                label=annot_data.get("label", ""),
                annotator_id=annot_data.get("annotator_id", ""),
                annotated_at=datetime.fromisoformat(annot_data.get("annotated_at")) if annot_data.get("annotated_at") else datetime.now(),
            )

            prediction = None
            pred_data = data.get("prediction")
            if pred_data:
                prediction = PredictionRecord(
                    session_id=pred_data.get("session_id", ""),
                    turn_id=pred_data.get("turn_id"),
                    predicted_label=pred_data.get("predicted_label", ""),
                    confidence=pred_data.get("confidence", 0.0),
                    model_version=pred_data.get("model_version", ""),
                    predicted_at=datetime.fromisoformat(pred_data.get("predicted_at")) if pred_data.get("predicted_at") else datetime.now(),
                )

            sampling_feedback = None
            fb_data = data.get("sampling_feedback")
            if fb_data:
                sampling_feedback = SamplingFeedback(
                    session_id=fb_data.get("session_id", ""),
                    turn_id=fb_data.get("turn_id"),
                    original_label=fb_data.get("original_label", ""),
                    reviewer_label=fb_data.get("reviewer_label", ""),
                    reviewer_id=fb_data.get("reviewer_id", ""),
                    is_agreement=fb_data.get("is_agreement", True),
                    feedback_notes=fb_data.get("feedback_notes", ""),
                    reviewed_at=datetime.fromisoformat(fb_data.get("reviewed_at")) if fb_data.get("reviewed_at") else datetime.now(),
                )

            decision = ReviewDecision(data.get("decision", "pending"))

            reviewed_at = None
            if data.get("reviewed_at"):
                reviewed_at = datetime.fromisoformat(data["reviewed_at"])

            review = ReviewRecord(
                record_id=record_id,
                session_id=data.get("session_id", ""),
                turn_id=data.get("turn_id"),
                annotation=annotation,
                prediction=prediction,
                sampling_feedback=sampling_feedback,
                decision=decision,
                final_label=data.get("final_label"),
                notes=data.get("notes", ""),
                reviewed_by=data.get("reviewed_by"),
                reviewed_at=reviewed_at,
            )

            self.reviews[record_id] = review
        except Exception as e:
            pass

    def _save(self) -> None:
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "version": "1.0",
            "updated_at": datetime.now().isoformat(),
            "reviews": [r.to_dict() for r in self.reviews.values()],
        }
        with open(self.storage_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def add_review(
        self,
        annotation: AnnotationRecord,
        prediction: Optional[PredictionRecord] = None,
        sampling_feedback: Optional[SamplingFeedback] = None,
    ) -> ReviewRecord:
        record_id = str(uuid.uuid4())[:8]

        review = ReviewRecord(
            record_id=record_id,
            session_id=annotation.session_id,
            turn_id=annotation.turn_id,
            annotation=annotation,
            prediction=prediction,
            sampling_feedback=sampling_feedback,
        )

        self.reviews[record_id] = review
        self._save()
        return review

    def get_review(self, record_id: str) -> Optional[ReviewRecord]:
        return self.reviews.get(record_id)

    def get_reviews_by_session(self, session_id: str) -> List[ReviewRecord]:
        return [r for r in self.reviews.values() if r.session_id == session_id]

    def get_pending_reviews(self) -> List[ReviewRecord]:
        return [r for r in self.reviews.values() if r.decision == ReviewDecision.PENDING]

    def update_decision(
        self,
        record_id: str,
        decision: ReviewDecision,
        final_label: Optional[str] = None,
        notes: str = "",
        reviewed_by: Optional[str] = None,
    ) -> Optional[ReviewRecord]:
        review = self.reviews.get(record_id)
        if review:
            review.decision = decision
            review.final_label = final_label
            review.notes = notes
            review.reviewed_by = reviewed_by
            review.reviewed_at = datetime.now()
            self._save()
        return review

    def get_statistics(self) -> Dict[str, Any]:
        total = len(self.reviews)
        decisions = {}
        for review in self.reviews.values():
            key = review.decision.value
            decisions[key] = decisions.get(key, 0) + 1

        return {
            "total_reviews": total,
            "by_decision": decisions,
            "pending": decisions.get("pending", 0),
            "completed": total - decisions.get("pending", 0),
        }

    def list_all(self, status: Optional[str] = None) -> List[ReviewRecord]:
        reviews = list(self.reviews.values())
        if status:
            try:
                status_enum = ReviewDecision(status)
                reviews = [r for r in reviews if r.decision == status_enum]
            except ValueError:
                pass
        return reviews
