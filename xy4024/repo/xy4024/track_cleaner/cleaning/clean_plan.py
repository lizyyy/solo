from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any, Set

from track_cleaner.models.track import TrackPoint, TrackSegment, Track
from track_cleaner.models.checkpoint import Checkpoint
from track_cleaner.rules.base import RuleResult, AnomalyAction
from track_cleaner.config import AppConfig
from track_cleaner.geo import calculate_speed, haversine_distance


@dataclass
class CleanPlanItem:
    rule_name: str
    rule_description: str
    action: AnomalyAction
    affected_point_indices: List[int]
    severity: str
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        return {
            "rule_name": self.rule_name,
            "rule_description": self.rule_description,
            "action": self.action.value,
            "affected_point_indices": self.affected_point_indices,
            "severity": self.severity,
            "message": self.message,
            "details": self.details,
        }


@dataclass
class CleanPlan:
    original_track: Track
    config: AppConfig
    items: List[CleanPlanItem] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    
    @property
    def points_to_remove(self) -> Set[int]:
        indices = set()
        for item in self.items:
            if item.action == AnomalyAction.REMOVE:
                indices.update(item.affected_point_indices)
        return indices
    
    @property
    def split_indices(self) -> Set[int]:
        indices = set()
        for item in self.items:
            if item.action == AnomalyAction.SPLIT:
                indices.update(item.affected_point_indices)
        return indices
    
    def get_summary(self) -> Dict[str, Any]:
        remove_count = len(self.points_to_remove)
        split_count = len(self.split_indices)
        warn_count = sum(1 for item in self.items if item.action == AnomalyAction.WARN)
        
        by_rule = {}
        for item in self.items:
            if item.rule_name not in by_rule:
                by_rule[item.rule_name] = 0
            by_rule[item.rule_name] += 1
        
        return {
            "original_points": len(self.original_track.all_points),
            "points_to_remove": remove_count,
            "split_points": split_count,
            "warnings": warn_count,
            "by_rule": by_rule,
            "total_issues": len(self.items),
        }
    
    def to_dict(self) -> dict:
        return {
            "track_name": self.original_track.name,
            "created_at": self.created_at.isoformat(),
            "summary": self.get_summary(),
            "items": [item.to_dict() for item in self.items],
        }


@dataclass
class CleanedTrack:
    original_track: Track
    clean_plan: CleanPlan
    segments: List[TrackSegment] = field(default_factory=list)
    
    @property
    def all_points(self) -> List[TrackPoint]:
        points = []
        for segment in self.segments:
            points.extend(segment.points)
        return points
    
    def to_dict(self) -> dict:
        return {
            "original_name": self.original_track.name,
            "clean_plan_summary": self.clean_plan.get_summary(),
            "segments": [s.to_dict() for s in self.segments],
            "total_points": len(self.all_points),
        }


def create_clean_plan(track: Track, config: AppConfig, rule_results: List[RuleResult]) -> CleanPlan:
    plan = CleanPlan(
        original_track=track,
        config=config,
    )
    
    for result in rule_results:
        affected_indices = []
        if result.point_index is not None:
            affected_indices.append(result.point_index)
        
        item = CleanPlanItem(
            rule_name=result.rule_name,
            rule_description=result.rule_description,
            action=result.action,
            affected_point_indices=affected_indices,
            severity=result.severity.value,
            message=result.message,
            details=result.details,
        )
        plan.items.append(item)
    
    return plan


def execute_clean_plan(plan: CleanPlan) -> CleanedTrack:
    points_to_remove = plan.points_to_remove
    split_indices = plan.split_indices
    original_points = plan.original_track.all_points
    
    kept_points = []
    for idx, point in enumerate(original_points):
        if idx not in points_to_remove:
            kept_points.append((idx, point))
    
    if not kept_points:
        return CleanedTrack(
            original_track=plan.original_track,
            clean_plan=plan,
            segments=[],
        )
    
    segments = []
    current_segment_points = []
    
    for idx, point in kept_points:
        if idx in split_indices and current_segment_points:
            segment = TrackSegment(points=current_segment_points.copy())
            segments.append(segment)
            current_segment_points = []
        
        current_segment_points.append(point)
    
    if current_segment_points:
        segment = TrackSegment(points=current_segment_points)
        segments.append(segment)
    
    return CleanedTrack(
        original_track=plan.original_track,
        clean_plan=plan,
        segments=segments,
    )
