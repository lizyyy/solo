import pytest
from pathlib import Path

from ..risk.rules import RiskEngine, RiskConfig
from ..risk.models import RiskLevel, RiskCategory, RiskPoint, RiskAssessment
from ..terrain.calculator import TerrainCalculator, RouteSegment, RouteStatistics
from ..parsers.gpx_parser import Waypoint
from ..parsers.weight_parser import TeamMember
from ..parsers.weather_parser import WaterCrossingPoint, WeatherCondition


class TestRiskConfig:
    def test_default_config(self):
        config = RiskConfig()
        
        assert config.max_safe_slope_percent == 20.0
        assert config.critical_slope_percent == 30.0
        assert config.max_weight_ratio == 30.0
        assert config.max_supply_interval_km == 5.0

    def test_custom_config(self):
        config = RiskConfig(
            max_safe_slope_percent=25.0,
            critical_slope_percent=35.0,
            max_weight_ratio=35.0
        )
        
        assert config.max_safe_slope_percent == 25.0
        assert config.critical_slope_percent == 35.0
        assert config.max_weight_ratio == 35.0


class TestRiskEngine:
    def setup_method(self):
        self.engine = RiskEngine()
        self.calculator = TerrainCalculator()
        
    def test_assess_slope_risks_low(self):
        waypoints = [
            Waypoint(lat=34.050000, lon=108.900000, elevation=1200.0),
            Waypoint(lat=34.052000, lon=108.901500, elevation=1210.0)
        ]
        
        segments = self.calculator.calculate_segments(waypoints)
        risks = self.engine._assess_slope_risks(segments)
        
        assert isinstance(risks, list)

    def test_assess_slope_risks_high(self):
        waypoints = [
            Waypoint(lat=34.050000, lon=108.900000, elevation=1200.0),
            Waypoint(lat=34.050100, lon=108.900100, elevation=1250.0)
        ]
        
        segments = self.calculator.calculate_segments(waypoints)
        risks = self.engine._assess_slope_risks(segments)
        
        assert isinstance(risks, list)

    def test_assess_weight_risks_normal(self):
        members = [
            TeamMember(
                name="正常队员",
                role="队员",
                body_weight=70.0,
                pack_weight=20.0,
                max_recommended_weight=25.0
            )
        ]
        
        risks = self.engine._assess_weight_risks(members)
        
        assert isinstance(risks, list)

    def test_assess_weight_risks_over_limit(self):
        members = [
            TeamMember(
                name="超重队员",
                role="队员",
                body_weight=60.0,
                pack_weight=28.0,
                max_recommended_weight=22.0
            )
        ]
        
        risks = self.engine._assess_weight_risks(members)
        
        assert len(risks) >= 1
        assert risks[0].category == RiskCategory.WEIGHT

    def test_assess_water_crossing_risks_safe(self):
        crossings = [
            WaterCrossingPoint(
                name="安全涉水点",
                lat=34.050000,
                lon=108.900000,
                current_depth=0.3,
                warning_depth=0.5,
                danger_depth=0.8,
                flow_rate=0.5
            )
        ]
        
        risks = self.engine._assess_water_crossing_risks(crossings)
        
        assert isinstance(risks, list)

    def test_assess_water_crossing_risks_dangerous(self):
        crossings = [
            WaterCrossingPoint(
                name="危险涉水点",
                lat=34.050000,
                lon=108.900000,
                current_depth=0.6,
                warning_depth=0.5,
                danger_depth=0.8,
                flow_rate=1.0
            )
        ]
        
        risks = self.engine._assess_water_crossing_risks(crossings)
        
        assert len(risks) >= 1
        assert risks[0].category == RiskCategory.WATER_CROSSING

    def test_calculate_overall_risk_low(self):
        from ..risk.models import RiskPoint, RiskLevel, RiskCategory
        
        risks = []
        overall = self.engine._calculate_overall_risk(risks)
        
        assert overall == RiskLevel.LOW

    def test_calculate_overall_risk_critical(self):
        from ..risk.models import RiskPoint, RiskLevel, RiskCategory
        
        risks = [
            RiskPoint(
                risk_id="TEST-001",
                category=RiskCategory.SLOPE,
                level=RiskLevel.CRITICAL,
                location={},
                description="测试极高风险",
                recommendations=[]
            )
        ]
        
        overall = self.engine._calculate_overall_risk(risks)
        
        assert overall == RiskLevel.CRITICAL

    def test_full_assessment(self):
        waypoints = [
            Waypoint(lat=34.050000, lon=108.900000, elevation=1200.0),
            Waypoint(lat=34.052000, lon=108.901500, elevation=1250.0),
            Waypoint(lat=34.054000, lon=108.903000, elevation=1300.0)
        ]
        
        segments = self.calculator.calculate_segments(waypoints)
        stats = self.calculator.calculate_statistics(segments)
        
        members = [
            TeamMember(
                name="测试队员",
                role="队员",
                body_weight=70.0,
                pack_weight=20.0,
                max_recommended_weight=25.0
            )
        ]
        
        assessment = self.engine.assess_all_risks(
            route_segments=segments,
            route_stats=stats,
            team_members=members,
            water_crossings=[],
            weather_forecasts=[],
            waypoints=waypoints
        )
        
        assert isinstance(assessment, RiskAssessment)
        assert hasattr(assessment, 'overall_risk_level')
        assert hasattr(assessment, 'risk_points')
        assert isinstance(assessment.risk_points, list)

    def test_risk_point_to_dict(self):
        risk = RiskPoint(
            risk_id="TEST-001",
            category=RiskCategory.SLOPE,
            level=RiskLevel.HIGH,
            location={'lat': 34.05, 'lon': 108.90, 'elevation': 1200},
            description="测试风险点",
            recommendations=["建议1", "建议2"]
        )
        
        risk_dict = risk.to_dict()
        
        assert risk_dict['risk_id'] == "TEST-001"
        assert risk_dict['level'] == "高风险"
        assert 'location' in risk_dict
        assert 'recommendations' in risk_dict

    def test_risk_assessment_to_dict(self):
        waypoints = [
            Waypoint(lat=34.050000, lon=108.900000, elevation=1200.0),
            Waypoint(lat=34.052000, lon=108.901500, elevation=1250.0)
        ]
        
        segments = self.calculator.calculate_segments(waypoints)
        stats = self.calculator.calculate_statistics(segments)
        
        members = [
            TeamMember(
                name="测试队员",
                role="队员",
                body_weight=70.0,
                pack_weight=20.0,
                max_recommended_weight=25.0
            )
        ]
        
        assessment = self.engine.assess_all_risks(
            route_segments=segments,
            route_stats=stats,
            team_members=members,
            water_crossings=[],
            weather_forecasts=[],
            waypoints=waypoints
        )
        
        assessment_dict = assessment.to_dict()
        
        assert 'assessment_id' in assessment_dict
        assert 'overall_risk_level' in assessment_dict
        assert 'risk_points' in assessment_dict
        assert 'statistics' in assessment_dict

    def test_risk_count_by_level(self):
        waypoints = [
            Waypoint(lat=34.050000, lon=108.900000, elevation=1200.0),
            Waypoint(lat=34.050100, lon=108.900100, elevation=1250.0)
        ]
        
        segments = self.calculator.calculate_segments(waypoints)
        stats = self.calculator.calculate_statistics(segments)
        
        members = [
            TeamMember(
                name="测试队员",
                role="队员",
                body_weight=70.0,
                pack_weight=20.0,
                max_recommended_weight=25.0
            )
        ]
        
        assessment = self.engine.assess_all_risks(
            route_segments=segments,
            route_stats=stats,
            team_members=members,
            water_crossings=[],
            weather_forecasts=[],
            waypoints=waypoints
        )
        
        counts = assessment.risk_count_by_level
        
        assert isinstance(counts, dict)
        for level in RiskLevel:
            assert level in counts
