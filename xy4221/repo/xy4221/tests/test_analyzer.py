from datetime import datetime, timedelta

import pytest

from power_checker.config import create_default_config, CircuitConfig
from power_checker.analyzer import PowerAnalyzer
from power_checker.models import LogRecord, PlanRecord, PowerUnit, RiskType, RiskSeverity


class TestPowerAnalyzer:
    @pytest.fixture
    def config(self):
        config = create_default_config("测试")
        config.circuits = [
            CircuitConfig(id="A1", name="回路A1", phase="A", rated_current=32.0, max_current=40.0),
            CircuitConfig(id="B1", name="回路B1", phase="B", rated_current=32.0, max_current=40.0),
            CircuitConfig(id="C1", name="回路C1", phase="C", rated_current=32.0, max_current=40.0),
        ]
        return config

    @pytest.fixture
    def analyzer(self, config):
        return PowerAnalyzer(config)

    def test_peak_load_calculation(self, analyzer):
        base_time = datetime(2024, 5, 15, 14, 0, 0)
        records = [
            LogRecord(
                id="",
                timestamp=base_time + timedelta(minutes=i),
                circuit_id="A1",
                current=20.0 + i,
                unit=PowerUnit.AMPERE,
            )
            for i in range(10)
        ]

        result = analyzer.analyze(records, [], time_window_minutes=5)
        
        assert "A1" in result.peak_loads
        assert result.peak_loads["A1"] > 0

    def test_sustained_overload_detection(self, analyzer):
        base_time = datetime(2024, 5, 15, 14, 0, 0)
        
        records = [
            LogRecord(
                id="",
                timestamp=base_time + timedelta(minutes=i),
                circuit_id="A1",
                current=38.0,
                unit=PowerUnit.AMPERE,
            )
            for i in range(10)
        ]

        result = analyzer.analyze(records, [], time_window_minutes=5)
        
        assert len(result.sustained_overloads) > 0
        
        for risk in result.sustained_overloads:
            assert risk.risk_type == RiskType.SUSTAINED_OVERLOAD
            assert risk.circuit_id == "A1"

    def test_phase_imbalance_detection(self, analyzer):
        base_time = datetime(2024, 5, 15, 14, 0, 0)
        
        records = []
        for i in range(10):
            t = base_time + timedelta(minutes=i)
            records.append(LogRecord(id="", timestamp=t, circuit_id="A1", current=30.0, unit=PowerUnit.AMPERE))
            records.append(LogRecord(id="", timestamp=t, circuit_id="B1", current=5.0, unit=PowerUnit.AMPERE))
            records.append(LogRecord(id="", timestamp=t, circuit_id="C1", current=5.0, unit=PowerUnit.AMPERE))

        result = analyzer.analyze(records, [], time_window_minutes=5)
        
        assert len(result.phase_imbalances) > 0
        
        for risk in result.phase_imbalances:
            assert risk.risk_type == RiskType.PHASE_IMBALANCE

    def test_unplanned_power_detection(self, analyzer):
        base_time = datetime(2024, 5, 15, 14, 0, 0)
        
        log_records = [
            LogRecord(
                id="",
                timestamp=base_time + timedelta(minutes=5),
                circuit_id="B1",
                current=25.0,
                unit=PowerUnit.AMPERE,
            ),
        ]
        
        plan_records = [
            PlanRecord(
                id="",
                circuit_id="A1",
                device_name="追光灯",
                device_id="LIGHT-001",
                power_on_time=base_time,
                power_off_time=base_time + timedelta(hours=1),
            ),
        ]

        result = analyzer.analyze(log_records, plan_records, time_window_minutes=5)
        
        assert len(result.unplanned_powers) > 0
        
        for risk in result.unplanned_powers:
            assert risk.risk_type == RiskType.UNPLANNED_POWER
            assert risk.circuit_id == "B1"

    def test_time_deviation_detection(self, analyzer):
        base_time = datetime(2024, 5, 15, 14, 0, 0)
        
        log_records = [
            LogRecord(
                id="",
                timestamp=base_time + timedelta(minutes=10),
                circuit_id="A1",
                current=25.0,
                unit=PowerUnit.AMPERE,
            ),
        ]
        
        plan_records = [
            PlanRecord(
                id="",
                circuit_id="A1",
                device_name="追光灯",
                device_id="LIGHT-001",
                power_on_time=base_time,
                power_off_time=base_time + timedelta(hours=1),
            ),
        ]

        analyzer.config.time_deviation_seconds = 300
        
        result = analyzer.analyze(log_records, plan_records, time_window_minutes=5)
        
        assert len(result.time_deviations) > 0
        
        for risk in result.time_deviations:
            assert risk.risk_type == RiskType.TIME_DEVIATION
