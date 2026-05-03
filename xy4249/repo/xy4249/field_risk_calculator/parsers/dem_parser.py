import csv
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
import math


@dataclass
class DEMPoint:
    lat: float
    lon: float
    elevation: float
    slope: Optional[float] = None
    aspect: Optional[float] = None


class DEMParser:
    def __init__(self):
        self.points: List[DEMPoint] = []
        self.metadata: Dict = {}

    def parse(self, file_path: str) -> None:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                point = DEMPoint(
                    lat=float(row['lat']),
                    lon=float(row['lon']),
                    elevation=float(row['elevation']),
                    slope=float(row['slope']) if 'slope' in row and row['slope'] else None,
                    aspect=float(row['aspect']) if 'aspect' in row and row['aspect'] else None
                )
                self.points.append(point)
        
        if self.points:
            first = self.points[0]
            last = self.points[-1]
            self.metadata = {
                'point_count': len(self.points),
                'min_elevation': min(p.elevation for p in self.points),
                'max_elevation': max(p.elevation for p in self.points),
                'bounds': {
                    'min_lat': min(p.lat for p in self.points),
                    'max_lat': max(p.lat for p in self.points),
                    'min_lon': min(p.lon for p in self.points),
                    'max_lon': max(p.lon for p in self.points)
                }
            }

    def get_elevation_at(self, lat: float, lon: float) -> Optional[float]:
        if not self.points:
            return None
        
        nearest_point = min(
            self.points,
            key=lambda p: self._haversine_distance(lat, lon, p.lat, p.lon)
        )
        
        distance = self._haversine_distance(lat, lon, nearest_point.lat, nearest_point.lon)
        if distance > 1000:
            return None
        
        return nearest_point.elevation

    def _haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6371000
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)

        a = (math.sin(delta_lat / 2) ** 2 +
             math.cos(lat1_rad) * math.cos(lat2_rad) *
             math.sin(delta_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c

    def validate(self) -> List[str]:
        errors = []
        
        if not self.points:
            errors.append("DEM CSV 文件中未找到任何点数据")
            return errors

        if len(self.points) < 2:
            errors.append("DEM 点数量不足，至少需要2个点")

        for i, point in enumerate(self.points):
            if point.elevation < -500 or point.elevation > 9000:
                errors.append(f"第 {i+1} 个点高程值异常: {point.elevation}m")

        return errors
