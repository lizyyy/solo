from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

from track_cleaner.models.track import Track, TrackPoint, TrackSegment
from track_cleaner.models.checkpoint import Checkpoint
from track_cleaner.geo import (
    calculate_total_distance,
    calculate_elevation_gain,
    calculate_elevation_loss,
    calculate_speed,
    haversine_distance,
)


@dataclass
class TrackSummary:
    track_name: str
    total_distance_km: float
    total_time_hours: float
    moving_time_hours: float
    stopped_time_hours: float
    elevation_gain_m: float
    elevation_loss_m: float
    average_speed_kmh: float
    moving_speed_kmh: float
    point_count: int
    segment_count: int
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    checkpoints: List[Checkpoint] = field(default_factory=list)
    
    def to_dict(self) -> dict:
        return {
            "track_name": self.track_name,
            "total_distance_km": round(self.total_distance_km, 2),
            "total_time_hours": round(self.total_time_hours, 2),
            "moving_time_hours": round(self.moving_time_hours, 2),
            "stopped_time_hours": round(self.stopped_time_hours, 2),
            "elevation_gain_m": round(self.elevation_gain_m, 1),
            "elevation_loss_m": round(self.elevation_loss_m, 1),
            "average_speed_kmh": round(self.average_speed_kmh, 2),
            "moving_speed_kmh": round(self.moving_speed_kmh, 2),
            "point_count": self.point_count,
            "segment_count": self.segment_count,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "checkpoints": [cp.to_dict() for cp in self.checkpoints],
            "checkpoints_visited": sum(1 for cp in self.checkpoints if cp.visited),
            "checkpoints_total": len(self.checkpoints),
        }


def calculate_summary(
    track: Track,
    min_speed_kmh: float = 1.0,
    checkpoints: Optional[List[Checkpoint]] = None,
) -> TrackSummary:
    points = track.all_points
    
    total_distance_m = calculate_total_distance(track)
    total_distance_km = total_distance_m / 1000.0
    
    elevation_gain_m = calculate_elevation_gain(track)
    elevation_loss_m = calculate_elevation_loss(track)
    
    total_time_seconds = 0.0
    moving_time_seconds = 0.0
    
    for i in range(1, len(points)):
        p1 = points[i-1]
        p2 = points[i]
        
        if p1.timestamp and p2.timestamp:
            time_diff = (p2.timestamp - p1.timestamp).total_seconds()
            if time_diff > 0:
                total_time_seconds += time_diff
                speed = calculate_speed(p1, p2)
                if speed is not None and speed >= min_speed_kmh:
                    moving_time_seconds += time_diff
    
    total_time_hours = total_time_seconds / 3600.0 if total_time_seconds > 0 else 0.0
    moving_time_hours = moving_time_seconds / 3600.0 if moving_time_seconds > 0 else 0.0
    stopped_time_hours = total_time_hours - moving_time_hours
    
    average_speed_kmh = total_distance_km / total_time_hours if total_time_hours > 0 else 0.0
    moving_speed_kmh = total_distance_km / moving_time_hours if moving_time_hours > 0 else 0.0
    
    return TrackSummary(
        track_name=track.name,
        total_distance_km=total_distance_km,
        total_time_hours=total_time_hours,
        moving_time_hours=moving_time_hours,
        stopped_time_hours=stopped_time_hours,
        elevation_gain_m=elevation_gain_m,
        elevation_loss_m=elevation_loss_m,
        average_speed_kmh=average_speed_kmh,
        moving_speed_kmh=moving_speed_kmh,
        point_count=len(points),
        segment_count=len(track.segments),
        start_time=track.start_time,
        end_time=track.end_time,
        checkpoints=checkpoints or [],
    )


def check_checkpoints(
    track: Track,
    checkpoints: List[Checkpoint],
) -> List[Checkpoint]:
    points = track.all_points
    result_checkpoints = []
    
    for checkpoint in checkpoints:
        cp_point = TrackPoint(
            latitude=checkpoint.latitude,
            longitude=checkpoint.longitude,
            elevation=checkpoint.elevation,
        )
        
        visited = False
        closest_point_idx = None
        closest_distance = None
        closest_time = None
        
        for idx, point in enumerate(points):
            dist = haversine_distance(cp_point, point)
            
            if closest_distance is None or dist < closest_distance:
                closest_distance = dist
                closest_point_idx = idx
                closest_time = point.timestamp
            
            if dist <= checkpoint.radius_meters:
                visited = True
        
        result_cp = Checkpoint(
            name=checkpoint.name,
            latitude=checkpoint.latitude,
            longitude=checkpoint.longitude,
            elevation=checkpoint.elevation,
            radius_meters=checkpoint.radius_meters,
            planned_time=checkpoint.planned_time,
            visited=visited,
            visited_time=closest_time,
            visited_point_index=closest_point_idx,
            distance_to_checkpoint=closest_distance,
        )
        result_checkpoints.append(result_cp)
    
    return result_checkpoints


def load_checkpoints_from_csv(file_path: Path) -> List[Checkpoint]:
    if not PANDAS_AVAILABLE:
        raise ImportError("pandas 库未安装，请运行: pip install pandas")
    
    df = pd.read_csv(file_path)
    
    checkpoints = []
    
    for idx, row in df.iterrows():
        name = str(row.get("name", row.get("checkpoint", f"Checkpoint_{idx}")))
        lat = float(row["latitude"]) if "latitude" in row.index else float(row.get("lat"))
        lon = float(row["longitude"]) if "longitude" in row.index else float(row.get("lon", row.get("lng")))
        elev = row.get("elevation", row.get("elev", None))
        if elev is not None:
            elev = float(elev)
        radius = float(row.get("radius_meters", row.get("radius", 30.0)))
        
        checkpoint = Checkpoint(
            name=name,
            latitude=lat,
            longitude=lon,
            elevation=elev,
            radius_meters=radius,
        )
        checkpoints.append(checkpoint)
    
    return checkpoints
