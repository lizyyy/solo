import pytest
import tempfile
import os
import csv
import json
import yaml
from datetime import datetime, timedelta, timezone
from pathlib import Path

from bacnet_validator.parser import (
    PointMapParser,
    BACnetReadsParser,
    RulesParser,
    PointMapping,
    BACnetReading,
    ValidationRule,
    parse_all,
)


class TestPointMapParser:
    def test_parse_basic_point_mapping(self):
        parser = PointMapParser()
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write('old_name,new_name,unit,unit_multiplier,floor,device_id,point_type,description\n')
            f.write('Temp_Sensor,Zone1_Temp,Celsius,1.0,1,AHU-001,analog,Zone 1 Temp\n')
            f.write('Flow_Sensor,AHU_Flow,cfm,0.471947,1,VFD-001,analog,Air Flow\n')
            temp_path = f.name
        
        try:
            mappings = parser.parse(temp_path)
            
            assert len(mappings) == 2
            
            temp_mapping = mappings.get("F1.AHU-001.Temp_Sensor")
            assert temp_mapping is not None
            assert temp_mapping.old_name == "Temp_Sensor"
            assert temp_mapping.new_name == "Zone1_Temp"
            assert temp_mapping.unit == "Celsius"
            assert temp_mapping.unit_multiplier == 1.0
            assert temp_mapping.floor == "1"
            assert temp_mapping.device_id == "AHU-001"
            
            flow_mapping = mappings.get("F1.VFD-001.Flow_Sensor")
            assert flow_mapping is not None
            assert flow_mapping.unit_multiplier == 0.471947
        finally:
            os.unlink(temp_path)

    def test_same_name_different_floor(self):
        parser = PointMapParser()
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write('old_name,new_name,unit,unit_multiplier,floor,device_id,point_type,description\n')
            f.write('RoomTemp,Zone1_RT,Celsius,1.0,1,AHU-001,analog,Floor 1\n')
            f.write('RoomTemp,Zone2_RT,Celsius,1.0,2,AHU-002,analog,Floor 2\n')
            f.write('RoomTemp,Zone3_RT,Celsius,1.0,3,AHU-003,analog,Floor 3\n')
            temp_path = f.name
        
        try:
            mappings = parser.parse(temp_path)
            
            assert len(mappings) == 3
            
            assert "F1.AHU-001.RoomTemp" in mappings
            assert "F2.AHU-002.RoomTemp" in mappings
            assert "F3.AHU-003.RoomTemp" in mappings
        finally:
            os.unlink(temp_path)

    def test_point_mapping_full_identifier(self):
        mapping = PointMapping(
            old_name="Test_Point",
            new_name="New_Test_Point",
            unit="Celsius",
            unit_multiplier=1.0,
            floor="5",
            device_id="DEV-001",
            point_type="analog",
        )
        
        assert mapping.full_identifier == "F5.DEV-001.Test_Point"

    def test_point_mapping_no_floor(self):
        mapping = PointMapping(
            old_name="Test_Point",
            new_name="New_Test_Point",
            unit="Celsius",
            unit_multiplier=1.0,
            floor=None,
            device_id=None,
            point_type="analog",
        )
        
        assert mapping.full_identifier == "Test_Point"


class TestBACnetReadsParser:
    def test_parse_bacnet_readings_utc(self):
        parser = BACnetReadsParser()
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            f.write('{"timestamp":"2026-05-03T08:00:00.000Z","point_name":"Temp_Sensor","floor":"1","device_id":"AHU-001","value":22.5,"unit":"Celsius","status":"ok"}\n')
            f.write('{"timestamp":"2026-05-03T08:01:00.000Z","point_name":"Temp_Sensor","floor":"1","device_id":"AHU-001","value":23.0,"unit":"Celsius","status":"ok"}\n')
            temp_path = f.name
        
        try:
            readings = parser.parse(temp_path)
            
            assert len(readings) == 2
            
            assert readings[0].point_name == "Temp_Sensor"
            assert readings[0].value == 22.5
            assert readings[0].unit == "Celsius"
            assert readings[0].floor == "1"
            assert readings[0].full_identifier == "F1.AHU-001.Temp_Sensor"
            
            assert readings[0].timestamp < readings[1].timestamp
        finally:
            os.unlink(temp_path)

    def test_parse_bacnet_readings_local_time(self):
        parser = BACnetReadsParser()
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            f.write('{"timestamp":"2026-05-03 08:00:00","point_name":"Test_Point","value":100.0,"unit":"percent"}\n')
            temp_path = f.name
        
        try:
            readings = parser.parse(temp_path)
            
            assert len(readings) == 1
            assert readings[0].timestamp.tzinfo is not None
        finally:
            os.unlink(temp_path)

    def test_bacnet_reading_full_identifier(self):
        reading = BACnetReading(
            point_name="Test_Point",
            floor="3",
            device_id="DEV-005",
            value=50.0,
            unit="percent",
            timestamp=datetime.now(timezone.utc),
            raw_timestamp="2026-05-03T08:00:00Z",
        )
        
        assert reading.full_identifier == "F3.DEV-005.Test_Point"


class TestRulesParser:
    def test_parse_rules(self):
        parser = RulesParser()
        
        rules_data = {
            "rules": [
                {
                    "type": "temperature",
                    "point_pattern": "Temp|Sensor",
                    "unit": "Celsius",
                    "staleness_threshold_seconds": 300,
                    "high_alarm_threshold": 30.0,
                    "low_alarm_threshold": 15.0,
                    "tolerance_pct": 2.0,
                    "enabled": True,
                },
                {
                    "type": "humidity",
                    "point_pattern": "Humidity|RH",
                    "unit": "percent",
                    "staleness_threshold_seconds": 300,
                    "high_alarm_threshold": 90.0,
                    "tolerance_pct": 5.0,
                    "enabled": True,
                },
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            yaml.dump(rules_data, f)
            temp_path = f.name
        
        try:
            rules = parser.parse(temp_path)
            
            assert len(rules) == 2
            
            temp_rule = rules[0]
            assert temp_rule.rule_type == "temperature"
            assert temp_rule.point_pattern == "Temp|Sensor"
            assert temp_rule.unit == "Celsius"
            assert temp_rule.staleness_threshold_seconds == 300
            assert temp_rule.high_alarm_threshold == 30.0
            assert temp_rule.low_alarm_threshold == 15.0
            assert temp_rule.tolerance_pct == 2.0
        finally:
            os.unlink(temp_path)


class TestParseAll:
    def test_parse_all_with_samples(self):
        sample_dir = Path(__file__).parent.parent / "samples"
        
        point_map_path = sample_dir / "point_map.csv"
        bacnet_reads_path = sample_dir / "bacnet_reads.jsonl"
        rules_path = sample_dir / "rules.yaml"
        
        if not (point_map_path.exists() and bacnet_reads_path.exists() and rules_path.exists()):
            pytest.skip("Sample files not found")
        
        parsed_data = parse_all(
            str(point_map_path),
            str(bacnet_reads_path),
            str(rules_path),
        )
        
        assert parsed_data.point_mappings is not None
        assert len(parsed_data.point_mappings) > 0
        
        assert parsed_data.bacnet_readings is not None
        assert len(parsed_data.bacnet_readings) > 0
        
        assert parsed_data.rules is not None
        assert len(parsed_data.rules) > 0
