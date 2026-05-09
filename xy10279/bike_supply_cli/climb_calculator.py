import math
from typing import List, Dict, Any
from .models import GPXPoint, ClimbSegment, RouteProfile


class ClimbCalculator:
    EARTH_RADIUS_KM = 6371.0
    MIN_CLIMB_GAIN = 50.0
    MIN_CLIMB_DISTANCE = 0.5
    MIN_GRADIENT = 2.0

    @classmethod
    def haversine(cls, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_lat / 2) ** 2 +
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return cls.EARTH_RADIUS_KM * c

    @classmethod
    def process_points(cls, raw_points: List[Dict[str, Any]]) -> List[GPXPoint]:
        points = []
        cumulative_dist = 0.0
        
        for i, p in enumerate(raw_points):
            lat = float(p.get("lat", p.get("latitude", 0)))
            lon = float(p.get("lon", p.get("longitude", p.get("lng", 0))))
            ele = float(p.get("elevation", p.get("ele", 0)))
            
            point = GPXPoint(lat=lat, lon=lon, elevation=ele)
            
            if i > 0:
                prev = raw_points[i - 1]
                prev_lat = float(prev.get("lat", prev.get("latitude", 0)))
                prev_lon = float(prev.get("lon", prev.get("longitude", prev.get("lng", 0))))
                segment_dist = cls.haversine(prev_lat, prev_lon, lat, lon)
                cumulative_dist += segment_dist
            
            point.distance = cumulative_dist
            points.append(point)
        
        return points

    @classmethod
    def calculate_profile(cls, points: List[GPXPoint]) -> RouteProfile:
        if not points:
            return RouteProfile()

        total_gain = 0.0
        total_loss = 0.0
        max_ele = points[0].elevation
        min_ele = points[0].elevation
        total_dist = points[-1].distance if points else 0.0

        for i in range(1, len(points)):
            delta = points[i].elevation - points[i - 1].elevation
            if delta > 0:
                total_gain += delta
            else:
                total_loss += abs(delta)
            
            max_ele = max(max_ele, points[i].elevation)
            min_ele = min(min_ele, points[i].elevation)

        climbs = cls._detect_climbs(points)

        return RouteProfile(
            total_distance_km=total_dist,
            total_elevation_gain=total_gain,
            total_elevation_loss=total_loss,
            max_elevation=max_ele,
            min_elevation=min_ele,
            climbs=climbs
        )

    @classmethod
    def _detect_climbs(cls, points: List[GPXPoint]) -> List[ClimbSegment]:
        climbs = []
        
        if len(points) < 10:
            return climbs

        in_climb = False
        climb_start = 0
        
        for i in range(1, len(points)):
            delta_ele = points[i].elevation - points[i - 1].elevation
            delta_dist = points[i].distance - points[i - 1].distance
            
            if delta_dist <= 0:
                continue
            
            gradient = (delta_ele / (delta_dist * 1000)) * 100
            
            if gradient >= cls.MIN_GRADIENT:
                if not in_climb:
                    in_climb = True
                    climb_start = i - 1
            else:
                if in_climb:
                    climb = cls._build_climb(points, climb_start, i)
                    if climb and (climb.elevation_gain >= cls.MIN_CLIMB_GAIN or 
                                  climb.distance_km >= cls.MIN_CLIMB_DISTANCE):
                        climbs.append(climb)
                    in_climb = False
        
        if in_climb:
            climb = cls._build_climb(points, climb_start, len(points))
            if climb and (climb.elevation_gain >= cls.MIN_CLIMB_GAIN or 
                          climb.distance_km >= cls.MIN_CLIMB_DISTANCE):
                climbs.append(climb)
        
        return climbs

    @classmethod
    def _build_climb(cls, points: List[GPXPoint], start_idx: int, end_idx: int) -> ClimbSegment:
        if end_idx - start_idx < 2:
            return None
        
        start = points[start_idx]
        end = points[end_idx - 1]
        
        distance_km = end.distance - start.distance
        elevation_gain = 0.0
        elevation_loss = 0.0
        max_gradient = 0.0
        
        for i in range(start_idx + 1, end_idx):
            delta = points[i].elevation - points[i - 1].elevation
            delta_d = points[i].distance - points[i - 1].distance
            
            if delta > 0:
                elevation_gain += delta
            else:
                elevation_loss += abs(delta)
            
            if delta_d > 0:
                grad = (delta / (delta_d * 1000)) * 100
                max_gradient = max(max_gradient, grad)
        
        avg_gradient = 0.0
        if distance_km > 0:
            avg_gradient = (elevation_gain / (distance_km * 1000)) * 100
        
        return ClimbSegment(
            start_index=start_idx,
            end_index=end_idx - 1,
            distance_km=distance_km,
            elevation_gain=elevation_gain,
            elevation_loss=elevation_loss,
            avg_gradient=avg_gradient,
            max_gradient=max_gradient
        )

    @classmethod
    def profile_to_dict(cls, profile: RouteProfile) -> Dict[str, Any]:
        return {
            "total_distance_km": round(profile.total_distance_km, 2),
            "total_elevation_gain": round(profile.total_elevation_gain, 1),
            "total_elevation_loss": round(profile.total_elevation_loss, 1),
            "max_elevation": round(profile.max_elevation, 1),
            "min_elevation": round(profile.min_elevation, 1),
            "climbs": [
                {
                    "start_index": c.start_index,
                    "end_index": c.end_index,
                    "distance_km": round(c.distance_km, 2),
                    "elevation_gain": round(c.elevation_gain, 1),
                    "elevation_loss": round(c.elevation_loss, 1),
                    "avg_gradient": round(c.avg_gradient, 2),
                    "max_gradient": round(c.max_gradient, 2)
                }
                for c in profile.climbs
            ]
        }
