import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from dataclasses import asdict

from ..risk.models import RiskAssessment
from ..terrain.calculator import RouteSegment, RouteStatistics
from ..parsers.gpx_parser import Waypoint
from ..parsers.weight_parser import TeamMember
from ..parsers.weather_parser import WeatherCondition, WaterCrossingPoint


class JSONExporter:
    def __init__(self):
        pass

    def _serialize_dataclass(self, obj) -> Any:
        if hasattr(obj, 'to_dict'):
            return obj.to_dict()
        elif hasattr(obj, '__dataclass_fields__'):
            return asdict(obj)
        elif isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, (int, float, str, bool, type(None))):
            return obj
        elif isinstance(obj, list):
            return [self._serialize_dataclass(item) for item in obj]
        elif isinstance(obj, dict):
            return {k: self._serialize_dataclass(v) for k, v in obj.items()}
        else:
            return str(obj)

    def export_audit_package(
        self,
        assessment: RiskAssessment,
        segments: List[RouteSegment],
        stats: RouteStatistics,
        waypoints: List[Waypoint],
        team_members: List[TeamMember],
        weather_forecasts: List[WeatherCondition],
        water_crossings: List[WaterCrossingPoint],
        input_files: Dict[str, str]
    ) -> Dict[str, Any]:
        package = {
            'audit_metadata': {
                'generated_at': datetime.now().isoformat(),
                'version': '1.0.0',
                'input_files': input_files
            },
            'risk_assessment': assessment.to_dict(),
            'route_data': {
                'waypoints': [
                    {
                        'lat': wp.lat,
                        'lon': wp.lon,
                        'elevation': wp.elevation,
                        'name': wp.name,
                        'description': wp.description
                    }
                    for wp in waypoints
                ],
                'segments': [
                    {
                        'segment_id': seg.segment_id,
                        'distance_2d_m': seg.distance_2d,
                        'distance_3d_m': seg.distance_3d,
                        'elevation_gain_m': seg.elevation_gain,
                        'elevation_loss_m': seg.elevation_loss,
                        'avg_slope_percent': seg.avg_slope_percent,
                        'max_slope_percent': seg.max_slope_percent,
                        'slope_category': seg.slope_category,
                        'bearing_degrees': seg.bearing,
                        'estimated_time_hours': seg.estimated_time,
                        'estimated_water_liters': seg.water_consumption,
                        'is_uphill': seg.is_uphill
                    }
                    for seg in segments
                ],
                'statistics': {
                    'total_distance_2d_km': stats.total_distance_2d / 1000,
                    'total_distance_3d_km': stats.total_distance_3d / 1000,
                    'total_elevation_gain_m': stats.total_elevation_gain,
                    'total_elevation_loss_m': stats.total_elevation_loss,
                    'min_elevation_m': stats.min_elevation,
                    'max_elevation_m': stats.max_elevation,
                    'avg_slope_percent': stats.avg_slope_percent,
                    'max_slope_percent': stats.max_slope_percent,
                    'segment_count': stats.segment_count,
                    'estimated_total_time_hours': stats.estimated_total_time,
                    'estimated_total_water_liters': stats.estimated_total_water
                }
            },
            'team_data': {
                'members': [
                    {
                        'name': m.name,
                        'role': m.role,
                        'body_weight_kg': m.body_weight,
                        'pack_weight_kg': m.pack_weight,
                        'max_recommended_weight_kg': m.max_recommended_weight,
                        'weight_ratio_percent': m.weight_ratio,
                        'total_weight_kg': m.total_weight,
                        'gear_list': m.gear_list or []
                    }
                    for m in team_members
                ],
                'summary': {
                    'total_members': len(team_members),
                    'total_pack_weight_kg': sum(m.pack_weight for m in team_members),
                    'avg_weight_ratio_percent': sum(m.weight_ratio for m in team_members) / len(team_members) if team_members else 0,
                    'members_over_limit': len([m for m in team_members if m.pack_weight > m.max_recommended_weight])
                }
            },
            'weather_data': {
                'forecasts': [
                    {
                        'date': str(f.date),
                        'hour': f.hour,
                        'temperature_c': f.temperature,
                        'humidity_percent': f.humidity,
                        'wind_speed_m_s': f.wind_speed,
                        'wind_direction': f.wind_direction,
                        'precipitation_probability_percent': f.precipitation_probability,
                        'precipitation_amount_mm': f.precipitation_amount,
                        'condition': f.condition,
                        'visibility_m': f.visibility,
                        'uv_index': f.uv_index
                    }
                    for f in weather_forecasts
                ],
                'water_crossings': [
                    {
                        'name': wc.name,
                        'lat': wc.lat,
                        'lon': wc.lon,
                        'current_depth_m': wc.current_depth,
                        'warning_depth_m': wc.warning_depth,
                        'danger_depth_m': wc.danger_depth,
                        'flow_rate_m_s': wc.flow_rate,
                        'is_dangerous': wc.current_depth >= wc.warning_depth
                    }
                    for wc in water_crossings
                ]
            },
            'risk_summary': {
                'overall_risk': assessment.overall_risk_level.value,
                'critical_count': sum(1 for r in assessment.risk_points if r.level.value == '极高风险'),
                'high_count': sum(1 for r in assessment.risk_points if r.level.value == '高风险'),
                'medium_count': sum(1 for r in assessment.risk_points if r.level.value == '中风险'),
                'low_count': sum(1 for r in assessment.risk_points if r.level.value == '低风险'),
                'needs_attention': assessment.overall_risk_level.value in ['极高风险', '高风险']
            }
        }

        return self._serialize_dataclass(package)

    def write_audit_package(
        self,
        file_path: str,
        assessment: RiskAssessment,
        segments: List[RouteSegment],
        stats: RouteStatistics,
        waypoints: List[Waypoint],
        team_members: List[TeamMember],
        weather_forecasts: List[WeatherCondition],
        water_crossings: List[WaterCrossingPoint],
        input_files: Dict[str, str]
    ) -> None:
        package = self.export_audit_package(
            assessment, segments, stats, waypoints,
            team_members, weather_forecasts, water_crossings,
            input_files
        )
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(package, f, ensure_ascii=False, indent=2, default=str)

    def write_risk_assessment_only(self, file_path: str, assessment: RiskAssessment) -> None:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(assessment.to_dict(), f, ensure_ascii=False, indent=2, default=str)
