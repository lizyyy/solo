from datetime import datetime
import pytest

from track_cleaner.models.track import TrackPoint, TrackSegment, Track
from track_cleaner.geo import (
    haversine_distance,
    calculate_speed,
    calculate_total_distance,
    calculate_elevation_gain,
    calculate_elevation_loss,
    point_to_line_distance,
)


class TestHaversineDistance:
    
    def test_same_point(self):
        p1 = TrackPoint(latitude=39.9945, longitude=116.2080)
        p2 = TrackPoint(latitude=39.9945, longitude=116.2080)
        dist = haversine_distance(p1, p2)
        assert abs(dist) < 0.001
    
    def test_known_distance(self):
        p1 = TrackPoint(latitude=39.9042, longitude=116.4074)
        p2 = TrackPoint(latitude=31.2304, longitude=121.4737)
        dist = haversine_distance(p1, p2)
        assert dist > 1000000


class TestCalculateSpeed:
    
    def test_speed_calculation(self):
        p1 = TrackPoint(
            latitude=39.9945,
            longitude=116.2080,
            timestamp=datetime(2024, 10, 15, 8, 0, 0)
        )
        p2 = TrackPoint(
            latitude=39.9955,
            longitude=116.2090,
            timestamp=datetime(2024, 10, 15, 8, 2, 30)
        )
        speed = calculate_speed(p1, p2)
        assert speed is not None
        assert speed > 0
    
    def test_no_timestamp(self):
        p1 = TrackPoint(latitude=39.9945, longitude=116.2080)
        p2 = TrackPoint(latitude=39.9955, longitude=116.2090)
        speed = calculate_speed(p1, p2)
        assert speed is None
    
    def test_negative_time(self):
        p1 = TrackPoint(
            latitude=39.9945,
            longitude=116.2080,
            timestamp=datetime(2024, 10, 15, 8, 10, 0)
        )
        p2 = TrackPoint(
            latitude=39.9955,
            longitude=116.2090,
            timestamp=datetime(2024, 10, 15, 8, 0, 0)
        )
        speed = calculate_speed(p1, p2)
        assert speed is None


class TestTrackCalculations:
    
    def create_test_track(self):
        points = [
            TrackPoint(
                latitude=39.9945 + i * 0.001,
                longitude=116.2080 + i * 0.001,
                elevation=100.0 + i * 50.0,
                timestamp=datetime(2024, 10, 15, 8, 0, i * 120)
            )
            for i in range(5)
        ]
        segment = TrackSegment(points=points)
        return Track(name="Test Track", segments=[segment])
    
    def test_total_distance(self):
        track = self.create_test_track()
        distance = calculate_total_distance(track)
        assert distance > 0
    
    def test_elevation_gain(self):
        track = self.create_test_track()
        gain = calculate_elevation_gain(track, threshold=1.0)
        assert gain > 0
    
    def test_elevation_loss(self):
        points = [
            TrackPoint(
                latitude=39.9945 + i * 0.001,
                longitude=116.2080 + i * 0.001,
                elevation=300.0 - i * 50.0,
            )
            for i in range(5)
        ]
        segment = TrackSegment(points=points)
        track = Track(name="Test Track", segments=[segment])
        
        loss = calculate_elevation_loss(track, threshold=1.0)
        assert loss > 0


class TestPointToLineDistance:
    
    def test_point_on_line(self):
        line_start = TrackPoint(latitude=39.9945, longitude=116.2080)
        line_end = TrackPoint(latitude=39.9965, longitude=116.2100)
        point = TrackPoint(latitude=39.9955, longitude=116.2090)
        
        dist = point_to_line_distance(point, line_start, line_end)
        assert dist < 100
    
    def test_point_off_line(self):
        line_start = TrackPoint(latitude=39.9945, longitude=116.2080)
        line_end = TrackPoint(latitude=39.9945, longitude=116.2100)
        point = TrackPoint(latitude=39.9965, longitude=116.2090)
        
        dist = point_to_line_distance(point, line_start, line_end)
        assert dist > 100
