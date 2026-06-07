from datetime import datetime
from typing import List, Dict, Tuple
from collections import defaultdict
from difflib import SequenceMatcher
from models import UserFeedback, RecordStatus, IntentCategory, AnnotationNote


class IntentComparator:
    def __init__(self):
        self.records: List[UserFeedback] = []
        self.duplicate_threshold = 0.8

    def load_records(self, records: List[UserFeedback]) -> None:
        self.records = records

    def detect_duplicates(self) -> List[Tuple[UserFeedback, UserFeedback, float]]:
        duplicates = []
        for i, r1 in enumerate(self.records):
            for j, r2 in enumerate(self.records[i + 1:]):
                if r1.user_id == r2.user_id:
                    similarity = self._text_similarity(r1.content, r2.content)
                    time_diff = abs((r1.timestamp - r2.timestamp).total_seconds())
                    if similarity > self.duplicate_threshold and time_diff < 300:
                        duplicates.append((r1, r2, similarity))
                        if r1.status != RecordStatus.DUPLICATE and r2.status != RecordStatus.DUPLICATE:
                            r2.status = RecordStatus.DUPLICATE
                            r2.duplicate_of = r1.feedback_id
        return duplicates

    def _text_similarity(self, a: str, b: str) -> float:
        return SequenceMatcher(None, a, b).ratio()

    def add_annotation_note(self, feedback_id: str, annotator: str, note: str,
                            is_official_caliber: bool = False) -> bool:
        for record in self.records:
            if record.feedback_id == feedback_id:
                record.annotation_notes.append(
                    AnnotationNote(
                        annotator=annotator,
                        note=note,
                        timestamp=datetime.now(),
                        is_official_caliber=is_official_caliber
                    )
                )
                return True
        return False

    def apply_manual_correction(self, feedback_id: str, new_intent: IntentCategory) -> bool:
        for record in self.records:
            if record.feedback_id == feedback_id:
                record.manual_correction = new_intent
                record.status = RecordStatus.RESOLVED
                return True
        return False

    def update_record_status(self, feedback_id: str, status: RecordStatus) -> bool:
        for record in self.records:
            if record.feedback_id == feedback_id:
                record.status = status
                return True
        return False

    def get_evidence_playback(self, feedback_id: str) -> Dict:
        for record in self.records:
            if record.feedback_id == feedback_id:
                current_intent = record.manual_correction or record.new_model_intent
                intent_changed = (
                    record.old_model_intent != record.new_model_intent or
                    record.manual_correction is not None
                )
                return {
                    "feedback_id": record.feedback_id,
                    "user_id": record.user_id,
                    "gray_batch": record.gray_batch,
                    "status": record.status.value,
                    "is_duplicate": record.status == RecordStatus.DUPLICATE,
                    "duplicate_of": record.duplicate_of,
                    "original_content": record.content,
                    "timestamp": record.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                    "old_model_intent": record.old_model_intent.value,
                    "new_model_intent": record.new_model_intent.value,
                    "manual_correction": record.manual_correction.value if record.manual_correction else None,
                    "current_intent": current_intent.value,
                    "intent_changed": intent_changed,
                    "annotation_notes": [
                        {
                            "annotator": n.annotator,
                            "note": n.note,
                            "timestamp": n.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                            "is_official_caliber": n.is_official_caliber
                        }
                        for n in record.annotation_notes
                    ],
                    "has_official_caliber": any(n.is_official_caliber for n in record.annotation_notes)
                }
        return {}

    def get_records_summary(self) -> Dict:
        summary = defaultdict(int)
        batches = defaultdict(int)
        for record in self.records:
            summary[record.status.value] += 1
            batches[record.gray_batch] += 1
        return {
            "total": len(self.records),
            "status_breakdown": dict(summary),
            "gray_batches": dict(batches)
        }

    def get_records_by_status(self, status: RecordStatus) -> List[UserFeedback]:
        return [r for r in self.records if r.status == status]

    def get_records_by_batch(self, batch_name: str) -> List[UserFeedback]:
        return [r for r in self.records if r.gray_batch == batch_name]

    def rerun_comparison(self) -> None:
        self.detect_duplicates()
        for record in self.records:
            if record.status == RecordStatus.DUPLICATE:
                continue
            has_official = any(n.is_official_caliber for n in record.annotation_notes)
            if has_official and record.manual_correction:
                record.status = RecordStatus.RESOLVED
            elif has_official and not record.manual_correction:
                record.status = RecordStatus.CONFIRMED
