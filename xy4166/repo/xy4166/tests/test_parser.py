import csv
import tempfile
from pathlib import Path
from datetime import datetime

import pytest

from deco_reviewer.parser import CSVParser
from deco_reviewer.models import GasType


class TestCSVParser:
    """测试CSV解析器"""

    @pytest.fixture
    def sample_csv_content(self):
        """创建示例CSV内容"""
        return [
            ["dive_id", "diver_name", "dive_date", "gas_type", "o2_percent", "n2_percent", "he_percent", "safety_stop_depth", "safety_stop_duration", "time", "depth", "temperature"],
            ["TEST_001", "测试潜水员", "2026-05-01", "air", "21", "79", "0", "5", "3", "0", "0", "25"],
            ["", "", "", "", "", "", "", "", "", "1", "5", "24"],
            ["", "", "", "", "", "", "", "", "", "2", "10", "23"],
            ["", "", "", "", "", "", "", "", "", "3", "15", "22"],
            ["", "", "", "", "", "", "", "", "", "4", "18", "22"],
            ["", "", "", "", "", "", "", "", "", "5", "20", "21"],
            ["", "", "", "", "", "", "", "", "", "10", "20", "21"],
            ["", "", "", "", "", "", "", "", "", "15", "20", "21"],
            ["", "", "", "", "", "", "", "", "", "16", "18", "21"],
            ["", "", "", "", "", "", "", "", "", "17", "15", "22"],
            ["", "", "", "", "", "", "", "", "", "18", "12", "22"],
            ["", "", "", "", "", "", "", "", "", "19", "9", "23"],
            ["", "", "", "", "", "", "", "", "", "20", "5", "24"],
            ["", "", "", "", "", "", "", "", "", "23", "5", "24"],
            ["", "", "", "", "", "", "", "", "", "24", "3", "24"],
            ["", "", "", "", "", "", "", "", "", "25", "0", "25"],
        ]

    @pytest.fixture
    def temp_csv_file(self, sample_csv_content):
        """创建临时CSV文件"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerows(sample_csv_content)
            temp_path = Path(f.name)
        
        yield temp_path
        temp_path.unlink()

    def test_parse_basic_info(self, temp_csv_file):
        """测试解析基本信息"""
        parser = CSVParser()
        dive_log = parser.parse(temp_csv_file)

        assert dive_log.dive_id == "TEST_001"
        assert dive_log.diver_name == "测试潜水员"
        assert dive_log.dive_date.strftime("%Y-%m-%d") == "2026-05-01"

    def test_parse_gas_mix(self, temp_csv_file):
        """测试解析气体混合"""
        parser = CSVParser()
        dive_log = parser.parse(temp_csv_file)

        assert dive_log.gas_mix.gas_type == GasType.AIR
        assert dive_log.gas_mix.o2_percent == 21.0
        assert dive_log.gas_mix.n2_percent == 79.0
        assert dive_log.gas_mix.he_percent == 0.0
        assert dive_log.gas_mix.p_o2 == 0.21
        assert dive_log.gas_mix.p_n2 == 0.79

    def test_parse_profile(self, temp_csv_file):
        """测试解析潜水剖面"""
        parser = CSVParser()
        dive_log = parser.parse(temp_csv_file)

        assert len(dive_log.profile) == 16

        first_point = dive_log.profile[0]
        assert first_point.time == 0
        assert first_point.depth == 0.0
        assert first_point.temperature == 25.0

        max_depth_point = max(dive_log.profile, key=lambda p: p.depth)
        assert max_depth_point.depth == 20.0

    def test_parse_safety_stops(self, temp_csv_file):
        """测试解析安全停留"""
        parser = CSVParser()
        dive_log = parser.parse(temp_csv_file)

        assert len(dive_log.safety_stops) == 1
        assert dive_log.safety_stops[0].depth == 5.0
        assert dive_log.safety_stops[0].duration == 3

    def test_file_not_found(self):
        """测试文件不存在"""
        parser = CSVParser()
        with pytest.raises(FileNotFoundError):
            parser.parse(Path("/nonexistent/path.csv"))

    def test_parse_nitrox_gas(self):
        """测试解析氮氧混合气"""
        nitrox_content = [
            ["dive_id", "gas_type", "o2_percent", "n2_percent", "time", "depth"],
            ["TEST_NITROX", "nitrox", "32", "68", "0", "0"],
            ["", "", "", "", "5", "20"],
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerows(nitrox_content)
            temp_path = Path(f.name)
        
        try:
            parser = CSVParser()
            dive_log = parser.parse(temp_path)
            
            assert dive_log.gas_mix.gas_type == GasType.NITROX
            assert dive_log.gas_mix.o2_percent == 32.0
            assert dive_log.gas_mix.n2_percent == 68.0
        finally:
            temp_path.unlink()

    def test_parse_with_surface_interval(self):
        """测试解析带水面间隔的记录"""
        content = [
            ["dive_id", "surface_interval_minutes", "time", "depth"],
            ["TEST_REPEAT", "45", "0", "0"],
            ["", "", "10", "15"],
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerows(content)
            temp_path = Path(f.name)
        
        try:
            parser = CSVParser()
            dive_log = parser.parse(temp_path)
            
            assert dive_log.surface_interval_minutes == 45
        finally:
            temp_path.unlink()

    def test_parse_chinese_column_names(self):
        """测试中文列名"""
        content = [
            ["潜水ID", "潜水员", "潜水日期", "时间", "深度", "温度"],
            ["TEST_CN", "张三", "2026-05-01", "0", "0", "25"],
            ["", "", "", "5", "10", "24"],
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerows(content)
            temp_path = Path(f.name)
        
        try:
            parser = CSVParser()
            dive_log = parser.parse(temp_path)
            
            assert dive_log.dive_id == "TEST_CN"
            assert dive_log.diver_name == "张三"
            assert len(dive_log.profile) == 2
        finally:
            temp_path.unlink()
