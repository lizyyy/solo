"""
人工反馈存储模块
负责存储和管理人工对工单的分类反馈，包括合并簇、拆分簇、打标签和标记误报
"""

import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass, field, asdict
from enum import Enum

from .config import Config


class FeedbackType(Enum):
    MERGE = "merge"
    SPLIT = "split"
    TAG = "tag"
    FALSE_POSITIVE = "false_positive"
    CORRECT = "correct"
    MOVE = "move"


@dataclass
class Feedback:
    feedback_id: str
    feedback_type: FeedbackType
    ticket_id: Optional[str] = None
    from_cluster_id: Optional[int] = None
    to_cluster_id: Optional[int] = None
    tags: List[str] = field(default_factory=list)
    reason: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["feedback_type"] = self.feedback_type.value
        data["created_at"] = self.created_at.isoformat()
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Feedback':
        return cls(
            feedback_id=data["feedback_id"],
            feedback_type=FeedbackType(data["feedback_type"]),
            ticket_id=data.get("ticket_id"),
            from_cluster_id=data.get("from_cluster_id"),
            to_cluster_id=data.get("to_cluster_id"),
            tags=data.get("tags", []),
            reason=data.get("reason", ""),
            created_at=datetime.fromisoformat(data["created_at"])
        )


@dataclass
class OverrideRule:
    ticket_id: str
    target_cluster_id: Optional[int] = None
    is_ignored: bool = False
    is_false_positive: bool = False
    tags: List[str] = field(default_factory=list)
    notes: str = ""
    last_updated: datetime = field(default_factory=datetime.now)


class FeedbackStore:
    def __init__(self, config: Config):
        self.config = config
        self.feedbacks: List[Feedback] = []
        self.overrides: Dict[str, OverrideRule] = {}
        self._load()
    
    def _load(self):
        feedback_path = self.config.get_feedback_path()
        if not feedback_path.exists():
            return
        
        try:
            with open(feedback_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            self.feedbacks = [Feedback.from_dict(fb) for fb in data.get("feedbacks", [])]
            
            overrides_data = data.get("overrides", {})
            for ticket_id, rule_data in overrides_data.items():
                self.overrides[ticket_id] = OverrideRule(
                    ticket_id=ticket_id,
                    target_cluster_id=rule_data.get("target_cluster_id"),
                    is_ignored=rule_data.get("is_ignored", False),
                    is_false_positive=rule_data.get("is_false_positive", False),
                    tags=rule_data.get("tags", []),
                    notes=rule_data.get("notes", ""),
                    last_updated=datetime.fromisoformat(rule_data["last_updated"])
                )
        except Exception:
            self.feedbacks = []
            self.overrides = {}
    
    def _save(self):
        feedback_path = self.config.get_feedback_path()
        feedback_path.parent.mkdir(exist_ok=True)
        
        data = {
            "feedbacks": [fb.to_dict() for fb in self.feedbacks],
            "overrides": {}
        }
        
        for ticket_id, rule in self.overrides.items():
            data["overrides"][ticket_id] = {
                "ticket_id": rule.ticket_id,
                "target_cluster_id": rule.target_cluster_id,
                "is_ignored": rule.is_ignored,
                "is_false_positive": rule.is_false_positive,
                "tags": rule.tags,
                "notes": rule.notes,
                "last_updated": rule.last_updated.isoformat()
            }
        
        with open(feedback_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def add_feedback(self, feedback: Feedback) -> Feedback:
        self.feedbacks.append(feedback)
        self._apply_feedback(feedback)
        self._save()
        return feedback
    
    def _apply_feedback(self, feedback: Feedback):
        if feedback.ticket_id:
            if feedback.ticket_id not in self.overrides:
                self.overrides[feedback.ticket_id] = OverrideRule(
                    ticket_id=feedback.ticket_id
                )
            
            rule = self.overrides[feedback.ticket_id]
            rule.last_updated = datetime.now()
            
            if feedback.feedback_type == FeedbackType.MOVE:
                rule.target_cluster_id = feedback.to_cluster_id
            elif feedback.feedback_type == FeedbackType.FALSE_POSITIVE:
                rule.is_false_positive = True
            elif feedback.feedback_type == FeedbackType.TAG:
                for tag in feedback.tags:
                    if tag not in rule.tags:
                        rule.tags.append(tag)
            
            if feedback.reason:
                if rule.notes:
                    rule.notes += f"\n{feedback.reason}"
                else:
                    rule.notes = feedback.reason
    
    def merge_tickets(
        self,
        ticket_id: str,
        from_cluster_id: int,
        to_cluster_id: int,
        reason: str = ""
    ) -> Feedback:
        feedback_id = f"merge_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        feedback = Feedback(
            feedback_id=feedback_id,
            feedback_type=FeedbackType.MERGE,
            ticket_id=ticket_id,
            from_cluster_id=from_cluster_id,
            to_cluster_id=to_cluster_id,
            reason=reason
        )
        return self.add_feedback(feedback)
    
    def split_ticket(
        self,
        ticket_id: str,
        from_cluster_id: int,
        reason: str = ""
    ) -> Feedback:
        feedback_id = f"split_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        feedback = Feedback(
            feedback_id=feedback_id,
            feedback_type=FeedbackType.SPLIT,
            ticket_id=ticket_id,
            from_cluster_id=from_cluster_id,
            reason=reason
        )
        return self.add_feedback(feedback)
    
    def tag_cluster(
        self,
        cluster_id: int,
        tags: List[str],
        reason: str = ""
    ) -> Feedback:
        feedback_id = f"tag_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        feedback = Feedback(
            feedback_id=feedback_id,
            feedback_type=FeedbackType.TAG,
            from_cluster_id=cluster_id,
            tags=tags,
            reason=reason
        )
        return self.add_feedback(feedback)
    
    def mark_false_positive(
        self,
        ticket_id: str,
        cluster_id: int,
        reason: str = ""
    ) -> Feedback:
        feedback_id = f"fp_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        feedback = Feedback(
            feedback_id=feedback_id,
            feedback_type=FeedbackType.FALSE_POSITIVE,
            ticket_id=ticket_id,
            from_cluster_id=cluster_id,
            reason=reason
        )
        return self.add_feedback(feedback)
    
    def move_ticket(
        self,
        ticket_id: str,
        from_cluster_id: int,
        to_cluster_id: int,
        reason: str = ""
    ) -> Feedback:
        feedback_id = f"move_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        feedback = Feedback(
            feedback_id=feedback_id,
            feedback_type=FeedbackType.MOVE,
            ticket_id=ticket_id,
            from_cluster_id=from_cluster_id,
            to_cluster_id=to_cluster_id,
            reason=reason
        )
        return self.add_feedback(feedback)
    
    def get_override(self, ticket_id: str) -> Optional[OverrideRule]:
        return self.overrides.get(ticket_id)
    
    def get_ignored_tickets(self) -> Set[str]:
        return {
            ticket_id for ticket_id, rule in self.overrides.items()
            if rule.is_ignored or rule.is_false_positive
        }
    
    def get_forced_clusters(self) -> Dict[int, List[str]]:
        result: Dict[int, List[str]] = {}
        for ticket_id, rule in self.overrides.items():
            if rule.target_cluster_id is not None:
                if rule.target_cluster_id not in result:
                    result[rule.target_cluster_id] = []
                result[rule.target_cluster_id].append(ticket_id)
        return result
    
    def get_ticket_tags(self, ticket_id: str) -> List[str]:
        rule = self.overrides.get(ticket_id)
        if rule:
            return rule.tags
        return []
    
    def get_recent_feedbacks(self, limit: int = 50) -> List[Feedback]:
        return sorted(self.feedbacks, key=lambda f: f.created_at, reverse=True)[:limit]
    
    def get_cluster_tags(self, cluster_id: int) -> List[str]:
        tags = set()
        for feedback in self.feedbacks:
            if feedback.feedback_type == FeedbackType.TAG and feedback.from_cluster_id == cluster_id:
                tags.update(feedback.tags)
        return list(tags)


def get_feedback_store(config: Config) -> FeedbackStore:
    return FeedbackStore(config)
