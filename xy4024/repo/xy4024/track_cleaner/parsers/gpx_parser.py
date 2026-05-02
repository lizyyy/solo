from pathlib import Path
from typing import Optional

try:
    import gpxpy
    import gpxpy.gpx
    GPXPY_AVAILABLE = True
except ImportError:
    GPXPY_AVAILABLE = False

from track_cleaner.parsers.base import TrackParser
from track_cleaner.models.track import TrackPoint, TrackSegment, Track


class GPXParser(TrackParser):
    
    @classmethod
    def supported_extensions(cls) -> list:
        return [".gpx"]
    
    def parse(self, file_path: Path) -> Track:
        if not GPXPY_AVAILABLE:
            raise ImportError("gpxpy 库未安装，请运行: pip install gpxpy")
        
        with open(file_path, "r", encoding="utf-8") as f:
            gpx = gpxpy.parse(f)
        
        track_name = file_path.stem
        if gpx.tracks:
            track_name = gpx.tracks[0].name or track_name
        
        segments = []
        for gpx_track in gpx.tracks:
            for gpx_segment in gpx_track.segments:
                points = []
                for point in gpx_segment.points:
                    tp = TrackPoint(
                        latitude=point.latitude,
                        longitude=point.longitude,
                        elevation=point.elevation,
                        timestamp=point.time,
                    )
                    points.append(tp)
                
                if points:
                    segment = TrackSegment(
                        points=points,
                        name=gpx_track.name,
                    )
                    segments.append(segment)
        
        for gpx_route in gpx.routes:
            points = []
            for point in gpx_route.points:
                tp = TrackPoint(
                    latitude=point.latitude,
                    longitude=point.longitude,
                    elevation=point.elevation,
                    timestamp=point.time,
                )
                points.append(tp)
            
            if points:
                segment = TrackSegment(
                    points=points,
                    name=gpx_route.name or f"Route: {gpx_route.name}",
                )
                segments.append(segment)
        
        waypoint_points = []
        for waypoint in gpx.waypoints:
            tp = TrackPoint(
                latitude=waypoint.latitude,
                longitude=waypoint.longitude,
                elevation=waypoint.elevation,
                timestamp=waypoint.time,
            )
            waypoint_points.append(tp)
        
        if waypoint_points and not segments:
            segment = TrackSegment(
                points=waypoint_points,
                name="Waypoints",
            )
            segments.append(segment)
        
        return Track(
            name=track_name,
            segments=segments,
            source_file=str(file_path),
            source_format="gpx",
        )
