import pytest
import json
import csv
import tempfile
from pathlib import Path
from datetime import datetime

from access_arbiter.models import (
    DataParser,
    CardSwipeEvent,
    PermissionRecord,
    ZoneDefinition,
    Direction,
    EventType,
    ValidationResult
)


class TestCardSwipeEvent:
    def test_parse_timestamp_various_formats(self):
        event1 = CardSwipeEvent(
            device_id="D1",
            card_id="C001",
            timestamp="2026-05-01 08:00:00",
            zone_id="main_gate"
        )
        assert event1.timestamp.hour == 8
        
        event2 = CardSwipeEvent(
            device_id="D1",
            card_id="C001",
            timestamp="20260501080000",
            zone_id="main_gate"
        )
        assert event2.timestamp.hour == 8
        
        event3 = CardSwipeEvent(
            device_id="D1",
            card_id="C001",
            timestamp="2026-05-01T08:00:00",
            zone_id="main_gate"
        )
        assert event3.timestamp.hour == 8
    
    def test_direction_parsing(self):
        event_in = CardSwipeEvent(
            device_id="D1",
            card_id="C001",
            timestamp="2026-05-01 08:00:00",
            zone_id="main_gate",
            direction=Direction.IN
        )
        assert event_in.direction == Direction.IN
        
        event_out = CardSwipeEvent(
            device_id="D1",
            card_id="C001",
            timestamp="2026-05-01 08:00:00",
            zone_id="main_gate",
            direction=Direction.OUT
        )
        assert event_out.direction == Direction.OUT


class TestDataParser:
    def test_parse_device_log_json(self):
        test_json = {
            "device_id": "test_device",
            "events": [
                {
                    "card_id": "C001",
                    "timestamp": "2026-05-01 08:00:15",
                    "zone_id": "main_gate",
                    "direction": "in",
                    "event_type": "swipe"
                },
                {
                    "card_id": "C002",
                    "timestamp": "2026-05-01 08:15:30",
                    "zone_id": "main_gate",
                    "direction": "out",
                    "event_type": "deny"
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(test_json, f)
            temp_path = Path(f.name)
        
        try:
            events, result = DataParser.parse_device_log(temp_path)
            
            assert len(events) == 2
            assert result.total_records == 2
            assert result.valid_records == 2
            
            assert events[0].card_id == "C001"
            assert events[0].direction == Direction.IN
            assert events[0].event_type == EventType.SWIPE
            
            assert events[1].card_id == "C002"
            assert events[1].direction == Direction.OUT
            assert events[1].event_type == EventType.DENY
        finally:
            temp_path.unlink()
    
    def test_parse_device_log_with_invalid_event(self):
        test_json = {
            "device_id": "test_device",
            "events": [
                {
                    "card_id": "C001",
                    "timestamp": "invalid_time",
                    "zone_id": "main_gate"
                },
                {
                    "card_id": "C002",
                    "timestamp": "2026-05-01 08:15:30",
                    "zone_id": "main_gate"
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(test_json, f)
            temp_path = Path(f.name)
        
        try:
            events, result = DataParser.parse_device_log(temp_path)
            
            assert len(events) == 1
            assert result.total_records == 2
            assert result.valid_records == 1
            assert len(result.errors) == 1
        finally:
            temp_path.unlink()
    
    def test_parse_permissions_csv(self):
        csv_content = """card_id,person_name,person_id,department,group,allowed_zones,valid_from,valid_until,is_active
C001,张三,E001,技术部,管理员,"main_gate,server_room",2026-01-01,2026-12-31,true
C004,赵六,E004,财务部,普通员工,main_gate,2026-01-01,2026-04-30,false
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(csv_content)
            temp_path = Path(f.name)
        
        try:
            records, result = DataParser.parse_permissions_csv(temp_path)
            
            assert len(records) == 2
            assert result.total_records == 2
            assert result.valid_records == 2
            
            assert records[0].card_id == "C001"
            assert records[0].person_name == "张三"
            assert records[0].is_active == True
            assert "main_gate" in records[0].allowed_zones
            assert "server_room" in records[0].allowed_zones
            
            assert records[1].card_id == "C004"
            assert records[1].is_active == False
        finally:
            temp_path.unlink()
    
    def test_parse_zones_csv(self):
        csv_content = """zone_id,name,description,anti_passback,re_entry_grace_minutes
main_gate,正门入口,园区主入口,true,5
server_room,机房,核心机房,false,3
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(csv_content)
            temp_path = Path(f.name)
        
        try:
            zones, result = DataParser.parse_zones_csv(temp_path)
            
            assert len(zones) == 2
            assert result.total_records == 2
            
            assert zones[0].zone_id == "main_gate"
            assert zones[0].anti_passback_enabled == True
            assert zones[0].re_entry_grace_minutes == 5
            
            assert zones[1].zone_id == "server_room"
            assert zones[1].anti_passback_enabled == False
            assert zones[1].re_entry_grace_minutes == 3
        finally:
            temp_path.unlink()
