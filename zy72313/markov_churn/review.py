import json
from typing import Dict, List, Optional, Any
from datetime import datetime
from dataclasses import dataclass, asdict
from pathlib import Path
from enum import Enum


class ReviewStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_MORE_INFO = "needs_more_info"


class ReviewType(Enum):
    MULTIPLE_ANSWERS = "multiple_answers"
    ANNOTATION_UPDATE = "annotation_update"
    ERROR_NOTE_UPDATE = "error_note_update"
    DATA_IMPORT = "data_import"
    ROLLBACK = "rollback"


@dataclass
class ReviewItem:
    review_id: str
    review_type: str
    status: str
    created_at: str
    assigned_to: List[str]
    data: Dict
    comments: List[Dict]
    resolved_at: Optional[str] = None
    resolved_by: Optional[str] = None
    resolution: Optional[str] = None


class ReviewSystem:
    def __init__(self, review_file: str, history_manager=None):
        self.review_file = Path(review_file)
        self.review_file.parent.mkdir(parents=True, exist_ok=True)
        self.reviews: Dict[str, ReviewItem] = {}
        self.history_manager = history_manager
        self._load_reviews()

    def _load_reviews(self) -> None:
        if self.review_file.exists():
            with open(self.review_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.reviews = {
                    rid: ReviewItem(**rdata)
                    for rid, rdata in data.items()
                }

    def _save_reviews(self) -> None:
        data = {
            rid: asdict(item)
            for rid, item in self.reviews.items()
        }
        with open(self.review_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _generate_review_id(self) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"review_{timestamp}"

    def create_review(self, review_type: ReviewType, data: Dict,
                      assigned_to: List[str] = None,
                      description: str = "") -> ReviewItem:
        review_id = self._generate_review_id()
        review = ReviewItem(
            review_id=review_id,
            review_type=review_type.value,
            status=ReviewStatus.PENDING.value,
            created_at=datetime.now().isoformat(),
            assigned_to=assigned_to or ["唐老师", "业务运营"],
            data=data,
            comments=[{
                "timestamp": datetime.now().isoformat(),
                "author": "system",
                "content": description or f"创建{review_type.value}复核任务"
            }]
        )
        self.reviews[review_id] = review
        self._save_reviews()
        return review

    def add_comment(self, review_id: str, author: str, content: str) -> ReviewItem:
        if review_id not in self.reviews:
            raise ValueError(f"复核任务不存在: {review_id}")
        
        review = self.reviews[review_id]
        review.comments.append({
            "timestamp": datetime.now().isoformat(),
            "author": author,
            "content": content
        })
        self._save_reviews()
        return review

    def approve(self, review_id: str, approver: str, comment: str = "") -> ReviewItem:
        if review_id not in self.reviews:
            raise ValueError(f"复核任务不存在: {review_id}")
        
        review = self.reviews[review_id]
        review.status = ReviewStatus.APPROVED.value
        review.resolved_at = datetime.now().isoformat()
        review.resolved_by = approver
        review.resolution = "approved"
        review.comments.append({
            "timestamp": datetime.now().isoformat(),
            "author": approver,
            "content": comment or "已批准"
        })
        self._save_reviews()

        if self.history_manager:
            self.history_manager.create_version(
                data={
                    "review_id": review_id,
                    "action": "approve",
                    "review_type": review.review_type,
                    "approver": approver,
                    "review_data": review.data
                },
                author=approver,
                description=f"批准复核: {review_id}"
            )

        return review

    def reject(self, review_id: str, rejector: str, reason: str,
               rollback: bool = False) -> ReviewItem:
        if review_id not in self.reviews:
            raise ValueError(f"复核任务不存在: {review_id}")
        
        review = self.reviews[review_id]
        review.status = ReviewStatus.REJECTED.value
        review.resolved_at = datetime.now().isoformat()
        review.resolved_by = rejector
        review.resolution = "rejected"
        review.comments.append({
            "timestamp": datetime.now().isoformat(),
            "author": rejector,
            "content": f"已拒绝: {reason}"
        })
        self._save_reviews()
        return review

    def request_more_info(self, review_id: str, requester: str, 
                          info_requested: str) -> ReviewItem:
        if review_id not in self.reviews:
            raise ValueError(f"复核任务不存在: {review_id}")
        
        review = self.reviews[review_id]
        review.status = ReviewStatus.NEEDS_MORE_INFO.value
        review.comments.append({
            "timestamp": datetime.now().isoformat(),
            "author": requester,
            "content": f"需要更多信息: {info_requested}"
        })
        self._save_reviews()
        return review

    def get_pending_reviews(self, review_type: str = None) -> List[ReviewItem]:
        pending = [
            r for r in self.reviews.values()
            if r.status == ReviewStatus.PENDING.value
        ]
        if review_type:
            pending = [r for r in pending if r.review_type == review_type]
        return sorted(pending, key=lambda r: r.created_at)

    def get_review(self, review_id: str) -> Optional[ReviewItem]:
        return self.reviews.get(review_id)

    def list_reviews(self, status: str = None, limit: int = None) -> List[ReviewItem]:
        reviews = list(self.reviews.values())
        if status:
            reviews = [r for r in reviews if r.status == status]
        reviews = sorted(reviews, key=lambda r: r.created_at, reverse=True)
        if limit:
            reviews = reviews[:limit]
        return reviews

    def check_and_create_multiple_answer_review(self, student_id: str,
                                                 versions_data: Dict,
                                                 source_file: str) -> Optional[ReviewItem]:
        existing_pending = [
            r for r in self.get_pending_reviews("multiple_answers")
            if r.data.get("student_id") == student_id
        ]
        if existing_pending:
            return None

        return self.create_review(
            review_type=ReviewType.MULTIPLE_ANSWERS,
            data={
                "student_id": student_id,
                "versions": versions_data,
                "source_file": source_file,
                "issue": "同一学生提交了多版答案，需要业务运营复核确认正确版本"
            },
            description=f"学生{student_id}存在多版答案，需复核确认"
        )

    def create_annotation_review(self, item_id: str, old_annotation: Dict,
                                  new_annotation: Dict, author: str) -> ReviewItem:
        return self.create_review(
            review_type=ReviewType.ANNOTATION_UPDATE,
            data={
                "item_id": item_id,
                "old_annotation": old_annotation,
                "new_annotation": new_annotation,
                "updated_by": author
            },
            description=f"备注更新复核: {item_id}"
        )
