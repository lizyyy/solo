import pytest
from datetime import datetime

from sampler_merger.config import Sample


class TestSample:
    """测试Sample数据模型"""
    
    def test_init_basic(self):
        """测试基本初始化"""
        sample = Sample(sample_id="S001")
        assert sample.sample_id == "S001"
        assert sample.latitude is None
        assert sample.longitude is None
        assert sample.timestamp is None
        assert sample.source_file == ""
        assert sample.source_type == ""
        assert sample.attachments == []
        assert sample.metadata == {}
        assert sample.original_data == {}
    
    def test_init_full(self):
        """测试完整初始化"""
        ts = datetime(2024, 5, 10, 8, 30, 0)
        sample = Sample(
            sample_id="S001",
            latitude=30.2672,
            longitude=120.1551,
            timestamp=ts,
            source_file="logger_A.csv",
            source_type="csv",
            attachments=["photo_001.jpg"],
            metadata={"depth": 1.5, "temperature": 18.2},
            original_data={"raw": "data"},
        )
        
        assert sample.sample_id == "S001"
        assert sample.latitude == 30.2672
        assert sample.longitude == 120.1551
        assert sample.timestamp == ts
        assert sample.source_file == "logger_A.csv"
        assert sample.source_type == "csv"
        assert sample.attachments == ["photo_001.jpg"]
        assert sample.metadata == {"depth": 1.5, "temperature": 18.2}
        assert sample.original_data == {"raw": "data"}
    
    def test_to_dict(self):
        """测试转换为字典"""
        ts = datetime(2024, 5, 10, 8, 30, 0)
        sample = Sample(
            sample_id="S001",
            latitude=30.2672,
            longitude=120.1551,
            timestamp=ts,
            source_file="logger_A.csv",
            source_type="csv",
        )
        
        data = sample.to_dict()
        
        assert data["sample_id"] == "S001"
        assert data["latitude"] == 30.2672
        assert data["longitude"] == 120.1551
        assert data["timestamp"] == ts.isoformat()
        assert data["source_file"] == "logger_A.csv"
        assert data["source_type"] == "csv"
    
    def test_from_dict(self):
        """测试从字典创建"""
        ts = datetime(2024, 5, 10, 8, 30, 0)
        data = {
            "sample_id": "S001",
            "latitude": 30.2672,
            "longitude": 120.1551,
            "timestamp": ts.isoformat(),
            "source_file": "logger_A.csv",
            "source_type": "csv",
            "attachments": ["photo.jpg"],
            "metadata": {"depth": 1.5},
            "original_data": {},
        }
        
        sample = Sample.from_dict(data)
        
        assert sample.sample_id == "S001"
        assert sample.latitude == 30.2672
        assert sample.longitude == 120.1551
        assert sample.timestamp == ts
        assert sample.source_file == "logger_A.csv"
        assert sample.source_type == "csv"
        assert sample.attachments == ["photo.jpg"]
        assert sample.metadata == {"depth": 1.5}
    
    def test_has_valid_coordinates_true(self):
        """测试有效坐标"""
        sample = Sample(
            sample_id="S001",
            latitude=30.2672,
            longitude=120.1551,
        )
        assert sample.has_valid_coordinates() is True
    
    def test_has_valid_coordinates_false_none(self):
        """测试坐标为None"""
        sample = Sample(sample_id="S001")
        assert sample.has_valid_coordinates() is False
    
    def test_has_valid_coordinates_false_out_of_range(self):
        """测试坐标超出范围"""
        # 纬度超出范围
        sample1 = Sample(sample_id="S001", latitude=100.0, longitude=120.0)
        assert sample1.has_valid_coordinates() is False
        
        # 经度超出范围
        sample2 = Sample(sample_id="S001", latitude=30.0, longitude=200.0)
        assert sample2.has_valid_coordinates() is False
        
        # 负数范围
        sample3 = Sample(sample_id="S001", latitude=-100.0, longitude=-200.0)
        assert sample3.has_valid_coordinates() is False
    
    def test_get_coordinate_tuple(self):
        """测试获取坐标元组"""
        sample = Sample(
            sample_id="S001",
            latitude=30.2672,
            longitude=120.1551,
        )
        coord = sample.get_coordinate_tuple()
        assert coord == (120.1551, 30.2672)  # (longitude, latitude)
    
    def test_get_coordinate_tuple_none(self):
        """测试获取坐标元组（无有效坐标）"""
        sample = Sample(sample_id="S001")
        assert sample.get_coordinate_tuple() is None
    
    def test_roundtrip_to_dict_from_dict(self):
        """测试字典往返转换"""
        original = Sample(
            sample_id="S001",
            latitude=30.2672,
            longitude=120.1551,
            timestamp=datetime(2024, 5, 10, 8, 30, 0),
            source_file="test.csv",
            source_type="csv",
            attachments=["a.jpg", "b.jpg"],
            metadata={"depth": 1.5, "notes": "test"},
            original_data={"raw": [1, 2, 3]},
        )
        
        # 转换为字典再转换回来
        data = original.to_dict()
        restored = Sample.from_dict(data)
        
        # 比较
        assert restored.sample_id == original.sample_id
        assert restored.latitude == original.latitude
        assert restored.longitude == original.longitude
        assert restored.timestamp == original.timestamp
        assert restored.source_file == original.source_file
        assert restored.source_type == original.source_type
        assert restored.attachments == original.attachments
        assert restored.metadata == original.metadata
        # original_data可能会有变化（非JSON序列化类型），但值应该一致
