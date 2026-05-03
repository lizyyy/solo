"""Rule-based calculations for flight compliance checking."""

import math
from dataclasses import dataclass, field
from datetime import time
from enum import Enum
from typing import List, Optional, Dict, Any, Tuple

from flight_precheck.parsers.csv_parser import Waypoint, WeatherDay, WeatherData
from flight_precheck.parsers.geojson_parser import RestrictedZone, ZoneType
from flight_precheck.parsers.yaml_parser import AircraftCapabilities
from flight_precheck.calculators.geometry import (
    FlightSegment,
    haversine_distance,
    initial_bearing,
    point_in_polygon,
    segment_intersects_polygon,
)


class RiskLevel(Enum):
    """Risk level for compliance events."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class RiskCategory(Enum):
    """Category of compliance risk."""
    NO_FLY_ZONE = "no_fly_zone"
    HEIGHT_RESTRICTION = "height_restriction"
    WEATHER_LIMIT = "weather_limit"
    HEADWIND_RANGE = "headwind_range"
    RETURN_POINT = "return_point"
    AIRCRAFT_LIMIT = "aircraft_limit"


@dataclass
class RiskEvent:
    """Represents a compliance risk event."""
    risk_id: str
    category: RiskCategory
    level: RiskLevel
    description: str
    location_lat: Optional[float] = None
    location_lon: Optional[float] = None
    waypoint_id: Optional[str] = None
    segment_index: Optional[int] = None
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_csv_row(self) -> Dict[str, Any]:
        """Convert to CSV row format."""
        return {
            "risk_id": self.risk_id,
            "category": self.category.value,
            "level": self.level.value,
            "description": self.description,
            "location_lat": self.location_lat if self.location_lat is not None else "",
            "location_lon": self.location_lon if self.location_lon is not None else "",
            "waypoint_id": self.waypoint_id if self.waypoint_id is not None else "",
            "segment_index": self.segment_index if self.segment_index is not None else "",
            "details": str(self.details) if self.details else "",
        }


class ComplianceCalculator:
    """Main calculator for flight compliance checking."""
    
    def __init__(self, 
                 waypoints: List[Waypoint],
                 restricted_zones: List[RestrictedZone],
                 aircraft: AircraftCapabilities,
                 weather: WeatherDay,
                 segments: List[FlightSegment]):
        self.waypoints = waypoints
        self.restricted_zones = restricted_zones
        self.aircraft = aircraft
        self.weather = weather
        self.segments = segments
        self.risk_events: List[RiskEvent] = []
        self._risk_counter = 0
    
    def check_all_compliance(self) -> List[RiskEvent]:
        """Run all compliance checks."""
        self.risk_events = []
        self._risk_counter = 0
        
        self._check_no_fly_zones()
        self._check_height_restrictions()
        self._check_weather_limits()
        self._check_headwind_range()
        self._check_return_points()
        self._check_aircraft_limits()
        
        return self.risk_events
    
    def _add_risk(self, 
                  category: RiskCategory,
                  level: RiskLevel,
                  description: str,
                  location_lat: Optional[float] = None,
                  location_lon: Optional[float] = None,
                  waypoint_id: Optional[str] = None,
                  segment_index: Optional[int] = None,
                  details: Optional[Dict[str, Any]] = None) -> RiskEvent:
        """Add a new risk event."""
        self._risk_counter += 1
        risk = RiskEvent(
            risk_id=f"R{self._risk_counter:04d}",
            category=category,
            level=level,
            description=description,
            location_lat=location_lat,
            location_lon=location_lon,
            waypoint_id=waypoint_id,
            segment_index=segment_index,
            details=details or {}
        )
        self.risk_events.append(risk)
        return risk
    
    def _check_no_fly_zones(self):
        """Check for intersections with no-fly zones."""
        for zone in self.restricted_zones:
            if zone.zone_type != ZoneType.NO_FLY:
                continue
            
            for ring in zone.coordinates:
                for wp_idx, wp in enumerate(self.waypoints):
                    point = (wp.latitude, wp.longitude)
                    if point_in_polygon(point, ring):
                        self._add_risk(
                            category=RiskCategory.NO_FLY_ZONE,
                            level=RiskLevel.CRITICAL,
                            description=f"Waypoint {wp.id} is inside no-fly zone: {zone.name}",
                            location_lat=wp.latitude,
                            location_lon=wp.longitude,
                            waypoint_id=wp.id,
                            details={"zone_id": zone.id, "zone_name": zone.name}
                        )
                
                for seg_idx, seg in enumerate(self.segments):
                    seg_start = (seg.start_lat, seg.start_lon)
                    seg_end = (seg.end_lat, seg.end_lon)
                    
                    if segment_intersects_polygon(seg_start, seg_end, ring):
                        self._add_risk(
                            category=RiskCategory.NO_FLY_ZONE,
                            level=RiskLevel.CRITICAL,
                            description=f"Flight segment {seg_idx} intersects no-fly zone: {zone.name}",
                            location_lat=seg.midpoint_lat,
                            location_lon=seg.midpoint_lon,
                            segment_index=seg_idx,
                            details={"zone_id": zone.id, "zone_name": zone.name}
                        )
    
    def _check_height_restrictions(self):
        """Check for height restriction violations."""
        for wp_idx, wp in enumerate(self.waypoints):
            for zone in self.restricted_zones:
                if zone.zone_type != ZoneType.RESTRICTED_HEIGHT:
                    continue
                
                if zone.max_altitude is None:
                    continue
                
                for ring in zone.coordinates:
                    point = (wp.latitude, wp.longitude)
                    if point_in_polygon(point, ring):
                        if wp.altitude > zone.max_altitude:
                            self._add_risk(
                                category=RiskCategory.HEIGHT_RESTRICTION,
                                level=RiskLevel.HIGH,
                                description=f"Waypoint {wp.id} altitude ({wp.altitude}m) exceeds zone limit ({zone.max_altitude}m) in: {zone.name}",
                                location_lat=wp.latitude,
                                location_lon=wp.longitude,
                                waypoint_id=wp.id,
                                details={
                                    "zone_id": zone.id,
                                    "zone_name": zone.name,
                                    "planned_altitude": wp.altitude,
                                    "max_allowed": zone.max_altitude,
                                    "excess": wp.altitude - zone.max_altitude
                                }
                            )
        
        for seg_idx, seg in enumerate(self.segments):
            for zone in self.restricted_zones:
                if zone.zone_type != ZoneType.RESTRICTED_HEIGHT:
                    continue
                
                if zone.max_altitude is None:
                    continue
                
                max_alt = max(seg.start_alt, seg.end_alt)
                if max_alt <= zone.max_altitude:
                    continue
                
                for ring in zone.coordinates:
                    seg_start = (seg.start_lat, seg.start_lon)
                    seg_end = (seg.end_lat, seg.end_lon)
                    
                    if segment_intersects_polygon(seg_start, seg_end, ring):
                        self._add_risk(
                            category=RiskCategory.HEIGHT_RESTRICTION,
                            level=RiskLevel.HIGH,
                            description=f"Flight segment {seg_idx} may exceed altitude limit ({zone.max_altitude}m) in: {zone.name}",
                            location_lat=seg.midpoint_lat,
                            location_lon=seg.midpoint_lon,
                            segment_index=seg_idx,
                            details={
                                "zone_id": zone.id,
                                "zone_name": zone.name,
                                "segment_max_alt": max_alt,
                                "max_allowed": zone.max_altitude
                            }
                        )
        
        for wp_idx, wp in enumerate(self.waypoints):
            if wp.altitude > self.aircraft.max_altitude:
                self._add_risk(
                    category=RiskCategory.AIRCRAFT_LIMIT,
                    level=RiskLevel.HIGH,
                    description=f"Waypoint {wp.id} altitude ({wp.altitude}m) exceeds aircraft max altitude ({self.aircraft.max_altitude}m)",
                    location_lat=wp.latitude,
                    location_lon=wp.longitude,
                    waypoint_id=wp.id,
                    details={
                        "planned_altitude": wp.altitude,
                        "aircraft_max": self.aircraft.max_altitude
                    }
                )
    
    def _check_weather_limits(self):
        """Check weather conditions against aircraft limits."""
        if not self.weather.weather_records:
            self._add_risk(
                category=RiskCategory.WEATHER_LIMIT,
                level=RiskLevel.MEDIUM,
                description="No weather data available for checking",
                details={"note": "Weather compliance cannot be verified"}
            )
            return
        
        current_time_min = 0
        cruise_speed = self.aircraft.cruise_speed
        
        for seg_idx, seg in enumerate(self.segments):
            seg_lat = seg.midpoint_lat
            seg_lon = seg.midpoint_lon
            
            est_hour = int(current_time_min / 60) % 24
            est_min = int(current_time_min % 60)
            check_time = time(hour=est_hour, minute=est_min)
            
            weather = self.weather.get_weather_at_time(check_time)
            
            if weather is None:
                self._add_risk(
                    category=RiskCategory.WEATHER_LIMIT,
                    level=RiskLevel.LOW,
                    description=f"No weather data for segment {seg_idx} at estimated time {check_time.strftime('%H:%M')}",
                    segment_index=seg_idx,
                    location_lat=seg_lat,
                    location_lon=seg_lon
                )
            else:
                if weather.wind_speed > self.aircraft.max_wind_speed:
                    self._add_risk(
                        category=RiskCategory.WEATHER_LIMIT,
                        level=RiskLevel.HIGH,
                        description=f"Wind speed ({weather.wind_speed}m/s) exceeds aircraft limit ({self.aircraft.max_wind_speed}m/s) for segment {seg_idx}",
                        segment_index=seg_idx,
                        location_lat=seg_lat,
                        location_lon=seg_lon,
                        details={
                            "wind_speed": weather.wind_speed,
                            "max_allowed": self.aircraft.max_wind_speed,
                            "time": check_time.strftime('%H:%M')
                        }
                    )
                
                if weather.temperature > self.aircraft.max_temperature:
                    self._add_risk(
                        category=RiskCategory.WEATHER_LIMIT,
                        level=RiskLevel.MEDIUM,
                        description=f"Temperature ({weather.temperature}°C) exceeds aircraft max ({self.aircraft.max_temperature}°C)",
                        segment_index=seg_idx,
                        location_lat=seg_lat,
                        location_lon=seg_lon,
                        details={
                            "temperature": weather.temperature,
                            "max_allowed": self.aircraft.max_temperature
                        }
                    )
                
                if weather.temperature < self.aircraft.min_temperature:
                    self._add_risk(
                        category=RiskCategory.WEATHER_LIMIT,
                        level=RiskLevel.MEDIUM,
                        description=f"Temperature ({weather.temperature}°C) below aircraft min ({self.aircraft.min_temperature}°C)",
                        segment_index=seg_idx,
                        location_lat=seg_lat,
                        location_lon=seg_lon,
                        details={
                            "temperature": weather.temperature,
                            "min_allowed": self.aircraft.min_temperature
                        }
                    )
                
                if weather.visibility < self.aircraft.min_visibility:
                    self._add_risk(
                        category=RiskCategory.WEATHER_LIMIT,
                        level=RiskLevel.HIGH,
                        description=f"Visibility ({weather.visibility}m) below aircraft minimum ({self.aircraft.min_visibility}m)",
                        segment_index=seg_idx,
                        location_lat=seg_lat,
                        location_lon=seg_lon,
                        details={
                            "visibility": weather.visibility,
                            "min_required": self.aircraft.min_visibility
                        }
                    )
                
                if weather.precipitation > self.aircraft.max_precipitation:
                    self._add_risk(
                        category=RiskCategory.WEATHER_LIMIT,
                        level=RiskLevel.HIGH,
                        description=f"Precipitation ({weather.precipitation}mm/hr) exceeds aircraft limit",
                        segment_index=seg_idx,
                        location_lat=seg_lat,
                        location_lon=seg_lon,
                        details={
                            "precipitation": weather.precipitation,
                            "max_allowed": self.aircraft.max_precipitation
                        }
                    )
            
            current_time_min += seg.estimated_time_min
    
    def _check_headwind_range(self):
        """Check range considering headwind component."""
        total_distance = sum(seg.distance_m for seg in self.segments)
        cruise_speed = self.aircraft.cruise_speed
        
        max_headwind_component = 0.0
        effective_range = self.aircraft.range
        
        for seg_idx, seg in enumerate(self.segments):
            current_time_min = sum(s.estimated_time_min for s in self.segments[:seg_idx])
            est_hour = int(current_time_min / 60) % 24
            est_min = int(current_time_min % 60)
            check_time = time(hour=est_hour, minute=est_min)
            
            weather = self.weather.get_weather_at_time(check_time)
            
            if weather:
                track_bearing = seg.bearing_deg
                wind_from = weather.wind_direction
                
                wind_to = (wind_from + 180) % 360
                
                angle_diff = abs(track_bearing - wind_to)
                if angle_diff > 180:
                    angle_diff = 360 - angle_diff
                
                headwind_component = weather.wind_speed * math.cos(math.radians(angle_diff))
                
                if headwind_component > max_headwind_component:
                    max_headwind_component = headwind_component
                
                if headwind_component > 0:
                    effective_ground_speed = cruise_speed - headwind_component
                    if effective_ground_speed > 0:
                        effective_range = min(effective_range, 
                                             self.aircraft.range * (effective_ground_speed / cruise_speed))
                    else:
                        effective_range = 0
        
        if total_distance > effective_range:
            self._add_risk(
                category=RiskCategory.HEADWIND_RANGE,
                level=RiskLevel.CRITICAL,
                description=f"Total distance ({total_distance:.0f}m) exceeds effective range ({effective_range:.0f}m) with headwind",
                details={
                    "total_distance": total_distance,
                    "effective_range": effective_range,
                    "max_headwind": max_headwind_component,
                    "deficit": total_distance - effective_range
                }
            )
        elif total_distance > effective_range * 0.8:
            self._add_risk(
                category=RiskCategory.HEADWIND_RANGE,
                level=RiskLevel.MEDIUM,
                description=f"Total distance ({total_distance:.0f}m) is within 80% of effective range ({effective_range:.0f}m)",
                details={
                    "total_distance": total_distance,
                    "effective_range": effective_range,
                    "utilization": (total_distance / effective_range) * 100
                }
            )
        
        self._add_risk(
            category=RiskCategory.HEADWIND_RANGE,
            level=RiskLevel.INFO,
            description=f"Range analysis: {total_distance:.0f}m / {effective_range:.0f}m ({(total_distance/effective_range*100):.1f}%)",
            details={
                "total_distance": total_distance,
                "effective_range": effective_range,
                "max_headwind_component": max_headwind_component
            }
        )
    
    def _check_return_points(self):
        """Check return point availability and risk."""
        return_points = [wp for wp in self.waypoints if wp.is_return_point]
        home_point = next((wp for wp in self.waypoints if wp.is_home), None)
        
        if not return_points and not home_point:
            self._add_risk(
                category=RiskCategory.RETURN_POINT,
                level=RiskLevel.CRITICAL,
                description="No return points or home point defined in the route",
                details={"issue": "Cannot calculate safe return path"}
            )
            return
        
        if not return_points and home_point:
            self._add_risk(
                category=RiskCategory.RETURN_POINT,
                level=RiskLevel.MEDIUM,
                description="No explicit return points defined, using home point as fallback",
                waypoint_id=home_point.id,
                location_lat=home_point.latitude,
                location_lon=home_point.longitude,
                details={"note": "Home point will be used for return calculations"}
            )
        
        all_return_points = return_points + ([home_point] if home_point and not return_points else [])
        
        for seg_idx, seg in enumerate(self.segments):
            mid_lat = seg.midpoint_lat
            mid_lon = seg.midpoint_lon
            
            min_return_dist = float('inf')
            nearest_return = None
            
            for rp in all_return_points:
                dist = haversine_distance(mid_lat, mid_lon, rp.latitude, rp.longitude)
                if dist < min_return_dist:
                    min_return_dist = dist
                    nearest_return = rp
            
            dist_to_end = sum(s.distance_m for s in self.segments[seg_idx:])
            total_needed = min_return_dist + dist_to_end
            
            if total_needed > self.aircraft.range * 0.7:
                self._add_risk(
                    category=RiskCategory.RETURN_POINT,
                    level=RiskLevel.MEDIUM,
                    description=f"At segment {seg_idx}, return to {nearest_return.id if nearest_return else 'nearest point'} requires {total_needed:.0f}m (>70% of range)",
                    segment_index=seg_idx,
                    location_lat=mid_lat,
                    location_lon=mid_lon,
                    details={
                        "return_distance": min_return_dist,
                        "remaining_distance": dist_to_end,
                        "total_needed": total_needed,
                        "nearest_return": nearest_return.id if nearest_return else None
                    }
                )
    
    def _check_aircraft_limits(self):
        """Check general aircraft capability limits."""
        total_distance = sum(seg.distance_m for seg in self.segments)
        total_time = sum(seg.estimated_time_min for seg in self.segments)
        
        if total_distance > self.aircraft.range:
            self._add_risk(
                category=RiskCategory.AIRCRAFT_LIMIT,
                level=RiskLevel.CRITICAL,
                description=f"Total distance ({total_distance:.0f}m) exceeds aircraft range ({self.aircraft.range:.0f}m)",
                details={
                    "total_distance": total_distance,
                    "aircraft_range": self.aircraft.range,
                    "deficit": total_distance - self.aircraft.range
                }
            )
        
        if total_time > self.aircraft.max_flight_time:
            self._add_risk(
                category=RiskCategory.AIRCRAFT_LIMIT,
                level=RiskLevel.HIGH,
                description=f"Estimated flight time ({total_time:.1f}min) exceeds max flight time ({self.aircraft.max_flight_time}min)",
                details={
                    "estimated_time": total_time,
                    "max_allowed": self.aircraft.max_flight_time
                }
            )
        
        self._add_risk(
            category=RiskCategory.AIRCRAFT_LIMIT,
            level=RiskLevel.INFO,
            description=f"Flight summary: {total_distance:.0f}m, {total_time:.1f}min",
            details={
                "aircraft_model": self.aircraft.model,
                "cruise_speed": self.aircraft.cruise_speed,
                "max_altitude": self.aircraft.max_altitude
            }
        )
