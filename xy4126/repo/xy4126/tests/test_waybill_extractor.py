import pytest
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from indexers import WaybillExtractor


class TestWaybillExtractor:
    def test_extract_sf_waybill(self):
        test_cases = [
            ("SF1234567890123_面单.jpg", "SF1234567890123"),
            ("SF_1234567890123_破损.jpg", "SF1234567890123"),
            ("sf-1234567890123-photo.jpg", "sf1234567890123"),
        ]
        
        for filename, expected in test_cases:
            result = WaybillExtractor.extract(filename)
            assert result is not None, f"应该能从 {filename} 提取运单号"
            assert result.upper() == expected.upper()
    
    def test_extract_yt_waybill(self):
        test_cases = [
            ("YT9876543210_包裹.png", "YT9876543210"),
            ("圆通_9876543210987_照片.jpg", "圆通9876543210987"),
            ("yt-9876543210987.jpg", "yt9876543210987"),
        ]
        
        for filename, expected in test_cases:
            result = WaybillExtractor.extract(filename)
            assert result is not None, f"应该能从 {filename} 提取运单号"
            assert result.upper() == expected.upper()
    
    def test_extract_loose_waybill_with_keyword(self):
        test_cases = [
            ("运单号_771234567890123.jpg", "771234567890123"),
            ("快递单号_391234567890123_破损.jpg", "391234567890123"),
            ("物流号_951234567890123.png", "951234567890123"),
        ]
        
        for filename, expected in test_cases:
            result = WaybillExtractor.extract(filename)
            assert result is not None, f"应该能从 {filename} 提取运单号"
            assert result == expected
    
    def test_extract_no_waybill(self):
        test_cases = [
            ("some_random_file.jpg", None),
            ("photo_20240501.jpg", None),
            ("IMG_1234.png", None),
        ]
        
        for filename, expected in test_cases:
            result = WaybillExtractor.extract(filename)
            assert result == expected, f"{filename} 不应该包含运单号"
    
    def test_extract_all(self):
        text = "运单号 SF1234567890123 和 YT9876543210987 的图片"
        results = WaybillExtractor.extract_all(text)
        
        assert len(results) == 2
        assert "SF1234567890123" in results
        assert "YT9876543210987" in results


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
