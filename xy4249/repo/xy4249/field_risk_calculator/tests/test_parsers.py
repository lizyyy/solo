import pytest
import os
import tempfile
import csv
import json
from pathlib import Path

from ..parsers.gpx_parser import GPXParser, Waypoint
from ..parsers.dem_parser import DEMParser, DEMPoint
from ..parsers.weight_parser import WeightParser, TeamMember
from ..parsers.weather_parser import WeatherParser, WeatherCondition, WaterCrossingPoint


class TestGPXParser:
    def test_parse_valid_gpx(self, sample_gpx_path):
        parser = GPXParser()
        parser.parse(sample_gpx_path)
        
        waypoints = parser.get_all_route_points()
        assert len(waypoints) >= 2
        assert all(wp.lat is not None and wp.lon is not None for wp in waypoints)

    def test_validate_valid_gpx(self, sample_gpx_path):
        parser = GPXParser()
        parser.parse(sample_gpx_path)
        
        errors = parser.validate()
        assert len(errors) == 0

    def test_waypoint_data(self, sample_gpx_path):
        parser = GPXParser()
        parser.parse(sample_gpx_path)
        
        waypoints = parser.get_all_route_points()
        for wp in waypoints:
            assert isinstance(wp.lat, float)
            assert isinstance(wp.lon, float)
            assert -90 <= wp.lat <= 90
            assert -180 <= wp.lon <= 180


class TestDEMParser:
    def test_parse_valid_dem(self, sample_dem_path):
        parser = DEMParser()
        parser.parse(sample_dem_path)
        
        assert len(parser.points) >= 2
        assert 'point_count' in parser.metadata

    def test_validate_valid_dem(self, sample_dem_path):
        parser = DEMParser()
        parser.parse(sample_dem_path)
        
        errors = parser.validate()
        assert len(errors) == 0

    def test_dem_point_elevation(self, sample_dem_path):
        parser = DEMParser()
        parser.parse(sample_dem_path)
        
        for point in parser.points:
            assert isinstance(point.elevation, float)
            assert -500 <= point.elevation <= 9000

    def test_get_elevation_at(self, sample_dem_path):
        parser = DEMParser()
        parser.parse(sample_dem_path)
        
        first_point = parser.points[0]
        elevation = parser.get_elevation_at(first_point.lat, first_point.lon)
        
        assert elevation is not None
        assert elevation == first_point.elevation


class TestWeightParser:
    def test_parse_valid_weight(self, sample_weight_path):
        parser = WeightParser()
        parser.parse(sample_weight_path)
        
        assert len(parser.team_members) >= 1
        assert 'member_count' in parser.metadata

    def test_validate_valid_weight(self, sample_weight_path):
        parser = WeightParser()
        parser.parse(sample_weight_path)
        
        errors = parser.validate()
        assert len(errors) == 0

    def test_team_member_calculations(self):
        member = TeamMember(
            name="测试队员",
            role="队员",
            body_weight=70.0,
            pack_weight=21.0,
            max_recommended_weight=25.0
        )
        
        assert member.total_weight == 91.0
        assert member.weight_ratio == 30.0

    def test_get_members_over_limit(self, sample_weight_path):
        parser = WeightParser()
        parser.parse(sample_weight_path)
        
        over_limit = parser.get_members_over_limit()
        assert isinstance(over_limit, list)

    def test_high_weight_ratio(self):
        member = TeamMember(
            name="高负重队员",
            role="队员",
            body_weight=60.0,
            pack_weight=24.0,
            max_recommended_weight=20.0
        )
        
        assert member.weight_ratio == 40.0
        assert member.pack_weight > member.max_recommended_weight


class TestWeatherParser:
    def test_parse_valid_weather(self, sample_weather_path):
        parser = WeatherParser()
        parser.parse(sample_weather_path)
        
        assert len(parser.forecasts) >= 1
        assert 'forecast_days' in parser.metadata

    def test_validate_valid_weather(self, sample_weather_path):
        parser = WeatherParser()
        parser.parse(sample_weather_path)
        
        errors = parser.validate()
        assert len(errors) == 0

    def test_water_crossing_detection(self, sample_weather_path):
        parser = WeatherParser()
        parser.parse(sample_weather_path)
        
        dangerous = parser.get_dangerous_crossings()
        assert isinstance(dangerous, list)

    def test_extreme_conditions(self, sample_weather_path):
        parser = WeatherParser()
        parser.parse(sample_weather_path)
        
        extreme = parser.get_extreme_conditions()
        assert isinstance(extreme, dict)
        assert 'high_wind' in extreme
        assert 'heavy_rain' in extreme


@pytest.fixture
def sample_gpx_path():
    examples_dir = Path(__file__).parent.parent / 'examples'
    gpx_file = examples_dir / 'route.gpx'
    return str(gpx_file)


@pytest.fixture
def sample_dem_path():
    examples_dir = Path(__file__).parent.parent / 'examples'
    dem_file = examples_dir / 'dem.csv'
    return str(dem_file)


@pytest.fixture
def sample_weight_path():
    examples_dir = Path(__file__).parent.parent / 'examples'
    weight_file = examples_dir / 'weight.csv'
    return str(weight_file)


@pytest.fixture
def sample_weather_path():
    examples_dir = Path(__file__).parent.parent / 'examples'
    weather_file = examples_dir / 'weather.json'
    return str(weather_file)
