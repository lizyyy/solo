from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass
class TimeOrderIssue:
    track_name: str
    segment_index: int
    point_index: int
    previous_time: Optional[datetime]
    current_time: Optional[datetime]
    time_delta_seconds: Optional[float]
    source_package: str
    message: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "track_name": self.track_name,
            "segment_index": self.segment_index,
            "point_index": self.point_index,
            "previous_time": self.previous_time.isoformat() if self.previous_time else None,
            "current_time": self.current_time.isoformat() if self.current_time else None,
            "time_delta_seconds": self.time_delta_seconds,
            "source_package": self.source_package,
            "message": self.message,
        }


@dataclass
class TimeValidationResult:
    issues: List[TimeOrderIssue] = field(default_factory=list)
    tracks_without_timestamps: List[str] = field(default_factory=list)
    total_tracks_checked: int = 0
    total_points_checked: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "issues": [i.to_dict() for i in self.issues],
            "tracks_without_timestamps": self.tracks_without_timestamps,
            "total_tracks_checked": self.total_tracks_checked,
            "total_points_checked": self.total_points_checked,
        }


class TimeValidator:
    def __init__(self, time_tolerance_seconds: float = 0.0):
        self.time_tolerance_seconds = time_tolerance_seconds
        self._tracks: List[Dict[str, Any]] = []

    def add_track(
        self,
        track_name: str,
        segments: List[List[Dict[str, Any]]],
        source_package: str,
    ) -> None:
        self._tracks.append({
            "track_name": track_name,
            "segments": segments,
            "source_package": source_package,
        })

    def add_track_from_parse_result(self, parse_result, source_package: str) -> None:
        for track in parse_result.tracks:
            segments = []
            for segment in track.segments:
                points = []
                for point in segment.points:
                    points.append({
                        "timestamp": point.timestamp,
                        "lat": point.lat,
                        "lon": point.lon,
                    })
                segments.append(points)

            self.add_track(
                track_name=track.name,
                segments=segments,
                source_package=source_package,
            )

    def validate(self) -> TimeValidationResult:
        result = TimeValidationResult()
        result.total_tracks_checked = len(self._tracks)

        for track in self._tracks:
            track_name = track["track_name"]
            segments = track["segments"]
            source_package = track["source_package"]

            has_any_timestamp = False

            for seg_idx, segment in enumerate(segments):
                prev_time: Optional[datetime] = None

                for point_idx, point in enumerate(segment):
                    current_time = point.get("timestamp")

                    if current_time is not None:
                        has_any_timestamp = True

                    if prev_time is not None and current_time is not None:
                        delta = (current_time - prev_time).total_seconds()

                        if delta < -self.time_tolerance_seconds:
                            issue = TimeOrderIssue(
                                track_name=track_name,
                                segment_index=seg_idx,
                                point_index=point_idx,
                                previous_time=prev_time,
                                current_time=current_time,
                                time_delta_seconds=delta,
                                source_package=source_package,
                                message=(
                                    f"轨迹 '{track_name}' 第 {seg_idx + 1} 段第 {point_idx + 1} 点时间倒序: "
                                    f"{prev_time} -> {current_time} (偏差 {abs(delta):.2f} 秒)"
                                ),
                            )
                            result.issues.append(issue)

                    if current_time is not None:
                        prev_time = current_time

                    result.total_points_checked += 1

            if not has_any_timestamp and segments:
                result.tracks_without_timestamps.append(track_name)

        return result

    def clear(self) -> None:
        self._tracks.clear()
