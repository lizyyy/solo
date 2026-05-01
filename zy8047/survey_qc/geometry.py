"""Geometry layer for survey coverage and spatial calculations."""

import math
from datetime import datetime, timedelta
from typing import Any, Dict, List, Tuple, Union


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def calculate_gsd(altitude_m: float, focal_length_mm: float, sensor_width_mm: float, image_width_px: int) -> float:
    if focal_length_mm <= 0 or sensor_width_mm <= 0 or image_width_px <= 0:
        return 0.0
    pixel_size_mm = sensor_width_mm / image_width_px
    gsd_mm = (altitude_m * pixel_size_mm) / focal_length_mm
    return gsd_mm * 10


def calculate_overlap(photo1: Dict[str, Any], photo2: Dict[str, Any], altitude_m: float, focal_length_mm: float, sensor_width_mm: float, image_width_px: int) -> float:
    if not all(k in photo1 for k in ("latitude", "longitude")) or not all(k in photo2 for k in ("latitude", "longitude")):
        return 0.0
    dist = haversine_distance(
        float(photo1["latitude"]), float(photo1["longitude"]),
        float(photo2["latitude"]), float(photo2["longitude"]),
    )
    footprint_width_m = 2 * altitude_m * math.tan(math.radians(sensor_width_mm / focal_length_mm / 2 * 57.3))
    if footprint_width_m <= 0:
        return 0.0
    overlap_ratio = 1 - (dist / footprint_width_m)
    return max(0.0, min(100.0, overlap_ratio * 100))


def point_in_polygon(lat: float, lon: float, polygon: List[Tuple[float, float]]) -> bool:
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / (yj - yi + 0.0000001) + xi):
            inside = not inside
        j = i
    return inside


def get_line_bbox(line_coords: List[Tuple[float, float]]) -> Tuple[float, float, float, float]:
    if not line_coords:
        return 0.0, 0.0, 0.0, 0.0
    lats = [c[0] for c in line_coords]
    lons = [c[1] for c in line_coords]
    return min(lats), min(lons), max(lats), max(lons)


def is_photo_on_line(photo: Dict[str, Any], line_coords: List[Tuple[float, float]], tolerance_m: float = 50.0) -> bool:
    if not all(k in photo for k in ("latitude", "longitude")):
        return False
    plat, plon = float(photo["latitude"]), float(photo["longitude"])
    minlat, minlon, maxlat, maxlon = get_line_bbox(line_coords)
    if plat < minlat - 0.001 or plat > maxlat + 0.001 or plon < minlon - 0.001 or plon > maxlon + 0.001:
        return False
    min_dist = float("inf")
    for i in range(len(line_coords) - 1):
        p1, p2 = line_coords[i], line_coords[i + 1]
        dist = point_to_segment_distance(plat, plon, p1[0], p1[1], p2[0], p2[1])
        min_dist = min(min_dist, dist)
    return min_dist <= tolerance_m


def point_to_segment_distance(px: float, py: float, x1: float, y1: float, x2: float, y2: float) -> float:
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return haversine_distance(px, py, x1, y1)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
    nearest_lon = x1 + t * dx
    nearest_lat = y1 + t * dy
    return haversine_distance(px, py, nearest_lat, nearest_lon)


class TimeSequenceAnalyzer:
    def __init__(self):
        self.issues: List[Dict[str, Any]] = []

    def check_cross_midnight(self, timestamps: List[datetime], photo_ids: List[str]) -> List[Dict[str, Any]]:
        issues = []
        for i in range(len(timestamps) - 1):
            t1, t2 = timestamps[i], timestamps[i + 1]
            if t2 < t1:
                time_diff = (t1 - t2).total_seconds()
                if time_diff > 3600:
                    issues.append({
                        "photo_id": photo_ids[i + 1],
                        "issue": "CROSS_MIDNIGHT",
                        "severity": "INFO",
                        "message": f"Flight crosses midnight between {t1} and {t2}",
                        "details": {"prev_time": t1.isoformat(), "curr_time": t2.isoformat(), "gap_seconds": time_diff},
                    })
        return issues

    def check_time_gaps(self, timestamps: List[datetime], photo_ids: List[str], expected_interval_sec: float = 2.0) -> List[Dict[str, Any]]:
        issues = []
        for i in range(len(timestamps) - 1):
            diff = (timestamps[i + 1] - timestamps[i]).total_seconds()
            if diff > expected_interval_sec * 5:
                issues.append({
                    "photo_id": photo_ids[i + 1],
                    "issue": "UNUSUAL_TIME_GAP",
                    "severity": "LOW",
                    "message": f"Unusual time gap of {diff:.1f}s between photos",
                    "details": {"gap_seconds": diff, "expected_interval": expected_interval_sec},
                })
        return issues

    def check_disorder(self, timestamps: List[datetime], photo_ids: List[str]) -> List[Dict[str, Any]]:
        issues = []
        for i in range(1, len(timestamps)):
            if timestamps[i] < timestamps[i - 1]:
                issues.append({
                    "photo_id": photo_ids[i],
                    "issue": "TIME_DISORDER",
                    "severity": "MEDIUM",
                    "message": f"Time stamp disorder: {timestamps[i]} before {timestamps[i - 1]}",
                    "details": {"previous_time": timestamps[i - 1].isoformat(), "current_time": timestamps[i].isoformat()},
                })
        return issues
