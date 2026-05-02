import os
import json
from typing import Dict, List, Optional
from datetime import datetime
from pathlib import Path

from .models import Review


class ReviewStore:
    """复核状态存储 - 保存人工处理意见"""
    
    REVIEW_STATUS_PENDING = "pending"
    REVIEW_STATUS_APPROVED = "approved"
    REVIEW_STATUS_REJECTED = "rejected"
    REVIEW_STATUS_NEED_MORE_INFO = "need_more_info"
    REVIEW_STATUS_RESOLVED = "resolved"
    
    VALID_STATUSES = {
        REVIEW_STATUS_PENDING,
        REVIEW_STATUS_APPROVED,
        REVIEW_STATUS_REJECTED,
        REVIEW_STATUS_NEED_MORE_INFO,
        REVIEW_STATUS_RESOLVED,
    }
    
    def __init__(self, index_file_path: str):
        self.index_file_path = index_file_path
        self.reviews: Dict[str, Review] = {}
        self._load_reviews()
    
    def _get_review_file_path(self) -> str:
        """获取复核记录文件路径"""
        base_dir = os.path.dirname(os.path.abspath(self.index_file_path))
        base_name = os.path.splitext(os.path.basename(self.index_file_path))[0]
        return os.path.join(base_dir, f"{base_name}_reviews.json")
    
    def _load_reviews(self) -> None:
        """加载复核记录"""
        review_file = self._get_review_file_path()
        
        if not os.path.exists(review_file):
            self.reviews = {}
            return
        
        try:
            with open(review_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            self.reviews = {}
            for tracking_no, review_data in data.items():
                self.reviews[tracking_no.upper()] = Review.from_dict(review_data)
        except Exception:
            self.reviews = {}
    
    def _save_reviews(self) -> None:
        """保存复核记录"""
        review_file = self._get_review_file_path()
        
        data = {
            tracking_no: review.to_dict()
            for tracking_no, review in self.reviews.items()
        }
        
        os.makedirs(os.path.dirname(review_file), exist_ok=True)
        
        with open(review_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def add_review(self, tracking_no: str, status: str, comment: str = "", reviewer: str = "") -> bool:
        """添加复核记录
        
        Args:
            tracking_no: 运单号
            status: 状态 (pending/approved/rejected/need_more_info/resolved)
            comment: 处理意见备注
            reviewer: 复核人
        
        Returns:
            是否成功添加
        """
        normalized_no = tracking_no.upper().strip()
        
        if status not in self.VALID_STATUSES:
            valid_statuses = ", ".join(self.VALID_STATUSES)
            raise ValueError(f"无效状态 '{status}'. 有效状态: {valid_statuses}")
        
        self.reviews[normalized_no] = Review(
            tracking_no=normalized_no,
            status=status,
            comment=comment,
            reviewer=reviewer,
            reviewed_at=datetime.now(),
        )
        
        self._save_reviews()
        return True
    
    def get_review(self, tracking_no: str) -> Optional[Review]:
        """获取指定运单号的复核记录"""
        normalized_no = tracking_no.upper().strip()
        return self.reviews.get(normalized_no)
    
    def get_all_reviews(self) -> Dict[str, Review]:
        """获取所有复核记录"""
        return self.reviews.copy()
    
    def get_reviews_by_status(self, status: str) -> List[Review]:
        """按状态获取复核记录"""
        return [
            review for review in self.reviews.values()
            if review.status == status
        ]
    
    def update_review(self, tracking_no: str, status: str = None, comment: str = None, reviewer: str = None) -> bool:
        """更新复核记录"""
        normalized_no = tracking_no.upper().strip()
        
        if normalized_no not in self.reviews:
            return False
        
        review = self.reviews[normalized_no]
        
        if status and status in self.VALID_STATUSES:
            review.status = status
        
        if comment is not None:
            review.comment = comment
        
        if reviewer is not None:
            review.reviewer = reviewer
        
        review.reviewed_at = datetime.now()
        self._save_reviews()
        
        return True
    
    def delete_review(self, tracking_no: str) -> bool:
        """删除复核记录"""
        normalized_no = tracking_no.upper().strip()
        
        if normalized_no in self.reviews:
            del self.reviews[normalized_no]
            self._save_reviews()
            return True
        
        return False
