from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from offline_merger.config.coordinate_config import (
    CoordinateConverter,
    CoordinatePoint,
    CoordinateSystem,
    calculate_haversine_distance,
)


@dataclass
class DuplicatePoint:
    group_id: str
    points: List[Dict[str, Any]]
    distance_meters: float
    time_delta_seconds: Optional[float]
    suggested_action: str
    message: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "group_id": self.group_id,
            "points": self.points,
            "distance_meters": self.distance_meters,
            "time_delta_seconds": self.time_delta_seconds,
            "suggested_action": self.suggested_action,
            "message": self.message,
        }


@dataclass
class DuplicateValidationResult:
    duplicates: List[DuplicatePoint] = field(default_factory=list)
    groups_count: int = 0
    total_points: int = 0
    duplicate_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "duplicates": [d.to_dict() for d in self.duplicates],
            "groups_count": self.groups_count,
            "total_points": self.total_points,
            "duplicate_count": self.duplicate_count,
        }


@dataclass
class IndexedPoint:
    point_id: str
    lat: float
    lon: float
    elevation: Optional[float]
    timestamp: Optional[datetime]
    source_package: str
    original_data: Dict[str, Any]
    grid_key: str


class DuplicateValidator:
    def __init__(
        self,
        distance_threshold_meters: float = 1.0,
        time_tolerance_seconds: float = 60.0,
    ):
        self.distance_threshold = distance_threshold_meters
        self.time_tolerance = time_tolerance_seconds
        self._points: List[IndexedPoint] = []
        self._grid: Dict[str, List[int]] = {}

    def _calculate_grid_key(self, lat: float, lon: float) -> str:
        grid_size = self.distance_threshold / 111000.0
        grid_lat = int(lat / grid_size)
        grid_lon = int(lon / grid_size)
        return f"{grid_lat}_{grid_lon}"

    def _get_adjacent_grids(self, grid_key: str) -> List[str]:
        parts = grid_key.split("_")
        if len(parts) != 2:
            return [grid_key]

        try:
            lat_idx = int(parts[0])
            lon_idx = int(parts[1])
        except ValueError:
            return [grid_key]

        adjacent = []
        for dlat in (-1, 0, 1):
            for dlon in (-1, 0, 1):
                adjacent.append(f"{lat_idx + dlat}_{lon_idx + dlon}")
        return adjacent

    def add_point(
        self,
        point_id: str,
        lat: float,
        lon: float,
        elevation: Optional[float] = None,
        timestamp: Optional[datetime] = None,
        source_package: str = "",
        original_data: Optional[Dict[str, Any]] = None,
        coordinate_system: CoordinateSystem = CoordinateSystem.WGS84,
    ) -> None:
        point = CoordinatePoint(lat=lat, lon=lon, coordinate_system=coordinate_system)
        wgs84_point = CoordinateConverter.convert(point, CoordinateSystem.WGS84)

        grid_key = self._calculate_grid_key(wgs84_point.lat, wgs84_point.lon)

        indexed_point = IndexedPoint(
            point_id=point_id,
            lat=wgs84_point.lat,
            lon=wgs84_point.lon,
            elevation=elevation,
            timestamp=timestamp,
            source_package=source_package,
            original_data=original_data or {},
            grid_key=grid_key,
        )

        point_index = len(self._points)
        self._points.append(indexed_point)

        if grid_key not in self._grid:
            self._grid[grid_key] = []
        self._grid[grid_key].append(point_index)

    def add_from_parse_result(self, parse_result, source_package: str) -> None:
        for waypoint in parse_result.waypoints:
            self.add_point(
                point_id=f"waypoint_{waypoint.name}",
                lat=waypoint.lat,
                lon=waypoint.lon,
                elevation=waypoint.elevation,
                timestamp=waypoint.timestamp,
                source_package=source_package,
                original_data={
                    "type": "waypoint",
                    "description": waypoint.description,
                    "symbol": waypoint.symbol,
                },
            )

        for point in parse_result.points:
            self.add_point(
                point_id=point.point_id,
                lat=point.lat,
                lon=point.lon,
                elevation=point.elevation,
                timestamp=point.timestamp,
                source_package=source_package,
                original_data={
                    "type": "point",
                    "attributes": point.attributes,
                    "attachments": point.attachments,
                },
            )

    def validate(self) -> DuplicateValidationResult:
        result = DuplicateValidationResult()
        result.total_points = len(self._points)

        visited = set()
        group_counter = 0

        for i, point in enumerate(self._points):
            if i in visited:
                continue

            adjacent_grids = self._get_adjacent_grids(point.grid_key)
            candidates = []

            for grid_key in adjacent_grids:
                if grid_key in self._grid:
                    for idx in self._grid[grid_key]:
                        if idx != i and idx not in visited:
                            candidates.append(idx)

            group = [i]
            min_distance = 0.0
            max_time_delta: Optional[float] = None

            for j in candidates:
                other_point = self._points[j]

                p1 = CoordinatePoint(lat=point.lat, lon=point.lon)
                p2 = CoordinatePoint(lat=other_point.lat, lon=other_point.lon)

                distance = calculate_haversine_distance(p1, p2)

                if distance <= self.distance_threshold:
                    time_delta = None
                    if point.timestamp and other_point.timestamp:
                        time_delta = abs((point.timestamp - other_point.timestamp).total_seconds())

                    if time_delta is None or time_delta <= self.time_tolerance:
                        group.append(j)
                        min_distance = min(min_distance, distance) if min_distance else distance
                        if max_time_delta is None:
                            max_time_delta = time_delta
                        elif time_delta is not None:
                            max_time_delta = max(max_time_delta, time_delta)

            if len(group) > 1:
                group_counter += 1
                group_id = f"dup_{group_counter:04d}"

                group_points = []
                for idx in group:
                    p = self._points[idx]
                    group_points.append({
                        "point_id": p.point_id,
                        "lat": p.lat,
                        "lon": p.lon,
                        "elevation": p.elevation,
                        "timestamp": p.timestamp.isoformat() if p.timestamp else None,
                        "source_package": p.source_package,
                        "original_data": p.original_data,
                    })
                    visited.add(idx)

                suggested_action = self._suggest_action(group_points)

                duplicate = DuplicatePoint(
                    group_id=group_id,
                    points=group_points,
                    distance_meters=min_distance,
                    time_delta_seconds=max_time_delta,
                    suggested_action=suggested_action,
                    message=(
                        f"发现 {len(group_points)} 个重复点位 (距离 {min_distance:.3f} 米)"
                    ),
                )
                result.duplicates.append(duplicate)
                result.duplicate_count += len(group_points)

        result.groups_count = group_counter
        return result

    def _suggest_action(self, group_points: List[Dict[str, Any]]) -> str:
        has_different_sources = len({p["source_package"] for p in group_points}) > 1

        timestamps = [
            p["timestamp"] for p in group_points if p["timestamp"]
        ]

        if len(timestamps) == len(group_points) and not has_different_sources:
            return "keep_latest"

        if has_different_sources:
            return "review_manually"

        return "keep_first"

    def clear(self) -> None:
        self._points.clear()
        self._grid.clear()
