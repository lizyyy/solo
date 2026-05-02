from datetime import datetime
from typing import Optional

import gpxpy
import gpxpy.gpx

from offline_merger.parsers.base_parser import (
    BaseParser,
    FileType,
    ParseResult,
    Track,
    TrackPoint,
    TrackSegment,
    WayPoint,
)


class GPXParser(BaseParser):
    SUPPORTED_EXTENSIONS = ["gpx"]

    def parse(self, file_path: str, source_package: str) -> ParseResult:
        self.clear_errors()
        tracks = []
        waypoints = []

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                gpx = gpxpy.parse(f)

            for gpx_track in gpx.tracks:
                track = Track(name=gpx_track.name or "未命名轨迹", description=gpx_track.description)

                for gpx_segment in gpx_track.segments:
                    segment = TrackSegment()

                    for point in gpx_segment.points:
                        track_point = TrackPoint(
                            lat=point.latitude,
                            lon=point.longitude,
                            elevation=point.elevation,
                            timestamp=point.time,
                            speed=point.speed if hasattr(point, "speed") else None,
                            course=point.course if hasattr(point, "course") else None,
                        )
                        segment.points.append(track_point)

                    track.segments.append(segment)

                tracks.append(track)

            for wpt in gpx.waypoints:
                waypoint = WayPoint(
                    name=wpt.name or "未命名航点",
                    lat=wpt.latitude,
                    lon=wpt.longitude,
                    elevation=wpt.elevation,
                    timestamp=wpt.time,
                    description=wpt.description,
                    symbol=wpt.symbol,
                )
                waypoints.append(waypoint)

        except Exception as e:
            self.add_error(f"解析 GPX 失败: {str(e)}")

        metadata = self._get_file_metadata(
            file_path=file_path,
            source_package=source_package,
            file_type=FileType.GPX,
        )

        return ParseResult(
            metadata=metadata,
            tracks=tracks,
            waypoints=waypoints,
        )
