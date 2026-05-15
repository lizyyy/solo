from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any


class SampleStatus(Enum):
    CREATED = "created"
    ANALYZED = "analyzed"
    TROUBLESHOOTING = "troubleshooting"
    RESOLVED = "resolved"
    DISCARDED = "discarded"


class TimeoutCategory(Enum):
    NORMAL = "normal"
    WARNING = "warning"
    SEVERE = "severe"
    CRITICAL = "critical"
    TIMEOUT = "timeout"


class FixType(Enum):
    CODE_OPTIMIZATION = "code_optimization"
    CACHE_STRATEGY = "cache_strategy"
    DATABASE_INDEX = "database_index"
    NETWORK_ADJUSTMENT = "network_adjustment"
    CONFIGURATION_TUNING = "configuration_tuning"
    RESOURCE_SCALING = "resource_scaling"
    OTHER = "other"


@dataclass
class DownstreamSegment:
    name: str
    start_time: int
    end_time: int
    duration_ms: int
    status_code: Optional[int] = None
    error: Optional[str] = None
    timeout_bucket: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'name': self.name,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'duration_ms': self.duration_ms,
            'status_code': self.status_code,
            'error': self.error,
            'timeout_bucket': self.timeout_bucket
        }


@dataclass
class TimeBucket:
    bucket_name: str
    min_ms: int
    max_ms: int
    count: int = 0
    sample_ids: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'bucket_name': self.bucket_name,
            'min_ms': self.min_ms,
            'max_ms': self.max_ms,
            'count': self.count,
            'sample_ids': self.sample_ids[:10]
        }


@dataclass
class TimeoutType:
    category: TimeoutCategory
    threshold_ms: int
    description: str
    count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            'category': self.category.value,
            'threshold_ms': self.threshold_ms,
            'description': self.description,
            'count': self.count
        }


@dataclass
class TroubleshootNote:
    note_id: str
    content: str
    author: str
    created_at: datetime = field(default_factory=datetime.now)
    tags: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'note_id': self.note_id,
            'content': self.content,
            'author': self.author,
            'created_at': self.created_at.isoformat(),
            'tags': self.tags
        }


@dataclass
class FixRecord:
    fix_id: str
    description: str
    fix_type: str
    author: str
    created_at: datetime = field(default_factory=datetime.now)
    effectiveness: Optional[str] = None
    applied: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            'fix_id': self.fix_id,
            'description': self.description,
            'fix_type': self.fix_type,
            'author': self.author,
            'created_at': self.created_at.isoformat(),
            'effectiveness': self.effectiveness,
            'applied': self.applied
        }


@dataclass
class RequestSample:
    request_id: str
    api_name: str
    total_time_ms: int
    segments: List[DownstreamSegment]
    status: SampleStatus = SampleStatus.CREATED
    timeout_category: Optional[TimeoutCategory] = None
    slowest_segment: Optional[str] = None
    notes: List[TroubleshootNote] = field(default_factory=list)
    fix_records: List[FixRecord] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'request_id': self.request_id,
            'api_name': self.api_name,
            'total_time_ms': self.total_time_ms,
            'status': self.status.value,
            'timeout_category': self.timeout_category.value if self.timeout_category else None,
            'slowest_segment': self.slowest_segment,
            'segments': [s.to_dict() for s in self.segments],
            'notes': [n.to_dict() for n in self.notes],
            'fix_records': [f.to_dict() for f in self.fix_records],
            'metadata': self.metadata,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
