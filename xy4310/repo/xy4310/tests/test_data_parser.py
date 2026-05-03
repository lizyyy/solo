import pytest
import pandas as pd
import numpy as np
from pathlib import Path
import tempfile
import json
from datetime import datetime, timedelta
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.data_parser.complaints import ComplaintsParser
from src.data_parser.permits import PermitsParser
from src.data_parser.monitoring import MonitoringParser
from src.data_parser.grid import GridParser


class TestComplaintsParser:
    """测试投诉解析器"""
    
    def setup_method(self):
        self.parser = ComplaintsParser()
        
        self.sample_data = pd.DataFrame({
            'complaint_id': ['C001', 'C002', 'C003'],
            'complaint_time': ['2024-05-01 22:30:00', '2024-05-02 00:15:00', '2024-05-02 18:45:00'],
            'location': ['中心商务区', '老城区居住区', '科技园区'],
            'longitude': [116.40, 116.41, 116.38],
            'latitude': [39.91, 39.92, 39.90],
            'description': [
                '楼下酒吧晚上音乐声很大',
                '小区内有人在装修，电钻声音刺耳',
                '主干道修路，大型机械作业'
            ],
            'complaint_type': ['娱乐噪声', '施工噪声', '施工噪声'],
            'severity': ['严重', '一般', '紧急']
        })
    
    def test_parse_valid_csv(self, tmp_path):
        """测试解析有效CSV"""
        csv_path = tmp_path / "test_complaints.csv"
        self.sample_data.to_csv(csv_path, index=False, encoding='utf-8-sig')
        
        result = self.parser.parse(csv_path)
        
        assert isinstance(result, pd.DataFrame)
        assert len(result) == 3
        assert 'complaint_id' in result.columns
        assert 'complaint_time' in result.columns
    
    def test_column_mapping(self):
        """测试列名映射"""
        df = pd.DataFrame({
            '单号': ['C001'],
            '投诉时间': ['2024-05-01 22:30:00'],
            '地点': ['测试地点'],
            '经度': [116.40],
            '纬度': [39.91],
            '描述': ['测试描述'],
            '类型': ['测试类型'],
            '级别': ['一般']
        })
        
        self.parser.raw_data = df
        self.parser._map_columns()
        
        assert 'complaint_id' in self.parser.raw_data.columns
    
    def test_parse_datetime(self):
        """测试时间解析"""
        csv_path = Path(tempfile.gettempdir()) / "test_datetime.csv"
        self.sample_data.to_csv(csv_path, index=False, encoding='utf-8-sig')
        
        result = self.parser.parse(csv_path)
        
        assert pd.api.types.is_datetime64_any_dtype(result['complaint_time'])
    
    def test_parse_coordinates(self):
        """测试坐标解析"""
        csv_path = Path(tempfile.gettempdir()) / "test_coords.csv"
        self.sample_data.to_csv(csv_path, index=False, encoding='utf-8-sig')
        
        result = self.parser.parse(csv_path)
        
        assert pd.api.types.is_numeric_dtype(result['longitude'])
        assert pd.api.types.is_numeric_dtype(result['latitude'])


class TestPermitsParser:
    """测试施工备案解析器"""
    
    def setup_method(self):
        self.parser = PermitsParser()
        
        self.sample_data = [
            {
                'permit_id': 'P001',
                'project_name': '中心商务区道路改造',
                'location': '中心商务区主干道',
                'longitude': 116.40,
                'latitude': 39.91,
                'start_time': '2024-05-01 08:00:00',
                'end_time': '2024-05-15 20:00:00',
                'construction_type': '道路施工',
                'contractor': '某工程公司',
                'permit_status': '有效'
            },
            {
                'permit_id': 'P002',
                'project_name': '老城区装修工程',
                'location': '老城区居住区',
                'longitude': 116.41,
                'latitude': 39.92,
                'start_time': '2024-05-01 09:00:00',
                'end_time': '2024-05-10 18:00:00',
                'construction_type': '装修改造',
                'contractor': '某装修公司',
                'permit_status': '有效'
            }
        ]
    
    def test_parse_valid_json(self, tmp_path):
        """测试解析有效JSON"""
        json_path = tmp_path / "test_permits.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(self.sample_data, f, ensure_ascii=False, default=str)
        
        result = self.parser.parse(json_path)
        
        assert isinstance(result, pd.DataFrame)
        assert len(result) == 2
        assert 'permit_id' in result.columns
    
    def test_parse_geojson_format(self, tmp_path):
        """测试解析GeoJSON格式"""
        geojson_data = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {
                        "permit_id": "P001",
                        "project_name": "测试项目"
                    },
                    "geometry": {
                        "type": "Point",
                        "coordinates": [116.40, 39.91]
                    }
                }
            ]
        }
        
        json_path = tmp_path / "test_geojson.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(geojson_data, f)
        
        result = self.parser.parse(json_path)
        
        assert isinstance(result, pd.DataFrame)
        assert len(result) >= 0
    
    def test_get_active_permits(self):
        """测试获取有效备案"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(self.sample_data, f, ensure_ascii=False, default=str)
            json_path = Path(f.name)
        
        self.parser.parse(json_path)
        
        check_time = pd.Timestamp('2024-05-05 12:00:00')
        active = self.parser.get_active_permits(check_time)
        
        assert isinstance(active, pd.DataFrame)
        Path(json_path).unlink()


class TestMonitoringParser:
    """测试噪声监测解析器"""
    
    def setup_method(self):
        self.parser = MonitoringParser()
        
        times = pd.date_range(
            start='2024-05-01 22:00:00',
            end='2024-05-02 06:00:00',
            freq='5min'
        )
        
        np.random.seed(42)
        db_levels = 55 + np.random.normal(0, 5, len(times))
        db_peaks = db_levels + np.random.uniform(2, 10, len(times))
        
        self.sample_data = pd.DataFrame({
            'monitor_id': ['M001'] * len(times),
            'monitor_time': times,
            'longitude': [116.40] * len(times),
            'latitude': [39.91] * len(times),
            'db_level': db_levels,
            'db_peak': db_peaks,
            'db_leq': db_levels - 2,
            'status': ['正常'] * len(times)
        })
    
    def test_parse_valid_csv(self, tmp_path):
        """测试解析有效CSV"""
        csv_path = tmp_path / "test_monitoring.csv"
        self.sample_data.to_csv(csv_path, index=False, encoding='utf-8-sig')
        
        result = self.parser.parse(csv_path)
        
        assert isinstance(result, pd.DataFrame)
        assert len(result) == len(self.sample_data)
        assert 'monitor_time' in result.columns
    
    def test_time_range_detection(self):
        """测试时间范围检测"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig') as f:
            self.sample_data.to_csv(f, index=False)
            csv_path = Path(f.name)
        
        self.parser.parse(csv_path)
        time_range = self.parser.get_time_range()
        
        assert time_range[0] is not None
        assert time_range[1] is not None
        Path(csv_path).unlink()
    
    def test_get_monitor_stats(self):
        """测试获取监测点统计"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig') as f:
            self.sample_data.to_csv(f, index=False)
            csv_path = Path(f.name)
        
        self.parser.parse(csv_path)
        stats = self.parser.get_monitor_stats()
        
        assert isinstance(stats, pd.DataFrame)
        assert 'M001' in stats.index
        Path(csv_path).unlink()


class TestGridParser:
    """测试网格解析器"""
    
    def setup_method(self):
        self.parser = GridParser()
        
        self.sample_data = [
            {
                'grid_id': 'G001',
                'grid_name': '中心商务区',
                'area': 2.5,
                'population': 15000,
                'zone_type': '商业区',
                'longitude': 116.40,
                'latitude': 39.91,
                'boundary': [
                    [116.395, 39.905],
                    [116.405, 39.905],
                    [116.405, 39.915],
                    [116.395, 39.915],
                    [116.395, 39.905]
                ]
            }
        ]
    
    def test_parse_valid_json(self, tmp_path):
        """测试解析有效JSON"""
        json_path = tmp_path / "test_grids.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(self.sample_data, f, ensure_ascii=False)
        
        result = self.parser.parse(json_path)
        
        assert isinstance(result, pd.DataFrame)
        assert len(result) == 1
        assert 'grid_id' in result.columns
    
    def test_get_boundary(self, tmp_path):
        """测试获取边界"""
        json_path = tmp_path / "test_grids.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(self.sample_data, f, ensure_ascii=False)
        
        self.parser.parse(json_path)
        boundary = self.parser.get_boundary('G001')
        
        assert isinstance(boundary, list)
        assert len(boundary) == 5
    
    def test_get_grid_centroid(self, tmp_path):
        """测试计算网格质心"""
        json_path = tmp_path / "test_grids.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(self.sample_data, f, ensure_ascii=False)
        
        self.parser.parse(json_path)
        centroid = self.parser.get_grid_centroid('G001')
        
        assert centroid is not None
        assert isinstance(centroid, tuple)
        assert len(centroid) == 2
    
    def test_get_zone_type_stats(self, tmp_path):
        """测试按区域类型统计"""
        json_path = tmp_path / "test_grids.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(self.sample_data, f, ensure_ascii=False)
        
        self.parser.parse(json_path)
        stats = self.parser.get_zone_type_stats()
        
        assert isinstance(stats, pd.DataFrame)


if __name__ == "__main__":
    pytest.main([__file__, '-v'])
