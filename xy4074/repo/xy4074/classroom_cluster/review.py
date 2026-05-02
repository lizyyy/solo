from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import List, Dict, Any, Optional
from pathlib import Path
import json

from classroom_cluster.models import QuestionCluster, ReviewStatus, generate_id


class ReviewActionType(str, Enum):
    CONFIRM = "confirm"
    MERGE = "merge"
    SPLIT = "split"
    RESOLVE = "resolve"
    DISCARD = "discard"
    ADD_NOTE = "add_note"


@dataclass
class ReviewAction:
    id: str = field(default_factory=generate_id)
    action_type: ReviewActionType = ReviewActionType.CONFIRM
    cluster_id: str = ""
    target_cluster_ids: List[str] = field(default_factory=list)
    notes: str = ""
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["action_type"] = self.action_type.value
        data["timestamp"] = self.timestamp.isoformat()
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ReviewAction":
        timestamp = data.get("timestamp")
        if timestamp:
            timestamp = datetime.fromisoformat(timestamp)
        
        return cls(
            id=data.get("id", generate_id()),
            action_type=ReviewActionType(data.get("action_type", "confirm")),
            cluster_id=data.get("cluster_id", ""),
            target_cluster_ids=data.get("target_cluster_ids", []),
            notes=data.get("notes", ""),
            timestamp=timestamp or datetime.now(),
            metadata=data.get("metadata", {}),
        )


@dataclass
class ReviewSession:
    id: str = field(default_factory=generate_id)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    actions: List[ReviewAction] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "actions": [a.to_dict() for a in self.actions],
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ReviewSession":
        created_at = data.get("created_at")
        if created_at:
            created_at = datetime.fromisoformat(created_at)
        
        updated_at = data.get("updated_at")
        if updated_at:
            updated_at = datetime.fromisoformat(updated_at)
        
        actions_data = data.get("actions", [])
        actions = [ReviewAction.from_dict(a) for a in actions_data]
        
        return cls(
            id=data.get("id", generate_id()),
            created_at=created_at or datetime.now(),
            updated_at=updated_at or datetime.now(),
            actions=actions,
        )


class ReviewManager:
    def __init__(self):
        self._clusters: Dict[str, QuestionCluster] = {}
        self._session: ReviewSession = ReviewSession()
    
    def load_clusters(self, clusters: List[QuestionCluster]) -> None:
        self._clusters = {c.id: c for c in clusters}
    
    def get_clusters(self) -> List[QuestionCluster]:
        return list(self._clusters.values())
    
    def get_cluster(self, cluster_id: str) -> Optional[QuestionCluster]:
        return self._clusters.get(cluster_id)
    
    def get_pending_clusters(self) -> List[QuestionCluster]:
        return [
            c for c in self._clusters.values()
            if c.review_status == ReviewStatus.PENDING
        ]
    
    def confirm_cluster(self, cluster_id: str, notes: str = "") -> bool:
        cluster = self._clusters.get(cluster_id)
        if not cluster:
            return False
        
        cluster.review_status = ReviewStatus.CONFIRMED
        cluster.review_notes = notes
        cluster.review_timestamp = datetime.now()
        
        action = ReviewAction(
            action_type=ReviewActionType.CONFIRM,
            cluster_id=cluster_id,
            notes=notes,
        )
        self._session.actions.append(action)
        self._session.updated_at = datetime.now()
        
        return True
    
    def merge_clusters(
        self,
        source_cluster_ids: List[str],
        notes: str = "",
    ) -> Optional[QuestionCluster]:
        if len(source_cluster_ids) < 2:
            return None
        
        clusters = [self._clusters.get(cid) for cid in source_cluster_ids]
        clusters = [c for c in clusters if c is not None]
        
        if len(clusters) < 2:
            return None
        
        main_cluster = clusters[0]
        
        all_questions: List[str] = []
        for cluster in clusters:
            all_questions.extend(cluster.questions)
        
        all_questions = list(dict.fromkeys(all_questions))
        
        main_cluster.questions = all_questions
        
        for cluster in clusters[1:]:
            cluster.review_status = ReviewStatus.MERGED
            cluster.review_timestamp = datetime.now()
            cluster.metadata["merged_into"] = main_cluster.id
        
        main_cluster.review_status = ReviewStatus.MERGED
        main_cluster.review_notes = notes
        main_cluster.review_timestamp = datetime.now()
        main_cluster.metadata["merged_from"] = [
            c.id for c in clusters[1:]
        ]
        
        action = ReviewAction(
            action_type=ReviewActionType.MERGE,
            cluster_id=main_cluster.id,
            target_cluster_ids=[c.id for c in clusters[1:]],
            notes=notes,
        )
        self._session.actions.append(action)
        self._session.updated_at = datetime.now()
        
        return main_cluster
    
    def split_cluster(
        self,
        cluster_id: str,
        question_groups: List[List[str]],
        notes: str = "",
    ) -> List[QuestionCluster]:
        cluster = self._clusters.get(cluster_id)
        if not cluster:
            return []
        
        if len(question_groups) < 2:
            return []
        
        all_questions = set(cluster.questions)
        specified_questions = set()
        for group in question_groups:
            specified_questions.update(group)
        
        unspecified = all_questions - specified_questions
        
        new_clusters: List[QuestionCluster] = []
        
        for i, question_ids in enumerate(question_groups):
            if not question_ids:
                continue
            
            new_cluster = QuestionCluster(
                representative_question=cluster.representative_question,
                questions=question_ids,
                chapter_id=cluster.chapter_id,
                chapter_title=cluster.chapter_title,
                confidence=cluster.confidence,
                avg_time_start=cluster.avg_time_start,
                metadata={
                    "split_from": cluster_id,
                    "split_index": i,
                },
                review_status=ReviewStatus.SPLIT,
                review_timestamp=datetime.now(),
            )
            self._clusters[new_cluster.id] = new_cluster
            new_clusters.append(new_cluster)
        
        if unspecified:
            remaining_cluster = QuestionCluster(
                representative_question=cluster.representative_question,
                questions=list(unspecified),
                chapter_id=cluster.chapter_id,
                chapter_title=cluster.chapter_title,
                confidence=cluster.confidence,
                avg_time_start=cluster.avg_time_start,
                metadata={
                    "split_remaining": cluster_id,
                },
                review_status=ReviewStatus.SPLIT,
                review_timestamp=datetime.now(),
            )
            self._clusters[remaining_cluster.id] = remaining_cluster
            new_clusters.append(remaining_cluster)
        
        cluster.review_status = ReviewStatus.SPLIT
        cluster.review_notes = notes
        cluster.review_timestamp = datetime.now()
        cluster.metadata["split_into"] = [c.id for c in new_clusters]
        
        action = ReviewAction(
            action_type=ReviewActionType.SPLIT,
            cluster_id=cluster_id,
            target_cluster_ids=[c.id for c in new_clusters],
            notes=notes,
        )
        self._session.actions.append(action)
        self._session.updated_at = datetime.now()
        
        return new_clusters
    
    def resolve_cluster(self, cluster_id: str, notes: str = "") -> bool:
        cluster = self._clusters.get(cluster_id)
        if not cluster:
            return False
        
        cluster.review_status = ReviewStatus.RESOLVED
        cluster.review_notes = notes
        cluster.review_timestamp = datetime.now()
        
        action = ReviewAction(
            action_type=ReviewActionType.RESOLVE,
            cluster_id=cluster_id,
            notes=notes,
        )
        self._session.actions.append(action)
        self._session.updated_at = datetime.now()
        
        return True
    
    def discard_cluster(self, cluster_id: str, notes: str = "") -> bool:
        cluster = self._clusters.get(cluster_id)
        if not cluster:
            return False
        
        cluster.review_status = ReviewStatus.DISCARDED
        cluster.review_notes = notes
        cluster.review_timestamp = datetime.now()
        
        action = ReviewAction(
            action_type=ReviewActionType.DISCARD,
            cluster_id=cluster_id,
            notes=notes,
        )
        self._session.actions.append(action)
        self._session.updated_at = datetime.now()
        
        return True
    
    def add_note(self, cluster_id: str, notes: str) -> bool:
        cluster = self._clusters.get(cluster_id)
        if not cluster:
            return False
        
        if cluster.review_notes:
            cluster.review_notes += "\n" + notes
        else:
            cluster.review_notes = notes
        
        action = ReviewAction(
            action_type=ReviewActionType.ADD_NOTE,
            cluster_id=cluster_id,
            notes=notes,
        )
        self._session.actions.append(action)
        self._session.updated_at = datetime.now()
        
        return True
    
    def get_session(self) -> ReviewSession:
        return self._session
    
    def load_session(self, session: ReviewSession) -> None:
        self._session = session
    
    def get_statistics(self) -> Dict[str, Any]:
        status_counts: Dict[str, int] = {}
        for cluster in self._clusters.values():
            status = cluster.review_status.value
            status_counts[status] = status_counts.get(status, 0) + 1
        
        total_questions = sum(
            len(c.questions) for c in self._clusters.values()
        )
        
        return {
            "total_clusters": len(self._clusters),
            "total_questions": total_questions,
            "status_counts": status_counts,
            "review_actions": len(self._session.actions),
            "session_created_at": self._session.created_at.isoformat(),
            "session_updated_at": self._session.updated_at.isoformat(),
        }
