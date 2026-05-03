import gpxpy
import gpxpy.gpx
from typing import List, Dict, Optional
from dataclasses import dataclass
from datetime import datetime


@dataclass
class Waypoint:
    lat: float
    lon: float
    elevation: Optional[float] = None
    name: Optional[str] = None
    description: Optional[str] = None


@dataclass
class TrackSegment:
    points: List[Waypoint]
    segment_distance: float = 0.0


class GPXParser:
    def __init__(self):
        self.waypoints: List[Waypoint] = []
        self.track_segments: List[TrackSegment] = []
        self.route_points: List[Waypoint] = []

    def parse(self, file_path: str) -> None:
        with open(file_path, 'r', encoding='utf-8') as f:
            gpx = gpxpy.parse(f)

        self._parse_waypoints(gpx)
        self._parse_tracks(gpx)
        self._parse_routes(gpx)

    def _parse_waypoints(self, gpx: gpxpy.gpx.GPX) -> None:
        for wp in gpx.waypoints:
            self.waypoints.append(Waypoint(
                lat=wp.latitude,
                lon=wp.longitude,
                elevation=wp.elevation,
                name=wp.name,
                description=wp.description
            ))

    def _parse_tracks(self, gpx: gpxpy.gpx.GPX) -> None:
        for track in gpx.tracks:
            for segment in track.segments:
                points = []
                for point in segment.points:
                    points.append(Waypoint(
                        lat=point.latitude,
                        lon=point.longitude,
                        elevation=point.elevation,
                        name=point.name if hasattr(point, 'name') else None
                    ))
                self.track_segments.append(TrackSegment(
                    points=points,
                    segment_distance=segment.length_2d()
                ))

    def _parse_routes(self, gpx: gpxpy.gpx.GPX) -> None:
        for route in gpx.routes:
            for point in route.points:
                self.route_points.append(Waypoint(
                    lat=point.latitude,
                    lon=point.longitude,
                    elevation=point.elevation,
                    name=point.name
                ))

    def get_all_route_points(self) -> List[Waypoint]:
        all_points = []
        for segment in self.track_segments:
            all_points.extend(segment.points)
        if not all_points:
            all_points = self.route_points
        return all_points

    def validate(self) -> List[str]:
        errors = []
        all_points = self.get_all_route_points()
        
        if not all_points:
            errors.append("GPX 文件中未找到路线点")
            return errors

        if len(all_points) < 2:
            errors.append("路线点数量不足，至少需要2个点")

        for i, point in enumerate(all_points):
            if point.elevation is None:
                errors.append(f"第 {i+1} 个点缺少高程数据")

        return errors
