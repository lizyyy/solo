"""单位换算模块测试"""

import pytest
from flow_balancer.core.units import UnitConverter, convert, is_valid_unit


class TestUnitConverter:
    """单位转换器测试"""
    
    def test_length_conversion(self):
        """测试长度单位转换"""
        assert convert(1, "m", "mm", "length") == 1000.0
        assert convert(1000, "mm", "m", "length") == 1.0
        assert convert(1, "mm", "μm", "length") == 1000.0
        assert convert(1, "μm", "nm", "length") == 1000.0
        assert convert(1, "cm", "m", "length") == 0.01
    
    def test_volume_conversion(self):
        """测试体积单位转换"""
        assert convert(1, "m3", "L", "volume") == 1000.0
        assert convert(1, "L", "mL", "volume") == 1000.0
        assert convert(1, "mL", "μL", "volume") == 1000.0
        assert convert(1, "μL", "m3", "volume") == pytest.approx(1e-9)
    
    def test_time_conversion(self):
        """测试时间单位转换"""
        assert convert(1, "min", "s", "time") == 60.0
        assert convert(1, "h", "s", "time") == 3600.0
        assert convert(60, "s", "min", "time") == 1.0
    
    def test_pressure_conversion(self):
        """测试压力单位转换"""
        assert convert(1, "bar", "Pa", "pressure") == 1e5
        assert convert(1, "kPa", "Pa", "pressure") == 1000.0
        assert convert(1, "MPa", "Pa", "pressure") == 1e6
    
    def test_viscosity_conversion(self):
        """测试黏度单位转换"""
        assert convert(1, "Pa·s", "cP", "viscosity") == 1000.0
        assert convert(1, "cP", "mPa·s", "viscosity") == 1.0
        assert convert(1, "mPa·s", "Pa·s", "viscosity") == 0.001
    
    def test_flow_rate_conversion(self):
        """测试流量单位转换"""
        assert convert(1, "mL/min", "μL/min", "flow_rate") == 1000.0
        assert convert(1, "mL/s", "mL/min", "flow_rate") == 60.0
        
        result = convert(1, "μL/min", "m3/s", "flow_rate")
        expected = 1e-9 / 60.0
        assert result == pytest.approx(expected)
    
    def test_parse_flow_rate(self):
        """测试流量单位解析"""
        result = UnitConverter.parse_flow_rate(10, "μL/min")
        expected = 10e-9 / 60.0
        assert result == pytest.approx(expected)
    
    def test_is_valid_unit(self):
        """测试单位有效性检查"""
        assert is_valid_unit("m", "length") == True
        assert is_valid_unit("mm", "length") == True
        assert is_valid_unit("μm", "length") == True
        assert is_valid_unit("invalid", "length") == False
        assert is_valid_unit("m", "invalid_dimension") == False
    
    def test_invalid_conversion(self):
        """测试无效单位转换"""
        with pytest.raises(ValueError):
            convert(1, "invalid_unit", "m", "length")
        
        with pytest.raises(ValueError):
            convert(1, "m", "invalid_unit", "length")
