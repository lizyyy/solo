"""
复核存储模块：保存人工调整和复核记录
"""
import json
import csv
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict, field
from datetime import datetime


@dataclass
class ReviewAction:
    """复核操作"""
    child_id: str
    book_id: str
    action: str
    reason: str = ""
    reviewer: str = ""
    timestamp: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    VALID_ACTIONS = ["approve", "reject", "replace", "add_note"]
    
    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()
        
        if self.action not in self.VALID_ACTIONS:
            raise ValueError(f"无效的操作类型: {self.action}，有效值: {self.VALID_ACTIONS}")


@dataclass
class ChildReview:
    """单个孩子的复核记录"""
    child_id: str
    child_name: str = ""
    original_recommendations: List[Dict[str, Any]] = field(default_factory=list)
    final_recommendations: List[Dict[str, Any]] = field(default_factory=list)
    actions: List[ReviewAction] = field(default_factory=list)
    reviewed_at: str = ""
    reviewer: str = ""
    notes: str = ""
    
    def __post_init__(self):
        if not self.reviewed_at:
            self.reviewed_at = datetime.now().isoformat()


class ReviewStorage:
    """复核存储管理器"""
    
    def __init__(self, storage_dir: Path):
        self.storage_dir = storage_dir
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
        self.reviews_file = storage_dir / "reviews.json"
        self.actions_log_file = storage_dir / "actions_log.csv"
        
        self._ensure_files_exist()
    
    def _ensure_files_exist(self):
        """确保必要的文件存在"""
        if not self.reviews_file.exists():
            self.reviews_file.write_text(json.dumps({}, ensure_ascii=False, indent=2), encoding='utf-8')
        
        if not self.actions_log_file.exists():
            with open(self.actions_log_file, 'w', encoding='utf-8', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=[
                    "timestamp", "child_id", "book_id", "action", 
                    "reason", "reviewer", "metadata"
                ])
                writer.writeheader()
    
    def load_all_reviews(self) -> Dict[str, ChildReview]:
        """加载所有复核记录"""
        if not self.reviews_file.exists():
            return {}
        
        try:
            data = json.loads(self.reviews_file.read_text(encoding='utf-8'))
            reviews = {}
            
            for child_id, review_data in data.items():
                actions = [
                    ReviewAction(**action_data)
                    for action_data in review_data.get('actions', [])
                ]
                review_data['actions'] = actions
                reviews[child_id] = ChildReview(**review_data)
            
            return reviews
        except Exception:
            return {}
    
    def save_review(self, review: ChildReview) -> bool:
        """保存单个复核记录"""
        reviews = self.load_all_reviews()
        reviews[review.child_id] = review
        
        try:
            data = {}
            for child_id, r in reviews.items():
                r_dict = asdict(r)
                r_dict['actions'] = [asdict(a) for a in r.actions]
                data[child_id] = r_dict
            
            self.reviews_file.write_text(
                json.dumps(data, ensure_ascii=False, indent=2),
                encoding='utf-8'
            )
            return True
        except Exception:
            return False
    
    def log_action(self, action: ReviewAction) -> bool:
        """记录单个操作到日志"""
        try:
            with open(self.actions_log_file, 'a', encoding='utf-8', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=[
                    "timestamp", "child_id", "book_id", "action", 
                    "reason", "reviewer", "metadata"
                ])
                
                writer.writerow({
                    "timestamp": action.timestamp,
                    "child_id": action.child_id,
                    "book_id": action.book_id,
                    "action": action.action,
                    "reason": action.reason,
                    "reviewer": action.reviewer,
                    "metadata": json.dumps(action.metadata, ensure_ascii=False)
                })
            return True
        except Exception:
            return False
    
    def get_child_review(self, child_id: str) -> Optional[ChildReview]:
        """获取单个孩子的复核记录"""
        reviews = self.load_all_reviews()
        return reviews.get(child_id)
    
    def get_action_history(self, child_id: str = None, limit: int = 100) -> List[ReviewAction]:
        """获取操作历史记录"""
        actions = []
        
        try:
            with open(self.actions_log_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if child_id and row['child_id'] != child_id:
                        continue
                    
                    try:
                        metadata = json.loads(row.get('metadata', '{}'))
                    except Exception:
                        metadata = {}
                    
                    action = ReviewAction(
                        child_id=row['child_id'],
                        book_id=row['book_id'],
                        action=row['action'],
                        reason=row.get('reason', ''),
                        reviewer=row.get('reviewer', ''),
                        timestamp=row.get('timestamp', ''),
                        metadata=metadata
                    )
                    actions.append(action)
        except Exception:
            pass
        
        actions.sort(key=lambda x: x.timestamp, reverse=True)
        return actions[:limit]
    
    def save_adjustment(
        self,
        child_id: str,
        original_recommendations: List[Dict[str, Any]],
        final_recommendations: List[Dict[str, Any]],
        reviewer: str = "",
        notes: str = ""
    ) -> ChildReview:
        """
        保存人工调整结果
        
        Args:
            child_id: 孩子ID
            original_recommendations: 原始推荐列表
            final_recommendations: 调整后的推荐列表
            reviewer: 复核人
            notes: 备注
            
        Returns:
            ChildReview 对象
        """
        review = self.get_child_review(child_id)
        
        if review is None:
            review = ChildReview(
                child_id=child_id,
                original_recommendations=original_recommendations,
                final_recommendations=final_recommendations,
                reviewer=reviewer,
                notes=notes
            )
        else:
            review.original_recommendations = original_recommendations
            review.final_recommendations = final_recommendations
            review.reviewer = reviewer
            review.notes = notes
            review.reviewed_at = datetime.now().isoformat()
        
        self._generate_actions_from_changes(review, original_recommendations, final_recommendations, reviewer)
        self.save_review(review)
        
        return review
    
    def _generate_actions_from_changes(
        self,
        review: ChildReview,
        original: List[Dict[str, Any]],
        final: List[Dict[str, Any]],
        reviewer: str
    ):
        """根据变更生成操作记录"""
        original_book_ids = {r.get('book_id', '') for r in original if r.get('book_id')}
        final_book_ids = {r.get('book_id', '') for r in final if r.get('book_id')}
        
        removed_books = original_book_ids - final_book_ids
        added_books = final_book_ids - original_book_ids
        
        for book_id in removed_books:
            action = ReviewAction(
                child_id=review.child_id,
                book_id=book_id,
                action="reject",
                reason="人工移除",
                reviewer=reviewer
            )
            review.actions.append(action)
            self.log_action(action)
        
        for book_id in added_books:
            action = ReviewAction(
                child_id=review.child_id,
                book_id=book_id,
                action="replace",
                reason="人工添加",
                reviewer=reviewer
            )
            review.actions.append(action)
            self.log_action(action)
    
    def add_note(
        self,
        child_id: str,
        book_id: str,
        note: str,
        reviewer: str = ""
    ) -> bool:
        """
        添加备注
        
        Args:
            child_id: 孩子ID
            book_id: 图书ID
            note: 备注内容
            reviewer: 备注人
            
        Returns:
            是否成功
        """
        action = ReviewAction(
            child_id=child_id,
            book_id=book_id,
            action="add_note",
            reason=note,
            reviewer=reviewer
        )
        
        return self.log_action(action)
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取复核统计信息"""
        reviews = self.load_all_reviews()
        all_actions = self.get_action_history(limit=10000)
        
        action_counts = {}
        for action in all_actions:
            action_counts[action.action] = action_counts.get(action.action, 0) + 1
        
        return {
            "total_reviewed_children": len(reviews),
            "total_actions": len(all_actions),
            "action_counts": action_counts,
            "storage_path": str(self.storage_dir)
        }
