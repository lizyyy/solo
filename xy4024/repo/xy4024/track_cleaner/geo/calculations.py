import math
from datetime import datetime
from typing import List, Optional, Tuple

from track_cleaner.models.track import TrackPoint, TrackSegment, Track

EARTH_RADIUS_METERS = 6371000.0


def haversine_distance(point1: TrackPoint, point2: TrackPoint) -> float:
    lat1 = math.radians(point1.latitude)
    lon1 = math.radians(point1.longitude)
    lat2 = math.radians(point2.latitude)
    lon2 = math.radians(point2.longitude)
    
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return EARTH_RADIUS_METERS * c


def calculate_speed(point1: TrackPoint, point2: TrackPoint) -> Optional[float]:
    if not point1.timestamp or not point2.timestamp:
        return None
    
    time_diff = (point2.timestamp - point1.timestamp).total_seconds()
    if time_diff <= 0:
        return None
    
    distance = haversine_distance(point1, point2)
    speed_mps = distance / time_diff
    speed_kmh = speed_mps * 3.6
    
    return speed_kmh


def calculate_bearing(point1: TrackPoint, point2: TrackPoint) -> float:
    lat1 = math.radians(point1.latitude)
    lat2 = math.radians(point2.latitude)
    dlon = math.radians(point2.longitude - point1.longitude)
    
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    bearing = math.atan2(y, x)
    
    bearing_deg = (math.degrees(bearing) + 360) % 360
    return bearing_deg


def calculate_total_distance(track: Track) -> float:
    total = 0.0
    points = track.all_points
    
    for i in range(1, len(points)):
        total += haversine_distance(points[i-1], points[i])
    
    return total


def calculate_elevation_gain(track: Track, threshold: float = 5.0) -> float:
    gain = 0.0
    points = track.all_points
    
    for i in range(1, len(points)):
        if points[i].elevation is not None and points[i-1].elevation is not None:
            diff = points[i].elevation - points[i-1].elevation
            if diff > 0 and diff > threshold:
                gain += diff
    
    return gain


def calculate_elevation_loss(track: Track, threshold: float = 5.0) -> float:
    loss = 0.0
    points = track.all_points
    
    for i in range(1, len(points)):
        if points[i].elevation is not None and points[i-1].elevation is not None:
            diff = points[i-1].elevation - points[i].elevation
            if diff > 0 and diff > threshold:
                loss += diff
    
    return loss


def point_to_line_distance(
    point: TrackPoint,
    line_start: TrackPoint,
    line_end: TrackPoint
) -> float:
    if line_start.latitude == line_end.latitude and line_start.longitude == line_end.longitude:
        return haversine_distance(point, line_start)
    
    dx = line_end.latitude - line_start.latitude
    dy = line_end.longitude - line_start.longitude
    t = (
        (point.latitude - line_start.latitude) * dx +
        (point.longitude - line_start.longitude) * dy
    ) / (dx * dx + dy * dy)
    
    if t < 0:
        return haversine_distance(point, line_start)
    elif t > 1:
        return haversine_distance(point, line_end)
    
    proj_lat = line_start.latitude + t * dx
    proj_lon = line_start.longitude + t * dy
    
    proj_point = TrackPoint(latitude=proj_lat, longitude=proj_lon)
    
    return haversine_distance(point, proj_point)


def calculate_moving_time(
    track: Track,
    min_speed_kmh: float = 1.0
) -> Tuple[float, float]:
    total_time = 0.0
    moving_time = 0.0
    points = track.all_points
    
    for i in range(1, len(points)):
        p1 = points[i-1]
        p2 = points[i]
        
        if p1.timestamp and p2.timestamp:
            time_diff = (p2.timestamp - p1.timestamp).total_seconds()
            if time_diff > 0:
                total_time += time_diff
                speed = calculate_speed(p1, p2)
                if speed is not None and speed >= min_speed_kmh:
                    moving_time += time_diff
    
    return total_time, moving_time
