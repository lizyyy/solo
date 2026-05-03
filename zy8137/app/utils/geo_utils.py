import math
from typing import List, Tuple, Optional
from shapely.geometry import Point, Polygon, LineString
from shapely.wkt import loads as wkt_loads
import pytz
from datetime import datetime, timedelta


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    dlon = lon2_rad - lon1_rad
    dlat = lat2_rad - lat1_rad
    
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def calculate_trajectory_distance(points: List[Tuple[float, float, datetime]]) -> float:
    if len(points) < 2:
        return 0.0
    
    total_distance = 0.0
    for i in range(1, len(points)):
        lat1, lon1, _ = points[i-1]
        lat2, lon2, _ = points[i]
        total_distance += haversine_distance(lat1, lon1, lat2, lon2)
    
    return total_distance


def calculate_area_from_trajectory(points: List[Tuple[float, float]], working_width: float) -> float:
    if len(points) < 2:
        return 0.0
    
    if not working_width or working_width <= 0:
        return 0.0
    
    line = LineString([(lon, lat) for lat, lon in points])
    length_km = line.length * 111.0
    
    working_width_km = working_width / 1000.0
    area_km2 = length_km * working_width_km
    area_mu = area_km2 * 1500
    
    return area_mu


def is_point_in_boundary(lat: float, lon: float, boundary_wkt: Optional[str]) -> bool:
    if not boundary_wkt:
        return False
    
    try:
        polygon = wkt_loads(boundary_wkt)
        point = Point(lon, lat)
        return polygon.contains(point)
    except Exception:
        return False


def detect_overlap(points1: List[Tuple[float, float]], points2: List[Tuple[float, float]], 
                   threshold_meters: float = 5.0) -> float:
    if len(points1) < 2 or len(points2) < 2:
        return 0.0
    
    threshold_km = threshold_meters / 1000.0
    overlap_count = 0
    total_points = 0
    
    for lat1, lon1 in points1:
        total_points += 1
        for lat2, lon2 in points2:
            distance = haversine_distance(lat1, lon1, lat2, lon2)
            if distance <= threshold_km:
                overlap_count += 1
                break
    
    if total_points == 0:
        return 0.0
    
    return overlap_count / total_points


def is_night_time(dt: datetime, night_start: int = 22, night_end: int = 6, 
                  timezone: str = 'Asia/Shanghai') -> bool:
    tz = pytz.timezone(timezone)
    if dt.tzinfo is None:
        dt = tz.localize(dt)
    else:
        dt = dt.astimezone(tz)
    
    hour = dt.hour
    if night_start < night_end:
        return hour >= night_start or hour < night_end
    else:
        return hour >= night_start and hour < night_end


def split_night_day_points(points: List[Tuple[float, float, datetime]], 
                            night_start: int = 22, night_end: int = 6) -> Tuple[List, List]:
    night_points = []
    day_points = []
    
    for lat, lon, dt in points:
        if is_night_time(dt, night_start, night_end):
            night_points.append((lat, lon, dt))
        else:
            day_points.append((lat, lon, dt))
    
    return night_points, day_points


def handle_cross_midnight_trajectory(points: List[Tuple[float, float, datetime]]) -> List[List]:
    if len(points) < 2:
        return [points]
    
    points_sorted = sorted(points, key=lambda x: x[2])
    sessions = []
    current_session = [points_sorted[0]]
    
    for i in range(1, len(points_sorted)):
        prev_dt = points_sorted[i-1][2]
        curr_dt = points_sorted[i][2]
        
        prev_date = prev_dt.date()
        curr_date = curr_dt.date()
        
        if prev_date != curr_date:
            if current_session:
                sessions.append(current_session)
            current_session = [points_sorted[i]]
        else:
            current_session.append(points_sorted[i])
    
    if current_session:
        sessions.append(current_session)
    
    return sessions
