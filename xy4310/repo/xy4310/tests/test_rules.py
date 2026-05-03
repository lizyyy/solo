import pytest
import pandas as pd
import numpy as np
from pathlib import Path
import tempfile
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.rules.classifier import NoiseSourceClassifier


class TestNoiseSourceClassifier:
    """测试噪声源分类器"""
    
    def setup_method(self):
        self.classifier = NoiseSourceClassifier()
    
    def test_classify_by_keywords_bar_closing(self):
        """测试酒吧散场关键词分类"""
        description = "楼下酒吧晚上音乐声很大，影响睡眠"
        
        results = self.classifier.classify_by_keywords(description)
        
        assert len(results) > 0
        source_types = [r[0] for r in results]
        assert "bar_closing" in source_types
    
    def test_classify_by_keywords_construction(self):
        """测试施工关键词分类"""
        description = "小区内有人在装修，电钻声音刺耳，砸墙声不断"
        
        results = self.classifier.classify_by_keywords(description)
        
        assert len(results) > 0
        source_types = [r[0] for r in results]
        assert "short_construction" in source_types
    
    def test_classify_by_keywords_road_construction(self):
        """测试道路施工关键词分类"""
        description = "主干道正在修路，大型机械作业，沥青铺路声很大"
        
        results = self.classifier.classify_by_keywords(description)
        
        assert len(results) > 0
        source_types = [r[0] for r in results]
        assert "road_construction" in source_types
    
    def test_classify_by_time_pattern_night(self):
        """测试夜间时间模式分类"""
        results = self.classifier.classify_by_time_pattern(hour=23)
        
        assert len(results) > 0
        source_types = [r[0] for r in results]
        assert "bar_closing" in source_types
    
    def test_classify_by_time_pattern_day(self):
        """测试白天时间模式分类"""
        results = self.classifier.classify_by_time_pattern(hour=10)
        
        assert len(results) > 0
        source_types = [r[0] for r in results]
        assert "road_construction" in source_types or "short_construction" in source_types
    
    def test_classify_by_time_pattern_rush_hour(self):
        """测试高峰时间模式分类"""
        results = self.classifier.classify_by_time_pattern(hour=8)
        
        source_types = [r[0] for r in results]
        assert "traffic" in source_types
    
    def test_classify_by_noise_pattern_high_variation(self):
        """测试高波动噪声模式分类"""
        db_levels = [65, 85, 60, 90, 58, 82, 62, 88]
        
        results = self.classifier.classify_by_noise_pattern(db_levels)
        
        assert len(results) > 0
        source_types = [r[0] for r in results]
        assert "short_construction" in source_types
    
    def test_classify_by_noise_pattern_stable_high(self):
        """测试稳定高噪声模式分类"""
        db_levels = [78, 79, 77, 80, 78, 79, 77, 80]
        
        results = self.classifier.classify_by_noise_pattern(db_levels)
        
        source_types = [r[0] for r in results]
        assert "road_construction" in source_types
    
    def test_classify_by_duration_short(self):
        """测试短时间持续分类"""
        results = self.classifier.classify_by_duration(duration_minutes=30)
        
        source_types = [r[0] for r in results]
        assert "short_construction" in source_types
    
    def test_classify_by_duration_long(self):
        """测试长时间持续分类"""
        results = self.classifier.classify_by_duration(duration_minutes=300)
        
        source_types = [r[0] for r in results]
        assert "road_construction" in source_types
    
    def test_classify_event_combined(self):
        """测试综合事件分类"""
        event_data = {
            "description": "楼下酒吧晚上音乐声很大，客人吵闹到凌晨",
            "hour": 23,
            "minute": 30,
            "is_weekend": True,
            "db_levels": [62, 68, 70, 65, 72, 68, 63, 75],
            "duration_minutes": 90
        }
        
        result = self.classifier.classify_event(event_data)
        
        assert "primary_source" in result
        assert "all_candidates" in result
        
        primary = result["primary_source"]
        assert primary["source_type"] == "bar_closing" or primary["confidence"] > 0
    
    def test_classify_event_construction(self):
        """测试施工事件分类"""
        event_data = {
            "description": "电钻声音刺耳，砸墙声不断，正在装修",
            "hour": 10,
            "minute": 30,
            "is_weekend": False,
            "db_levels": [60, 85, 55, 90, 58, 82, 62, 88, 55, 80],
            "duration_minutes": 60
        }
        
        result = self.classifier.classify_event(event_data)
        
        primary = result["primary_source"]
        assert primary["source_type"] in ["short_construction", "road_construction"]
    
    def test_classify_dataframe(self):
        """测试DataFrame分类"""
        df = pd.DataFrame({
            'complaint_id': ['C001', 'C002', 'C003'],
            'complaint_time': pd.to_datetime([
                '2024-05-01 22:30:00',
                '2024-05-01 10:15:00',
                '2024-05-01 08:00:00'
            ]),
            'description': [
                '酒吧音乐声很大',
                '装修电钻声音刺耳',
                '货车鸣笛声不断'
            ]
        })
        
        result = self.classifier.classify_dataframe(df)
        
        assert 'noise_source_type' in result.columns
        assert 'noise_source_name' in result.columns
        assert 'classification_confidence' in result.columns
        assert len(result) == 3
    
    def test_source_type_names(self):
        """测试噪声源类型名称"""
        expected_names = {
            "short_construction": "短时施工",
            "bar_closing": "酒吧散场",
            "road_construction": "道路施工",
            "traffic": "交通噪声",
            "unknown": "未知噪声"
        }
        
        for source_type, expected_name in expected_names.items():
            assert source_type in self.classifier.SOURCE_TYPES
            assert self.classifier.SOURCE_TYPES[source_type]["name"] == expected_name
    
    def test_empty_description(self):
        """测试空描述"""
        results = self.classifier.classify_by_keywords("")
        assert len(results) == 0
        
        results = self.classifier.classify_by_keywords(None)
        assert len(results) == 0
    
    def test_insufficient_db_levels(self):
        """测试不足的分贝数据"""
        results = self.classifier.classify_by_noise_pattern([60, 65])
        assert len(results) == 0
    
    def test_verification_in_classification(self):
        """测试备案信息影响分类"""
        event_data = {
            "description": "大型机械作业声音很大",
            "hour": 14,
            "minute": 0,
            "is_weekend": False,
            "db_levels": [78, 80, 79, 81, 77, 82],
            "duration_minutes": 240,
            "has_active_permit": True
        }
        
        result = self.classifier.classify_event(event_data)
        
        primary = result["primary_source"]
        assert "备案匹配" in [e["type"] for e in primary.get("evidences", [])]


if __name__ == "__main__":
    pytest.main([__file__, '-v'])
