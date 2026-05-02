"""数据导入模块测试"""

import pytest
from datetime import datetime

from rov_tension_checker.data_import.unit_converters import UnitConverter
from rov_tension_checker.data_import.validators import DataValidator, ValidationErrorType


class TestUnitConverter:
    def test_knots_to_ms(self):
        assert UnitConverter.knots_to_ms(1.0) == pytest.approx(0.514444, rel=1e-4)
        assert UnitConverter.knots_to_ms(2.0) == pytest.approx(1.028888, rel=1e-4)
    
    def test_feet_to_meters(self):
        assert UnitConverter.feet_to_meters(3.28084) == pytest.approx(1.0, rel=1e-4)
    
    def test_lat_lon_to_local(self):
        ref_lat = 31.23456
        ref_lon = 122.34567
        
        x, y = UnitConverter.lat_lon_to_local(ref_lat, ref_lon, ref_lat, ref_lon)
        assert x == pytest.approx(0.0, abs=1e-3)
        assert y == pytest.approx(0.0, abs=1e-3)


class TestDataValidator:
    def test_parse_timestamp_iso(self):
        ts_str = "2024-06-15 08:00:00"
        ts = DataValidator.parse_timestamp(ts_str)
        assert ts is not None
        assert ts.year == 2024
        assert ts.month == 6
        assert ts.day == 15
    
    def test_parse_timestamp_invalid(self):
        ts = DataValidator.parse_timestamp("not_a_timestamp")
        assert ts is None
    
    def test_validate_track_data_basic(self):
        valid_row = {
            "timestamp": "2024-06-15 08:00:00",
            "latitude": 31.23456,
            "longitude": 122.34567
        }
        
        result = DataValidator.validate_track_data([valid_row])
        assert result.valid_count == 1
        assert result.invalid_count == 0
    
    def test_validate_track_data_missing_coords(self):
        invalid_row = {
            "timestamp": "2024-06-15 08:00:00"
        }
        
        result = DataValidator.validate_track_data([invalid_row])
        assert result.valid_count == 0
        assert result.invalid_count == 1
        assert any(
            e.error_type == ValidationErrorType.MISSING_COORDINATES
            for e in result.errors
        )
    
    def test_validate_track_data_invalid_latitude(self):
        invalid_row = {
            "timestamp": "2024-06-15 08:00:00",
            "latitude": 100.0,
            "longitude": 122.34567
        }
        
        result = DataValidator.validate_track_data([invalid_row])
        assert result.valid_count == 0
        assert any(
            e.error_type == ValidationErrorType.INVALID_LATITUDE
            for e in result.errors
        )
    
    def test_validate_rov_telemetry_negative_depth(self):
        invalid_row = {
            "timestamp": "2024-06-15 08:00:00",
            "depth": -85.0
        }
        
        result = DataValidator.validate_rov_telemetry([invalid_row])
        assert result.valid_count == 0
        assert any(
            e.error_type == ValidationErrorType.DEPTH_SIGN_CONFUSION
            for e in result.errors
        )
    
    def test_validate_rov_telemetry_negative_cable_length(self):
        invalid_row = {
            "timestamp": "2024-06-15 08:00:00",
            "depth": 85.0,
            "cable_length": -100.0
        }
        
        result = DataValidator.validate_rov_telemetry([invalid_row])
        assert result.valid_count == 0
        assert any(
            e.error_type == ValidationErrorType.NEGATIVE_CABLE_LENGTH
            for e in result.errors
        )
    
    def test_validate_duplicate_timestamp(self):
        rows = [
            {
                "timestamp": "2024-06-15 08:00:00",
                "latitude": 31.23456,
                "longitude": 122.34567
            },
            {
                "timestamp": "2024-06-15 08:00:00",
                "latitude": 31.23457,
                "longitude": 122.34568
            }
        ]
        
        result = DataValidator.validate_track_data(rows)
        assert result.valid_count == 1
        assert result.invalid_count == 1
        assert any(
            e.error_type == ValidationErrorType.DUPLICATE_TIMESTAMP
            for e in result.errors
        )
    
    def test_validate_out_of_order(self):
        rows = [
            {
                "timestamp": "2024-06-15 08:00:01",
                "latitude": 31.23457,
                "longitude": 122.34568
            },
            {
                "timestamp": "2024-06-15 08:00:00",
                "latitude": 31.23456,
                "longitude": 122.34567
            }
        ]
        
        result = DataValidator.validate_track_data(rows)
        assert result.valid_count == 1
        assert result.invalid_count == 1
        assert any(
            e.error_type == ValidationErrorType.TIME_OUT_OF_ORDER
            for e in result.errors
        )
