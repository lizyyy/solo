"""数据存储层"""
import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict
from .models import (
    FeedbackTicket, DesensitizationNote, ReviewRecord,
    DuplicateGroup, ReviewReport
)


class JsonStorage:
    """基于 JSON 文件的轻量存储"""

    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.tickets_path = self.data_dir / "tickets.json"
        self.notes_path = self.data_dir / "notes.json"
        self.reviews_path = self.data_dir / "reviews.json"
        self.groups_path = self.data_dir / "groups.json"
        self.reports_path = self.data_dir / "reports.json"
        self._init_storage()

    def _init_storage(self):
        self.data_dir.mkdir(parents=True, exist_ok=True)
        for path in [self.tickets_path, self.notes_path,
                     self.reviews_path, self.groups_path, self.reports_path]:
            if not path.exists():
                path.write_text("[]", encoding="utf-8")

    def _load(self, path: Path) -> List[Dict]:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        return []

    def _save(self, path: Path, data: List[Dict]):
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8"
        )

    # ---- Tickets ----
    def save_ticket(self, ticket: FeedbackTicket):
        tickets = self._load(self.tickets_path)
        for i, t in enumerate(tickets):
            if t["ticket_id"] == ticket.ticket_id:
                tickets[i] = ticket.model_dump()
                self._save(self.tickets_path, tickets)
                return
        tickets.append(ticket.model_dump())
        self._save(self.tickets_path, tickets)

    def get_ticket(self, ticket_id: str) -> Optional[FeedbackTicket]:
        for t in self._load(self.tickets_path):
            if t["ticket_id"] == ticket_id:
                return FeedbackTicket(**t)
        return None

    def list_tickets(self) -> List[FeedbackTicket]:
        return [FeedbackTicket(**t) for t in self._load(self.tickets_path)]

    # ---- Notes ----
    def save_note(self, note: DesensitizationNote):
        notes = self._load(self.notes_path)
        for i, n in enumerate(notes):
            if n["note_id"] == note.note_id:
                notes[i] = note.model_dump()
                self._save(self.notes_path, notes)
                return
        notes.append(note.model_dump())
        self._save(self.notes_path, notes)

    def get_note_for_ticket(self, ticket_id: str) -> Optional[DesensitizationNote]:
        for n in self._load(self.notes_path):
            if n["ticket_id"] == ticket_id:
                return DesensitizationNote(**n)
        return None

    def list_notes(self) -> List[DesensitizationNote]:
        return [DesensitizationNote(**n) for n in self._load(self.notes_path)]

    # ---- Reviews ----
    def save_review(self, review: ReviewRecord):
        reviews = self._load(self.reviews_path)
        for i, r in enumerate(reviews):
            if r["review_id"] == review.review_id:
                reviews[i] = review.model_dump()
                self._save(self.reviews_path, reviews)
                return
        reviews.append(review.model_dump())
        self._save(self.reviews_path, reviews)

    def get_review_for_ticket(self, ticket_id: str) -> Optional[ReviewRecord]:
        for r in self._load(self.reviews_path):
            if r["ticket_id"] == ticket_id:
                return ReviewRecord(**r)
        return None

    def list_reviews(self) -> List[ReviewRecord]:
        return [ReviewRecord(**r) for r in self._load(self.reviews_path)]

    # ---- Groups ----
    def save_group(self, group: DuplicateGroup):
        groups = self._load(self.groups_path)
        for i, g in enumerate(groups):
            if g["group_id"] == group.group_id:
                groups[i] = group.model_dump()
                self._save(self.groups_path, groups)
                return
        groups.append(group.model_dump())
        self._save(self.groups_path, groups)

    def list_groups(self) -> List[DuplicateGroup]:
        return [DuplicateGroup(**g) for g in self._load(self.groups_path)]

    def clear_groups(self):
        self._save(self.groups_path, [])

    # ---- Reports ----
    def save_report(self, report: ReviewReport):
        reports = self._load(self.reports_path)
        reports.append(report.model_dump())
        self._save(self.reports_path, reports)

    def list_reports(self) -> List[ReviewReport]:
        return [ReviewReport(**r) for r in self._load(self.reports_path)]
