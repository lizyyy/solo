import math
from dataclasses import dataclass
from typing import Tuple

EARTH_RADIUS_M = 6371000.0


@dataclass
class Point:
    lat: float
    lon: float
    
    def to_radians(self) -> Tuple[float, float]:
        return math.radians(self.lat), math.radians(self.lon)
    
    def __repr__(self) -> str:
        return f"Point(lat={self.lat:.6f}, lon={self.lon:.6f})"


def haversine_distance(p1: Point, p2: Point) -> float:
    lat1, lon1 = p1.to_radians()
    lat2, lon2 = p2.to_radians()
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    
    return EARTH_RADIUS_M * c


def bearing(p1: Point, p2: Point) -> float:
    lat1, lon1 = p1.to_radians()
    lat2, lon2 = p2.to_radians()
    
    dlon = lon2 - lon1
    
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    
    theta = math.atan2(y, x)
    return (math.degrees(theta) + 360) % 360


def point_at_bearing_distance(p: Point, bearing_deg: float, distance_m: float) -> Point:
    lat1, lon1 = p.to_radians()
    b_rad = math.radians(bearing_deg)
    angular_dist = distance_m / EARTH_RADIUS_M
    
    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular_dist) +
        math.cos(lat1) * math.sin(angular_dist) * math.cos(b_rad)
    )
    
    lon2 = lon1 + math.atan2(
        math.sin(b_rad) * math.sin(angular_dist) * math.cos(lat1),
        math.cos(angular_dist) - math.sin(lat1) * math.sin(lat2)
    )
    
    return Point(math.degrees(lat2), math.degrees(lon2))


def cross_track_distance(p: Point, line_start: Point, line_end: Point) -> float:
    d13 = haversine_distance(line_start, p)
    brng12 = bearing(line_start, line_end)
    brng13 = bearing(line_start, p)
    
    d13_rad = d13 / EARTH_RADIUS_M
    brng_diff_rad = math.radians(brng13 - brng12)
    
    return abs(EARTH_RADIUS_M * math.asin(math.sin(d13_rad) * math.sin(brng_diff_rad)))


def along_track_distance(p: Point, line_start: Point, line_end: Point) -> float:
    d13 = haversine_distance(line_start, p)
    dxt = cross_track_distance(p, line_start, line_end)
    
    d13_rad = d13 / EARTH_RADIUS_M
    dxt_rad = dxt / EARTH_RADIUS_M
    
    return abs(EARTH_RADIUS_M * math.acos(math.cos(d13_rad) / math.cos(dxt_rad)))


def is_point_on_segment(p: Point, line_start: Point, line_end: Point, tolerance_m: float = 1.0) -> bool:
    d_start = haversine_distance(p, line_start)
    d_end = haversine_distance(p, line_end)
    d_segment = haversine_distance(line_start, line_end)
    
    if abs(d_start + d_end - d_segment) < tolerance_m:
        return True
    
    d_xt = cross_track_distance(p, line_start, line_end)
    if d_xt > tolerance_m:
        return False
    
    d_along = along_track_distance(p, line_start, line_end)
    return d_along <= d_segment + tolerance_m and d_along >= -tolerance_m


def segment_intersection(
    seg1_start: Point, seg1_end: Point,
    seg2_start: Point, seg2_end: Point
) -> Tuple[bool, Point]:
    lat1, lon1 = seg1_start.to_radians()
    lat2, lon2 = seg1_end.to_radians()
    lat3, lon3 = seg2_start.to_radians()
    lat4, lon4 = seg2_end.to_radians()
    
    dlon12 = lon2 - lon1
    dlon34 = lon4 - lon3
    
    def intersectant():
        if lon1 + lon2 == 0:
            lon1_p = lon1
            lon2_p = lon2
        else:
            lon1_p = ((lon1 + lon2) / 2)
            lon2_p = ((lon1 + lon2) / 2)
        
        return None
    
    return False, Point(0, 0)


def project_point_on_segment(p: Point, seg_start: Point, seg_end: Point) -> Point:
    d_segment = haversine_distance(seg_start, seg_end)
    if d_segment < 0.1:
        return seg_start
    
    d_along = along_track_distance(p, seg_start, seg_end)
    
    if d_along <= 0:
        return seg_start
    elif d_along >= d_segment:
        return seg_end
    else:
        brng = bearing(seg_start, seg_end)
        return point_at_bearing_distance(seg_start, brng, d_along)
