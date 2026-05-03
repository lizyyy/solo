"""Geometry calculations for flight path analysis."""

import math
from dataclasses import dataclass
from typing import List, Tuple, Optional
from datetime import time


EARTH_RADIUS_KM = 6371.0
EARTH_RADIUS_M = EARTH_RADIUS_KM * 1000.0


@dataclass
class FlightSegment:
    """Represents a segment between two waypoints."""
    start_index: int
    end_index: int
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float
    start_alt: float
    end_alt: float
    distance_m: float
    bearing_deg: float
    estimated_time_min: float
    
    @property
    def midpoint_lat(self) -> float:
        return (self.start_lat + self.end_lat) / 2
    
    @property
    def midpoint_lon(self) -> float:
        return (self.start_lon + self.end_lon) / 2


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in meters.
    
    Uses the Haversine formula.
    """
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return EARTH_RADIUS_M * c


def initial_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the initial bearing from point 1 to point 2 in degrees (0-360)."""
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    dlon = lon2_rad - lon1_rad
    
    y = math.sin(dlon) * math.cos(lat2_rad)
    x = math.cos(lat1_rad) * math.sin(lat2_rad) - math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(dlon)
    
    bearing_rad = math.atan2(y, x)
    bearing_deg = math.degrees(bearing_rad)
    
    return (bearing_deg + 360) % 360


def point_in_polygon(point: Tuple[float, float], polygon: List[Tuple[float, float]]) -> bool:
    """Check if a point is inside a polygon using the ray casting algorithm.
    
    Args:
        point: (latitude, longitude) tuple
        polygon: List of (latitude, longitude) tuples representing the polygon vertices
    
    Returns:
        True if point is inside or on the boundary of the polygon
    """
    if len(polygon) < 3:
        return False
    
    lat, lon = point
    inside = False
    
    n = len(polygon)
    j = n - 1
    
    for i in range(n):
        vi_lat, vi_lon = polygon[i]
        vj_lat, vj_lon = polygon[j]
        
        if ((vi_lat > lat) != (vj_lat > lat)):
            lon_intersect = (lat - vi_lat) * (vj_lon - vi_lon) / (vj_lat - vi_lat) + vi_lon
            if lon <= lon_intersect:
                inside = not inside
        
        j = i
    
    return inside


def point_on_segment(point: Tuple[float, float], 
                     seg_start: Tuple[float, float], 
                     seg_end: Tuple[float, float], 
                     epsilon: float = 1e-8) -> bool:
    """Check if a point lies on a line segment."""
    lat, lon = point
    s_lat, s_lon = seg_start
    e_lat, e_lon = seg_end
    
    cross_product = (e_lat - s_lat) * (lon - s_lon) - (e_lon - s_lon) * (lat - s_lat)
    if abs(cross_product) > epsilon:
        return False
    
    dot_product = (lat - s_lat) * (e_lat - s_lat) + (lon - s_lon) * (e_lon - s_lon)
    if dot_product < -epsilon:
        return False
    
    squared_length = (e_lat - s_lat) ** 2 + (e_lon - s_lon) ** 2
    if dot_product > squared_length + epsilon:
        return False
    
    return True


def segments_intersect(seg1_start: Tuple[float, float], 
                       seg1_end: Tuple[float, float],
                       seg2_start: Tuple[float, float], 
                       seg2_end: Tuple[float, float],
                       include_endpoints: bool = True) -> bool:
    """Check if two line segments intersect.
    
    Uses orientation-based algorithm.
    """
    def orientation(p: Tuple[float, float], q: Tuple[float, float], r: Tuple[float, float]) -> int:
        val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1])
        if abs(val) < 1e-10:
            return 0
        return 1 if val > 0 else 2
    
    o1 = orientation(seg1_start, seg1_end, seg2_start)
    o2 = orientation(seg1_start, seg1_end, seg2_end)
    o3 = orientation(seg2_start, seg2_end, seg1_start)
    o4 = orientation(seg2_start, seg2_end, seg1_end)
    
    if (o1 != o2 and o3 != o4):
        return True
    
    if include_endpoints:
        if o1 == 0 and point_on_segment(seg2_start, seg1_start, seg1_end):
            return True
        if o2 == 0 and point_on_segment(seg2_end, seg1_start, seg1_end):
            return True
        if o3 == 0 and point_on_segment(seg1_start, seg2_start, seg2_end):
            return True
        if o4 == 0 and point_on_segment(seg1_end, seg2_start, seg2_end):
            return True
    
    return False


def segment_intersects_polygon(seg_start: Tuple[float, float], 
                                seg_end: Tuple[float, float],
                                polygon: List[Tuple[float, float]]) -> bool:
    """Check if a line segment intersects a polygon.
    
    Returns True if:
    - The segment intersects any edge of the polygon
    - Either endpoint is inside the polygon
    """
    if point_in_polygon(seg_start, polygon):
        return True
    
    if point_in_polygon(seg_end, polygon):
        return True
    
    n = len(polygon)
    for i in range(n):
        j = (i + 1) % n
        edge_start = polygon[i]
        edge_end = polygon[j]
        
        if segments_intersect(seg_start, seg_end, edge_start, edge_end):
            return True
    
    return False


def calculate_flight_segments(waypoints: List['Waypoint'], cruise_speed: float) -> List[FlightSegment]:
    """Calculate flight segments between consecutive waypoints.
    
    Args:
        waypoints: List of waypoints
        cruise_speed: Cruise speed in m/s
    
    Returns:
        List of FlightSegment objects
    """
    segments = []
    
    for i in range(len(waypoints) - 1):
        wp1 = waypoints[i]
        wp2 = waypoints[i + 1]
        
        distance = haversine_distance(wp1.latitude, wp1.longitude, wp2.latitude, wp2.longitude)
        bearing = initial_bearing(wp1.latitude, wp1.longitude, wp2.latitude, wp2.longitude)
        
        estimated_time = distance / cruise_speed / 60
        
        segment = FlightSegment(
            start_index=i,
            end_index=i + 1,
            start_lat=wp1.latitude,
            start_lon=wp1.longitude,
            end_lat=wp2.latitude,
            end_lon=wp2.longitude,
            start_alt=wp1.altitude,
            end_alt=wp2.altitude,
            distance_m=distance,
            bearing_deg=bearing,
            estimated_time_min=estimated_time
        )
        
        segments.append(segment)
    
    return segments


def calculate_total_distance(segments: List[FlightSegment]) -> float:
    """Calculate total flight distance in meters."""
    return sum(seg.distance_m for seg in segments)


def calculate_total_flight_time(segments: List[FlightSegment]) -> float:
    """Calculate total estimated flight time in minutes."""
    return sum(seg.estimated_time_min for seg in segments)
