"""合并模块"""

from .merger import (
    ConflictDetector,
    WorkOrderMerger,
    ConflictResolver,
    MergeStrategy,
    detect_conflicts,
    merge_tickets,
    resolve_conflict,
    find_duplicate_tickets,
)

__all__ = [
    "ConflictDetector",
    "WorkOrderMerger",
    "ConflictResolver",
    "MergeStrategy",
    "detect_conflicts",
    "merge_tickets",
    "resolve_conflict",
    "find_duplicate_tickets",
]
