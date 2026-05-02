import pytest
import tempfile
import os
import json
from datetime import datetime

from access_gate_cli.parser.csv_parser import (
    parse_personnel_csv,
    parse_access_requests_csv,
    Personnel,
    AccessRequest
)
from access_gate_cli.parser.yaml_parser import (
    parse_zone_rules_yaml,
    Zone,
    Device,
    ZoneRules
)
from access_gate_cli.parser.jsonl_parser import (
    parse_device_clock_jsonl,
    DeviceClock
)


class TestCsvParser:
    def test_parse_personnel_csv(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write("personnel_id,name,department,card_id,role\n")
            f.write("P001,张三,工程部,CARD001,engineer\n")
            f.write("P002,李四,安保部,CARD002,security\n")
            temp_path = f.name
        
        try:
            personnel = parse_personnel_csv(temp_path)
            
            assert len(personnel) == 2
            assert "P001" in personnel
            assert "P002" in personnel
            
            p1 = personnel["P001"]
            assert p1.name == "张三"
            assert p1.department == "工程部"
            assert p1.card_id == "CARD001"
            assert p1.role == "engineer"
            
            p2 = personnel["P002"]
            assert p2.name == "李四"
            assert p2.role == "security"
        finally:
            os.unlink(temp_path)
    
    def test_parse_access_requests_csv(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write("request_id,personnel_id,zone_id,start_time,end_time,request_type,priority\n")
            f.write("REQ001,P001,Z001,2024-05-15 09:00:00,2024-05-15 18:00:00,grant,0\n")
            f.write("REQ002,P002,Z002,2024-05-15 10:00:00,2024-05-15 16:00:00,revoke,1\n")
            temp_path = f.name
        
        try:
            requests = parse_access_requests_csv(temp_path)
            
            assert len(requests) == 2
            
            req1 = requests[0]
            assert req1.request_id == "REQ001"
            assert req1.personnel_id == "P001"
            assert req1.zone_id == "Z001"
            assert req1.start_time == datetime(2024, 5, 15, 9, 0, 0)
            assert req1.end_time == datetime(2024, 5, 15, 18, 0, 0)
            assert req1.request_type == "grant"
            assert req1.priority == 0
            
            req2 = requests[1]
            assert req2.request_type == "revoke"
            assert req2.priority == 1
        finally:
            os.unlink(temp_path)


class TestYamlParser:
    def test_parse_zone_rules_yaml(self):
        yaml_content = """
zones:
  - zone_id: Z001
    zone_name: 主大门
    device_ids:
      - DEV001
    allowed_roles:
      - engineer
      - security
    time_windows:
      - start_time: "08:00"
        end_time: "20:00"
        days: [0, 1, 2, 3, 4]
    mutex_zones: []

devices:
  - device_id: DEV001
    device_name: 主大门控制器
    location: 园区正门
    hmac_key: "test_secret_123"
    clock_drift_threshold_seconds: 300
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False, encoding='utf-8') as f:
            f.write(yaml_content)
            temp_path = f.name
        
        try:
            rules = parse_zone_rules_yaml(temp_path)
            
            assert isinstance(rules, ZoneRules)
            assert len(rules.zones) == 1
            assert len(rules.devices) == 1
            
            zone = rules.zones["Z001"]
            assert zone.zone_name == "主大门"
            assert zone.device_ids == ["DEV001"]
            assert zone.allowed_roles == ["engineer", "security"]
            assert len(zone.time_windows) == 1
            assert zone.time_windows[0]["start_time"] == "08:00"
            assert zone.mutex_zones == []
            
            device = rules.devices["DEV001"]
            assert device.device_name == "主大门控制器"
            assert device.hmac_key == "test_secret_123"
            assert device.clock_drift_threshold_seconds == 300
            
            assert rules.zone_to_devices["Z001"] == ["DEV001"]
        finally:
            os.unlink(temp_path)


class TestJsonlParser:
    def test_parse_device_clock_jsonl(self):
        lines = [
            '{"device_id": "DEV001", "device_time": "2024-05-15 10:00:00", "server_time": "2024-05-15 10:00:00", "drift_seconds": 0.0}',
            '{"device_id": "DEV002", "device_time": "2024-05-15 10:05:00", "server_time": "2024-05-15 10:00:00", "drift_seconds": 300.0}',
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False, encoding='utf-8') as f:
            for line in lines:
                f.write(line + "\n")
            temp_path = f.name
        
        try:
            clocks = parse_device_clock_jsonl(temp_path)
            
            assert len(clocks) == 2
            assert "DEV001" in clocks
            assert "DEV002" in clocks
            
            clock1 = clocks["DEV001"]
            assert clock1.drift_seconds == 0.0
            assert clock1.device_time == datetime(2024, 5, 15, 10, 0, 0)
            assert clock1.server_time == datetime(2024, 5, 15, 10, 0, 0)
            
            clock2 = clocks["DEV002"]
            assert clock2.drift_seconds == 300.0
            assert clock2.device_time == datetime(2024, 5, 15, 10, 5, 0)
        finally:
            os.unlink(temp_path)
