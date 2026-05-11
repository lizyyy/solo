import uuid
from datetime import datetime
from typing import List, Optional, Dict
from .models import ReviewNote, ReviewStatus, MatchedResult


class ReviewManager:
    def __init__(self, existing_notes: List[ReviewNote] = None):
        self.notes: Dict[str, ReviewNote] = {}
        if existing_notes:
            for note in existing_notes:
                self.notes[note.fuel_record_id] = note

    def add_review(
        self,
        fuel_record_id: str,
        reviewer: str,
        status: ReviewStatus,
        conclusion: str,
        remarks: str = "",
    ) -> ReviewNote:
        note = ReviewNote(
            id=str(uuid.uuid4()),
            fuel_record_id=fuel_record_id,
            reviewer=reviewer,
            review_time=datetime.now(),
            status=status,
            conclusion=conclusion,
            remarks=remarks,
        )
        self.notes[fuel_record_id] = note
        return note

    def get_note(self, fuel_record_id: str) -> Optional[ReviewNote]:
        return self.notes.get(fuel_record_id)

    def get_all_notes(self) -> List[ReviewNote]:
        return list(self.notes.values())

    def get_notes_by_status(self, status: ReviewStatus) -> List[ReviewNote]:
        return [n for n in self.notes.values() if n.status == status]

    def attach_notes_to_results(self, results: List[MatchedResult]) -> List[MatchedResult]:
        for result in results:
            fuel_id = result.fuel_record.id
            if fuel_id in self.notes:
                result.review_note = self.notes[fuel_id]
        return results
