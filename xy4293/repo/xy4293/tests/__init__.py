#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
数据解析模块测试 - Data Parser Tests

测试数据解析功能。
"""

import pytest
import pandas as pd
import numpy as np
from pathlib import Path

from pvchecker.dataparser import (
    DataParser,
    RoofZoneParser,
    ModuleParser,
    InverterParser,
    ShadingParser,
    ParseError,
    parse_all_data,
)
from pvchecker import PVModule, RoofZone, InverterMPPT


class TestRoofZoneParser:
    """屋面分区解析器测试"""
    
    def test_parse_csv(self, sample_roof_zones_csv: Path):
        """测试从CSV文件解析"""
        parser = RoofZoneParser()
        zones = parser.parse(sample_roof_zones_csv)
        
        assert len(zones) == 2
        assert zones[0].zone_id == "zone_1"
        assert zones[0].area == 48.0
        assert zones[0].module_count == 24
        
        assert parser.errors == []
    
    def test_parse_dataframe(self):
        """测试从DataFrame解析"""
        df = pd.DataFrame({
            'zone_id': ['test1', 'test2'],
            'area': [100.0, 80.0],
            'tilt': [25.0, 20.0],
            'azimuth': [0.0, -45.0],
            'module_count': [20, 16],
            'shading_profile': ['standard', 'light_shading'],
            'notes': ['Test 1', 'Test 2']
        })
        
        parser = RoofZoneParser()
        zones = parser.parse(df)
        
        assert len(zones) == 2
        assert zones[0].zone_id == "test1"
        assert zones[1].area == 80.0
    
    def test_missing_fields(self, temp_dir: Path):
        """测试缺少必需字段"""
        filepath = temp_dir / "invalid_roof.csv"
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("zone_id,area,tilt\n")
            f.write("test,100.0,25.0\n")
        
        parser = RoofZoneParser()
        
        with pytest.raises(ParseError, match="缺少必需字段"):
            parser.parse(filepath)
    
    def test_validation_duplicate_id(self):
        """测试重复ID验证"""
        df = pd.DataFrame({
            'zone_id': ['test1', 'test1'],
            'area': [100.0, 80.0],
            'tilt': [25.0, 20.0],
            'azimuth': [0.0, -45.0],
            'module_count': [20, 16],
        })
        
        parser = RoofZoneParser()
        
        with pytest.raises(ParseError):
            parser.parse(df)
        
        assert len(parser.errors) > 0
        assert "重复的分区ID" in str(parser.errors[0])
    
    def test_validation_invalid_values(self):
        """测试无效值验证"""
        df = pd.DataFrame({
            'zone_id': ['test1'],
            'area': [-10.0],
            'tilt': [100.0],
            'azimuth': [200.0],
            'module_count': [0],
        })
        
        parser = RoofZoneParser()
        
        with pytest.raises(ParseError):
            parser.parse(df)
        
        assert len(parser.errors) >= 4
    
    def test_get_total_modules(self, sample_roof_zones_csv: Path):
        """测试获取总组件数"""
        parser = RoofZoneParser()
        parser.parse(sample_roof_zones_csv)
        
        assert parser.get_total_modules() == 42
    
    def test_get_total_area(self, sample_roof_zones_csv: Path):
        """测试获取总面积"""
        parser = RoofZoneParser()
        parser.parse(sample_roof_zones_csv)
        
        assert parser.get_total_area() == 84.0


class TestModuleParser:
    """组件参数解析器测试"""
    
    def test_parse_json(self, sample_module_json: Path):
        """测试从JSON文件解析"""
        parser = ModuleParser()
        module = parser.parse(sample_module_json)
        
        assert isinstance(module, PVModule)
        assert module.model == "Test-Module"
        assert module.p_max == 550.0
        assert module.v_mp == 48.5
        assert module.temp_coeff_voc == -0.32
        assert parser.errors == []
    
    def test_parse_dict(self):
        """测试从字典解析"""
        data = {
            "model": "Dict-Module",
            "p_max": 400.0,
            "v_mp": 40.0,
            "i_mp": 10.0,
            "voc": 50.0,
            "isc": 11.0,
            "temp_coeff_voc": -0.35,
            "temp_coeff_isc": 0.05,
            "temp_coeff_pmax": -0.40,
        }
        
        parser = ModuleParser()
        module = parser.parse(data)
        
        assert module.model == "Dict-Module"
        assert module.noct == 45.0
        assert module.area == 1.6
    
    def test_missing_fields(self, temp_dir: Path):
        """测试缺少必需字段"""
        filepath = temp_dir / "invalid_module.json"
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('{"model": "test", "p_max": 550.0}')
        
        parser = ModuleParser()
        
        with pytest.raises(ParseError, match="缺少必需字段"):
            parser.parse(filepath)
    
    def test_validation_temperature_coeffs(self):
        """测试温度系数符号验证"""
        invalid_data = {
            "model": "Invalid",
            "p_max": 550.0,
            "v_mp": 48.5,
            "i_mp": 11.34,
            "voc": 59.2,
            "isc": 12.0,
            "temp_coeff_voc": 0.32,
            "temp_coeff_isc": -0.05,
            "temp_coeff_pmax": 0.40,
        }
        
        parser = ModuleParser()
        
        with pytest.raises(ParseError):
            parser.parse(invalid_data)
        
        assert len(parser.errors) >= 3
    
    def test_to_dict(self, sample_module_json: Path):
        """测试转换为字典"""
        parser = ModuleParser()
        parser.parse(sample_module_json)
        
        data = parser.to_dict()
        
        assert data['model'] == "Test-Module"
        assert data['p_max'] == 550.0


class TestInverterParser:
    """逆变器参数解析器测试"""
    
    def test_parse_csv(self, sample_inverter_csv: Path):
        """测试从CSV文件解析"""
        parser = InverterParser()
        inverters = parser.parse(sample_inverter_csv)
        
        assert len(inverters) == 1
        assert isinstance(inverters[0], InverterMPPT)
        assert inverters[0].inverter_model == "Test-Inverter"
        assert inverters[0].v_min == 200.0
        assert inverters[0].v_max == 1000.0
        assert inverters[0].v_start == 250.0
    
    def test_voltage_range_validation(self):
        """测试电压范围验证"""
        df = pd.DataFrame({
            'inverter_model': ['Invalid'],
            'mppt_id': ['mppt1'],
            'v_min': [800.0],
            'v_max': [200.0],
            'v_nom': [500.0],
            'p_max': [10000.0],
            'i_max': [20.0],
        })
        
        parser = InverterParser()
        
        with pytest.raises(ParseError):
            parser.parse(df)
        
        assert len(parser.errors) > 0
        assert "v_min" in str(parser.errors[0])
    
    def test_v_nom_validation(self):
        """测试标称电压验证"""
        df = pd.DataFrame({
            'inverter_model': ['Invalid'],
            'mppt_id': ['mppt1'],
            'v_min': [200.0],
            'v_max': [1000.0],
            'v_nom': [100.0],
            'p_max': [10000.0],
            'i_max': [20.0],
        })
        
        parser = InverterParser()
        
        with pytest.raises(ParseError):
            parser.parse(df)
    
    def test_get_by_model(self, sample_inverter_csv: Path):
        """测试按型号获取"""
        parser = InverterParser()
        parser.parse(sample_inverter_csv)
        
        inverters = parser.get_by_model("Test-Inverter")
        
        assert len(inverters) == 1
    
    def test_get_total_power(self, sample_inverter_csv: Path):
        """测试获取总功率"""
        parser = InverterParser()
        parser.parse(sample_inverter_csv)
        
        assert parser.get_total_power() == 10000.0


class TestShadingParser:
    """遮挡系数解析器测试"""
    
    def test_parse_csv(self, sample_shading_csv: Path):
        """测试从CSV文件解析"""
        parser = ShadingParser()
        matrix = parser.parse(sample_shading_csv)
        
        assert isinstance(matrix, np.ndarray)
        assert matrix.shape == (12, 24)
        assert parser.errors == []
    
    def test_validation_range(self, temp_dir: Path):
        """测试值范围验证"""
        filepath = temp_dir / "invalid_shading.csv"
        
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            import csv
            writer = csv.writer(f)
            header = ['month'] + [f'hour_{h}' for h in range(24)]
            writer.writerow(header)
            for month in range(1, 13):
                row = [month] + [1.5 if h == 12 else 0.8 for h in range(24)]
                writer.writerow(row)
        
        parser = ShadingParser()
        
        with pytest.raises(ParseError):
            parser.parse(filepath)
        
        assert len(parser.errors) > 0
    
    def test_get_monthly_average(self, sample_shading_csv: Path):
        """测试获取月平均"""
        parser = ShadingParser()
        parser.parse(sample_shading_csv)
        
        avg = parser.get_monthly_average()
        
        assert len(avg) == 12
    
    def test_get_daily_average(self, sample_shading_csv: Path):
        """测试获取日平均"""
        parser = ShadingParser()
        parser.parse(sample_shading_csv)
        
        avg = parser.get_daily_average(month=6)
        
        assert isinstance(avg, float)
        assert 0 <= avg <= 1
    
    def test_get_hourly(self, sample_shading_csv: Path):
        """测试获取小时值"""
        parser = ShadingParser()
        parser.parse(sample_shading_csv)
        
        val = parser.get_hourly(month=1, hour=12)
        
        assert isinstance(val, float)


class TestParseAllData:
    """测试批量数据解析"""
    
    def test_parse_all_data(
        self,
        sample_roof_zones_csv: Path,
        sample_module_json: Path,
        sample_inverter_csv: Path,
        sample_shading_csv: Path,
    ):
        """测试解析所有数据"""
        result = parse_all_data(
            roof_zones_path=sample_roof_zones_csv,
            module_params_path=sample_module_json,
            inverter_mppt_path=sample_inverter_csv,
            shading_coeff_path=sample_shading_csv,
        )
        
        assert result['roof_zones'] is not None
        assert result['module'] is not None
        assert result['inverters'] is not None
        assert result['shading_matrix'] is not None
        assert len(result['errors']) == 0
