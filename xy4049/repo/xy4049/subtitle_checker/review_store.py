"""人工复核模块 - 问题确认/驳回存储"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from .models import (
    Issue,
    IssueSeverity,
    IssueType,
    Language,
    Quarantine,
    ReviewAction,
)


class ReviewStore:
    REVIEW_FILENAME = "reviews.json"

    def __init__(self, storage_dir: Path):
        self.storage_dir = storage_dir
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.review_file = self.storage_dir / self.REVIEW_FILENAME
        self._reviews: dict[str, dict] = {}
        self._load_reviews()

    def _load_reviews(self):
        if self.review_file.exists():
            try:
                with open(self.review_file, "r", encoding="utf-8") as f:
                    self._reviews = json.load(f)
            except (json.JSONDecodeError, IOError):
                self._reviews = {}

    def _save_reviews(self):
        with open(self.review_file, "w", encoding="utf-8") as f:
            json.dump(self._reviews, f, ensure_ascii=False, indent=2, default=str)

    def review_issue(
        self,
        issue_id: str,
        action: ReviewAction,
        note: Optional[str] = None,
    ) -> Optional[dict]:
        if issue_id not in self._reviews:
            self._reviews[issue_id] = {}

        self._reviews[issue_id]["action"] = action.value
        self._reviews[issue_id]["note"] = note
        self._reviews[issue_id]["reviewed_at"] = datetime.now().isoformat()

        self._save_reviews()
        return self._reviews.get(issue_id)

    def get_review(self, issue_id: str) -> Optional[dict]:
        return self._reviews.get(issue_id)

    def apply_reviews_to_quarantine(self, quarantine: Quarantine) -> Quarantine:
        for issue in quarantine.issues:
            review = self._reviews.get(issue.id)
            if review:
                try:
                    issue.review_action = ReviewAction(review.get("action", ReviewAction.PENDING))
                except ValueError:
                    issue.review_action = ReviewAction.PENDING
                issue.review_note = review.get("note")
                if review.get("reviewed_at"):
                    try:
                        issue.reviewed_at = datetime.fromisoformat(review["reviewed_at"])
                    except ValueError:
                        issue.reviewed_at = None

        return quarantine

    def get_issues_by_review_status(
        self,
        quarantine: Quarantine,
        action: ReviewAction,
    ) -> list[Issue]:
        filtered = []
        for issue in quarantine.issues:
            review = self._reviews.get(issue.id)
            if review:
                try:
                    if ReviewAction(review.get("action")) == action:
                        filtered.append(issue)
                except ValueError:
                    pass
        return filtered

    def get_stats(self, quarantine: Quarantine) -> dict:
        stats = {
            "total": len(quarantine.issues),
            "pending": 0,
            "confirmed": 0,
            "dismissed": 0,
            "by_type": {},
            "by_severity": {},
            "by_language": {},
        }

        for issue in quarantine.issues:
            review = self._reviews.get(issue.id)
            if review:
                try:
                    action = ReviewAction(review.get("action"))
                    if action == ReviewAction.CONFIRM:
                        stats["confirmed"] += 1
                    elif action == ReviewAction.DISMISS:
                        stats["dismissed"] += 1
                    else:
                        stats["pending"] += 1
                except ValueError:
                    stats["pending"] += 1
            else:
                stats["pending"] += 1

            issue_type = issue.issue_type.value
            if issue_type not in stats["by_type"]:
                stats["by_type"][issue_type] = 0
            stats["by_type"][issue_type] += 1

            severity = issue.severity.value
            if severity not in stats["by_severity"]:
                stats["by_severity"][severity] = 0
            stats["by_severity"][severity] += 1

            if issue.language:
                lang = issue.language.value
                if lang not in stats["by_language"]:
                    stats["by_language"][lang] = 0
                stats["by_language"][lang] += 1

        return stats

    def get_all_reviews(self) -> dict[str, dict]:
        return self._reviews.copy()
