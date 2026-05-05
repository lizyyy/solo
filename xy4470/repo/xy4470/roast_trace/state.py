"""状态管理模块 - 处理复核备注和状态持久化"""
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from roast_trace.models import BatchReview, BatchStatus


class StateManager:
    DEFAULT_STATE_FILE = ".roast_trace_state.json"

    def __init__(self, state_dir: Optional[Path] = None):
        if state_dir is None:
            state_dir = Path.cwd()
        self.state_file = state_dir / self.DEFAULT_STATE_FILE
        self._data: dict[str, Any] = self._load()

    def _load(self) -> dict[str, Any]:
        if self.state_file.exists():
            with open(self.state_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return {
            "reviews": {},
            "import_history": [],
            "last_check": None,
            "custom_flags": {},
        }

    def _save(self) -> None:
        with open(self.state_file, "w", encoding="utf-8") as f:
            json.dump(self._data, f, ensure_ascii=False, indent=2, default=str)

    def add_review(
        self,
        roast_batch_id: str,
        reviewer: str,
        status: BatchStatus,
        notes: str,
        action_items: Optional[list[str]] = None,
    ) -> BatchReview:
        review = BatchReview(
            roast_batch_id=roast_batch_id,
            reviewer=reviewer,
            review_date=datetime.now(),
            status=status,
            notes=notes,
            action_items=action_items or [],
        )
        if roast_batch_id not in self._data["reviews"]:
            self._data["reviews"][roast_batch_id] = []
        self._data["reviews"][roast_batch_id].append(review.model_dump(mode="json"))
        self._save()
        return review

    def get_reviews(self, roast_batch_id: Optional[str] = None) -> list[dict[str, Any]]:
        if roast_batch_id:
            return self._data["reviews"].get(roast_batch_id, [])
        all_reviews: list[dict[str, Any]] = []
        for reviews in self._data["reviews"].values():
            all_reviews.extend(reviews)
        return all_reviews

    def get_latest_review(self, roast_batch_id: str) -> Optional[dict[str, Any]]:
        reviews = self._data["reviews"].get(roast_batch_id, [])
        if reviews:
            return reviews[-1]
        return None

    def get_effective_status(self, roast_batch_id: str) -> Optional[BatchStatus]:
        latest = self.get_latest_review(roast_batch_id)
        if latest:
            return BatchStatus(latest["status"])
        return None

    def set_custom_flag(
        self,
        roast_batch_id: str,
        flag_type: str,
        reason: str,
        set_by: str,
    ) -> None:
        if roast_batch_id not in self._data["custom_flags"]:
            self._data["custom_flags"][roast_batch_id] = []
        self._data["custom_flags"][roast_batch_id].append({
            "flag_type": flag_type,
            "reason": reason,
            "set_by": set_by,
            "set_at": datetime.now().isoformat(),
        })
        self._save()

    def get_custom_flags(self, roast_batch_id: Optional[str] = None) -> dict[str, list[dict[str, Any]]]:
        if roast_batch_id:
            return {roast_batch_id: self._data["custom_flags"].get(roast_batch_id, [])}
        return self._data["custom_flags"]

    def log_import(
        self,
        file_type: str,
        file_path: str,
        record_count: int,
        error_count: int = 0,
    ) -> None:
        self._data["import_history"].append({
            "timestamp": datetime.now().isoformat(),
            "file_type": file_type,
            "file_path": file_path,
            "record_count": record_count,
            "error_count": error_count,
        })
        self._save()

    def get_import_history(self, limit: Optional[int] = None) -> list[dict[str, Any]]:
        history = self._data["import_history"]
        if limit:
            return history[-limit:]
        return history

    def update_last_check(self, check_summary: dict[str, Any]) -> None:
        self._data["last_check"] = {
            "timestamp": datetime.now().isoformat(),
            "summary": check_summary,
        }
        self._save()

    def get_last_check(self) -> Optional[dict[str, Any]]:
        return self._data.get("last_check")

    def clear_state(self) -> None:
        if self.state_file.exists():
            self.state_file.unlink()
        self._data = self._load()
