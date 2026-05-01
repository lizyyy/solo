"""单位换算模块"""

import math
from typing import Optional


class UnitConverter:
    EARTH_RADIUS = 6371000.0
    
    @staticmethod
    def knots_to_ms(knots: float) -> float:
        return knots * 0.514444
    
    @staticmethod
    def ms_to_knots(ms: float) -> float:
        return ms / 0.514444
    
    @staticmethod
    def kg_to_n(kg: float) -> float:
        return kg * 9.80665
    
    @staticmethod
    def n_to_kg(n: float) -> float:
        return n / 9.80665
    
    @staticmethod
    def feet_to_meters(feet: float) -> float:
        return feet * 0.3048
    
    @staticmethod
    def meters_to_feet(meters: float) -> float:
        return meters / 0.3048
    
    @staticmethod
    def fathoms_to_meters(fathoms: float) -> float:
        return fathoms * 1.8288
    
    @staticmethod
    def meters_to_fathoms(meters: float) -> float:
        return meters / 1.8288
    
    @staticmethod
    def degrees_to_radians(degrees: float) -> float:
        return math.radians(degrees)
    
    @staticmethod
    def radians_to_degrees(radians: float) -> float:
        return math.degrees(radians)
    
    @staticmethod
    def lat_lon_to_local(
        lat: float,
        lon: float,
        ref_lat: float,
        ref_lon: float
    ) -> tuple[float, float]:
        d_lat = math.radians(lat - ref_lat)
        d_lon = math.radians(lon - ref_lon)
        
        x = d_lon * math.cos(math.radians(ref_lat)) * UnitConverter.EARTH_RADIUS
        y = d_lat * UnitConverter.EARTH_RADIUS
        
        return x, y
    
    @staticmethod
    def local_to_lat_lon(
        x: float,
        y: float,
        ref_lat: float,
        ref_lon: float
    ) -> tuple[float, float]:
        d_lat = y / UnitConverter.EARTH_RADIUS
        d_lon = x / (UnitConverter.EARTH_RADIUS * math.cos(math.radians(ref_lat)))
        
        lat = ref_lat + math.degrees(d_lat)
        lon = ref_lon + math.degrees(d_lon)
        
        return lat, lon
    
    @staticmethod
    def bearing_to_angle(bearing: float) -> float:
        angle = 90.0 - bearing
        if angle < 0:
            angle += 360.0
        return angle
    
    @staticmethod
    def angle_to_bearing(angle: float) -> float:
        bearing = 90.0 - angle
        if bearing < 0:
            bearing += 360.0
        return bearing


def parse_depth(value: str, allow_negative: bool = True) -> Optional[float]:
    if not value or value.strip() == '':
        return None
    
    value = value.strip().lower()
    
    if 'm' in value:
        value = value.replace('m', '').strip()
    elif 'ft' in value:
        value = value.replace('ft', '').strip()
        try:
            val = float(value)
            return UnitConverter.feet_to_meters(val)
        except ValueError:
            return None
    elif 'fm' in value or 'fathom' in value:
        value = value.replace('fm', '').replace('fathom', '').strip()
        try:
            val = float(value)
            return UnitConverter.fathoms_to_meters(val)
        except ValueError:
            return None
    
    try:
        return float(value)
    except ValueError:
        return None


def parse_tension(value: str) -> Optional[float]:
    if not value or value.strip() == '':
        return None
    
    value = value.strip().lower()
    
    if 'kn' in value or 'kilo' in value:
        value = value.replace('kn', '').replace('kilo', '').replace('n', '').strip()
        try:
            return float(value) * 1000.0
        except ValueError:
            return None
    elif 'kg' in value:
        value = value.replace('kg', '').strip()
        try:
            val = float(value)
            return UnitConverter.kg_to_n(val)
        except ValueError:
            return None
    elif 'n' in value:
        value = value.replace('n', '').strip()
    
    try:
        return float(value)
    except ValueError:
        return None


def parse_length(value: str) -> Optional[float]:
    if not value or value.strip() == '':
        return None
    
    value = value.strip().lower()
    
    if 'm' in value:
        value = value.replace('m', '').strip()
    elif 'ft' in value:
        value = value.replace('ft', '').strip()
        try:
            val = float(value)
            return UnitConverter.feet_to_meters(val)
        except ValueError:
            return None
    
    try:
        return float(value)
    except ValueError:
        return None


def parse_speed(value: str) -> Optional[float]:
    if not value or value.strip() == '':
        return None
    
    value = value.strip().lower()
    
    if 'knot' in value or 'kt' in value:
        value = value.replace('knot', '').replace('kt', '').strip()
        try:
            val = float(value)
            return UnitConverter.knots_to_ms(val)
        except ValueError:
            return None
    elif 'm/s' in value or 'ms' in value:
        value = value.replace('m/s', '').replace('ms', '').strip()
    
    try:
        return float(value)
    except ValueError:
        return None
