import math
from typing import List, Dict, Any, Tuple
from datetime import datetime, timedelta
import json

from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

class ShadingCalculator:
    def __init__(self, latitude: float = 30.0, longitude: float = 120.0):
        self.latitude = latitude
        self.longitude = longitude
    
    def calculate_solar_position(self, dt: datetime) -> Tuple[float, float]:
        day_of_year = dt.timetuple().tm_yday
        declination = 23.45 * math.sin(math.radians(360 / 365 * (day_of_year - 81)))
        
        hour_angle = (dt.hour - 12 + self.longitude / 15.0) * 15.0
        
        lat_rad = math.radians(self.latitude)
        dec_rad = math.radians(declination)
        ha_rad = math.radians(hour_angle)
        
        sin_elevation = (math.sin(lat_rad) * math.sin(dec_rad) + 
                          math.cos(lat_rad) * math.cos(dec_rad) * math.cos(ha_rad))
        sin_elevation = max(-1, min(1, sin_elevation))
        elevation = math.degrees(math.asin(sin_elevation))
        
        if elevation <= 0:
            return 0.0, 0.0
        
        cos_azimuth = ((math.sin(lat_rad) * math.sin(dec_rad) - 
                       math.cos(lat_rad) * math.cos(dec_rad) * math.cos(ha_rad)))
        cos_azimuth = cos_azimuth / (math.cos(math.radians(elevation)))
        cos_azimuth = max(-1, min(1, cos_azimuth))
        
        azimuth = math.degrees(math.acos(cos_azimuth))
        if hour_angle > 0:
            azimuth = 360.0 - azimuth
        
        return elevation, azimuth
    
    def calculate_shadow_polygon(self, 
                                   obstacle_polygon: Polygon, 
                                   obstacle_height: float, 
                                   solar_elevation: float, 
                                   solar_azimuth: float) -> Polygon:
        if solar_elevation <= 0:
            return obstacle_polygon
        
        shadow_length = obstacle_height / math.tan(math.radians(solar_elevation))
        shadow_direction = math.radians(solar_azimuth + 180)
        
        dx = shadow_length * math.sin(shadow_direction)
        dy = shadow_length * math.cos(shadow_direction)
        
        coords = list(obstacle_polygon.exterior.coords)
        shadow_coords = []
        
        for x, y in coords:
            shadow_coords.append((x, y))
            shadow_coords.append((x + dx, y + dy))
        
        if len(shadow_coords) < 4:
            return obstacle_polygon
        
        try:
            shadow_polygon = Polygon(shadow_coords)
            return shadow_polygon
        except:
            return obstacle_polygon
    
    def calculate_panel_shading(self, 
                                panel_polygon: Polygon, 
                                obstacles: List[Dict[str, Any]], 
                                dt: datetime,
                                roof_inclination: float = 0) -> float:
        elevation, azimuth = self.calculate_solar_position(dt)
        
        if elevation <= 0:
            return 1.0
        
        shadow_polygons = []
        for obs in obstacles:
            try:
                coords = [(p['x'], p['y']) for p in obs['coordinates']]
                if len(coords) < 3:
                    continue
                obs_poly = Polygon(coords)
                shadow_poly = self.calculate_shadow_polygon(
                    obs_poly, obs['height'], elevation, azimuth)
                shadow_polygons.append(shadow_poly)
            except:
                continue
        
        if not shadow_polygons:
            return 0.0
        
        combined_shadow = unary_union(shadow_polygons)
        
        try:
            intersection = panel_polygon.intersection(combined_shadow)
            shaded_area = intersection.area
            total_area = panel_polygon.area
            if total_area > 0:
                return shaded_area / total_area
        except:
            pass
        
        return 0.0
    
    def generate_shading_map(self, 
                              roof_coords: List[Dict[str, float]],
                              obstacles: List[Dict[str, Any]],
                              grid_size: float = 0.5) -> Dict[str, Any]:
        try:
            coords = [(p['x'], p['y']) for p in roof_coords]
            if len(coords) < 3:
                return {"error": "无效的屋顶坐标"}
            
            roof_polygon = Polygon(coords)
            minx, miny, maxx, maxy = roof_polygon.bounds
            
            x_steps = int((maxx - minx) / grid_size) + 1
            y_steps = int((maxy - miny) / grid_size) + 1
            
            shading_map = {
                "grid_size": grid_size,
                "bounds": {"minx": minx, "miny": miny, "maxx": maxx, "maxy": maxy},
                "points": []
            }
            
            for i in range(x_steps):
                for j in range(y_steps):
                    x = minx + i * grid_size
                    y = miny + j * grid_size
                    point = Point(x, y)
                    
                    if roof_polygon.contains(point):
                        point_shading = self._calculate_point_shading(point, obstacles)
                        shading_map["points"].append({
                            "x": round(x, 2),
                            "y": round(y, 2),
                            "shading_ratio": point_shading
                        })
            
            return shading_map
        except Exception as e:
            return {"error": str(e)}
    
    def _calculate_point_shading(self, point: Point, obstacles: List[Dict[str, Any]]) -> float:
        max_shading = 0.0
        
        for hour in range(6, 19):
            dt = datetime(2024, 6, 21, hour, 0, 0)
            elevation, azimuth = self.calculate_solar_position(dt)
            
            if elevation <= 0:
                continue
            
            for obs in obstacles:
                try:
                    coords = [(p['x'], p['y']) for p in obs['coordinates']]
                    if len(coords) < 3:
                        continue
                    obs_poly = Polygon(coords)
                    shadow_poly = self.calculate_shadow_polygon(
                        obs_poly, obs['height'], elevation, azimuth)
                    
                    if shadow_poly.contains(point):
                        max_shading = max(max_shading, 1.0)
                except:
                    continue
        
        return max_shading
    
    def calculate_annual_shading_hours(self, 
                                          panel_positions: List[Dict[str, Any]],
                                          obstacles: List[Dict[str, Any]],
                                          panel_width: float,
                                          panel_height: float) -> Dict[str, Any]:
        total_hours = 0
        total_panels = len(panel_positions)
        shading_hours_by_month = [0] * 12
        
        for panel in panel_positions:
            try:
                x = panel.get('x', 0)
                y = panel.get('y', 0)
                panel_polygon = Polygon([
                    (x, y),
                    (x + panel_width, y),
                    (x + panel_width, y + panel_height),
                    (x, y + panel_height)
                ])
                
                for month in range(1, 13):
                    day = 15
                    for hour in range(6, 19):
                        dt = datetime(2024, month, day, hour, 0, 0)
                        shading_ratio = self.calculate_panel_shading(
                            panel_polygon, obstacles, dt
                        )
                        if shading_ratio > 0.1:
                            total_hours += 1
                            shading_hours_by_month[month - 1] += 1
            except:
                continue
        
        avg_shading_hours = total_hours / total_panels if total_panels > 0 else 0
        
        return {
            "total_shading_hours": total_hours,
            "average_shading_hours_per_panel": avg_shading_hours,
            "shading_hours_by_month": shading_hours_by_month,
            "shading_loss_ratio": min(1.0, avg_shading_hours / (12 * 13))
        }
