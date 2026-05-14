from datetime import datetime
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class FailureRecord(BaseModel):
    record_id: str
    batch_id: str
    item_id: str
    content_hash: str
    source: str
    content: str
    failure_type: str
    failure_reason: str
    rule_versions: Dict[str, str] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    status_code: Optional[int] = None
    detected_at: datetime = Field(default_factory=datetime.now)
    human_reviewed: bool = False
    review_comment: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "batch_id": self.batch_id,
            "item_id": self.item_id,
            "content_hash": self.content_hash,
            "source": self.source,
            "content": self.content,
            "failure_type": self.failure_type,
            "failure_reason": self.failure_reason,
            "rule_versions": self.rule_versions,
            "metadata": self.metadata,
            "status_code": self.status_code,
            "detected_at": self.detected_at.isoformat(),
            "human_reviewed": self.human_reviewed,
            "review_comment": self.review_comment,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None
        }
