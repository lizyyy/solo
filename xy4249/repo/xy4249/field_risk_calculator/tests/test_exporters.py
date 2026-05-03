import pytest
import tempfile
import os
import json
import csv
from pathlib import Path

from ..exporters.markdown_exporter import MarkdownExporter
from ..exporters.csv_exporter import CSVExporter
from ..exporters.json_exporter import JSONExporter
from ..risk.rules import RiskEngine
from ..risk.models import RiskLevel
from ..terrain.calculator import TerrainCalculator
from ..parsers.gpx_parser import Waypoint
from ..parsers.weight_parser import TeamMember


class TestMarkdownExporter:
    def setup_method(self):
        self.exporter = MarkdownExporter()
        self.engine = RiskEngine()
        self.calculator = TerrainCalculator()
        
    def test_export_basic(self):
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
        
        md_content = self.exporter.export(assessment, segments, stats, members)
        
        assert isinstance(md_content, str)
        assert len(md_content) > 0
        assert '# 野外踏勘风险评估报告' in md_content
        assert '总体风险等级' in md_content

    def test_write_markdown_file(self):
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
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
            temp_path = f.name
        
        try:
            self.exporter.write(temp_path, assessment, segments, stats, members)
            
            assert os.path.exists(temp_path)
            
            with open(temp_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            assert '# 野外踏勘风险评估报告' in content
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def test_risk_rendering(self):
        from ..risk.models import RiskPoint, RiskLevel, RiskCategory
        
        risk = RiskPoint(
            risk_id="TEST-001",
            category=RiskCategory.SLOPE,
            level=RiskLevel.HIGH,
            location={'lat': 34.05, 'lon': 108.90, 'elevation': 1200},
            description="测试高风险点",
            recommendations=["建议1", "建议2"]
        )
        
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
        
        assessment.risk_points.append(risk)
        
        md_content = self.exporter.export(assessment, segments, stats, members)
        
        assert '高风险' in md_content
        assert '测试高风险点' in md_content


class TestCSVExporter:
    def setup_method(self):
        self.exporter = CSVExporter()
        self.engine = RiskEngine()
        self.calculator = TerrainCalculator()
        
    def test_export_risk_points(self):
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
        
        rows = self.exporter.export_risk_points(assessment)
        
        assert isinstance(rows, list)

    def test_write_csv_files(self):
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
        
        with tempfile.TemporaryDirectory() as temp_dir:
            base_path = os.path.join(temp_dir, 'test_export')
            
            files = self.exporter.write_all(base_path, assessment)
            
            assert 'risk_points' in files
            assert 'retreat_points' in files
            assert 'supply_points' in files
            
            for key, file_path in files.items():
                assert os.path.exists(file_path)

    def test_export_retreat_points(self):
        from ..risk.models import RetreatPoint, RiskLevel
        
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
        
        rows = self.exporter.export_retreat_points(assessment)
        
        assert isinstance(rows, list)


class TestJSONExporter:
    def setup_method(self):
        self.exporter = JSONExporter()
        self.engine = RiskEngine()
        self.calculator = TerrainCalculator()
        
    def test_serialize_dataclass(self):
        from ..risk.models import RiskPoint, RiskLevel, RiskCategory
        
        risk = RiskPoint(
            risk_id="TEST-001",
            category=RiskCategory.SLOPE,
            level=RiskLevel.HIGH,
            location={'lat': 34.05, 'lon': 108.90},
            description="测试",
            recommendations=[]
        )
        
        serialized = self.exporter._serialize_dataclass(risk)
        
        assert isinstance(serialized, dict)
        assert serialized['risk_id'] == 'TEST-001'
        assert serialized['level'] == '高风险'

    def test_export_audit_package(self):
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
        
        input_files = {
            'gpx': 'test.gpx',
            'dem': 'test.csv',
            'weight': 'weight.csv',
            'weather': 'weather.json'
        }
        
        package = self.exporter.export_audit_package(
            assessment, segments, stats, waypoints,
            members, [], [], input_files
        )
        
        assert isinstance(package, dict)
        assert 'audit_metadata' in package
        assert 'risk_assessment' in package
        assert 'route_data' in package
        assert 'team_data' in package
        assert 'weather_data' in package
        assert 'risk_summary' in package

    def test_write_audit_package(self):
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
        
        input_files = {
            'gpx': 'test.gpx',
            'dem': 'test.csv',
            'weight': 'weight.csv',
            'weather': 'weather.json'
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            temp_path = f.name
        
        try:
            self.exporter.write_audit_package(
                temp_path, assessment, segments, stats, waypoints,
                members, [], [], input_files
            )
            
            assert os.path.exists(temp_path)
            
            with open(temp_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            assert 'audit_metadata' in data
            assert 'risk_assessment' in data
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def test_risk_assessment_only(self):
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
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            temp_path = f.name
        
        try:
            self.exporter.write_risk_assessment_only(temp_path, assessment)
            
            assert os.path.exists(temp_path)
            
            with open(temp_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            assert 'assessment_id' in data
            assert 'overall_risk_level' in data
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
