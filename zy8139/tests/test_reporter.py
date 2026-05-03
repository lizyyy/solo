import pytest
import tempfile
import os
import csv
from datetime import datetime, timedelta, timezone
from pathlib import Path

from bacnet_validator.parser import (
    PointMapping,
    BACnetReading,
    ValidationRule,
    ParsedData,
)
from bacnet_validator.rules import Validator, ValidationResult, IssueType, IssueSeverity
from bacnet_validator.reporter import Reporter


def create_test_validation_result() -> ValidationResult:
    base_time = datetime.now(timezone.utc)
    
    mappings = [
        PointMapping(
            old_name="TempSensor",
            new_name="Zone1_Temp",
            unit="Celsius",
            unit_multiplier=1.0,
            floor="1",
            device_id="AHU-001",
            point_type="analog",
            description="Zone 1 Temperature",
        ),
        PointMapping(
            old_name="HumiditySensor",
            new_name="Zone1_RH",
            unit="percent",
            unit_multiplier=1.0,
            floor="1",
            device_id="AHU-001",
            point_type="analog",
            description="Zone 1 Humidity",
        ),
    ]
    
    readings = [
        BACnetReading(
            point_name="TempSensor",
            floor="1",
            device_id="AHU-001",
            value=22.5,
            unit="Celsius",
            timestamp=base_time,
            raw_timestamp=base_time.isoformat(),
        ),
        BACnetReading(
            point_name="TempSensor",
            floor="1",
            device_id="AHU-001",
            value=35.0,
            unit="Celsius",
            timestamp=base_time + timedelta(minutes=1),
            raw_timestamp=(base_time + timedelta(minutes=1)).isoformat(),
        ),
        BACnetReading(
            point_name="HumiditySensor",
            floor="1",
            device_id="AHU-001",
            value=95.0,
            unit="percent",
            timestamp=base_time,
            raw_timestamp=base_time.isoformat(),
        ),
    ]
    
    rules = [
        ValidationRule(
            rule_type="temperature",
            point_pattern="Temp",
            staleness_threshold_seconds=300,
            high_alarm_threshold=30.0,
            low_alarm_threshold=15.0,
        ),
        ValidationRule(
            rule_type="humidity",
            point_pattern="Humidity|RH",
            staleness_threshold_seconds=300,
            high_alarm_threshold=90.0,
        ),
    ]
    
    mappings_dict = {m.full_identifier: m for m in mappings}
    
    parsed_data = ParsedData(
        point_mappings=mappings_dict,
        bacnet_readings=readings,
        rules=rules,
    )
    
    validator = Validator(parsed_data)
    return validator.validate()


class TestReporter:
    def test_generate_issues_csv(self):
        result = create_test_validation_result()
        reporter = Reporter(result)
        
        with tempfile.TemporaryDirectory() as temp_dir:
            csv_path = os.path.join(temp_dir, "issues.csv")
            reporter.generate_issues_csv(csv_path)
            
            assert os.path.exists(csv_path)
            
            with open(csv_path, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                rows = list(reader)
                
                assert len(rows) > 0
                
                header = rows[0]
                assert "Severity" in header
                assert "Issue Type" in header
                assert "Point Identifier" in header
                assert "Message" in header

    def test_generate_mapping_report_md(self):
        result = create_test_validation_result()
        reporter = Reporter(result)
        
        with tempfile.TemporaryDirectory() as temp_dir:
            md_path = os.path.join(temp_dir, "mapping_report.md")
            reporter.generate_mapping_report_md(md_path)
            
            assert os.path.exists(md_path)
            
            with open(md_path, "r", encoding="utf-8") as f:
                content = f.read()
                
                assert "# BACnet Gateway Upgrade Validation Report" in content
                assert "## Summary" in content
                assert "## Issues Summary" in content
                assert "Total Points" in content

    def test_generate_timeline_html(self):
        result = create_test_validation_result()
        reporter = Reporter(result)
        
        with tempfile.TemporaryDirectory() as temp_dir:
            html_path = os.path.join(temp_dir, "timeline.html")
            reporter.generate_timeline_html(html_path)
            
            assert os.path.exists(html_path)
            
            with open(html_path, "r", encoding="utf-8") as f:
                content = f.read()
                
                assert "<!DOCTYPE html>" in content
                assert "BACnet Upgrade Validation Timeline" in content
                assert "<script>" in content

    def test_generate_all(self):
        result = create_test_validation_result()
        reporter = Reporter(result)
        
        with tempfile.TemporaryDirectory() as temp_dir:
            output_files = reporter.generate_all(temp_dir)
            
            assert "issues_csv" in output_files
            assert "mapping_report_md" in output_files
            assert "timeline_html" in output_files
            
            assert os.path.exists(output_files["issues_csv"])
            assert os.path.exists(output_files["mapping_report_md"])
            assert os.path.exists(output_files["timeline_html"])

    def test_empty_result(self):
        empty_mappings = {}
        empty_readings = []
        empty_rules = []
        
        parsed_data = ParsedData(
            point_mappings=empty_mappings,
            bacnet_readings=empty_readings,
            rules=empty_rules,
        )
        
        validator = Validator(parsed_data)
        result = validator.validate()
        
        reporter = Reporter(result)
        
        with tempfile.TemporaryDirectory() as temp_dir:
            csv_path = os.path.join(temp_dir, "issues.csv")
            reporter.generate_issues_csv(csv_path)
            
            with open(csv_path, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                rows = list(reader)
                
                assert len(rows) == 1

    def test_timeline_html_contains_issue_data(self):
        result = create_test_validation_result()
        reporter = Reporter(result)
        
        with tempfile.TemporaryDirectory() as temp_dir:
            html_path = os.path.join(temp_dir, "timeline.html")
            reporter.generate_timeline_html(html_path)
            
            with open(html_path, "r", encoding="utf-8") as f:
                content = f.read()
                
                assert "issuesData" in content
                assert "timestamp" in content
                assert "severity" in content
                assert "message" in content


class TestIntegration:
    def test_full_validation_with_sample_data(self):
        sample_dir = Path(__file__).parent.parent / "samples"
        
        point_map_path = sample_dir / "point_map.csv"
        bacnet_reads_path = sample_dir / "bacnet_reads.jsonl"
        rules_path = sample_dir / "rules.yaml"
        
        if not (point_map_path.exists() and bacnet_reads_path.exists() and rules_path.exists()):
            pytest.skip("Sample files not found")
        
        from bacnet_validator.parser import parse_all
        
        parsed_data = parse_all(
            str(point_map_path),
            str(bacnet_reads_path),
            str(rules_path),
        )
        
        validator = Validator(parsed_data)
        result = validator.validate()
        
        assert result.total_points > 0
        assert result.total_readings > 0
        
        reporter = Reporter(result)
        
        with tempfile.TemporaryDirectory() as temp_dir:
            output_files = reporter.generate_all(temp_dir)
            
            for file_path in output_files.values():
                assert os.path.exists(file_path)
