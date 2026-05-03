import uuid
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass
from datetime import datetime

from .models import (
    RiskLevel, RiskCategory, RiskPoint, RetreatPoint, 
    SupplyPoint, RiskAssessment
)
from ..parsers.gpx_parser import Waypoint
from ..parsers.weight_parser import TeamMember
from ..parsers.weather_parser import WaterCrossingPoint, WeatherCondition
from ..terrain.calculator import RouteSegment, RouteStatistics


@dataclass
class RiskConfig:
    max_safe_slope_percent: float = 20.0
    warning_slope_percent: float = 15.0
    critical_slope_percent: float = 30.0
    max_water_depth_warning: float = 0.5
    max_water_depth_danger: float = 0.8
    max_weight_ratio: float = 30.0
    critical_weight_ratio: float = 40.0
    max_supply_interval_km: float = 5.0
    critical_supply_interval_km: float = 8.0
    max_water_per_person_liters: float = 3.0
    warning_wind_speed: float = 12.0
    critical_wind_speed: float = 18.0
    warning_precipitation: float = 10.0
    critical_precipitation: float = 25.0


class RiskEngine:
    def __init__(self, config: RiskConfig = None):
        self.config = config or RiskConfig()

    def assess_all_risks(
        self,
        route_segments: List[RouteSegment],
        route_stats: RouteStatistics,
        team_members: List[TeamMember],
        water_crossings: List[WaterCrossingPoint],
        weather_forecasts: List[WeatherCondition],
        waypoints: List[Waypoint]
    ) -> RiskAssessment:
        risk_points = []
        retreat_points = []
        supply_points = []
        recommendations = []

        slope_risks = self._assess_slope_risks(route_segments)
        risk_points.extend(slope_risks)

        weight_risks = self._assess_weight_risks(team_members)
        risk_points.extend(weight_risks)

        water_risks = self._assess_water_crossing_risks(water_crossings)
        risk_points.extend(water_risks)

        supply_risks, supply_pts = self._assess_supply_risks(
            route_segments, route_stats, waypoints
        )
        risk_points.extend(supply_risks)
        supply_points.extend(supply_pts)

        weather_risks = self._assess_weather_risks(weather_forecasts)
        risk_points.extend(weather_risks)

        retreat_points = self._identify_retreat_points(
            route_segments, risk_points, waypoints
        )

        overall_risk = self._calculate_overall_risk(risk_points)

        recommendations = self._generate_recommendations(
            risk_points, overall_risk, route_stats
        )

        statistics = {
            'route_statistics': {
                'total_distance_km': route_stats.total_distance_2d / 1000,
                'total_elevation_gain': route_stats.total_elevation_gain,
                'total_elevation_loss': route_stats.total_elevation_loss,
                'max_slope_percent': route_stats.max_slope_percent,
                'estimated_time_hours': route_stats.estimated_total_time,
                'estimated_water_liters': route_stats.estimated_total_water
            },
            'team_statistics': {
                'member_count': len(team_members),
                'total_pack_weight_kg': sum(m.pack_weight for m in team_members),
                'avg_weight_ratio': sum(m.weight_ratio for m in team_members) / len(team_members) if team_members else 0
            },
            'risk_summary': {
                'total_risks': len(risk_points),
                'by_level': {
                    'critical': sum(1 for r in risk_points if r.level == RiskLevel.CRITICAL),
                    'high': sum(1 for r in risk_points if r.level == RiskLevel.HIGH),
                    'medium': sum(1 for r in risk_points if r.level == RiskLevel.MEDIUM),
                    'low': sum(1 for r in risk_points if r.level == RiskLevel.LOW)
                }
            }
        }

        return RiskAssessment(
            assessment_id=str(uuid.uuid4())[:8],
            overall_risk_level=overall_risk,
            risk_points=risk_points,
            retreat_points=retreat_points,
            supply_points=supply_points,
            statistics=statistics,
            recommendations=recommendations
        )

    def _assess_slope_risks(self, segments: List[RouteSegment]) -> List[RiskPoint]:
        risks = []

        for i, seg in enumerate(segments):
            slope = abs(seg.avg_slope_percent)

            if slope >= self.config.critical_slope_percent:
                risks.append(RiskPoint(
                    risk_id=f"SLOPE-{i:03d}",
                    category=RiskCategory.SLOPE,
                    level=RiskLevel.CRITICAL,
                    location={
                        'lat': seg.start_point.lat,
                        'lon': seg.start_point.lon,
                        'elevation': seg.start_point.elevation or 0
                    },
                    description=f"极陡坡路段，坡度 {slope:.1f}%，{seg.slope_category}",
                    recommendations=[
                        "此路段风险极高，建议重新规划路线",
                        "如需通过，必须使用绳索保护",
                        "考虑分批次通过，确保安全"
                    ],
                    details={
                        'slope_percent': slope,
                        'slope_category': seg.slope_category,
                        'segment_distance': seg.distance_2d,
                        'elevation_gain': seg.elevation_gain,
                        'is_uphill': seg.is_uphill
                    }
                ))
            elif slope >= self.config.max_safe_slope_percent:
                risks.append(RiskPoint(
                    risk_id=f"SLOPE-{i:03d}",
                    category=RiskCategory.SLOPE,
                    level=RiskLevel.HIGH,
                    location={
                        'lat': seg.start_point.lat,
                        'lon': seg.start_point.lon,
                        'elevation': seg.start_point.elevation or 0
                    },
                    description=f"陡坡路段，坡度 {slope:.1f}%，{seg.slope_category}",
                    recommendations=[
                        "陡坡路段，注意 footing，使用登山杖",
                        "控制行进速度，避免滑倒",
                        "评估团队成员能力，考虑绕行"
                    ],
                    details={
                        'slope_percent': slope,
                        'slope_category': seg.slope_category,
                        'segment_distance': seg.distance_2d,
                        'elevation_gain': seg.elevation_gain
                    }
                ))
            elif slope >= self.config.warning_slope_percent:
                risks.append(RiskPoint(
                    risk_id=f"SLOPE-{i:03d}",
                    category=RiskCategory.SLOPE,
                    level=RiskLevel.MEDIUM,
                    location={
                        'lat': seg.start_point.lat,
                        'lon': seg.start_point.lon,
                        'elevation': seg.start_point.elevation or 0
                    },
                    description=f"中等坡度路段，坡度 {slope:.1f}%",
                    recommendations=[
                        "中等坡度，保持稳定步伐",
                        "注意体力分配",
                        "雨天可能更滑，需谨慎"
                    ],
                    details={
                        'slope_percent': slope,
                        'segment_distance': seg.distance_2d
                    }
                ))

        return risks

    def _assess_weight_risks(self, members: List[TeamMember]) -> List[RiskPoint]:
        risks = []

        for i, member in enumerate(members):
            if member.pack_weight > member.max_recommended_weight:
                level = RiskLevel.CRITICAL if member.weight_ratio >= self.config.critical_weight_ratio else RiskLevel.HIGH
                
                risks.append(RiskPoint(
                    risk_id=f"WEIGHT-{i:03d}",
                    category=RiskCategory.WEIGHT,
                    level=level,
                    location={},
                    description=f"队员 {member.name} 负重超限：{member.pack_weight}kg / 建议 {member.max_recommended_weight}kg",
                    recommendations=[
                        f"队员 {member.name} 需要减轻负重",
                        "重新分配团队装备",
                        "考虑移除非必要物品"
                    ],
                    details={
                        'member_name': member.name,
                        'member_role': member.role,
                        'pack_weight': member.pack_weight,
                        'max_recommended': member.max_recommended_weight,
                        'weight_ratio': member.weight_ratio,
                        'over_limit_by': member.pack_weight - member.max_recommended_weight
                    }
                ))
            elif member.weight_ratio >= self.config.max_weight_ratio:
                risks.append(RiskPoint(
                    risk_id=f"WEIGHT-{i:03d}",
                    category=RiskCategory.WEIGHT,
                    level=RiskLevel.MEDIUM,
                    location={},
                    description=f"队员 {member.name} 负重比例较高：{member.weight_ratio:.1f}%",
                    recommendations=[
                        "负重比例偏高，注意体力消耗",
                        "考虑适当减负",
                        "行进中多休息"
                    ],
                    details={
                        'member_name': member.name,
                        'weight_ratio': member.weight_ratio,
                        'pack_weight': member.pack_weight
                    }
                ))

        return risks

    def _assess_water_crossing_risks(self, crossings: List[WaterCrossingPoint]) -> List[RiskPoint]:
        risks = []

        for i, crossing in enumerate(crossings):
            depth = crossing.current_depth

            if depth >= crossing.danger_depth:
                risks.append(RiskPoint(
                    risk_id=f"WATER-{i:03d}",
                    category=RiskCategory.WATER_CROSSING,
                    level=RiskLevel.CRITICAL,
                    location={
                        'lat': crossing.lat,
                        'lon': crossing.lon
                    },
                    description=f"涉水点 {crossing.name} 深度危险：{depth}m / 危险值 {crossing.danger_depth}m",
                    recommendations=[
                        "此涉水点风险极高，禁止通过",
                        "寻找替代路线或绕行",
                        "等待水位下降后再评估"
                    ],
                    details={
                        'crossing_name': crossing.name,
                        'current_depth': depth,
                        'warning_depth': crossing.warning_depth,
                        'danger_depth': crossing.danger_depth,
                        'flow_rate': crossing.flow_rate
                    }
                ))
            elif depth >= crossing.warning_depth:
                risks.append(RiskPoint(
                    risk_id=f"WATER-{i:03d}",
                    category=RiskCategory.WATER_CROSSING,
                    level=RiskLevel.HIGH,
                    location={
                        'lat': crossing.lat,
                        'lon': crossing.lon
                    },
                    description=f"涉水点 {crossing.name} 接近警戒深度：{depth}m / 警戒值 {crossing.warning_depth}m",
                    recommendations=[
                        "涉水前评估水流情况",
                        "使用绳索保护",
                        "选择最浅处通过",
                        "考虑组队通过"
                    ],
                    details={
                        'crossing_name': crossing.name,
                        'current_depth': depth,
                        'warning_depth': crossing.warning_depth,
                        'flow_rate': crossing.flow_rate
                    }
                ))

        return risks

    def _assess_supply_risks(
        self, 
        segments: List[RouteSegment], 
        stats: RouteStatistics,
        waypoints: List[Waypoint]
    ) -> Tuple[List[RiskPoint], List[SupplyPoint]]:
        risks = []
        supply_points = []

        estimated_water = stats.estimated_total_water
        total_distance_km = stats.total_distance_2d / 1000

        named_waypoints = [wp for wp in waypoints if wp.name and 
                          ('补给' in wp.name or 'supply' in wp.name.lower() or 
                           '水' in wp.name or 'water' in wp.name.lower())]

        if not named_waypoints:
            if total_distance_km > self.config.critical_supply_interval_km:
                risks.append(RiskPoint(
                    risk_id="SUPPLY-001",
                    category=RiskCategory.SUPPLY,
                    level=RiskLevel.CRITICAL,
                    location={
                        'lat': waypoints[0].lat if waypoints else 0,
                        'lon': waypoints[0].lon if waypoints else 0
                    },
                    description=f"路线总长 {total_distance_km:.1f}km，远超安全补给间隔 {self.config.critical_supply_interval_km}km",
                    recommendations=[
                        "必须规划中途补给点",
                        "考虑分多天完成",
                        "携带足够的水和食物"
                    ],
                    details={
                        'total_distance_km': total_distance_km,
                        'safe_interval_km': self.config.max_supply_interval_km,
                        'critical_interval_km': self.config.critical_supply_interval_km,
                        'estimated_water_liters': estimated_water
                    }
                ))
            elif total_distance_km > self.config.max_supply_interval_km:
                risks.append(RiskPoint(
                    risk_id="SUPPLY-001",
                    category=RiskCategory.SUPPLY,
                    level=RiskLevel.HIGH,
                    location={
                        'lat': waypoints[0].lat if waypoints else 0,
                        'lon': waypoints[0].lon if waypoints else 0
                    },
                    description=f"路线总长 {total_distance_km:.1f}km，超过建议补给间隔",
                    recommendations=[
                        "建议规划中途补给点",
                        "确保携带足够的水",
                        "考虑轻装前进"
                    ],
                    details={
                        'total_distance_km': total_distance_km,
                        'safe_interval_km': self.config.max_supply_interval_km
                    }
                ))

        for i, wp in enumerate(named_waypoints):
            supply_points.append(SupplyPoint(
                point_id=f"SP-{i:03d}",
                location={'lat': wp.lat, 'lon': wp.lon, 'elevation': wp.elevation or 0},
                name=wp.name,
                water_available=0,
                food_available=0,
                is_emergency='应急' in wp.name if wp.name else False,
                distance_from_last=0
            ))

        return risks, supply_points

    def _assess_weather_risks(self, forecasts: List[WeatherCondition]) -> List[RiskPoint]:
        risks = []

        for i, fc in enumerate(forecasts):
            if fc.wind_speed >= self.config.critical_wind_speed:
                risks.append(RiskPoint(
                    risk_id=f"WEATHER-WIND-{i:03d}",
                    category=RiskCategory.WEATHER,
                    level=RiskLevel.CRITICAL,
                    location={},
                    description=f"{fc.date} 风速 {fc.wind_speed} m/s，极为危险",
                    recommendations=[
                        "大风天气，风险极高",
                        "建议推迟行程",
                        "如已出发，寻找避风处"
                    ],
                    details={
                        'date': str(fc.date),
                        'wind_speed': fc.wind_speed,
                        'wind_direction': fc.wind_direction
                    }
                ))
            elif fc.wind_speed >= self.config.warning_wind_speed:
                risks.append(RiskPoint(
                    risk_id=f"WEATHER-WIND-{i:03d}",
                    category=RiskCategory.WEATHER,
                    level=RiskLevel.HIGH,
                    location={},
                    description=f"{fc.date} 风速 {fc.wind_speed} m/s，请注意安全",
                    recommendations=[
                        "注意防风",
                        "避免在开阔地带行进",
                        "确保装备固定"
                    ],
                    details={
                        'date': str(fc.date),
                        'wind_speed': fc.wind_speed
                    }
                ))

            if fc.precipitation_amount >= self.config.critical_precipitation:
                risks.append(RiskPoint(
                    risk_id=f"WEATHER-RAIN-{i:03d}",
                    category=RiskCategory.WEATHER,
                    level=RiskLevel.CRITICAL,
                    location={},
                    description=f"{fc.date} 预计强降雨 {fc.precipitation_amount}mm",
                    recommendations=[
                        "强降雨风险极高",
                        "山洪、滑坡风险增加",
                        "建议取消或推迟行程"
                    ],
                    details={
                        'date': str(fc.date),
                        'precipitation_amount': fc.precipitation_amount,
                        'precipitation_probability': fc.precipitation_probability
                    }
                ))
            elif fc.precipitation_amount >= self.config.warning_precipitation:
                risks.append(RiskPoint(
                    risk_id=f"WEATHER-RAIN-{i:03d}",
                    category=RiskCategory.WEATHER,
                    level=RiskLevel.HIGH,
                    location={},
                    description=f"{fc.date} 预计降雨 {fc.precipitation_amount}mm",
                    recommendations=[
                        "携带雨具",
                        "注意路滑",
                        "避免涉水"
                    ],
                    details={
                        'date': str(fc.date),
                        'precipitation_amount': fc.precipitation_amount
                    }
                ))

            if fc.temperature >= 35:
                risks.append(RiskPoint(
                    risk_id=f"WEATHER-HEAT-{i:03d}",
                    category=RiskCategory.WEATHER,
                    level=RiskLevel.HIGH,
                    location={},
                    description=f"{fc.date} 高温 {fc.temperature}°C",
                    recommendations=[
                        "注意防暑降温",
                        "增加饮水量",
                        "避免正午时段行进"
                    ],
                    details={
                        'date': str(fc.date),
                        'temperature': fc.temperature,
                        'humidity': fc.humidity
                    }
                ))
            elif fc.temperature <= 0:
                risks.append(RiskPoint(
                    risk_id=f"WEATHER-COLD-{i:03d}",
                    category=RiskCategory.WEATHER,
                    level=RiskLevel.MEDIUM,
                    location={},
                    description=f"{fc.date} 低温 {fc.temperature}°C",
                    recommendations=[
                        "注意保暖",
                        "携带备用衣物",
                        "防止冻伤"
                    ],
                    details={
                        'date': str(fc.date),
                        'temperature': fc.temperature
                    }
                ))

        return risks

    def _identify_retreat_points(
        self,
        segments: List[RouteSegment],
        risk_points: List[RiskPoint],
        waypoints: List[Waypoint]
    ) -> List[RetreatPoint]:
        retreat_points = []
        critical_risks = [r for r in risk_points if r.level == RiskLevel.CRITICAL]

        cumulative_distance = 0
        for i, seg in enumerate(segments):
            cumulative_distance += seg.distance_2d

            slope = abs(seg.avg_slope_percent)
            if slope >= self.config.critical_slope_percent:
                retreat_points.append(RetreatPoint(
                    point_id=f"RP-SLOPE-{i:03d}",
                    location={
                        'lat': seg.start_point.lat,
                        'lon': seg.start_point.lon,
                        'elevation': seg.start_point.elevation or 0
                    },
                    name=f"陡坡撤返点-{i+1}",
                    distance_from_start=cumulative_distance - seg.distance_2d,
                    reason=f"前方坡度 {slope:.1f}%，超过安全值",
                    risk_level=RiskLevel.CRITICAL,
                    backtrack_distance=cumulative_distance - seg.distance_2d,
                    safety_assessment="建议在此处评估团队能力，考虑撤返"
                ))

        named_points = [wp for wp in waypoints if wp.name and 
                       ('撤返' in wp.name or 'retreat' in wp.name.lower() or
                        '汇合' in wp.name or 'rendezvous' in wp.name.lower())]
        
        for i, wp in enumerate(named_points):
            retreat_points.append(RetreatPoint(
                point_id=f"RP-WP-{i:03d}",
                location={
                    'lat': wp.lat,
                    'lon': wp.lon,
                    'elevation': wp.elevation or 0
                },
                name=wp.name,
                distance_from_start=0,
                reason="预设撤返/汇合点",
                risk_level=RiskLevel.LOW,
                backtrack_distance=0,
                safety_assessment="预设安全点，可在此处集合或撤返"
            ))

        return retreat_points

    def _calculate_overall_risk(self, risk_points: List[RiskPoint]) -> RiskLevel:
        if not risk_points:
            return RiskLevel.LOW

        critical_count = sum(1 for r in risk_points if r.level == RiskLevel.CRITICAL)
        high_count = sum(1 for r in risk_points if r.level == RiskLevel.HIGH)
        medium_count = sum(1 for r in risk_points if r.level == RiskLevel.MEDIUM)

        if critical_count > 0:
            return RiskLevel.CRITICAL
        elif high_count >= 3:
            return RiskLevel.HIGH
        elif high_count >= 1 or medium_count >= 3:
            return RiskLevel.MEDIUM
        else:
            return RiskLevel.LOW

    def _generate_recommendations(
        self,
        risk_points: List[RiskPoint],
        overall_risk: RiskLevel,
        route_stats: RouteStatistics
    ) -> List[str]:
        recommendations = []

        if overall_risk == RiskLevel.CRITICAL:
            recommendations.append("【重要警告】整体风险等级为极高风险，建议重新评估行程可行性")
        elif overall_risk == RiskLevel.HIGH:
            recommendations.append("【警告】整体风险等级为高风险，需谨慎对待")
        elif overall_risk == RiskLevel.MEDIUM:
            recommendations.append("【注意】整体风险等级为中风险，请注意安全")

        critical_risks = [r for r in risk_points if r.level == RiskLevel.CRITICAL]
        high_risks = [r for r in risk_points if r.level == RiskLevel.HIGH]

        if critical_risks:
            recommendations.append(f"发现 {len(critical_risks)} 个极高风险点，必须优先处理")
            for r in critical_risks[:3]:
                recommendations.append(f"  - {r.description}")

        if high_risks:
            recommendations.append(f"发现 {len(high_risks)} 个高风险点，建议重点关注")

        recommendations.append(f"路线总长: {route_stats.total_distance_2d/1000:.1f}km")
        recommendations.append(f"累计爬升: {route_stats.total_elevation_gain:.0f}m")
        recommendations.append(f"预计耗时: {route_stats.estimated_total_time:.1f}小时")
        recommendations.append(f"预计耗水: {route_stats.estimated_total_water:.1f}升/人")

        recommendations.append("出发前请检查所有队员装备和状态")
        recommendations.append("确保通讯设备电量充足")
        recommendations.append("告知后方人员行程计划和预计返回时间")

        return recommendations
