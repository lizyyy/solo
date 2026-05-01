import tempfile
from pathlib import Path
from datetime import datetime, timezone

import pytest

from firmware_delivery.utils import (
    get_current_timestamp,
    parse_datetime,
    calculate_sha256,
    ensure_dir,
    json_serial
)


class TestUtils:
    def test_get_current_timestamp(self):
        ts = get_current_timestamp()
        assert isinstance(ts, str)
        assert len(ts) > 0
    
    def test_parse_datetime(self):
        dt_str = "2026-04-20T08:30:00Z"
        dt = parse_datetime(dt_str)
        assert dt.year == 2026
        assert dt.month == 4
        assert dt.day == 20
    
    def test_parse_datetime_without_z(self):
        dt_str = "2026-04-20T08:30:00"
        dt = parse_datetime(dt_str)
        assert dt.year == 2026
    
    def test_calculate_sha256(self):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".txt") as f:
            f.write(b"test content")
            temp_path = Path(f.name)
        
        try:
            sha256_hash = calculate_sha256(temp_path)
            assert isinstance(sha256_hash, str)
            assert len(sha256_hash) == 64
        finally:
            temp_path.unlink()
    
    def test_calculate_sha256_empty_file(self):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".bin") as f:
            temp_path = Path(f.name)
        
        try:
            sha256_hash = calculate_sha256(temp_path)
            assert sha256_hash == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        finally:
            temp_path.unlink()
    
    def test_ensure_dir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            nested_dir = Path(tmpdir) / "nested" / "dir"
            assert not nested_dir.exists()
            
            ensure_dir(nested_dir)
            assert nested_dir.exists()
            assert nested_dir.is_dir()
    
    def test_json_serial_datetime(self):
        dt = datetime(2026, 4, 20, 8, 30, 0, tzinfo=timezone.utc)
        serialized = json_serial(dt)
        assert "2026" in serialized
        assert "04" in serialized
        assert "20" in serialized
    
    def test_json_serial_path(self):
        path = Path("/test/dir/file.txt")
        serialized = json_serial(path)
        assert serialized == str(path)
    
    def test_json_serial_invalid_type(self):
        class CustomType:
            pass
        
        with pytest.raises(TypeError):
            json_serial(CustomType())
