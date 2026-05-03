import pytest
import tempfile
import json
import yaml
from pathlib import Path
from datetime import datetime

from cleanroom_verifier.parser import Parser, Room, PressureReading, AirflowSetpoint, DoorEvent


class TestParser:
    def setup_method(self):
        self.parser = Parser()
    
    def test_parse_rooms_basic(self):
        rooms_data = {
            "rooms": [
                {
                    "id": "R1",
                    "name": "Test Room",
                    "area": 20.0,
                    "height": 2.8,
                    "volume": 56.0,
                    "adjacent_rooms": ["R2"],
                    "classification": "Grade A",
                    "required_pressure_diff": 15.0,
                    "required_ach": 40.0
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(rooms_data, f)
            temp_path = Path(f.name)
        
        try:
            rooms = self.parser.parse_rooms(temp_path)
            
            assert len(rooms) == 1
            assert "R1" in rooms
            
            room = rooms["R1"]
            assert room.id == "R1"
            assert room.name == "Test Room"
            assert room.area == 20.0
            assert room.height == 2.8
            assert room.volume == 56.0
            assert room.adjacent_rooms == ["R2"]
            assert room.classification == "Grade A"
            assert room.required_pressure_diff == 15.0
            assert room.required_ach == 40.0
        finally:
            temp_path.unlink()
    
    def test_parse_rooms_default_values(self):
        rooms_data = {
            "rooms": [
                {
                    "id": "R1",
                    "area": 20.0,
                    "height": 2.8
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(rooms_data, f)
            temp_path = Path(f.name)
        
        try:
            rooms = self.parser.parse_rooms(temp_path)
            room = rooms["R1"]
            
            assert room.name == "R1"
            assert room.volume == 56.0
            assert room.adjacent_rooms == []
            assert room.classification == "Grade C"
            assert room.required_pressure_diff == 10.0
            assert room.required_ach == 20.0
        finally:
            temp_path.unlink()
    
    def test_parse_pressure_readings_basic(self):
        csv_content = """timestamp,room_id,pressure,unit,status
2026-05-03 08:00:00,R1,15.2,Pa,ok
2026-05-03 08:05:00,R1,14.8,Pa,ok
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(csv_content)
            temp_path = Path(f.name)
        
        try:
            readings = self.parser.parse_pressure_readings(temp_path)
            
            assert len(readings) == 2
            assert readings[0].room_id == "R1"
            assert readings[0].pressure == 15.2
            assert readings[0].unit == "Pa"
            assert readings[0].is_valid == True
        finally:
            temp_path.unlink()
    
    def test_parse_pressure_readings_invalid_status(self):
        csv_content = """timestamp,room_id,pressure,unit,status
2026-05-03 08:00:00,R1,15.2,Pa,error
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(csv_content)
            temp_path = Path(f.name)
        
        try:
            readings = self.parser.parse_pressure_readings(temp_path)
            
            assert len(readings) == 1
            assert readings[0].is_valid == False
        finally:
            temp_path.unlink()
    
    def test_parse_pressure_readings_empty_values(self):
        csv_content = """timestamp,room_id,pressure,unit
2026-05-03 08:00:00,R1,,Pa
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(csv_content)
            temp_path = Path(f.name)
        
        try:
            readings = self.parser.parse_pressure_readings(temp_path)
            
            assert len(readings) == 0
        finally:
            temp_path.unlink()
    
    def test_parse_airflow_setpoints_basic(self):
        yaml_content = """setpoints:
  R1:
    supply_air: 2400
    exhaust_air: 800
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False, encoding='utf-8') as f:
            f.write(yaml_content)
            temp_path = Path(f.name)
        
        try:
            setpoints = self.parser.parse_airflow_setpoints(temp_path)
            
            assert len(setpoints) == 1
            assert "R1" in setpoints
            
            sp = setpoints["R1"]
            assert sp.supply_air == 2400
            assert sp.exhaust_air == 800
            assert sp.supply_unit == "m3/h"
            assert sp.exhaust_unit == "m3/h"
        finally:
            temp_path.unlink()
    
    def test_parse_door_events_basic(self):
        jsonl_content = '''{"timestamp": "2026-05-03 08:05:30", "room_id": "R1", "event_type": "open", "duration": 8.5}
{"timestamp": "2026-05-03 08:05:45", "room_id": "R1", "event_type": "close"}
'''
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False, encoding='utf-8') as f:
            f.write(jsonl_content)
            temp_path = Path(f.name)
        
        try:
            events = self.parser.parse_door_events(temp_path)
            
            assert len(events) == 2
            assert events[0].room_id == "R1"
            assert events[0].event_type == "open"
            assert events[0].duration == 8.5
            assert events[1].event_type == "close"
        finally:
            temp_path.unlink()
    
    def test_parse_door_events_invalid_json(self):
        jsonl_content = '''{"timestamp": "2026-05-03 08:05:30", "room_id": "R1", "event_type": "open"}
invalid json line
{"timestamp": "2026-05-03 08:05:45", "room_id": "R1", "event_type": "close"}
'''
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False, encoding='utf-8') as f:
            f.write(jsonl_content)
            temp_path = Path(f.name)
        
        try:
            events = self.parser.parse_door_events(temp_path)
            
            assert len(events) == 2
        finally:
            temp_path.unlink()
    
    def test_parse_timestamp_various_formats(self):
        from cleanroom_verifier.parser import Parser
        
        ts1 = self.parser._parse_timestamp("2026-05-03 08:00:00")
        assert isinstance(ts1, datetime)
        
        ts2 = self.parser._parse_timestamp("2026-05-03T08:00:00")
        assert isinstance(ts2, datetime)
        
        ts3 = self.parser._parse_timestamp("2026/05/03 08:00:00")
        assert isinstance(ts3, datetime)
        
        ts4 = self.parser._parse_timestamp("invalid format")
        assert isinstance(ts4, datetime)
    
    def test_safe_float(self):
        assert self.parser._safe_float("15.2") == 15.2
        assert self.parser._safe_float("  15.2  ") == 15.2
        assert self.parser._safe_float("") is None
        assert self.parser._safe_float("   ") is None
        assert self.parser._safe_float("abc") is None
    
    def test_is_valid_reading(self):
        assert self.parser._is_valid_reading({"status": "ok"}) == True
        assert self.parser._is_valid_reading({"status": "error"}) == False
        assert self.parser._is_valid_reading({"valid": "true"}) == True
        assert self.parser._is_valid_reading({"valid": "false"}) == False
        assert self.parser._is_valid_reading({"is_valid": True}) == True
        assert self.parser._is_valid_reading({"is_valid": False}) == False
        assert self.parser._is_valid_reading({}) == True
