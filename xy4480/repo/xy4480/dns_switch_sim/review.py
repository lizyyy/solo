from datetime import datetime
from typing import List, Dict, Optional, Any
from collections import defaultdict
import json
from pathlib import Path

from .models import (
    ReviewItem, ReviewStatus, CheckResult, CheckResultType,
    SimulationResult
)


class ReviewManager:
    def __init__(self):
        self._review_items: Dict[str, ReviewItem] = {}

    def load_from_simulation(self, simulation_result: SimulationResult) -> None:
        for item in simulation_result.review_items:
            self._review_items[item.item_id] = item

    def load_from_file(self, file_path: Path) -> None:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        for item_data in data.get("review_items", []):
            item = ReviewItem(
                item_id=item_data["item_id"],
                check_result_id=item_data.get("check_result_id", ""),
                reviewer=item_data.get("reviewer"),
                status=ReviewStatus(item_data["status"]),
                comment=item_data.get("comment"),
                reviewed_at=datetime.fromisoformat(item_data["reviewed_at"])
                if item_data.get("reviewed_at") else None,
            )
            self._review_items[item.item_id] = item

    def save_to_file(self, file_path: Path, extra_metadata: Optional[Dict[str, Any]] = None) -> None:
        output: Dict[str, Any] = {
            "version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "review_items": [],
        }
        
        for item in self._review_items.values():
            output["review_items"].append({
                "item_id": item.item_id,
                "check_result_id": item.check_result_id,
                "reviewer": item.reviewer,
                "status": item.status.value,
                "comment": item.comment,
                "reviewed_at": item.reviewed_at.isoformat() if item.reviewed_at else None,
            })
        
        if extra_metadata:
            output["metadata"] = extra_metadata
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)

    def get_pending_items(self) -> List[ReviewItem]:
        return [
            item for item in self._review_items.values()
            if item.status in [ReviewStatus.PENDING, ReviewStatus.NEEDS_REVIEW]
        ]

    def get_all_items(self) -> List[ReviewItem]:
        return list(self._review_items.values())

    def get_item(self, item_id: str) -> Optional[ReviewItem]:
        return self._review_items.get(item_id)

    def review_item(
        self,
        item_id: str,
        reviewer: str,
        status: ReviewStatus,
        comment: Optional[str] = None,
    ) -> bool:
        if item_id not in self._review_items:
            return False
        
        item = self._review_items[item_id]
        item.reviewer = reviewer
        item.status = status
        item.comment = comment
        item.reviewed_at = datetime.now()
        
        return True

    def approve(self, item_id: str, reviewer: str, comment: Optional[str] = None) -> bool:
        return self.review_item(item_id, reviewer, ReviewStatus.APPROVED, comment)

    def reject(self, item_id: str, reviewer: str, comment: Optional[str] = None) -> bool:
        return self.review_item(item_id, reviewer, ReviewStatus.REJECTED, comment)

    def get_statistics(self) -> Dict[str, Any]:
        stats: Dict[str, Any] = {
            "total": 0,
            "by_status": defaultdict(int),
            "needs_attention": 0,
        }
        
        for item in self._review_items.values():
            stats["total"] += 1
            stats["by_status"][item.status.value] += 1
            
            if item.status in [ReviewStatus.NEEDS_REVIEW, ReviewStatus.PENDING]:
                stats["needs_attention"] += 1
        
        stats["by_status"] = dict(stats["by_status"])
        return stats

    def update_from_check_results(self, check_results: List[CheckResult]) -> None:
        for result in check_results:
            if result.result in [CheckResultType.FAIL, CheckResultType.WARNING]:
                item_id = f"review_{result.check_id}"
                
                if item_id not in self._review_items:
                    self._review_items[item_id] = ReviewItem(
                        item_id=item_id,
                        check_result_id=result.check_id,
                        status=ReviewStatus.NEEDS_REVIEW,
                    )
                else:
                    existing = self._review_items[item_id]
                    if existing.status == ReviewStatus.PENDING:
                        existing.status = ReviewStatus.NEEDS_REVIEW
