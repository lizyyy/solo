import pytest
from datetime import datetime, timedelta, timezone

from freq_coordinator.models import (
    SupplyStation,
    RepeaterStation,
    VolunteerShift,
    Device,
    AssignedChannel,
    CommunicationPlan,
    ScheduleEntry,
)
from freq_coordinator.scheduler.rules import SchedulerRules
from freq_coordinator.risk_engine.detectors import (
    CoverageGapDetector,
    FrequencyConflictDetector,
    HandoverGapDetector,
    BatteryRiskDetector,
)
from freq_coordinator.risk_engine.engine import RiskEngine


class TestCoverageGapDetector:
    @pytest.fixture
    def rules_with_coverage(self):
        stations = [
            SupplyStation(
                id="S001", name="起点", latitude=40.123456, longitude=116.789012,
                distance_from_start=0.0, elevation=450, criticality="critical"
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
    
    @pytest.fixture
    def rules_without_coverage(self):
        stations = [
            SupplyStation(
                id="S001", name="起点", latitude=40.123456, longitude=116.789012,
                distance_from_start=0.0, elevation=450, criticality="critical"
            ),
        ]
        repeaters = [
            RepeaterStation(
                id="R001", name="远距中继", latitude=50.0, longitude=116.0,
                elevation=480, tx_frequency=145.525, rx_frequency=144.925,
                coverage_radius_km=1.0
            ),
        ]
        return SchedulerRules(
            stations=stations,
            repeaters=repeaters,
            shifts=[],
            devices=[],
        )
    
    def test_no_coverage_gap(self, rules_with_coverage):
        detector = CoverageGapDetector(rules_with_coverage)
        risks = detector.detect()
        assert len(risks) == 0
    
    def test_has_coverage_gap(self, rules_without_coverage):
        detector = CoverageGapDetector(rules_without_coverage)
        risks = detector.detect()
        assert len(risks) == 1
        assert risks[0].type == "coverage_gap"
        assert risks[0].severity == "critical"


class TestFrequencyConflictDetector:
    @pytest.fixture
    def rules_with_conflict(self):
        stations = [
            SupplyStation(
                id="S001", name="站点1", latitude=40.123456, longitude=116.789012,
                distance_from_start=0.0, elevation=450
            ),
            SupplyStation(
                id="S002", name="站点2", latitude=40.123500, longitude=116.789050,
                distance_from_start=0.1, elevation=450
            ),
        ]
        repeaters = [
            RepeaterStation(
                id="R001", name="中继1", latitude=40.123456, longitude=116.789012,
                elevation=480, tx_frequency=145.525, rx_frequency=144.925,
                coverage_radius_km=5.0
            ),
            RepeaterStation(
                id="R002", name="中继2", latitude=40.123500, longitude=116.789050,
                elevation=480, tx_frequency=145.525, rx_frequency=144.925,
                coverage_radius_km=5.0
            ),
        ]
        return SchedulerRules(
            stations=stations,
            repeaters=repeaters,
            shifts=[],
            devices=[],
        )
    
    @pytest.fixture
    def rules_without_conflict(self):
        repeaters = [
            RepeaterStation(
                id="R001", name="中继1", latitude=40.123456, longitude=116.789012,
                elevation=480, tx_frequency=145.525, rx_frequency=144.925,
                coverage_radius_km=1.0
            ),
            RepeaterStation(
                id="R002", name="中继2", latitude=41.0, longitude=117.0,
                elevation=480, tx_frequency=145.525, rx_frequency=144.925,
                coverage_radius_km=1.0
            ),
        ]
        return SchedulerRules(
            stations=[],
            repeaters=repeaters,
            shifts=[],
            devices=[],
        )
    
    def test_repeater_conflict(self, rules_with_conflict):
        detector = FrequencyConflictDetector(rules_with_conflict)
        risks = detector.detect()
        assert len(risks) > 0
        assert any(r.type == "frequency_conflict" for r in risks)


class TestHandoverGapDetector:
    @pytest.fixture
    def rules_with_good_handover(self):
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
                station_id="S001", start_time=base_time + timedelta(hours=5, minutes=45),
                end_time=base_time + timedelta(hours=12),
            ),
        ]
        return SchedulerRules(
            stations=stations,
            repeaters=[],
            shifts=shifts,
            devices=[],
        )
    
    @pytest.fixture
    def rules_with_insufficient_handover(self):
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
                station_id="S001", start_time=base_time + timedelta(hours=6, minutes=5),
                end_time=base_time + timedelta(hours=12),
            ),
        ]
        return SchedulerRules(
            stations=stations,
            repeaters=[],
            shifts=shifts,
            devices=[],
        )
    
    @pytest.fixture
    def rules_with_large_gap(self):
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
                station_id="S001", start_time=base_time, end_time=base_time + timedelta(hours=4),
            ),
            VolunteerShift(
                id="shift-002", volunteer_name="李四", volunteer_id="V002",
                station_id="S001", start_time=base_time + timedelta(hours=5),
                end_time=base_time + timedelta(hours=12),
            ),
        ]
        return SchedulerRules(
            stations=stations,
            repeaters=[],
            shifts=shifts,
            devices=[],
        )
    
    def test_good_handover(self, rules_with_good_handover):
        detector = HandoverGapDetector(rules_with_good_handover, min_handover_minutes=10)
        risks = detector.detect()
        assert len(risks) == 0
    
    def test_insufficient_handover(self, rules_with_insufficient_handover):
        detector = HandoverGapDetector(rules_with_insufficient_handover, min_handover_minutes=10)
        risks = detector.detect()
        assert len(risks) >= 1
    
    def test_large_gap(self, rules_with_large_gap):
        detector = HandoverGapDetector(rules_with_large_gap, min_handover_minutes=10)
        risks = detector.detect()
        assert len(risks) >= 1


class TestBatteryRiskDetector:
    @pytest.fixture
    def rules_with_good_battery(self):
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
        ]
        devices = [
            Device(
                id="D001", battery_capacity_mah=1800, current_charge_percent=100,
                power_consumption_ma=180, status="available"
            ),
        ]
        
        rules = SchedulerRules(
            stations=stations,
            repeaters=[],
            shifts=shifts,
            devices=devices,
        )
        
        plan = CommunicationPlan()
        plan.schedule = [
            ScheduleEntry(
                shift_id="shift-001", volunteer_name="张三",
                station_id="S001", station_name="起点",
                start_time=base_time, end_time=base_time + timedelta(hours=6),
                device_id="D001", assigned_channels=[],
            ),
        ]
        
        return rules, plan
    
    @pytest.fixture
    def rules_with_low_battery(self):
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
        ]
        devices = [
            Device(
                id="D001", battery_capacity_mah=500, current_charge_percent=100,
                power_consumption_ma=200, status="available"
            ),
        ]
        
        rules = SchedulerRules(
            stations=stations,
            repeaters=[],
            shifts=shifts,
            devices=devices,
        )
        
        plan = CommunicationPlan()
        plan.schedule = [
            ScheduleEntry(
                shift_id="shift-001", volunteer_name="张三",
                station_id="S001", station_name="起点",
                start_time=base_time, end_time=base_time + timedelta(hours=6),
                device_id="D001", assigned_channels=[],
            ),
        ]
        
        return rules, plan
    
    def test_good_battery(self, rules_with_good_battery):
        rules, plan = rules_with_good_battery
        detector = BatteryRiskDetector(rules, plan, safety_margin_hours=1.0)
        risks = detector.detect()
        assert len(risks) == 0
    
    def test_low_battery(self, rules_with_low_battery):
        rules, plan = rules_with_low_battery
        detector = BatteryRiskDetector(rules, plan, safety_margin_hours=1.0)
        risks = detector.detect()
        assert len(risks) >= 1


class TestRiskEngine:
    @pytest.fixture
    def setup(self):
        tz = timezone.utc
        base_time = datetime(2024, 5, 15, 6, 0, 0, tzinfo=tz)
        
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
        shifts = [
            VolunteerShift(
                id="shift-001", volunteer_name="张三", volunteer_id="V001",
                station_id="S001", start_time=base_time, end_time=base_time + timedelta(hours=6),
            ),
        ]
        devices = [
            Device(id="D001", battery_capacity_mah=1800, current_charge_percent=100, status="available"),
        ]
        
        rules = SchedulerRules(
            stations=stations,
            repeaters=repeaters,
            shifts=shifts,
            devices=devices,
        )
        
        plan = CommunicationPlan()
        plan.schedule = [
            ScheduleEntry(
                shift_id="shift-001", volunteer_name="张三",
                station_id="S001", station_name="起点",
                start_time=base_time, end_time=base_time + timedelta(hours=6),
                device_id="D001", assigned_channels=[],
            ),
        ]
        
        return rules, plan
    
    def test_run_all_detectors(self, setup):
        rules, plan = setup
        engine = RiskEngine(rules, plan)
        risks = engine.run_all_detectors()
        
        assert isinstance(risks, list)
        summary = engine.get_summary()
        assert "by_severity" in summary
        assert "total" in summary["by_severity"]
    
    def test_get_critical_risks(self, setup):
        rules, plan = setup
        engine = RiskEngine(rules, plan)
        engine.run_all_detectors()
        
        critical = engine.get_critical_risks()
        assert isinstance(critical, list)
    
    def test_has_critical_or_high_risks(self, setup):
        rules, plan = setup
        engine = RiskEngine(rules, plan)
        engine.run_all_detectors()
        
        result = engine.has_critical_or_high_risks()
        assert isinstance(result, bool)
