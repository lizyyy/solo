import csv
import tempfile
from datetime import datetime
from pathlib import Path

import pytest

from power_checker.config import create_default_config
from power_checker.parser import LogParser, PlanParser
from power_checker.models import RecordStatus, RiskType, RiskSeverity


class TestLogParser:
    @pytest.fixture
    def config(self):
        return create_default_config("测试")

    @pytest.fixture
    def sample_log_file(self):
        rows = [
            ["timestamp", "circuit_id", "current", "unit", "phase", "voltage", "power_factor"],
            ["2024-05-15 14:00:00", "A1", "25.5", "A", "A", "220", "0.95"],
            ["2024-05-15 14:01:00", "A1", "26.2", "A", "A", "220", "0.94"],
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerows(rows)
            return f.name

    def test_parse_valid_records(self, config, sample_log_file):
        parser = LogParser(config)
        valid, quarantined, risks = parser.parse_file(sample_log_file)
        
        assert len(valid) == 2
        assert len(quarantined) == 0
        assert len(risks) == 0
        
        assert valid[0].circuit_id == "A1"
        assert valid[0].current == 25.5
        assert valid[0].timestamp.hour == 14

    def test_parse_missing_circuit_id(self, config):
        rows = [
            ["timestamp", "circuit_id", "current", "unit"],
            ["2024-05-15 14:00:00", "", "25.5", "A"],
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerows(rows)
            file_path = f.name

        parser = LogParser(config)
        valid, quarantined, risks = parser.parse_file(file_path)
        
        assert len(valid) == 0
        assert len(quarantined) == 1
        assert len(risks) == 1
        assert risks[0].risk_type == RiskType.MISSING_FIELD

    def test_parse_invalid_circuit(self, config):
        rows = [
            ["timestamp", "circuit_id", "current", "unit"],
            ["2024-05-15 14:00:00", "INVALID", "25.5", "A"],
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerows(rows)
            file_path = f.name

        parser = LogParser(config)
        valid, quarantined, risks = parser.parse_file(file_path)
        
        assert len(valid) == 0
        assert len(quarantined) == 1
        assert len(risks) == 1
        assert risks[0].risk_type == RiskType.INVALID_CIRCUIT

    def test_parse_duplicate_records(self, config):
        rows = [
            ["timestamp", "circuit_id", "current", "unit"],
            ["2024-05-15 14:00:00", "A1", "25.5", "A"],
            ["2024-05-15 14:00:00", "A1", "25.5", "A"],
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerows(rows)
            file_path = f.name

        parser = LogParser(config)
        valid, quarantined, risks = parser.parse_file(file_path)
        
        assert len(valid) == 1
        assert len(quarantined) == 1
        assert len(risks) == 1
        assert risks[0].risk_type == RiskType.DUPLICATE_RECORD

    def test_parse_invalid_current(self, config):
        rows = [
            ["timestamp", "circuit_id", "current", "unit"],
            ["2024-05-15 14:00:00", "A1", "abc", "A"],
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerows(rows)
            file_path = f.name

        parser = LogParser(config)
        valid, quarantined, risks = parser.parse_file(file_path)
        
        assert len(valid) == 0
        assert len(quarantined) == 1
        assert len(risks) == 1
        assert risks[0].risk_type == RiskType.INVALID_UNIT


class TestPlanParser:
    @pytest.fixture
    def config(self):
        return create_default_config("测试")

    @pytest.fixture
    def sample_plan_file(self):
        rows = [
            ["circuit_id", "device_name", "device_id", "power_on_time", "power_off_time", "expected_current"],
            ["A1", "追光灯", "LIGHT-001", "2024-05-15 13:55:00", "2024-05-15 14:30:00", "25"],
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerows(rows)
            return f.name

    def test_parse_valid_plans(self, config, sample_plan_file):
        parser = PlanParser(config)
        valid, quarantined, risks = parser.parse_file(sample_plan_file)
        
        assert len(valid) == 1
        assert len(quarantined) == 0
        assert len(risks) == 0
        
        assert valid[0].circuit_id == "A1"
        assert valid[0].device_name == "追光灯"
        assert valid[0].device_id == "LIGHT-001"

    def test_parse_missing_device_id(self, config):
        rows = [
            ["circuit_id", "device_name", "device_id"],
            ["A1", "追光灯", ""],
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerows(rows)
            file_path = f.name

        parser = PlanParser(config)
        valid, quarantined, risks = parser.parse_file(file_path)
        
        assert len(valid) == 0
        assert len(quarantined) == 1
        assert len(risks) == 1
        assert risks[0].risk_type == RiskType.MISSING_FIELD

    def test_parse_invalid_time(self, config):
        rows = [
            ["circuit_id", "device_name", "device_id", "power_on_time"],
            ["A1", "追光灯", "LIGHT-001", "invalid_time"],
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerows(rows)
            file_path = f.name

        parser = PlanParser(config)
        valid, quarantined, risks = parser.parse_file(file_path)
        
        assert len(valid) == 1
        assert valid[0].power_on_time is None
