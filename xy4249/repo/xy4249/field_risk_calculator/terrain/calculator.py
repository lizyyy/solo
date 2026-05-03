import math
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from ..parsers.gpx_parser import Waypoint


@dataclass
class RouteSegment:
    segment_id: int
    start_point: Waypoint
    end_point: Waypoint
    distance_2d: float
    distance_3d: float
    elevation_gain: float
    elevation_loss: float
    avg_slope_percent: float
    max_slope_percent: float
    avg_slope_degrees: float
    bearing: float
    estimated_time: float
    water_consumption: float

    @property
    def is_uphill(self) -> bool:
        return self.elevation_gain > self.elevation_loss

    @property
    def slope_category(self) -> str:
        if self.avg_slope_percent < 5:
            return "平缓"
        elif self.avg_slope_percent < 15:
            return "缓坡"
        elif self.avg_slope_percent < 25:
            return "中等坡度"
        elif self.avg_slope_percent < 35:
            return "陡坡"
        else:
            return "极陡坡"


@dataclass
class RouteStatistics:
    total_distance_2d: float
    total_distance_3d: float
    total_elevation_gain: float
    total_elevation_loss: float
    min_elevation: float
    max_elevation: float
    avg_slope_percent: float
    max_slope_percent: float
    segment_count: int
    estimated_total_time: float
    estimated_total_water: float


class TerrainCalculator:
    EARTH_RADIUS = 6371000
    WALKING_SPEED_FLAT = 4.0
    TOBLER_HIKING_PARAM = 6.0

    def __init__(self, walking_speed: float = None, tobler_param: float = None):
        self.walking_speed = walking_speed or self.WALKING_SPEED_FLAT
        self.tobler_param = tobler_param or self.TOBLER_HIKING_PARAM

    def calculate_segments(self, waypoints: List[Waypoint]) -> List[RouteSegment]:
        if len(waypoints) < 2:
            return []

        segments = []
        for i in range(len(waypoints) - 1):
            start = waypoints[i]
            end = waypoints[i + 1]

            distance_2d = self._haversine_distance(
                start.lat, start.lon, end.lat, end.lon
            )

            elevation_start = start.elevation if start.elevation else 0
            elevation_end = end.elevation if end.elevation else 0
            elevation_delta = elevation_end - elevation_start

            distance_3d = math.sqrt(distance_2d ** 2 + elevation_delta ** 2)

            elevation_gain = max(0, elevation_delta)
            elevation_loss = max(0, -elevation_delta)

            if distance_2d > 0:
                avg_slope_percent = (elevation_delta / distance_2d) * 100
                avg_slope_degrees = math.degrees(math.atan(elevation_delta / distance_2d))
            else:
                avg_slope_percent = 0
                avg_slope_degrees = 0

            max_slope_percent = avg_slope_percent

            bearing = self._calculate_bearing(start.lat, start.lon, end.lat, end.lon)

            estimated_time = self._estimate_time(distance_3d, elevation_gain, elevation_loss)

            water_consumption = self._estimate_water(estimated_time, elevation_gain, 25)

            segment = RouteSegment(
                segment_id=i,
                start_point=start,
                end_point=end,
                distance_2d=distance_2d,
                distance_3d=distance_3d,
                elevation_gain=elevation_gain,
                elevation_loss=elevation_loss,
                avg_slope_percent=avg_slope_percent,
                max_slope_percent=max_slope_percent,
                avg_slope_degrees=avg_slope_degrees,
                bearing=bearing,
                estimated_time=estimated_time,
                water_consumption=water_consumption
            )

            segments.append(segment)

        return segments

    def calculate_statistics(self, segments: List[RouteSegment]) -> RouteStatistics:
        if not segments:
            return RouteStatistics(
                total_distance_2d=0,
                total_distance_3d=0,
                total_elevation_gain=0,
                total_elevation_loss=0,
                min_elevation=0,
                max_elevation=0,
                avg_slope_percent=0,
                max_slope_percent=0,
                segment_count=0,
                estimated_total_time=0,
                estimated_total_water=0
            )

        all_elevations = []
        for seg in segments:
            if seg.start_point.elevation:
                all_elevations.append(seg.start_point.elevation)
            if seg.end_point.elevation:
                all_elevations.append(seg.end_point.elevation)

        return RouteStatistics(
            total_distance_2d=sum(s.distance_2d for s in segments),
            total_distance_3d=sum(s.distance_3d for s in segments),
            total_elevation_gain=sum(s.elevation_gain for s in segments),
            total_elevation_loss=sum(s.elevation_loss for s in segments),
            min_elevation=min(all_elevations) if all_elevations else 0,
            max_elevation=max(all_elevations) if all_elevations else 0,
            avg_slope_percent=sum(s.avg_slope_percent for s in segments) / len(segments),
            max_slope_percent=max(abs(s.max_slope_percent) for s in segments),
            segment_count=len(segments),
            estimated_total_time=sum(s.estimated_time for s in segments),
            estimated_total_water=sum(s.water_consumption for s in segments)
        )

    def _haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)

        a = (math.sin(delta_lat / 2) ** 2 +
             math.cos(lat1_rad) * math.cos(lat2_rad) *
             math.sin(delta_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return self.EARTH_RADIUS * c

    def _calculate_bearing(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lon_rad = math.radians(lon2 - lon1)

        y = math.sin(delta_lon_rad) * math.cos(lat2_rad)
        x = (math.cos(lat1_rad) * math.sin(lat2_rad) -
             math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(delta_lon_rad))

        bearing_rad = math.atan2(y, x)
        bearing_deg = math.degrees(bearing_rad)

        return (bearing_deg + 360) % 360

    def _estimate_time(self, distance: float, elevation_gain: float, elevation_loss: float) -> float:
        if distance <= 0:
            return 0

        speed_m_s = self.walking_speed * 1000 / 3600
        base_time = distance / speed_m_s

        gain_factor = elevation_gain / 100
        loss_factor = elevation_loss / 200

        return base_time * (1 + gain_factor + loss_factor) / 3600

    def _estimate_water(self, time_hours: float, elevation_gain: float, temperature: float = 25) -> float:
        base_water = time_hours * 0.5

        temp_factor = max(1.0, 1.0 + (temperature - 20) * 0.02)

        gain_factor = 1.0 + (elevation_gain / 500) * 0.1

        return base_water * temp_factor * gain_factor

    def get_slope_segments(self, segments: List[RouteSegment], min_slope_percent: float = 15) -> List[RouteSegment]:
        return [s for s in segments if abs(s.avg_slope_percent) >= min_slope_percent]

    def get_retreat_points(self, segments: List[RouteSegment], safe_slope_threshold: float = 20) -> List[Dict]:
        retreat_points = []
        cumulative_distance = 0

        for i, segment in enumerate(segments):
            cumulative_distance += segment.distance_2d

            if abs(segment.avg_slope_percent) >= safe_slope_threshold:
                retreat_points.append({
                    'segment_id': segment.segment_id,
                    'location': segment.start_point,
                    'distance_from_start': cumulative_distance - segment.distance_2d,
                    'slope_percent': segment.avg_slope_percent,
                    'reason': f"坡度超过警戒值 ({segment.avg_slope_percent:.1f}%)"
                })

        return retreat_points
