"""数据解析模块测试。"""

import pytest
import tempfile
import os
from datetime import datetime

from zha_beng_yan_suan_qi.parser import DataParser


class TestDataParser:
    
    @pytest.fixture
    def parser(self):
        return DataParser()
    
    def test_parse_water_levels(self, parser):
        """测试解析水位数据。"""
        csv_content = """timestamp,inner_level,outer_level
2026-05-02 00:00,2.5,3.2
2026-05-02 01:00,2.55,3.25
2026-05-02 02:00,2.6,3.3
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = f.name
        
        try:
            records = parser.parse_water_levels(temp_path)
            
            assert len(records) == 3
            assert records[0].inner_level == 2.5
            assert records[0].outer_level == 3.2
            assert records[1].inner_level == 2.55
            
            assert records[0].timestamp < records[1].timestamp
        finally:
            os.unlink(temp_path)
    
    def test_parse_water_levels_with_chinese_columns(self, parser):
        """测试解析中文列名的水位数据。"""
        csv_content = """时间,内水位,外水位
2026-05-02 00:00,2.5,3.2
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = f.name
        
        try:
            records = parser.parse_water_levels(temp_path)
            
            assert len(records) == 1
            assert records[0].inner_level == 2.5
            assert records[0].outer_level == 3.2
        finally:
            os.unlink(temp_path)
    
    def test_parse_rainfall(self, parser):
        """测试解析降雨数据。"""
        csv_content = """timestamp,rainfall_mm,duration_hours
2026-05-02 00:00,0,1
2026-05-02 01:00,10,1
2026-05-02 02:00,25,1
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = f.name
        
        try:
            records = parser.parse_rainfall(temp_path)
            
            assert len(records) == 3
            assert records[0].rainfall_mm == 0.0
            assert records[1].rainfall_mm == 10.0
            assert records[2].rainfall_mm == 25.0
        finally:
            os.unlink(temp_path)
    
    def test_parse_rainfall_with_chinese_columns(self, parser):
        """测试解析中文列名的降雨数据。"""
        csv_content = """时间,降雨量,时长
2026-05-02 00:00,15,1
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = f.name
        
        try:
            records = parser.parse_rainfall(temp_path)
            
            assert len(records) == 1
            assert records[0].rainfall_mm == 15.0
        finally:
            os.unlink(temp_path)
    
    def test_parse_pump_curves(self, parser):
        """测试解析泵曲线数据。"""
        csv_content = """pump_id,pump_name,head_m,flow_m3h,power_kw,rated_flow_m3h,rated_head_m,rated_power_kw
1,主泵1号,0,1200,75,1200,5,75
1,主泵1号,2,1100,78,1200,5,75
1,主泵1号,4,900,80,1200,5,75
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = f.name
        
        try:
            pumps = parser.parse_pump_curves(temp_path)
            
            assert len(pumps) == 1
            assert pumps[0].pump_id == "1"
            assert pumps[0].rated_flow_m3h == 1200.0
            assert len(pumps[0].head_m) == 3
            assert len(pumps[0].flow_m3h) == 3
        finally:
            os.unlink(temp_path)
    
    def test_parse_gate_limits(self, parser):
        """测试解析闸门限制数据。"""
        csv_content = """gate_id,gate_name,max_opening,min_opening,discharge_coefficient,width_m,sill_elevation
1,东闸,1.5,0.3,0.62,8.0,0.0
2,西闸,1.5,0.3,0.62,8.0,0.0
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = f.name
        
        try:
            gates = parser.parse_gate_limits(temp_path)
            
            assert len(gates) == 2
            assert gates[0].gate_id == "1"
            assert gates[0].max_opening == 1.5
            assert gates[0].min_opening == 0.3
            assert gates[1].gate_id == "2"
        finally:
            os.unlink(temp_path)
    
    def test_parse_float(self, parser):
        """测试解析浮点数。"""
        assert parser._parse_float("3.14") == 3.14
        assert parser._parse_float("  5.6  ") == 5.6
        assert parser._parse_float("", default=10.0) == 10.0
        assert parser._parse_float("abc", default=0.0) == 0.0
    
    def test_parse_timestamp(self, parser):
        """测试解析时间戳。"""
        ts = parser._parse_timestamp("2026-05-02 10:30")
        assert isinstance(ts, datetime)
        assert ts.year == 2026
        assert ts.month == 5
        assert ts.day == 2
        assert ts.hour == 10
        assert ts.minute == 30
    
    def test_parse_timestamp_with_slash(self, parser):
        """测试解析斜杠分隔的时间戳。"""
        ts = parser._parse_timestamp("2026/05/02 10:30")
        assert isinstance(ts, datetime)
        assert ts.year == 2026
        assert ts.month == 5
        assert ts.day == 2
