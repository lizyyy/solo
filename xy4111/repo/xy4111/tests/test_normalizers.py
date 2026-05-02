import pytest
from datetime import datetime, timezone, timedelta

from sampler_merger.normalizers import (
    CoordinateNormalizer,
    TimeNormalizer,
    haversine_distance,
    time_difference_seconds,
)


class TestCoordinateNormalizer:
    """测试坐标归一化器"""
    
    def test_init_default(self):
        """测试默认初始化"""
        normalizer = CoordinateNormalizer()
        assert normalizer.target_system == "WGS84"
    
    def test_init_custom_system(self):
        """测试自定义目标坐标系"""
        normalizer = CoordinateNormalizer("GCJ02")
        assert normalizer.target_system == "GCJ02"
    
    def test_normalize_same_system(self):
        """测试同一坐标系不变化"""
        normalizer = CoordinateNormalizer("WGS84")
        lat, lon = 30.2672, 120.1551
        result_lat, result_lon = normalizer.normalize(lat, lon, "WGS84")
        assert result_lat == lat
        assert result_lon == lon
    
    def test_wgs84_to_gcj02_china(self):
        """测试中国境内坐标转换"""
        normalizer = CoordinateNormalizer("GCJ02")
        # 北京坐标（中国境内）
        lat, lon = 39.9042, 116.4074
        result_lat, result_lon = normalizer.normalize(lat, lon, "WGS84")
        # GCJ02坐标应该与WGS84有偏移
        assert abs(result_lat - lat) > 0.0001
        assert abs(result_lon - lon) > 0.0001
    
    def test_wgs84_to_gcj02_outside_china(self):
        """测试中国境外坐标不转换"""
        normalizer = CoordinateNormalizer("GCJ02")
        # 纽约坐标（中国境外）
        lat, lon = 40.7128, -74.0060
        result_lat, result_lon = normalizer.normalize(lat, lon, "WGS84")
        # 境外坐标应该保持不变
        assert result_lat == lat
        assert result_lon == lon
    
    def test_parse_coordinate_string_simple(self):
        """测试解析简单坐标字符串"""
        normalizer = CoordinateNormalizer()
        lat, lon, system = normalizer.parse_coordinate_string("30.2672, 120.1551")
        assert lat == pytest.approx(30.2672)
        assert lon == pytest.approx(120.1551)
        assert system == "WGS84"


class TestTimeNormalizer:
    """测试时间归一化器"""
    
    def test_init_default(self):
        """测试默认初始化"""
        normalizer = TimeNormalizer()
        assert normalizer.target_timezone == "UTC"
    
    def test_init_custom_timezone(self):
        """测试自定义目标时区"""
        normalizer = TimeNormalizer("Asia/Shanghai")
        assert normalizer.target_timezone == "Asia/Shanghai"
    
    def test_normalize_utc_to_utc(self):
        """测试UTC到UTC不变化"""
        normalizer = TimeNormalizer("UTC")
        dt = datetime(2024, 5, 10, 8, 30, 0, tzinfo=timezone.utc)
        result = normalizer.normalize(dt)
        assert result == dt
    
    def test_normalize_add_timezone(self):
        """测试给无时区的时间添加时区"""
        normalizer = TimeNormalizer("UTC")
        dt = datetime(2024, 5, 10, 8, 30, 0)  # 无时区
        result = normalizer.normalize(dt, "UTC")
        assert result.tzinfo is not None
    
    def test_format_iso(self):
        """测试ISO格式化"""
        normalizer = TimeNormalizer()
        dt = datetime(2024, 5, 10, 8, 30, 0, tzinfo=timezone.utc)
        result = normalizer.format_iso(dt)
        assert "2024-05-10" in result
        assert "08:30:00" in result
    
    def test_detect_timezone_z(self):
        """测试检测Z后缀时区"""
        normalizer = TimeNormalizer()
        tz = normalizer.detect_timezone_from_str("2024-05-10T08:30:00Z")
        assert tz == "UTC"
    
    def test_detect_timezone_offset(self):
        """测试检测时区偏移"""
        normalizer = TimeNormalizer()
        tz = normalizer.detect_timezone_from_str("2024-05-10 16:30:00+08:00")
        # 应该检测到UTC+8或Asia/Shanghai
        assert tz in ["Asia/Shanghai", "UTC+08:00"]


class TestHelperFunctions:
    """测试辅助函数"""
    
    def test_haversine_distance_same_point(self):
        """测试同一点距离为0"""
        lat, lon = 30.2672, 120.1551
        distance = haversine_distance(lat, lon, lat, lon)
        assert distance == pytest.approx(0.0, abs=1e-6)
    
    def test_haversine_distance_known(self):
        """测试已知距离的两点"""
        # 北京到上海大约1068公里
        beijing_lat, beijing_lon = 39.9042, 116.4074
        shanghai_lat, shanghai_lon = 31.2304, 121.4737
        
        distance = haversine_distance(
            beijing_lat, beijing_lon,
            shanghai_lat, shanghai_lon
        )
        
        # 大约1068公里，允许10%误差
        assert 900000 < distance < 1200000  # 米
    
    def test_time_difference_seconds(self):
        """测试时间差计算"""
        dt1 = datetime(2024, 5, 10, 8, 30, 0)
        dt2 = datetime(2024, 5, 10, 8, 35, 30)
        
        diff = time_difference_seconds(dt1, dt2)
        assert diff == 330.0  # 5分30秒 = 330秒
    
    def test_time_difference_seconds_absolute(self):
        """测试时间差绝对值"""
        dt1 = datetime(2024, 5, 10, 8, 30, 0)
        dt2 = datetime(2024, 5, 10, 8, 25, 0)
        
        # 顺序不影响结果
        diff1 = time_difference_seconds(dt1, dt2)
        diff2 = time_difference_seconds(dt2, dt1)
        
        assert diff1 == diff2 == 300.0
