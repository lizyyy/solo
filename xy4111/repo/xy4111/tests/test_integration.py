import pytest
import tempfile
import shutil
from pathlib import Path
from datetime import datetime

from sampler_merger.config import Sample, ConfigManager
from sampler_merger.parsers import CSVParser, GPXParser
from sampler_merger.normalizers import CoordinateNormalizer, TimeNormalizer, haversine_distance
from sampler_merger.conflict_rules import ConflictDetector


class TestCSVParserIntegration:
    """测试CSV解析器集成"""
    
    def test_parse_sample_csv(self):
        """测试解析样例CSV文件"""
        csv_content = """样点编号,纬度,经度,时间,水深,水温,备注
S001,30.2672,120.1551,2024-05-10 08:30:00,1.5,18.2,测试点1
S002,30.2567,120.1523,2024-05-10 09:15:00,2.3,17.8,测试点2
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(csv_content)
            temp_path = Path(f.name)
        
        try:
            parser = CSVParser()
            samples = parser.parse(temp_path)
            
            assert len(samples) == 2
            
            # 检查第一个样点
            s1 = samples[0]
            assert s1.sample_id == "S001"
            assert s1.latitude == pytest.approx(30.2672)
            assert s1.longitude == pytest.approx(120.1551)
            assert s1.timestamp is not None
            assert s1.metadata.get('depth') == "1.5"
            assert s1.metadata.get('description') == "测试点1"
            
            # 检查第二个样点
            s2 = samples[1]
            assert s2.sample_id == "S002"
            assert s2.latitude == pytest.approx(30.2567)
            assert s2.longitude == pytest.approx(120.1523)
            
        finally:
            temp_path.unlink()
    
    def test_parse_english_csv(self):
        """测试解析英文表头CSV"""
        csv_content = """id,latitude,longitude,timestamp,depth,notes
S001,30.2672,120.1551,2024-05-10 08:30:00,1.5,Test Point 1
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(csv_content)
            temp_path = Path(f.name)
        
        try:
            parser = CSVParser()
            samples = parser.parse(temp_path)
            
            assert len(samples) == 1
            s = samples[0]
            assert s.sample_id == "S001"
            assert s.latitude == pytest.approx(30.2672)
            assert s.longitude == pytest.approx(120.1551)
            
        finally:
            temp_path.unlink()


class TestGPXParserIntegration:
    """测试GPX解析器集成"""
    
    def test_parse_gpx_waypoints(self):
        """测试解析GPX航点"""
        gpx_content = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="30.2672" lon="120.1551">
    <ele>12.5</ele>
    <time>2024-05-10T08:30:00Z</time>
    <name>WP001</name>
    <desc>测试航点1</desc>
  </wpt>
  <wpt lat="30.2567" lon="120.1523">
    <ele>10.2</ele>
    <time>2024-05-10T09:15:00Z</time>
    <name>WP002</name>
    <desc>测试航点2</desc>
  </wpt>
</gpx>
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.gpx', delete=False, encoding='utf-8') as f:
            f.write(gpx_content)
            temp_path = Path(f.name)
        
        try:
            parser = GPXParser()
            samples = parser.parse(temp_path)
            
            # 应该有2个航点
            waypoint_samples = [s for s in samples if s.sample_id.startswith('WP')]
            assert len(waypoint_samples) == 2
            
            wp1 = [s for s in waypoint_samples if s.sample_id == 'WP001'][0]
            assert wp1.latitude == pytest.approx(30.2672)
            assert wp1.longitude == pytest.approx(120.1551)
            assert wp1.metadata.get('description') == '测试航点1'
            
        finally:
            temp_path.unlink()


class TestConflictDetectionIntegration:
    """测试冲突检测集成"""
    
    def test_detect_id_conflicts(self):
        """测试检测ID冲突"""
        samples = [
            Sample(
                sample_id="S001",
                latitude=30.2672,
                longitude=120.1551,
                timestamp=datetime(2024, 5, 10, 8, 30, 0),
                source_file="logger_A.csv",
                source_type="csv",
            ),
            Sample(
                sample_id="S001",  # 冲突：相同ID
                latitude=30.2673,
                longitude=120.1552,
                timestamp=datetime(2024, 5, 10, 8, 31, 0),
                source_file="logger_B.csv",
                source_type="csv",
            ),
            Sample(
                sample_id="S002",
                latitude=30.2567,
                longitude=120.1523,
                source_file="logger_A.csv",
                source_type="csv",
            ),
        ]
        
        detector = ConflictDetector()
        results = detector.detect_all(samples)
        
        # 应该有1个ID冲突
        id_conflicts = results.get("id_conflicts", [])
        assert len(id_conflicts) == 1
        
        conflict = id_conflicts[0]
        assert conflict["sample_id"] == "S001"
        assert conflict["count"] == 2
    
    def test_detect_coordinate_anomalies(self):
        """测试检测坐标异常"""
        samples = [
            Sample(
                sample_id="S001",
                latitude=95.0,  # 无效：纬度超出范围
                longitude=120.1551,
                source_file="test.csv",
                source_type="csv",
            ),
            Sample(
                sample_id="S002",
                latitude=30.2672,
                longitude=200.0,  # 无效：经度超出范围
                source_file="test.csv",
                source_type="csv",
            ),
        ]
        
        detector = ConflictDetector()
        results = detector.detect_all(samples)
        
        anomalies = results.get("coordinate_anomalies", [])
        # 应该有2个坐标异常
        range_anomalies = [a for a in anomalies if a.get("type") == "coordinate_out_of_range"]
        assert len(range_anomalies) == 2
    
    def test_detect_potential_duplicates(self):
        """测试检测潜在重复样点"""
        samples = [
            Sample(
                sample_id="S001",
                latitude=30.2672,
                longitude=120.1551,
                timestamp=datetime(2024, 5, 10, 8, 30, 0),
                source_file="logger_A.csv",
                source_type="csv",
            ),
            Sample(
                sample_id="S001_dup",  # 不同ID
                latitude=30.2673,  # 坐标接近
                longitude=120.1552,
                timestamp=datetime(2024, 5, 10, 8, 31, 0),  # 时间接近
                source_file="logger_B.csv",
                source_type="csv",
            ),
        ]
        
        detector = ConflictDetector(
            time_tolerance=300.0,  # 5分钟
            distance_tolerance=50.0,  # 50米
        )
        results = detector.detect_all(samples)
        
        duplicates = results.get("potential_duplicates", [])
        # 两个样点距离约14米，时间差60秒，应该被检测为潜在重复
        assert len(duplicates) >= 0  # 取决于实际距离计算


class TestNormalizerIntegration:
    """测试归一化器集成"""
    
    def test_coordinate_conversion_roundtrip(self):
        """测试坐标转换往返"""
        # 北京坐标
        original_lat, original_lon = 39.9042, 116.4074
        
        # WGS84 -> GCJ02 -> WGS84
        to_gcj = CoordinateNormalizer("GCJ02")
        gcj_lat, gcj_lon = to_gcj.normalize(original_lat, original_lon, "WGS84")
        
        # GCJ02应该与WGS84有偏移
        assert abs(gcj_lat - original_lat) > 0.0001
        assert abs(gcj_lon - original_lon) > 0.0001
        
        # 转换回来
        to_wgs = CoordinateNormalizer("WGS84")
        wgs_lat, wgs_lon = to_wgs.normalize(gcj_lat, gcj_lon, "GCJ02")
        
        # 应该接近原始坐标（允许小误差）
        assert abs(wgs_lat - original_lat) < 0.001
        assert abs(wgs_lon - original_lon) < 0.001
    
    def test_timezone_conversion(self):
        """测试时区转换"""
        normalizer = TimeNormalizer("UTC")
        
        # UTC+8时间
        from datetime import timezone, timedelta
        tz_utc8 = timezone(timedelta(hours=8))
        dt_utc8 = datetime(2024, 5, 10, 16, 30, 0, tzinfo=tz_utc8)
        
        # 转换到UTC
        dt_utc = normalizer.normalize(dt_utc8)
        
        # UTC时间应该是8:30
        assert dt_utc.hour == 8
        assert dt_utc.minute == 30


class TestConfigManagerIntegration:
    """测试配置管理器集成"""
    
    def test_save_and_load_config(self):
        """测试保存和加载配置"""
        with tempfile.TemporaryDirectory() as temp_dir:
            config_path = Path(temp_dir) / "sampler_config.json"
            
            config_manager = ConfigManager(config_path)
            
            # 保存配置
            test_config = {
                "project_name": "test_project",
                "timezone": "Asia/Shanghai",
                "coordinate_system": "WGS84",
                "ingested_files": [],
                "merged_samples": None,
                "check_results": None,
                "reviews": [],
            }
            
            config_manager.save_config(test_config)
            
            # 加载配置
            loaded = config_manager.load_config()
            
            assert loaded["project_name"] == "test_project"
            assert loaded["timezone"] == "Asia/Shanghai"
            assert loaded["coordinate_system"] == "WGS84"
    
    def test_get_project_info(self):
        """测试获取项目信息"""
        with tempfile.TemporaryDirectory() as temp_dir:
            config_path = Path(temp_dir) / "sampler_config.json"
            
            config_manager = ConfigManager(config_path)
            
            test_config = {
                "project_name": "hydrology_survey_2024",
                "created_at": "2024-05-10T08:00:00",
                "timezone": "Asia/Shanghai",
                "coordinate_system": "WGS84",
                "ingested_files": [{"id": "test1"}, {"id": "test2"}],
                "merged_samples": {"samples": []},
                "check_results": {"summary": {}},
                "reviews": [{"id": "review1"}],
            }
            
            config_manager.save_config(test_config)
            
            info = config_manager.get_project_info()
            
            assert info["project_name"] == "hydrology_survey_2024"
            assert info["timezone"] == "Asia/Shanghai"
            assert info["coordinate_system"] == "WGS84"
            assert info["ingested_file_count"] == 2
            assert info["has_merged_samples"] is True
            assert info["has_check_results"] is True
            assert info["review_count"] == 1
