from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple

from track_cleaner.models.track import Track, TrackPoint
from track_cleaner.models.checkpoint import Checkpoint
from track_cleaner.geo import (
    haversine_distance,
    point_to_line_distance,
    calculate_speed,
)


@dataclass
class DeviationSegment:
    start_point_index: int
    end_point_index: int
    max_deviation_meters: float
    avg_deviation_meters: float
    distance_km: float
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    
    def to_dict(self) -> dict:
        return {
            "start_point_index": self.start_point_index,
            "end_point_index": self.end_point_index,
            "max_deviation_meters": round(self.max_deviation_meters, 1),
            "avg_deviation_meters": round(self.avg_deviation_meters, 1),
            "distance_km": round(self.distance_km, 2),
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
        }


@dataclass
class LongStop:
    start_point_index: int
    end_point_index: int
    duration_seconds: float
    location: Tuple[float, float]
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    
    def to_dict(self) -> dict:
        return {
            "start_point_index": self.start_point_index,
            "end_point_index": self.end_point_index,
            "duration_minutes": round(self.duration_seconds / 60, 1),
            "location": self.location,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
        }


@dataclass
class ComparisonResult:
    planned_track_name: str
    actual_track_name: str
    deviations: List[DeviationSegment] = field(default_factory=list)
    missing_checkpoints: List[Checkpoint] = field(default_factory=list)
    long_stops: List[LongStop] = field(default_factory=list)
    
    def to_dict(self) -> dict:
        return {
            "planned_track_name": self.planned_track_name,
            "actual_track_name": self.actual_track_name,
            "deviation_count": len(self.deviations),
            "deviations": [d.to_dict() for d in self.deviations],
            "missing_checkpoint_count": len(self.missing_checkpoints),
            "missing_checkpoints": [cp.to_dict() for cp in self.missing_checkpoints],
            "long_stop_count": len(self.long_stops),
            "long_stops": [ls.to_dict() for ls in self.long_stops],
        }


def detect_deviations(
    planned_track: Track,
    actual_track: Track,
    deviation_threshold_meters: float = 50.0,
) -> List[DeviationSegment]:
    deviations = []
    planned_points = planned_track.all_points
    actual_points = actual_track.all_points
    
    if len(planned_points) < 2 or len(actual_points) < 2:
        return deviations
    
    in_deviation = False
    dev_start_idx = None
    dev_points = []
    current_deviation_distances = []
    
    for act_idx, act_point in enumerate(actual_points):
        min_distance = None
        
        for i in range(len(planned_points) - 1):
            dist = point_to_line_distance(
                act_point,
                planned_points[i],
                planned_points[i + 1],
            )
            if min_distance is None or dist < min_distance:
                min_distance = dist
        
        if min_distance is None:
            continue
        
        if min_distance > deviation_threshold_meters:
            if not in_deviation:
                in_deviation = True
                dev_start_idx = act_idx
                dev_points = []
                current_deviation_distances = []
            
            dev_points.append(act_idx)
            current_deviation_distances.append(min_distance)
        else:
            if in_deviation and dev_points:
                seg_start_idx = dev_points[0]
                seg_end_idx = act_idx - 1
                
                seg_distance = 0.0
                for i in range(seg_start_idx, seg_end_idx):
                    seg_distance += haversine_distance(
                        actual_points[i],
                        actual_points[i + 1],
                    )
                
                deviation = DeviationSegment(
                    start_point_index=seg_start_idx,
                    end_point_index=seg_end_idx,
                    max_deviation_meters=max(current_deviation_distances),
                    avg_deviation_meters=sum(current_deviation_distances) / len(current_deviation_distances),
                    distance_km=seg_distance / 1000.0,
                    start_time=actual_points[seg_start_idx].timestamp,
                    end_time=actual_points[seg_end_idx].timestamp,
                )
                deviations.append(deviation)
                
                in_deviation = False
                dev_points = []
                current_deviation_distances = []
    
    if in_deviation and dev_points:
        seg_start_idx = dev_points[0]
        seg_end_idx = dev_points[-1]
        
        seg_distance = 0.0
        for i in range(seg_start_idx, seg_end_idx):
            seg_distance += haversine_distance(
                actual_points[i],
                actual_points[i + 1],
            )
        
        deviation = DeviationSegment(
            start_point_index=seg_start_idx,
            end_point_index=seg_end_idx,
            max_deviation_meters=max(current_deviation_distances),
            avg_deviation_meters=sum(current_deviation_distances) / len(current_deviation_distances),
            distance_km=seg_distance / 1000.0,
            start_time=actual_points[seg_start_idx].timestamp,
            end_time=actual_points[seg_end_idx].timestamp,
        )
        deviations.append(deviation)
    
    return deviations


def detect_missing_checkpoints(
    planned_checkpoints: List[Checkpoint],
    actual_checked_checkpoints: List[Checkpoint],
) -> List[Checkpoint]:
    missing = []
    
    for planned in planned_checkpoints:
        found = False
        for actual in actual_checked_checkpoints:
            if (actual.name == planned.name or
                (actual.latitude == planned.latitude and actual.longitude == planned.longitude)):
                if not actual.visited:
                    missing.append(actual)
                found = True
                break
        
        if not found:
            cp = Checkpoint(
                name=planned.name,
                latitude=planned.latitude,
                longitude=planned.longitude,
                elevation=planned.elevation,
                radius_meters=planned.radius_meters,
                visited=False,
            )
            missing.append(cp)
    
    return missing


def detect_long_stops(
    track: Track,
    stop_threshold_minutes: float = 10.0,
    min_speed_kmh: float = 0.5,
) -> List[LongStop]:
    stops = []
    points = track.all_points
    
    in_stop = False
    stop_start_idx = None
    stop_start_time = None
    stop_start_location = None
    
    for idx in range(1, len(points)):
        p1 = points[idx - 1]
        p2 = points[idx]
        
        if p1.timestamp and p2.timestamp:
            time_diff = (p2.timestamp - p1.timestamp).total_seconds()
            speed = calculate_speed(p1, p2)
            
            is_stopped = (speed is None) or (speed < min_speed_kmh)
            
            if is_stopped and time_diff > 60:
                if not in_stop:
                    in_stop = True
                    stop_start_idx = idx - 1
                    stop_start_time = p1.timestamp
                    stop_start_location = (p1.latitude, p1.longitude)
            else:
                if in_stop:
                    stop_end_idx = idx - 1
                    stop_end_time = p1.timestamp
                    
                    if stop_start_time and stop_end_time:
                        duration = (stop_end_time - stop_start_time).total_seconds()
                        
                        if duration >= stop_threshold_minutes * 60:
                            long_stop = LongStop(
                                start_point_index=stop_start_idx,
                                end_point_index=stop_end_idx,
                                duration_seconds=duration,
                                location=stop_start_location if stop_start_location else (p1.latitude, p1.longitude),
                                start_time=stop_start_time,
                                end_time=stop_end_time,
                            )
                            stops.append(long_stop)
                    
                    in_stop = False
                    stop_start_idx = None
                    stop_start_time = None
                    stop_start_location = None
    
    if in_stop and stop_start_time:
        stop_end_idx = len(points) - 1
        stop_end_time = points[-1].timestamp
        
        if stop_end_time:
            duration = (stop_end_time - stop_start_time).total_seconds()
            
            if duration >= stop_threshold_minutes * 60:
                long_stop = LongStop(
                    start_point_index=stop_start_idx if stop_start_idx else 0,
                    end_point_index=stop_end_idx,
                    duration_seconds=duration,
                    location=stop_start_location if stop_start_location else (points[-1].latitude, points[-1].longitude),
                    start_time=stop_start_time,
                    end_time=stop_end_time,
                )
                stops.append(long_stop)
    
    return stops


def compare_tracks(
    planned_track: Track,
    actual_track: Track,
    planned_checkpoints: Optional[List[Checkpoint]] = None,
    deviation_threshold_meters: float = 50.0,
    stop_threshold_minutes: float = 10.0,
    actual_checkpoints: Optional[List[Checkpoint]] = None,
) -> ComparisonResult:
    deviations = detect_deviations(
        planned_track,
        actual_track,
        deviation_threshold_meters,
    )
    
    long_stops = detect_long_stops(
        actual_track,
        stop_threshold_minutes,
    )
    
    missing_checkpoints = []
    if planned_checkpoints and actual_checkpoints:
        missing_checkpoints = detect_missing_checkpoints(
            planned_checkpoints,
            actual_checkpoints,
        )
    
    return ComparisonResult(
        planned_track_name=planned_track.name,
        actual_track_name=actual_track.name,
        deviations=deviations,
        missing_checkpoints=missing_checkpoints,
        long_stops=long_stops,
    )
