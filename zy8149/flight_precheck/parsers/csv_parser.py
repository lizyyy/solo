"""CSV parser for waypoints and weather data."""

import csv
import math
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from typing import List, Optional, Tuple


@dataclass
class Waypoint:
    """Represents a single waypoint in the flight route."""
    id: str
    latitude: float
    longitude: float
    altitude: float
    is_home: bool = False
    is_return_point: bool = False
    estimated_arrival_time: Optional[datetime] = None
    sequence: int = 0


@dataclass
class WeatherData:
    """Represents weather data for a specific time window."""
    start_time: time
    end_time: time
    wind_direction: float
    wind_speed: float
    temperature: float
    visibility: float
    precipitation: float


@dataclass
class WeatherDay:
    """Represents weather data for a full day, handling midnight crossings."""
    date: datetime
    weather_records: List[WeatherData] = field(default_factory=list)
    
    def get_weather_at_time(self, check_time: time) -> Optional[WeatherData]:
        """Get weather data for a specific time, handling midnight crossings."""
        for record in self.weather_records:
            if self._is_time_in_range(check_time, record.start_time, record.end_time):
                return record
        return None
    
    def _is_time_in_range(self, check_time: time, start: time, end: time) -> bool:
        """Check if a time is within a range, handling midnight crossing (start > end)."""
        if start <= end:
            return start <= check_time <= end
        else:
            return check_time >= start or check_time <= end
    
    def get_weather_for_period(self, start_time: time, end_time: time) -> List[WeatherData]:
        """Get all weather records that overlap with a period, handling midnight crossings."""
        overlapping = []
        for record in self.weather_records:
            if self._periods_overlap(start_time, end_time, record.start_time, record.end_time):
                overlapping.append(record)
        return overlapping
    
    def _periods_overlap(self, s1: time, e1: time, s2: time, e2: time) -> bool:
        """Check if two time periods overlap, handling midnight crossings."""
        def to_minutes(t: time) -> int:
            return t.hour * 60 + t.minute
        
        m_s1, m_e1 = to_minutes(s1), to_minutes(e1)
        m_s2, m_e2 = to_minutes(s2), to_minutes(e2)
        
        def overlaps_normal(s_a, e_a, s_b, e_b):
            return s_a <= e_b and s_b <= e_a
        
        if m_s1 <= m_e1 and m_s2 <= m_e2:
            return overlaps_normal(m_s1, m_e1, m_s2, m_e2)
        elif m_s1 > m_e1 and m_s2 <= m_e2:
            return overlaps_normal(m_s1, 1440, m_s2, m_e2) or overlaps_normal(0, m_e1, m_s2, m_e2)
        elif m_s1 <= m_e1 and m_s2 > m_e2:
            return overlaps_normal(m_s1, m_e1, m_s2, 1440) or overlaps_normal(m_s1, m_e1, 0, m_e2)
        else:
            return True


class WaypointParser:
    """Parser for waypoint CSV files."""
    
    def parse(self, file_path: str) -> List[Waypoint]:
        """Parse waypoints from a CSV file.
        
        Expected columns: id, latitude, longitude, altitude, [is_home], [is_return_point], [sequence]
        """
        waypoints = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for idx, row in enumerate(reader):
                waypoint = Waypoint(
                    id=row.get('id', f'WP{idx+1}'),
                    latitude=float(row['latitude']),
                    longitude=float(row['longitude']),
                    altitude=float(row['altitude']),
                    is_home=row.get('is_home', 'false').lower() in ('true', '1', 'yes'),
                    is_return_point=row.get('is_return_point', 'false').lower() in ('true', '1', 'yes'),
                    sequence=int(row.get('sequence', idx + 1)),
                )
                waypoints.append(waypoint)
        
        waypoints.sort(key=lambda wp: wp.sequence)
        return waypoints
    
    def find_home_point(self, waypoints: List[Waypoint]) -> Optional[Waypoint]:
        """Find the home point from the waypoints list."""
        for wp in waypoints:
            if wp.is_home:
                return wp
        return None
    
    def find_return_points(self, waypoints: List[Waypoint]) -> List[Waypoint]:
        """Find all return points from the waypoints list."""
        return [wp for wp in waypoints if wp.is_return_point]


class WeatherParser:
    """Parser for weather CSV files."""
    
    def parse(self, file_path: str, flight_date: Optional[datetime] = None) -> WeatherDay:
        """Parse weather data from a CSV file.
        
        Expected columns: start_time, end_time, wind_direction, wind_speed, temperature, visibility, precipitation
        Time format: HH:MM (24-hour)
        """
        if flight_date is None:
            flight_date = datetime.now()
        
        weather_records = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                start_time = self._parse_time(row['start_time'])
                end_time = self._parse_time(row['end_time'])
                
                weather_record = WeatherData(
                    start_time=start_time,
                    end_time=end_time,
                    wind_direction=float(row['wind_direction']),
                    wind_speed=float(row['wind_speed']),
                    temperature=float(row['temperature']),
                    visibility=float(row['visibility']),
                    precipitation=float(row.get('precipitation', 0)),
                )
                weather_records.append(weather_record)
        
        weather_records.sort(key=lambda r: r.start_time)
        
        return WeatherDay(
            date=flight_date,
            weather_records=weather_records
        )
    
    def _parse_time(self, time_str: str) -> time:
        """Parse a time string in HH:MM format."""
        parts = time_str.strip().split(':')
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
        return time(hour=hour, minute=minute)
