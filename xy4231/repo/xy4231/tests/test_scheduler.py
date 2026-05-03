import pytest
from datetime import datetime, timedelta, timezone

from freq_coordinator.models import (
    SupplyStation,
    RepeaterStation,
    VolunteerShift,
    Device,
)
from freq_coordinator.scheduler.rules import (
    SchedulerRules,
    ChannelAssigner,
    DeviceAssigner,
    calculate_haversine_distance,
)


class TestHaversineDistance:
    def test_same_location(self):
        distance = calculate_haversine_distance(40.0, 116.0, 40.0, 116.0)
        assert distance == 0.0
    
    def test_known_distance(self):
        distance = calculate_haversine_distance(40.7128, -74.0060, 51.5074, -0.1278)
        assert 5500 < distance < 5600
    
    def test_positive_negative(self):
        dist1 = calculate_haversine_distance(40.0, 116.0, 30.0, 100.0)
        dist2 = calculate_haversine_distance(30.0, 100.0, 40.0, 116.0)
        assert abs(dist1 - dist2) < 0.01


class TestSchedulerRules:
    @pytest.fixture
    def sample_stations(self):
        return [
            SupplyStation(
                id="S001", name="起点", latitude=40.123456, longitude=116.789012,
                distance_from_start=0.0, elevation=450, criticality="critical"
            ),
            SupplyStation(
                id="S002", name="CP1", latitude=40.128900, longitude=116.795000,
                distance_from_start=5.2, elevation=520, criticality="high"
            ),
        ]
    
    @pytest.fixture
    def sample_repeaters(self):
        return [
            RepeaterStation(
                id="R001", name="起点中继", latitude=40.123456, longitude=116.789012,
                elevation=480, tx_frequency=145.525, rx_frequency=144.925,
                coverage_radius_km=8.0
            ),
        ]
    
    @pytest.fixture
    def sample_shifts(self):
        tz = timezone.utc
        base_time = datetime(2024, 5, 15, 6, 0, 0, tzinfo=tz)
        return [
            VolunteerShift(
                id="shift-001", volunteer_name="张三", volunteer_id="V001",
                station_id="S001", start_time=base_time, end_time=base_time + timedelta(hours=6),
            ),
            VolunteerShift(
                id="shift-002", volunteer_name="李四", volunteer_id="V002",
                station_id="S001", start_time=base_time + timedelta(hours=5, minutes=30),
                end_time=base_time + timedelta(hours=11, minutes=30),
            ),
        ]
    
    @pytest.fixture
    def sample_devices(self):
        return [
            Device(id="D001", battery_capacity_mah=1800, current_charge_percent=100),
            Device(id="D002", battery_capacity_mah=1800, current_charge_percent=80),
        ]
    
    @pytest.fixture
    def rules(self, sample_stations, sample_repeaters, sample_shifts, sample_devices):
        return SchedulerRules(
            stations=sample_stations,
            repeaters=sample_repeaters,
            shifts=sample_shifts,
            devices=sample_devices,
        )
    
    def test_get_shifts_by_station(self, rules):
        shifts = rules.get_shifts_by_station("S001")
        assert len(shifts) == 2
    
    def test_get_all_frequencies(self, rules):
        freqs = rules.get_all_frequencies_in_use()
        assert 145.525 in freqs
        assert 144.925 in freqs
    
    def test_check_frequency_conflict_same(self, rules):
        assert rules.check_frequency_conflict(145.525, 145.525) is True
    
    def test_check_frequency_conflict_close(self, rules):
        assert rules.check_frequency_conflict(145.525, 145.530) is True
    
    def test_check_frequency_conflict_far(self, rules):
        assert rules.check_frequency_conflict(145.525, 146.000) is False
    
    def test_check_time_overlap_true(self, rules, sample_shifts):
        shift1, shift2 = sample_shifts
        assert rules.check_time_overlap(shift1, shift2) is True
    
    def test_check_time_overlap_false(self, rules, sample_shifts):
        tz = timezone.utc
        base_time = datetime(2024, 5, 15, 6, 0, 0, tzinfo=tz)
        shift1 = VolunteerShift(
            id="s1", volunteer_name="A", volunteer_id="v1", station_id="S001",
            start_time=base_time, end_time=base_time + timedelta(hours=4),
        )
        shift2 = VolunteerShift(
            id="s2", volunteer_name="B", volunteer_id="v2", station_id="S001",
            start_time=base_time + timedelta(hours=5), end_time=base_time + timedelta(hours=9),
        )
        assert rules.check_time_overlap(shift1, shift2) is False
    
    def test_get_handover_gap(self, rules, sample_shifts):
        tz = timezone.utc
        base_time = datetime(2024, 5, 15, 6, 0, 0, tzinfo=tz)
        shift1 = VolunteerShift(
            id="s1", volunteer_name="A", volunteer_id="v1", station_id="S001",
            start_time=base_time, end_time=base_time + timedelta(hours=4),
        )
        shift2 = VolunteerShift(
            id="s2", volunteer_name="B", volunteer_id="v2", station_id="S001",
            start_time=base_time + timedelta(hours=4, minutes=15),
            end_time=base_time + timedelta(hours=8),
        )
        gap = rules.get_handover_gap(shift1, shift2)
        assert gap.total_seconds() == 15 * 60
    
    def test_is_station_covered(self, rules, sample_stations):
        station = sample_stations[0]
        is_covered, distance, repeaters = rules.is_station_covered(station)
        assert is_covered is True
        assert distance == 0.0
        assert len(repeaters) == 1
    
    def test_nearest_repeater(self, rules, sample_stations):
        station = sample_stations[0]
        result = rules.get_nearest_repeater(station)
        assert result is not None
        repeater, distance = result
        assert repeater.id == "R001"


class TestChannelAssigner:
    @pytest.fixture
    def rules(self):
        stations = [
            SupplyStation(
                id="S001", name="起点", latitude=40.123456, longitude=116.789012,
                distance_from_start=0.0, elevation=450
            ),
        ]
        repeaters = [
            RepeaterStation(
                id="R001", name="起点中继", latitude=40.123456, longitude=116.789012,
                elevation=480, tx_frequency=145.525, rx_frequency=144.925,
                coverage_radius_km=8.0
            ),
        ]
        return SchedulerRules(
            stations=stations,
            repeaters=repeaters,
            shifts=[],
            devices=[],
        )
    
    def test_assign_channels(self, rules):
        assigner = ChannelAssigner(rules)
        assignments = assigner.assign_channels()
        
        assert "*" in assignments
        emergency_channels = assignments["*"]
        assert len(emergency_channels) == 1
        assert emergency_channels[0].frequency == 145.000
        assert emergency_channels[0].purpose == "emergency"


class TestDeviceAssigner:
    @pytest.fixture
    def rules(self):
        tz = timezone.utc
        base_time = datetime(2024, 5, 15, 6, 0, 0, tzinfo=tz)
        
        stations = [
            SupplyStation(
                id="S001", name="起点", latitude=40.123456, longitude=116.789012,
                distance_from_start=0.0, elevation=450
            ),
        ]
        shifts = [
            VolunteerShift(
                id="shift-001", volunteer_name="张三", volunteer_id="V001",
                station_id="S001", start_time=base_time, end_time=base_time + timedelta(hours=6),
            ),
            VolunteerShift(
                id="shift-002", volunteer_name="李四", volunteer_id="V002",
                station_id="S001", start_time=base_time + timedelta(hours=5, minutes=30),
                end_time=base_time + timedelta(hours=11, minutes=30),
            ),
        ]
        devices = [
            Device(id="D001", battery_capacity_mah=1800, current_charge_percent=100, status="available"),
            Device(id="D002", battery_capacity_mah=1800, current_charge_percent=80, status="available"),
        ]
        
        return SchedulerRules(
            stations=stations,
            repeaters=[],
            shifts=shifts,
            devices=devices,
        )
    
    def test_assign_devices(self, rules):
        assigner = DeviceAssigner(rules)
        assignments = assigner.assign_devices()
        
        assert len(assignments) == 2
        assert "D001" in assignments
        assert "D002" in assignments
    
    def test_get_device_for_shift(self, rules):
        assigner = DeviceAssigner(rules)
        assigner.assign_devices()
        
        device_id = assigner.get_device_for_shift("shift-001")
        assert device_id is not None
