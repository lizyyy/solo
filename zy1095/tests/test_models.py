import pytest
from datetime import time
from power_sim.models import (
    BatterySpec, BatteryChemistry, Load, DeviceType, LoadPriority,
    SolarPanel, Plan, WeatherProfile, WeatherCondition
)
from power_sim.calculator import UnitConverter


class TestUnitConverter:
    """测试单位转换器"""
    
    def test_ah_to_wh(self):
        """测试 Ah 转 Wh"""
        assert UnitConverter.ah_to_wh(100, 12) == 1200
        assert UnitConverter.ah_to_wh(52.8, 48) == 2534.4
    
    def test_wh_to_ah(self):
        """测试 Wh 转 Ah"""
        assert UnitConverter.wh_to_ah(1200, 12) == 100
        assert UnitConverter.wh_to_ah(2534.4, 48) == 52.8
    
    def test_w_to_a(self):
        """测试 W 转 A"""
        assert UnitConverter.w_to_a(120, 12) == 10
        assert UnitConverter.w_to_a(240, 24) == 10
    
    def test_a_to_w(self):
        """测试 A 转 W"""
        assert UnitConverter.a_to_w(10, 12) == 120
        assert UnitConverter.a_to_w(5, 48) == 240
    
    def test_soc_conversion(self):
        """测试 SOC 转换"""
        total_wh = 2534.4
        assert UnitConverter.soc_to_wh(100, total_wh) == 2534.4
        assert UnitConverter.soc_to_wh(50, total_wh) == 1267.2
        assert UnitConverter.wh_to_soc(1267.2, total_wh) == 50.0
    
    def test_apply_efficiency(self):
        """测试效率计算"""
        assert UnitConverter.apply_efficiency(100, 85) == 85
        assert UnitConverter.apply_efficiency(200, 90) == 180


class TestBatterySpec:
    """测试电池规格模型"""
    
    def test_valid_battery(self):
        """测试有效电池配置"""
        battery = BatterySpec(
            name="测试电池",
            capacity_ah=100,
            voltage=12,
            chemistry=BatteryChemistry.LIFEPO4,
            min_soc_percent=10,
            max_soc_percent=100,
            initial_soc_percent=100
        )
        
        assert battery.capacity_wh == 1200
        assert battery.usable_capacity_wh == 1080  # 90% of 1200
    
    def test_invalid_initial_soc(self):
        """测试无效的初始 SOC"""
        with pytest.raises(ValueError, match="初始 SOC"):
            BatterySpec(
                name="测试电池",
                capacity_ah=100,
                voltage=12,
                min_soc_percent=20,
                initial_soc_percent=10
            )


class TestLoad:
    """测试负载模型"""
    
    def test_load_with_power(self):
        """测试带功率的负载"""
        load = Load(
            name="LED灯",
            device_type=DeviceType.DC,
            power_w=20,
            priority=LoadPriority.HIGH,
            start_time=time(18, 0),
            end_time=time(23, 0)
        )
        
        assert load.actual_power_w == 20
    
    def test_load_with_current_voltage(self):
        """测试带电流电压的负载"""
        load = Load(
            name="冰箱",
            device_type=DeviceType.DC,
            current_a=5,
            voltage=12,
            priority=LoadPriority.CRITICAL,
            start_time=time(0, 0),
            end_time=time(23, 59)
        )
        
        assert load.actual_power_w == 60
    
    def test_invalid_time_order(self):
        """测试无效时间顺序"""
        with pytest.raises(ValueError, match="结束时间"):
            Load(
                name="测试",
                power_w=10,
                start_time=time(23, 0),
                end_time=time(18, 0)
            )


class TestSolarPanel:
    """测试太阳能板模型"""
    
    def test_solar_panel(self):
        """测试太阳能板配置"""
        panel = SolarPanel(
            name="主太阳能板",
            max_power_w=400,
            efficiency_percent=90,
            start_time=time(6, 0),
            end_time=time(18, 0)
        )
        
        assert panel.get_hourly_output(12, 1.0) == 360  # 400 * 0.9 * 1.0
        assert panel.get_hourly_output(5, 1.0) == 0  # 还没到发电时间
        assert panel.get_hourly_output(12, 0.5) == 180  # 天气折减


class TestPlan:
    """测试计划模型"""
    
    def test_default_plan(self):
        """测试默认计划"""
        plan = Plan(name="测试方案")
        
        assert plan.simulation_start_hour == 0
        assert plan.simulation_duration_hours == 24
        assert plan.weather.condition == WeatherCondition.SUNNY


class TestLoadPriority:
    """测试负载优先级"""
    
    def test_priority_values(self):
        """测试优先级值"""
        assert LoadPriority.CRITICAL == "critical"
        assert LoadPriority.HIGH == "high"
        assert LoadPriority.MEDIUM == "medium"
        assert LoadPriority.LOW == "low"


class TestDeviceType:
    """测试设备类型"""
    
    def test_device_types(self):
        """测试设备类型"""
        assert DeviceType.DC == "dc"
        assert DeviceType.AC == "ac"


class TestWeatherCondition:
    """测试天气条件"""
    
    def test_weather_conditions(self):
        """测试天气条件"""
        assert WeatherCondition.SUNNY == "sunny"
        assert WeatherCondition.PARTLY_CLOUDY == "partly_cloudy"
        assert WeatherCondition.CLOUDY == "cloudy"
        assert WeatherCondition.RAINY == "rainy"
