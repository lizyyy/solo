from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, Optional


class ConflictResolutionStrategy(Enum):
    PROMPT = "prompt"
    KEEP_LATEST = "keep_latest"
    KEEP_ALL = "keep_all"
    KEEP_FIRST = "keep_first"
    ISOLATE_CONFLICTS = "isolate_conflicts"


@dataclass
class MergeRules:
    conflict_resolution: ConflictResolutionStrategy = ConflictResolutionStrategy.PROMPT
    prefer_latest_modified: bool = True
    auto_resolve_identical: bool = True
    rename_on_conflict: bool = False
    conflict_suffix: str = "_conflict_{source}"
    duplicate_distance_threshold_meters: float = 1.0
    time_tolerance_seconds: float = 1.0
    coordinate_boundary: Optional[Dict[str, float]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conflict_resolution": self.conflict_resolution.value,
            "prefer_latest_modified": self.prefer_latest_modified,
            "auto_resolve_identical": self.auto_resolve_identical,
            "rename_on_conflict": self.rename_on_conflict,
            "conflict_suffix": self.conflict_suffix,
            "duplicate_distance_threshold_meters": self.duplicate_distance_threshold_meters,
            "time_tolerance_seconds": self.time_tolerance_seconds,
            "coordinate_boundary": self.coordinate_boundary,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MergeRules":
        return cls(
            conflict_resolution=ConflictResolutionStrategy(
                data.get("conflict_resolution", "prompt")
            ),
            prefer_latest_modified=data.get("prefer_latest_modified", True),
            auto_resolve_identical=data.get("auto_resolve_identical", True),
            rename_on_conflict=data.get("rename_on_conflict", False),
            conflict_suffix=data.get("conflict_suffix", "_conflict_{source}"),
            duplicate_distance_threshold_meters=data.get(
                "duplicate_distance_threshold_meters", 1.0
            ),
            time_tolerance_seconds=data.get("time_tolerance_seconds", 1.0),
            coordinate_boundary=data.get("coordinate_boundary"),
        )

    @classmethod
    def default(cls) -> "MergeRules":
        return cls()
