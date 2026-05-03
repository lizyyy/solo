import pytest
import math
from pathlib import Path

from ..terrain.calculator import TerrainCalculator, RouteSegment, RouteStatistics
from ..parsers.gpx_parser import Waypoint


class TestTerrainCalculator:
    def setup_method(self):
        self.calculator = TerrainCalculator()
        
    def test_calculate_segments_basic(self):
        waypoints = [
            Waypoint(lat=34.050000, lon=108.900000, elevation=1200.0),
            Waypoint(lat=34.052000, lon=108.901500, elevation=1250.0)
        ]
        
        segments = self.calculator.calculate_segments(waypoints)
        
        assert len(segments) == 1
        assert segments[0].segment_id == 0
        assert segments[0].distance_2d > 0

    def test_calculate_statistics(self):
        waypoints = [
            Waypoint(lat=34.050000, lon=108.900000, elevation=1200.0),
            Waypoint(lat=34.052000, lon=108.901500, elevation=1300.0),
            Waypoint(lat=34.054000, lon=108.903000, elevation=1250.0)
        ]
        
        segments = self.calculator.calculate_segments(waypoints)
        stats = self.calculator.calculate_statistics(segments)
        
        assert stats.total_elevation_gain >= 100
        assert stats.total_elevation_loss >= 50
        assert stats.min_elevation == 1200.0
        assert stats.max_elevation == 1300.0

    def test_haversine_distance(self):
        lat1, lon1 = 34.050000, 108.900000
        lat2, lon2 = 34.051000, 108.901000
        
        distance = self.calculator._haversine_distance(lat1, lon1, lat2, lon2)
        
        assert distance > 0
        assert isinstance(distance, float)

    def test_calculate_bearing(self):
        bearing = self.calculator._calculate_bearing(
            34.050000, 108.900000,
            34.051000, 108.901000
        )
        
        assert 0 <= bearing <= 360

    def test_estimate_time_basic(self):
        distance = 1000
        elevation_gain = 100
        elevation_loss = 0
        
        time = self.calculator._estimate_time(distance, elevation_gain, elevation_loss)
        
        assert time > 0
        assert isinstance(time, float)

    def test_estimate_water_basic(self):
        time_hours = 4.0
        elevation_gain = 500
        temperature = 25
        
        water = self.calculator._estimate_water(time_hours, elevation_gain, temperature)
        
        assert water > 0
        assert isinstance(water, float)

    def test_slope_segments(self):
        waypoints = [
            Waypoint(lat=34.050000, lon=108.900000, elevation=1200.0),
            Waypoint(lat=34.050100, lon=108.900100, elevation=1210.0),
            Waypoint(lat=34.050200, lon=108.900200, elevation=1205.0)
        ]
        
        segments = self.calculator.calculate_segments(waypoints)
        slope_segs = self.calculator.get_slope_segments(segments, min_slope_percent=5.0)
        
        assert isinstance(slope_segs, list)

    def test_retreat_points(self):
        waypoints = [
            Waypoint(lat=34.050000, lon=108.900000, elevation=1200.0),
            Waypoint(lat=34.050100, lon=108.900100, elevation=1250.0),
            Waypoint(lat=34.050200, lon=108.900200, elevation=1260.0)
        ]
        
        segments = self.calculator.calculate_segments(waypoints)
        retreat_points = self.calculator.get_retreat_points(segments, safe_slope_threshold=15.0)
        
        assert isinstance(retreat_points, list)

    def test_route_segment_properties(self):
        waypoints = [
            Waypoint(lat=34.050000, lon=108.900000, elevation=1200.0),
            Waypoint(lat=34.052000, lon=108.901500, elevation=1300.0)
        ]
        
        segments = self.calculator.calculate_segments(waypoints)
        seg = segments[0]
        
        assert seg.is_uphill == True
        assert hasattr(seg, 'slope_category')
        assert isinstance(seg.slope_category, str)

    def test_empty_waypoints(self):
        segments = self.calculator.calculate_segments([])
        assert len(segments) == 0
        
        stats = self.calculator.calculate_statistics([])
        assert stats.total_distance_2d == 0

    def test_single_waypoint(self):
        waypoints = [Waypoint(lat=34.050000, lon=108.900000, elevation=1200.0)]
        segments = self.calculator.calculate_segments(waypoints)
        assert len(segments) == 0
