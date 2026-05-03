"""HTML exporter for map preview."""

import json
from typing import List, Tuple, Optional
from datetime import datetime

from flight_precheck.parsers.csv_parser import Waypoint
from flight_precheck.parsers.geojson_parser import RestrictedZone, ZoneType
from flight_precheck.calculators.geometry import FlightSegment
from flight_precheck.calculators.rules import RiskEvent, RiskLevel


class HTMLMapExporter:
    """Exporter for interactive HTML map preview using Leaflet."""
    
    LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    
    ZONE_COLORS = {
        ZoneType.NO_FLY: "#ff0000",
        ZoneType.RESTRICTED_HEIGHT: "#ff9900",
        ZoneType.WARNING: "#ffff00",
    }
    
    ZONE_FILL_OPACITY = {
        ZoneType.NO_FLY: 0.3,
        ZoneType.RESTRICTED_HEIGHT: 0.2,
        ZoneType.WARNING: 0.1,
    }
    
    RISK_MARKER_COLORS = {
        RiskLevel.CRITICAL: "#ff0000",
        RiskLevel.HIGH: "#ff6600",
        RiskLevel.MEDIUM: "#ffcc00",
        RiskLevel.LOW: "#00cc00",
        RiskLevel.INFO: "#0066ff",
    }
    
    def export(self,
               waypoints: List[Waypoint],
               segments: List[FlightSegment],
               restricted_zones: List[RestrictedZone],
               risk_events: List[RiskEvent],
               output_path: str,
               flight_name: str = "Power Inspection Flight") -> None:
        """Export interactive map preview to HTML file.
        
        Args:
            waypoints: List of waypoints
            segments: List of flight segments
            restricted_zones: List of restricted zones
            risk_events: List of risk events
            output_path: Path to output HTML file
            flight_name: Name of the flight
        """
        center_lat, center_lon = self._calculate_center(waypoints, restricted_zones)
        
        html_content = self._generate_html(
            waypoints, segments, restricted_zones, risk_events,
            center_lat, center_lon, flight_name
        )
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
    
    def _calculate_center(self,
                          waypoints: List[Waypoint],
                          restricted_zones: List[RestrictedZone]) -> Tuple[float, float]:
        """Calculate the center point for the map."""
        all_lats = []
        all_lons = []
        
        for wp in waypoints:
            all_lats.append(wp.latitude)
            all_lons.append(wp.longitude)
        
        for zone in restricted_zones:
            for ring in zone.coordinates:
                for lat, lon in ring:
                    all_lats.append(lat)
                    all_lons.append(lon)
        
        if not all_lats:
            return (39.9042, 116.4074)
        
        return (sum(all_lats) / len(all_lats), sum(all_lons) / len(all_lons))
    
    def _generate_html(self,
                       waypoints: List[Waypoint],
                       segments: List[FlightSegment],
                       restricted_zones: List[RestrictedZone],
                       risk_events: List[RiskEvent],
                       center_lat: float,
                       center_lon: float,
                       flight_name: str) -> str:
        """Generate the complete HTML content."""
        waypoints_json = self._waypoints_to_geojson(waypoints)
        segments_json = self._segments_to_geojson(segments, waypoints)
        zones_json = self._zones_to_geojson(restricted_zones)
        risks_json = self._risks_to_geojson(risk_events)
        
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{flight_name} - Map Preview</title>
    <link rel="stylesheet" href="{self.LEAFLET_CSS}" />
    <style>
        html, body {{
            margin: 0;
            padding: 0;
            height: 100%;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }}
        #map {{
            height: calc(100% - 120px);
            width: 100%;
        }}
        .header {{
            background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
            color: white;
            padding: 15px 20px;
            height: 120px;
            box-sizing: border-box;
        }}
        .header h1 {{
            margin: 0 0 8px 0;
            font-size: 1.3rem;
        }}
        .header p {{
            margin: 0;
            font-size: 0.9rem;
            opacity: 0.9;
        }}
        .legend {{
            background: white;
            padding: 10px 15px;
            border-radius: 4px;
            box-shadow: 0 1px 5px rgba(0,0,0,0.4);
            font-size: 12px;
        }}
        .legend-item {{
            display: flex;
            align-items: center;
            margin: 4px 0;
        }}
        .legend-color {{
            width: 20px;
            height: 16px;
            margin-right: 8px;
            border: 1px solid #666;
        }}
        .legend-circle {{
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
            border: 2px solid white;
        }}
        .waypoint-marker {{
            background: #0078d4;
            border: 2px solid white;
            border-radius: 50%;
            text-align: center;
            color: white;
            font-weight: bold;
            font-size: 10px;
            line-height: 24px;
        }}
        .home-marker {{
            background: #00a854;
        }}
        .return-marker {{
            background: #ffaa00;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🛰️ {flight_name}</h1>
        <p>Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        <p>Waypoints: {len(waypoints)} | Segments: {len(segments)} | Zones: {len(restricted_zones)}</p>
    </div>
    <div id="map"></div>
    
    <script src="{self.LEAFLET_JS}"></script>
    <script>
        var map = L.map('map').setView([{center_lat}, {center_lon}], 13);
        
        L.tileLayer('https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png', {{
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }}).addTo(map);
        
        var zonesData = {zones_json};
        var segmentsData = {segments_json};
        var waypointsData = {waypoints_json};
        var risksData = {risks_json};
        
        var zoneLayer = L.geoJSON(zonesData, {{
            style: function(feature) {{
                return {{
                    color: feature.properties.color,
                    weight: 2,
                    fillColor: feature.properties.color,
                    fillOpacity: feature.properties.fillOpacity
                }};
            }},
            onEachFeature: function(feature, layer) {{
                var popupContent = '<strong>' + feature.properties.name + '</strong><br/>';
                popupContent += 'Type: ' + feature.properties.zoneType + '<br/>';
                if (feature.properties.maxAltitude) {{
                    popupContent += 'Max Altitude: ' + feature.properties.maxAltitude + 'm<br/>';
                }}
                layer.bindPopup(popupContent);
            }}
        }}).addTo(map);
        
        var segmentLayer = L.geoJSON(segmentsData, {{
            style: function(feature) {{
                return {{
                    color: '#0078d4',
                    weight: 3,
                    opacity: 0.8
                }};
            }},
            onEachFeature: function(feature, layer) {{
                var popupContent = '<strong>Segment ' + feature.properties.segmentIndex + '</strong><br/>';
                popupContent += 'Distance: ' + feature.properties.distance.toFixed(0) + 'm<br/>';
                popupContent += 'Bearing: ' + feature.properties.bearing.toFixed(1) + '°<br/>';
                popupContent += 'Est. Time: ' + feature.properties.estimatedTime.toFixed(1) + 'min';
                layer.bindPopup(popupContent);
            }}
        }}).addTo(map);
        
        waypointsData.features.forEach(function(feature) {{
            var lat = feature.geometry.coordinates[1];
            var lon = feature.geometry.coordinates[0];
            var props = feature.properties;
            
            var markerClass = 'waypoint-marker';
            if (props.isHome) markerClass += ' home-marker';
            else if (props.isReturnPoint) markerClass += ' return-marker';
            
            var icon = L.divIcon({{
                className: markerClass,
                html: props.id,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            }});
            
            var marker = L.marker([lat, lon], {{ icon: icon }}).addTo(map);
            
            var popupContent = '<strong>Waypoint ' + props.id + '</strong><br/>';
            popupContent += 'Altitude: ' + props.altitude + 'm<br/>';
            if (props.isHome) popupContent += '🏠 Home Point<br/>';
            if (props.isReturnPoint) popupContent += '🔄 Return Point<br/>';
            marker.bindPopup(popupContent);
        }});
        
        risksData.features.forEach(function(feature) {{
            if (feature.geometry.type !== 'Point') return;
            
            var lat = feature.geometry.coordinates[1];
            var lon = feature.geometry.coordinates[0];
            var props = feature.properties;
            
            var color = props.color;
            
            var circleIcon = L.divIcon({{
                className: 'custom-circle',
                html: '<div style="background:' + color + ';width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            }});
            
            var marker = L.marker([lat, lon], {{ icon: circleIcon }}).addTo(map);
            
            var popupContent = '<strong>' + props.riskId + ' - ' + props.level.toUpperCase() + '</strong><br/>';
            popupContent += 'Category: ' + props.category + '<br/>';
            popupContent += props.description;
            marker.bindPopup(popupContent);
        }});
        
        var legend = L.control({{ position: 'bottomright' }});
        legend.onAdd = function(map) {{
            var div = L.DomUtil.create('div', 'legend');
            div.innerHTML = '<strong>Legend</strong><br/>';
            div.innerHTML += '<div class="legend-item"><div class="legend-color" style="background:#ff0000;opacity:0.3;"></div>No-Fly Zone</div>';
            div.innerHTML += '<div class="legend-item"><div class="legend-color" style="background:#ff9900;opacity:0.2;"></div>Height Restricted</div>';
            div.innerHTML += '<div class="legend-item"><div class="legend-color" style="background:#0078d4;"></div>Flight Route</div>';
            div.innerHTML += '<div class="legend-item"><div class="legend-circle" style="background:#00a854;"></div>Home Point</div>';
            div.innerHTML += '<div class="legend-item"><div class="legend-circle" style="background:#ffaa00;"></div>Return Point</div>';
            div.innerHTML += '<div class="legend-item"><div class="legend-circle" style="background:#ff0000;"></div>Critical Risk</div>';
            div.innerHTML += '<div class="legend-item"><div class="legend-circle" style="background:#ff6600;"></div>High Risk</div>';
            return div;
        }};
        legend.addTo(map);
        
        var bounds = [];
        waypointsData.features.forEach(function(f) {{
            bounds.push([f.geometry.coordinates[1], f.geometry.coordinates[0]]);
        }});
        if (bounds.length > 0) {{
            map.fitBounds(bounds, {{ padding: [50, 50] }});
        }}
    </script>
</body>
</html>"""
        
        return html
    
    def _waypoints_to_geojson(self, waypoints: List[Waypoint]) -> str:
        """Convert waypoints to GeoJSON FeatureCollection."""
        features = []
        
        for wp in waypoints:
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [wp.longitude, wp.latitude]
                },
                "properties": {
                    "id": wp.id,
                    "altitude": wp.altitude,
                    "isHome": wp.is_home,
                    "isReturnPoint": wp.is_return_point,
                    "sequence": wp.sequence
                }
            }
            features.append(feature)
        
        return json.dumps({"type": "FeatureCollection", "features": features})
    
    def _segments_to_geojson(self, segments: List[FlightSegment], waypoints: List[Waypoint]) -> str:
        """Convert flight segments to GeoJSON FeatureCollection."""
        features = []
        
        for idx, seg in enumerate(segments):
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [seg.start_lon, seg.start_lat],
                        [seg.end_lon, seg.end_lat]
                    ]
                },
                "properties": {
                    "segmentIndex": idx,
                    "distance": seg.distance_m,
                    "bearing": seg.bearing_deg,
                    "estimatedTime": seg.estimated_time_min,
                    "startAltitude": seg.start_alt,
                    "endAltitude": seg.end_alt
                }
            }
            features.append(feature)
        
        return json.dumps({"type": "FeatureCollection", "features": features})
    
    def _zones_to_geojson(self, restricted_zones: List[RestrictedZone]) -> str:
        """Convert restricted zones to GeoJSON FeatureCollection."""
        features = []
        
        for zone in restricted_zones:
            color = self.ZONE_COLORS.get(zone.zone_type, "#888888")
            fill_opacity = self.ZONE_FILL_OPACITY.get(zone.zone_type, 0.2)
            
            for ring_idx, ring in enumerate(zone.coordinates):
                coordinates = [[lon, lat] for lat, lon in ring]
                
                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [coordinates]
                    },
                    "properties": {
                        "id": zone.id,
                        "name": zone.name,
                        "zoneType": zone.zone_type.value,
                        "color": color,
                        "fillOpacity": fill_opacity,
                        "maxAltitude": zone.max_altitude,
                        "minAltitude": zone.min_altitude,
                        "ringIndex": ring_idx
                    }
                }
                features.append(feature)
        
        return json.dumps({"type": "FeatureCollection", "features": features})
    
    def _risks_to_geojson(self, risk_events: List[RiskEvent]) -> str:
        """Convert risk events to GeoJSON FeatureCollection."""
        features = []
        
        for event in risk_events:
            if event.location_lat is None or event.location_lon is None:
                continue
            
            color = self.RISK_MARKER_COLORS.get(event.level, "#888888")
            
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [event.location_lon, event.location_lat]
                },
                "properties": {
                    "riskId": event.risk_id,
                    "category": event.category.value,
                    "level": event.level.value,
                    "description": event.description,
                    "waypointId": event.waypoint_id,
                    "segmentIndex": event.segment_index,
                    "color": color,
                    "details": event.details
                }
            }
            features.append(feature)
        
        return json.dumps({"type": "FeatureCollection", "features": features})
