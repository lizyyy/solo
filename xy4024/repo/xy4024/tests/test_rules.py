from datetime import datetime
import pytest

from track_cleaner.models.track import TrackPoint, TrackSegment, Track
from track_cleaner.config import AppConfig
from track_cleaner.rules import (
    DuplicateTimestampRule,
    OutOfOrderTimestampRule,
    SpeedAnomalyRule,
    BreakpointRule,
    ElevationSpikeRule,
    MissingCoordinatesRule,
    apply_all_rules,
)


class TestDuplicateTimestampRule:
    
    def test_duplicate_detection(self):
        ts = datetime(2024, 10, 15, 8, 0, 0)
        points = [
            TrackPoint(latitude=39.9945, longitude=116.2080, timestamp=ts),
            TrackPoint(latitude=39.9955, longitude=116.2090, timestamp=ts),
            TrackPoint(latitude=39.9965, longitude=116.2100, timestamp=datetime(2024, 10, 15, 8, 5, 0)),
        ]
        segment = TrackSegment(points=points)
        track = Track(name="Test", segments=[segment])
        
        rule = DuplicateTimestampRule()
        results = rule.apply(track, AppConfig())
        
        assert len(results) == 1
        assert results[0].point_index == 1


class TestOutOfOrderTimestampRule:
    
    def test_out_of_order_detection(self):
        points = [
            TrackPoint(latitude=39.9945, longitude=116.2080, timestamp=datetime(2024, 10, 15, 8, 0, 0)),
            TrackPoint(latitude=39.9955, longitude=116.2090, timestamp=datetime(2024, 10, 15, 7, 55, 0)),
            TrackPoint(latitude=39.9965, longitude=116.2100, timestamp=datetime(2024, 10, 15, 8, 5, 0)),
        ]
        segment = TrackSegment(points=points)
        track = Track(name="Test", segments=[segment])
        
        rule = OutOfOrderTimestampRule()
        results = rule.apply(track, AppConfig())
        
        assert len(results) == 1
        assert results[0].point_index == 1


class TestElevationSpikeRule:
    
    def test_spike_detection(self):
        base_elev = 200.0
        spike_elev = 500.0
        
        points = [
            TrackPoint(latitude=39.9945 + i * 0.001, longitude=116.2080, 
                       elevation=base_elev + i * 10, timestamp=datetime(2024, 10, 15, 8, 0, i * 60))
            for i in range(5)
        ]
        points[2].elevation = spike_elev
        
        segment = TrackSegment(points=points)
        track = Track(name="Test", segments=[segment])
        
        config = AppConfig(elevation_spike_threshold=100.0)
        rule = ElevationSpikeRule()
        results = rule.apply(track, config)
        
        assert len(results) == 1
        assert results[0].point_index == 2


class TestMissingCoordinatesRule:
    
    def test_missing_lat(self):
        points = [
            TrackPoint(latitude=39.9945, longitude=116.2080),
            TrackPoint(latitude=None, longitude=116.2090),
            TrackPoint(latitude=39.9965, longitude=116.2100),
        ]
        segment = TrackSegment(points=points)
        track = Track(name="Test", segments=[segment])
        
        rule = MissingCoordinatesRule()
        results = rule.apply(track, AppConfig())
        
        assert len(results) == 1
        assert results[0].point_index == 1


class TestApplyAllRules:
    
    def test_multiple_rules(self):
        ts = datetime(2024, 10, 15, 8, 0, 0)
        points = [
            TrackPoint(latitude=39.9945, longitude=116.2080, elevation=100.0, timestamp=ts),
            TrackPoint(latitude=39.9955, longitude=116.2090, elevation=150.0, timestamp=ts),
            TrackPoint(latitude=39.9965, longitude=None, elevation=200.0, timestamp=datetime(2024, 10, 15, 8, 5, 0)),
        ]
        segment = TrackSegment(points=points)
        track = Track(name="Test", segments=[segment])
        
        results = apply_all_rules(track, AppConfig())
        
        assert len(results) >= 2
