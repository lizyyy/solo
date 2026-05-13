from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional
from enum import Enum


class OffsetStatus(Enum):
    NORMAL = "normal"
    FUTURE = "future"
    NEEDS_ROLLBACK = "needs_rollback"
    CONSUMER_ONLINE = "consumer_online"
    PARTITION_NOT_FOUND = "partition_not_found"


@dataclass
class Message:
    offset: int
    partition: int
    topic: str
    timestamp: datetime
    content: str = ""
    
    def to_dict(self) -> Dict:
        return {
            'offset': self.offset,
            'partition': self.partition,
            'topic': self.topic,
            'timestamp': self.timestamp.isoformat(),
            'content': self.content
        }


@dataclass
class PartitionInfo:
    topic: str
    partition: int
    current_offset: int
    earliest_offset: int
    latest_offset: int
    messages: List[Message] = field(default_factory=list)
    
    def status(self) -> OffsetStatus:
        if self.current_offset > self.latest_offset:
            return OffsetStatus.FUTURE
        elif self.current_offset < self.earliest_offset:
            return OffsetStatus.NEEDS_ROLLBACK
        else:
            return OffsetStatus.NORMAL
    
    def to_dict(self) -> Dict:
        return {
            'topic': self.topic,
            'partition': self.partition,
            'current_offset': self.current_offset,
            'earliest_offset': self.earliest_offset,
            'latest_offset': self.latest_offset,
            'status': self.status().value
        }


@dataclass
class ConsumerRecord:
    consumer_id: str
    topic: str
    partition: int
    processed_offset: int
    processed_at: datetime
    status: str = "success"
    
    def to_dict(self) -> Dict:
        return {
            'consumer_id': self.consumer_id,
            'topic': self.topic,
            'partition': self.partition,
            'processed_offset': self.processed_offset,
            'processed_at': self.processed_at.isoformat(),
            'status': self.status
        }


@dataclass
class ConsumerInfo:
    consumer_id: str
    group_id: str
    is_online: bool
    last_heartbeat: Optional[datetime] = None
    topics: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        return {
            'consumer_id': self.consumer_id,
            'group_id': self.group_id,
            'is_online': self.is_online,
            'last_heartbeat': self.last_heartbeat.isoformat() if self.last_heartbeat else None,
            'topics': self.topics
        }


@dataclass
class AdjustmentTarget:
    topic: str
    partition: int
    target_offset: int
    reason: str = ""
    
    def to_dict(self) -> Dict:
        return {
            'topic': self.topic,
            'partition': self.partition,
            'target_offset': self.target_offset,
            'reason': self.reason
        }


@dataclass
class AdjustmentResult:
    success: bool
    message: str
    before_offset: Optional[int] = None
    after_offset: Optional[int] = None
    operator: Optional[str] = None
    timestamp: Optional[datetime] = None
    
    def to_dict(self) -> Dict:
        return {
            'success': self.success,
            'message': self.message,
            'before_offset': self.before_offset,
            'after_offset': self.after_offset,
            'operator': self.operator,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }


@dataclass
class VerificationResult:
    topic: str
    partition: int
    expected_offset: int
    actual_offset: int
    is_correct: bool
    message: str
    
    def to_dict(self) -> Dict:
        return {
            'topic': self.topic,
            'partition': self.partition,
            'expected_offset': self.expected_offset,
            'actual_offset': self.actual_offset,
            'is_correct': self.is_correct,
            'message': self.message
        }


@dataclass
class RiskAssessment:
    topic: str
    partition: int
    duplicate_count: int
    missing_count: int
    risk_level: str
    details: str
    
    def to_dict(self) -> Dict:
        return {
            'topic': self.topic,
            'partition': self.partition,
            'duplicate_count': self.duplicate_count,
            'missing_count': self.missing_count,
            'risk_level': self.risk_level,
            'details': self.details
        }
