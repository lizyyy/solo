import pytest
import tempfile
import csv
import json
from pathlib import Path
from datetime import datetime, timezone

from freq_coordinator.parsers.csv_parser import parse_supply_stations, parse_devices
from freq_coordinator.parsers.json_parser import parse_repeaters


class TestSupplyStationParser:
    def test_valid_stations_csv(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=[
                'id', 'name', 'latitude', 'longitude', 'distance_from_start',
                'elevation', 'criticality', 'required_coverage', 'contact_person'
            ])
            writer.writeheader()
            writer.writerow({
                'id': 'S001',
                'name': '起点补给站',
                'latitude': '40.123456',
                'longitude': '116.789012',
                'distance_from_start': '0.0',
                'elevation': '450',
                'criticality': 'critical',
                'required_coverage': 'true',
                'contact_person': '张主任',
            })
            temp_path = f.name
        
        try:
            result = parse_supply_stations(temp_path)
            assert result.is_valid is True
            assert result.parsed_count == 1
            assert len(result.errors) == 0
        finally:
            Path(temp_path).unlink()
    
    def test_missing_required_fields(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['id', 'name'])
            writer.writeheader()
            writer.writerow({
                'id': 'S001',
                'name': '起点补给站',
            })
            temp_path = f.name
        
        try:
            result = parse_supply_stations(temp_path)
            assert result.is_valid is False
            assert len(result.errors) > 0
        finally:
            Path(temp_path).unlink()
    
    def test_invalid_latitude(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=[
                'id', 'name', 'latitude', 'longitude', 'distance_from_start',
            ])
            writer.writeheader()
            writer.writerow({
                'id': 'S001',
                'name': '起点补给站',
                'latitude': 'invalid',
                'longitude': '116.789012',
                'distance_from_start': '0.0',
            })
            temp_path = f.name
        
        try:
            result = parse_supply_stations(temp_path)
            assert len(result.errors) > 0
        finally:
            Path(temp_path).unlink()
    
    def test_latitude_out_of_range(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=[
                'id', 'name', 'latitude', 'longitude', 'distance_from_start',
            ])
            writer.writeheader()
            writer.writerow({
                'id': 'S001',
                'name': '起点补给站',
                'latitude': '100',
                'longitude': '116.789012',
                'distance_from_start': '0.0',
            })
            temp_path = f.name
        
        try:
            result = parse_supply_stations(temp_path)
            assert len(result.errors) > 0
        finally:
            Path(temp_path).unlink()
    
    def test_file_not_exists(self):
        result = parse_supply_stations('/non/existent/path.csv')
        assert result.is_valid is False
        assert len(result.errors) > 0


class TestRepeaterParser:
    def test_valid_repeaters_json(self):
        data = {
            "repeaters": [
                {
                    "id": "R001",
                    "name": "起点中继台",
                    "latitude": 40.123456,
                    "longitude": 116.789012,
                    "elevation": 480,
                    "tx_frequency": 145.525,
                    "rx_frequency": 144.925,
                    "power": 25,
                    "antenna_gain": 5.5,
                    "coverage_radius_km": 8.0,
                    "height_agl": 20
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(data, f)
            temp_path = f.name
        
        try:
            result = parse_repeaters(temp_path)
            assert result.is_valid is True
            assert result.parsed_count == 1
            assert len(result.errors) == 0
        finally:
            Path(temp_path).unlink()
    
    def test_invalid_json_format(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            f.write("this is not valid json")
            temp_path = f.name
        
        try:
            result = parse_repeaters(temp_path)
            assert result.is_valid is False
            assert len(result.errors) > 0
        finally:
            Path(temp_path).unlink()
    
    def test_invalid_frequency(self):
        data = {
            "repeaters": [
                {
                    "id": "R001",
                    "name": "起点中继台",
                    "latitude": 40.123456,
                    "longitude": 116.789012,
                    "elevation": 480,
                    "tx_frequency": 999.0,
                    "rx_frequency": 998.0,
                    "power": 25,
                    "antenna_gain": 5.5,
                    "coverage_radius_km": 8.0,
                    "height_agl": 20
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(data, f)
            temp_path = f.name
        
        try:
            result = parse_repeaters(temp_path)
            assert len(result.errors) > 0
        finally:
            Path(temp_path).unlink()


class TestDeviceParser:
    def test_valid_devices_csv(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=[
                'id', 'type', 'model', 'status', 'battery_capacity_mah',
                'current_charge_percent', 'power_consumption_ma', 'standby_current_ma',
                'frequencies', 'last_charged'
            ])
            writer.writeheader()
            writer.writerow({
                'id': 'D001',
                'type': 'handheld',
                'model': 'Baofeng UV-5R',
                'status': 'available',
                'battery_capacity_mah': '1800',
                'current_charge_percent': '100',
                'power_consumption_ma': '180',
                'standby_current_ma': '40',
                'frequencies': '144.525;145.000',
                'last_charged': '2024-05-01T08:00:00',
            })
            temp_path = f.name
        
        try:
            result = parse_devices(temp_path)
            assert result.is_valid is True
            assert result.parsed_count == 1
            assert len(result.errors) == 0
        finally:
            Path(temp_path).unlink()
    
    def test_invalid_battery_capacity(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['id', 'battery_capacity_mah'])
            writer.writeheader()
            writer.writerow({
                'id': 'D001',
                'battery_capacity_mah': '50',
            })
            temp_path = f.name
        
        try:
            result = parse_devices(temp_path)
            assert len(result.errors) > 0
        finally:
            Path(temp_path).unlink()
    
    def test_charge_percent_out_of_range(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['id', 'battery_capacity_mah', 'current_charge_percent'])
            writer.writeheader()
            writer.writerow({
                'id': 'D001',
                'battery_capacity_mah': '1800',
                'current_charge_percent': '150',
            })
            temp_path = f.name
        
        try:
            result = parse_devices(temp_path)
            assert len(result.errors) > 0
        finally:
            Path(temp_path).unlink()
