"""YAML parser for aircraft capabilities."""

import yaml
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List


@dataclass
class AircraftCapabilities:
    """Represents the capabilities of an aircraft model."""
    model: str
    max_speed: float
    cruise_speed: float
    max_altitude: float
    max_flight_time: float
    range: float
    climb_rate: float
    descent_rate: float
    min_wind_speed: float
    max_wind_speed: float
    max_crosswind: float
    max_gust: float
    min_temperature: float
    max_temperature: float
    min_visibility: float
    max_precipitation: float
    battery_capacity: Optional[float] = None
    payload_capacity: Optional[float] = None
    additional_properties: Dict[str, Any] = field(default_factory=dict)


class AircraftParser:
    """Parser for aircraft capability YAML files."""
    
    def parse(self, file_path: str) -> AircraftCapabilities:
        """Parse aircraft capabilities from a YAML file."""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        return self._parse_aircraft_data(data)
    
    def _parse_aircraft_data(self, data: Dict[str, Any]) -> AircraftCapabilities:
        """Parse the aircraft data dictionary into an AircraftCapabilities object."""
        aircraft = data.get('aircraft', data)
        
        model = aircraft.get('model', 'Unknown')
        
        performance = aircraft.get('performance', {})
        limits = aircraft.get('limits', {})
        weather = aircraft.get('weather_limits', limits.get('weather', {}))
        
        return AircraftCapabilities(
            model=model,
            max_speed=self._get_float(performance, 'max_speed', default=20.0),
            cruise_speed=self._get_float(performance, 'cruise_speed', default=15.0),
            max_altitude=self._get_float(limits, 'max_altitude', default=120.0),
            max_flight_time=self._get_float(limits, 'max_flight_time', default=30.0),
            range=self._get_float(performance, 'range', default=5000.0),
            climb_rate=self._get_float(performance, 'climb_rate', default=3.0),
            descent_rate=self._get_float(performance, 'descent_rate', default=2.0),
            min_wind_speed=self._get_float(weather, 'min_wind_speed', default=0.0),
            max_wind_speed=self._get_float(weather, 'max_wind_speed', default=12.0),
            max_crosswind=self._get_float(weather, 'max_crosswind', default=8.0),
            max_gust=self._get_float(weather, 'max_gust', default=15.0),
            min_temperature=self._get_float(weather, 'min_temperature', default=-10.0),
            max_temperature=self._get_float(weather, 'max_temperature', default=40.0),
            min_visibility=self._get_float(weather, 'min_visibility', default=1000.0),
            max_precipitation=self._get_float(weather, 'max_precipitation', default=0.0),
            battery_capacity=self._get_float(performance, 'battery_capacity'),
            payload_capacity=self._get_float(limits, 'payload_capacity'),
            additional_properties=self._extract_additional_properties(aircraft)
        )
    
    def _get_float(self, data: Dict[str, Any], key: str, default: Optional[float] = None) -> Optional[float]:
        """Get a float value from a dictionary, with optional default."""
        value = data.get(key)
        if value is None:
            return default
        try:
            return float(value)
        except (ValueError, TypeError):
            return default
    
    def _extract_additional_properties(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract any additional properties not explicitly mapped."""
        known_keys = {
            'model', 'performance', 'limits', 'weather_limits',
            'max_speed', 'cruise_speed', 'max_altitude', 'max_flight_time',
            'range', 'climb_rate', 'descent_rate', 'min_wind_speed',
            'max_wind_speed', 'max_crosswind', 'max_gust', 'min_temperature',
            'max_temperature', 'min_visibility', 'max_precipitation',
            'battery_capacity', 'payload_capacity', 'weather'
        }
        
        additional = {}
        for key, value in data.items():
            if key not in known_keys and not isinstance(value, dict):
                additional[key] = value
            elif isinstance(value, dict):
                for sub_key, sub_value in value.items():
                    if sub_key not in known_keys:
                        additional[f"{key}.{sub_key}"] = sub_value
        
        return additional
