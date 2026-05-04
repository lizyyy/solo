"""
GC Event data model
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any


class GCEventType(Enum):
    YOUNG_GC = "YoungGC"
    FULL_GC = "FullGC"
    MIXED_GC = "MixedGC"
    ZGC_PHASE = "ZGCPhase"
    CONCURRENT_MARK = "ConcurrentMark"
    HUMONGOUS_ALLOCATION = "HumongousAllocation"
    PROMOTION_FAILED = "PromotionFailed"
    ALLOCATION_FAILURE = "AllocationFailure"
    METASPACE_FULL = "MetaspaceFull"


@dataclass
class GCEvent:
    timestamp: datetime
    event_type: GCEventType
    gc_name: str  # G1 Young GC, Full GC, ZGC, etc.
    duration_ms: float
    user_time_ms: float = 0.0
    sys_time_ms: float = 0.0
    real_time_ms: float = 0.0
    
    heap_before_bytes: int = 0
    heap_after_bytes: int = 0
    heap_used_bytes: int = 0
    heap_max_bytes: int = 0
    
    young_before_bytes: int = 0
    young_after_bytes: int = 0
    old_before_bytes: int = 0
    old_after_bytes: int = 0
    
    regions_used: int = 0
    regions_total: int = 0
    
    cause: Optional[str] = None
    is_concurrent: bool = False
    is_stop_the_world: bool = True
    
    extra_info: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def heap_reclaimed_bytes(self) -> int:
        return self.heap_before_bytes - self.heap_after_bytes
    
    @property
    def heap_reclaimed_percent(self) -> float:
        if self.heap_before_bytes == 0:
            return 0.0
        return (self.heap_reclaimed_bytes / self.heap_before_bytes) * 100
    
    @property
    def is_humongous(self) -> bool:
        return self.event_type == GCEventType.HUMONGOUS_ALLOCATION
    
    @property
    def is_promotion_failed(self) -> bool:
        return self.event_type == GCEventType.PROMOTION_FAILED
    
    @property
    def is_full_gc(self) -> bool:
        return self.event_type == GCEventType.FULL_GC
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "event_type": self.event_type.value,
            "gc_name": self.gc_name,
            "duration_ms": self.duration_ms,
            "heap_before_bytes": self.heap_before_bytes,
            "heap_after_bytes": self.heap_after_bytes,
            "heap_max_bytes": self.heap_max_bytes,
            "heap_reclaimed_percent": round(self.heap_reclaimed_percent, 2),
            "cause": self.cause,
            "is_stop_the_world": self.is_stop_the_world,
            "is_humongous": self.is_humongous,
            "is_promotion_failed": self.is_promotion_failed,
            "is_full_gc": self.is_full_gc,
            **self.extra_info
        }
