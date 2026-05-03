"""GeoJSON parser for no-fly zones and restricted areas."""

import json
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Any, Tuple


class ZoneType(Enum):
    """Type of restricted zone."""
    NO_FLY = "no_fly"
    RESTRICTED_HEIGHT = "restricted_height"
    WARNING = "warning"


@dataclass
class RestrictedZone:
    """Represents a restricted flight zone."""
    id: str
    name: str
    zone_type: ZoneType
    coordinates: List[List[Tuple[float, float]]]
    max_altitude: Optional[float] = None
    min_altitude: Optional[float] = None
    properties: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Point:
    """Simple point representation for calculations."""
    latitude: float
    longitude: float
    
    def to_tuple(self) -> Tuple[float, float]:
        return (self.latitude, self.longitude)


class GeoJSONParser:
    """Parser for GeoJSON files containing restricted zones."""
    
    def parse(self, file_path: str) -> List[RestrictedZone]:
        """Parse restricted zones from a GeoJSON file.
        
        Supports:
        - Polygon features
        - MultiPolygon features
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            geojson_data = json.load(f)
        
        zones = []
        features = geojson_data.get('features', [])
        
        for idx, feature in enumerate(features):
            zone = self._parse_feature(feature, idx)
            if zone:
                zones.append(zone)
        
        return zones
    
    def _parse_feature(self, feature: Dict[str, Any], index: int) -> Optional[RestrictedZone]:
        """Parse a single GeoJSON feature into a RestrictedZone."""
        properties = feature.get('properties', {})
        geometry = feature.get('geometry', {})
        
        if not geometry:
            return None
        
        geom_type = geometry.get('type')
        coords = geometry.get('coordinates', [])
        
        zone_type = self._determine_zone_type(properties)
        
        zone = RestrictedZone(
            id=properties.get('id', f'zone_{index}'),
            name=properties.get('name', f'Restricted Zone {index + 1}'),
            zone_type=zone_type,
            coordinates=self._parse_coordinates(geom_type, coords),
            max_altitude=self._parse_altitude(properties, 'max_altitude'),
            min_altitude=self._parse_altitude(properties, 'min_altitude'),
            properties=properties
        )
        
        return zone
    
    def _determine_zone_type(self, properties: Dict[str, Any]) -> ZoneType:
        """Determine zone type from properties."""
        zone_type_str = properties.get('zone_type', properties.get('type', ''))
        
        zone_type_map = {
            'no_fly': ZoneType.NO_FLY,
            'no-fly': ZoneType.NO_FLY,
            'nofly': ZoneType.NO_FLY,
            'prohibited': ZoneType.NO_FLY,
            'restricted': ZoneType.RESTRICTED_HEIGHT,
            'height_restricted': ZoneType.RESTRICTED_HEIGHT,
            'warning': ZoneType.WARNING,
            'caution': ZoneType.WARNING,
        }
        
        return zone_type_map.get(zone_type_str.lower(), ZoneType.WARNING)
    
    def _parse_altitude(self, properties: Dict[str, Any], key: str) -> Optional[float]:
        """Parse altitude value from properties."""
        value = properties.get(key)
        if value is None:
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    def _parse_coordinates(self, geom_type: str, coords: Any) -> List[List[Tuple[float, float]]]:
        """Parse coordinates based on geometry type.
        
        Returns a list of rings, where each ring is a list of (lat, lon) tuples.
        """
        result = []
        
        if geom_type == 'Polygon':
            for ring in coords:
                parsed_ring = []
                for coord in ring:
                    if len(coord) >= 2:
                        parsed_ring.append((coord[1], coord[0]))
                if parsed_ring:
                    result.append(parsed_ring)
        
        elif geom_type == 'MultiPolygon':
            for polygon in coords:
                for ring in polygon:
                    parsed_ring = []
                    for coord in ring:
                        if len(coord) >= 2:
                            parsed_ring.append((coord[1], coord[0]))
                    if parsed_ring:
                        result.append(parsed_ring)
        
        elif geom_type == 'Point':
            pass
        
        return result
    
    def get_zone_bounds(self, zone: RestrictedZone) -> Tuple[float, float, float, float]:
        """Get the bounding box of a zone: (min_lat, max_lat, min_lon, max_lon)."""
        all_points = []
        for ring in zone.coordinates:
            all_points.extend(ring)
        
        if not all_points:
            return (0.0, 0.0, 0.0, 0.0)
        
        lats = [p[0] for p in all_points]
        lons = [p[1] for p in all_points]
        
        return (min(lats), max(lats), min(lons), max(lons))
