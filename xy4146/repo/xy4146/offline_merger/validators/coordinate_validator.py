from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

from offline_merger.config.coordinate_config import (
    CoordinateConverter,
    CoordinatePoint,
    CoordinateSystem,
)


class CoordinateIssueType(Enum):
    LATITUDE_OUT_OF_RANGE = "latitude_out_of_range"
    LONGITUDE_OUT_OF_RANGE = "longitude_out_of_range"
    BOUNDARY_VIOLATION = "boundary_violation"
    INVALID_VALUE = "invalid_value"


@dataclass
class CoordinateIssue:
    item_type: str
    item_name: str
    issue_type: CoordinateIssueType
    lat: Optional[float]
    lon: Optional[float]
    boundary_min: Optional[Dict[str, float]]
    boundary_max: Optional[Dict[str, float]]
    source_package: str
    message: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "item_type": self.item_type,
            "item_name": self.item_name,
            "issue_type": self.issue_type.value,
            "lat": self.lat,
            "lon": self.lon,
            "boundary_min": self.boundary_min,
            "boundary_max": self.boundary_max,
            "source_package": self.source_package,
            "message": self.message,
        }


@dataclass
class CoordinateValidationResult:
    issues: List[CoordinateIssue] = field(default_factory=list)
    valid_coordinates: int = 0
    total_checked: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "issues": [i.to_dict() for i in self.issues],
            "valid_coordinates": self.valid_coordinates,
            "total_checked": self.total_checked,
        }


@dataclass
class CoordinateBoundary:
    min_lat: float = -90.0
    max_lat: float = 90.0
    min_lon: float = -180.0
    max_lon: float = 180.0


class CoordinateValidator:
    def __init__(self, boundary: Optional[CoordinateBoundary] = None):
        self._boundary = boundary or CoordinateBoundary()
        self._items: List[Dict[str, Any]] = []

    def set_boundary(
        self,
        min_lat: Optional[float] = None,
        max_lat: Optional[float] = None,
        min_lon: Optional[float] = None,
        max_lon: Optional[float] = None,
    ) -> None:
        if min_lat is not None:
            self._boundary.min_lat = min_lat
        if max_lat is not None:
            self._boundary.max_lat = max_lat
        if min_lon is not None:
            self._boundary.min_lon = min_lon
        if max_lon is not None:
            self._boundary.max_lon = max_lon

    def add_coordinate(
        self,
        item_type: str,
        item_name: str,
        lat: float,
        lon: float,
        source_package: str,
        coordinate_system: CoordinateSystem = CoordinateSystem.WGS84,
    ) -> None:
        point = CoordinatePoint(lat=lat, lon=lon, coordinate_system=coordinate_system)
        wgs84_point = CoordinateConverter.convert(point, CoordinateSystem.WGS84)

        self._items.append({
            "item_type": item_type,
            "item_name": item_name,
            "lat": wgs84_point.lat,
            "lon": wgs84_point.lon,
            "original_lat": lat,
            "original_lon": lon,
            "source_package": source_package,
            "original_system": coordinate_system,
        })

    def validate(self) -> CoordinateValidationResult:
        result = CoordinateValidationResult()
        result.total_checked = len(self._items)

        for item in self._items:
            lat = item["lat"]
            lon = item["lon"]
            item_type = item["item_type"]
            item_name = item["item_name"]
            source_package = item["source_package"]

            valid = True

            if lat < -90.0 or lat > 90.0:
                issue = CoordinateIssue(
                    item_type=item_type,
                    item_name=item_name,
                    issue_type=CoordinateIssueType.LATITUDE_OUT_OF_RANGE,
                    lat=lat,
                    lon=lon,
                    boundary_min=None,
                    boundary_max=None,
                    source_package=source_package,
                    message=f"{item_type} '{item_name}' 纬度值超出有效范围 (-90 到 90): {lat}",
                )
                result.issues.append(issue)
                valid = False

            if lon < -180.0 or lon > 180.0:
                issue = CoordinateIssue(
                    item_type=item_type,
                    item_name=item_name,
                    issue_type=CoordinateIssueType.LONGITUDE_OUT_OF_RANGE,
                    lat=lat,
                    lon=lon,
                    boundary_min=None,
                    boundary_max=None,
                    source_package=source_package,
                    message=f"{item_type} '{item_name}' 经度值超出有效范围 (-180 到 180): {lon}",
                )
                result.issues.append(issue)
                valid = False

            if (
                lat < self._boundary.min_lat
                or lat > self._boundary.max_lat
                or lon < self._boundary.min_lon
                or lon > self._boundary.max_lon
            ):
                issue = CoordinateIssue(
                    item_type=item_type,
                    item_name=item_name,
                    issue_type=CoordinateIssueType.BOUNDARY_VIOLATION,
                    lat=lat,
                    lon=lon,
                    boundary_min={
                        "lat": self._boundary.min_lat,
                        "lon": self._boundary.min_lon,
                    },
                    boundary_max={
                        "lat": self._boundary.max_lat,
                        "lon": self._boundary.max_lon,
                    },
                    source_package=source_package,
                    message=(
                        f"{item_type} '{item_name}' 坐标超出工作区域边界: "
                        f"({lat:.6f}, {lon:.6f}) 不在 "
                        f"[{self._boundary.min_lat:.6f}, {self._boundary.max_lat:.6f}] x "
                        f"[{self._boundary.min_lon:.6f}, {self._boundary.max_lon:.6f}] 范围内"
                    ),
                )
                result.issues.append(issue)
                valid = False

            if valid:
                result.valid_coordinates += 1

        return result

    def add_from_parse_result(self, parse_result, source_package: str) -> None:
        for track in parse_result.tracks:
            for seg_idx, segment in enumerate(track.segments):
                for pt_idx, point in enumerate(segment.points):
                    if point.lat is not None and point.lon is not None:
                        self.add_coordinate(
                            item_type="轨迹点",
                            item_name=f"{track.name}:段{seg_idx+1}:点{pt_idx+1}",
                            lat=point.lat,
                            lon=point.lon,
                            source_package=source_package,
                        )

        for waypoint in parse_result.waypoints:
            self.add_coordinate(
                item_type="航点",
                item_name=waypoint.name,
                lat=waypoint.lat,
                lon=waypoint.lon,
                source_package=source_package,
            )

        for point in parse_result.points:
            self.add_coordinate(
                item_type="点位",
                item_name=point.point_id,
                lat=point.lat,
                lon=point.lon,
                source_package=source_package,
            )

    def clear(self) -> None:
        self._items.clear()
