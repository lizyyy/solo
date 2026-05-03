import pytest
from datetime import time
from power_sim.models import (
    BatterySpec, BatteryChemistry, Load, DeviceType, LoadPriority,
    SolarPanel, Plan, WeatherProfile, WeatherCondition
)
from power_sim.calculator import (
    UnitConverter, LoadScheduler, SolarCalculator, BatterySimulator, SimulationState
)


class TestLoadScheduler:
    """测试负载调度器"""
    
    def test_is_load_active_same_day(self):
        """测试同一天内的负载激活"""
        load = Load(
            name="测试负载",
            power_w=100,
            start_time=time(8, 0),
            end_time=time(18, 0)
        )
        
        assert LoadScheduler.is_load_active(load, 7) is False
        assert LoadScheduler.is_load_active(load, 8) is True
        assert LoadScheduler.is_load_active(load, 12) is True
        assert LoadScheduler.is_load_active(load, 17) is True
        assert LoadScheduler.is_load_active(load, 18) is False
    
    def test_is_load_active_cross_day(self):
        """测试跨天的负载激活"""
        load = Load(
            name="夜间负载",
            power_w=50,
            start_time=time(22, 0),
            end_time=time(6, 0)
        )
        
        assert LoadScheduler.is_load_active(load, 21) is False
        assert LoadScheduler.is_load_active(load, 22) is True
        assert LoadScheduler.is_load_active(load, 23) is True
        assert LoadScheduler.is_load_active(load, 0) is True
        assert LoadScheduler.is_load_active(load, 5) is True
        assert LoadScheduler.is_load_active(load, 6) is False
        assert LoadScheduler.is_load_active(load, 7) is False
    
    def test_get_active_loads(self):
        """测试获取活跃负载"""
        load1 = Load(
            name="白天负载",
            device_type=DeviceType.DC,
            power_w=100,
            start_time=time(8, 0),
            end_time=time(18, 0)
        )
        load2 = Load(
            name="夜间负载",
            device_type=DeviceType.AC,
            power_w=50,
            start_time=time(18, 0),
            end_time=time(22, 0)
        )
        
        loads = [load1, load2]
        
        dc, ac = LoadScheduler.get_active_loads(loads, 12)
        assert len(dc) == 1
        assert len(ac) == 0
        assert dc[0].name == "白天负载"
        
        dc, ac = LoadScheduler.get_active_loads(loads, 20)
        assert len(dc) == 0
        assert len(ac) == 1
        assert ac[0].name == "夜间负载"
    
    def test_check_overlapping_loads(self):
        """测试检查重叠负载"""
        load1 = Load(
            name="负载1",
            power_w=100,
            start_time=time(8, 0),
            end_time=time(12, 0)
        )
        load2 = Load(
            name="负载2",
            power_w=50,
            start_time=time(10, 0),
            end_time=time(14, 0)
        )
        load3 = Load(
            name="负载3",
            power_w=30,
            start_time=time(14, 0),
            end_time=time(18, 0)
        )
        
        loads = [load1, load2, load3]
        
        overlaps = LoadScheduler.check_overlapping_loads(loads)
        assert len(overlaps) == 1
        assert overlaps[0][0].name in ["负载1", "负载2"]
        assert overlaps[0][1].name in ["负载1", "负载2"]


class TestSolarCalculator:
    """测试太阳能计算器"""
    
    def test_calculate_hourly_generation(self):
        """测试每小时发电量计算"""
        panel1 = SolarPanel(
            name="主太阳能板",
            max_power_w=400,
            efficiency_percent=90,
            start_time=time(6, 0),
            end_time=time(18, 0)
        )
        panel2 = SolarPanel(
            name="备用太阳能板",
            max_power_w=200,
            efficiency_percent=85,
            start_time=time(7, 0),
            end_time=time(17, 0)
        )
        
        panels = [panel1, panel2]
        
        assert SolarCalculator.calculate_hourly_generation(panels, 5, 1.0) == 0
        assert SolarCalculator.calculate_hourly_generation(panels, 6, 1.0) == 360  # 400 * 0.9
        assert SolarCalculator.calculate_hourly_generation(panels, 12, 1.0) == 360 + 170  # 400*0.9 + 200*0.85
        assert SolarCalculator.calculate_hourly_generation(panels, 18, 1.0) == 0
    
    def test_weather_factor(self):
        """测试天气折减因子"""
        panel = SolarPanel(
            name="测试板",
            max_power_w=400,
            efficiency_percent=100,
            start_time=time(6, 0),
            end_time=time(18, 0)
        )
        
        # 晴天 100%
        assert SolarCalculator.calculate_hourly_generation([panel], 12, 1.0) == 400
        # 多云 40%
        assert SolarCalculator.calculate_hourly_generation([panel], 12, 0.4) == 160
        # 雨天 15%
        assert SolarCalculator.calculate_hourly_generation([panel], 12, 0.15) == 60


class TestBatterySimulator:
    """测试电池模拟器"""
    
    def test_basic_simulation(self):
        """测试基础模拟"""
        battery = BatterySpec(
            name="测试电池",
            capacity_ah=100,
            voltage=12,
            chemistry=BatteryChemistry.LIFEPO4,
            min_soc_percent=10,
            max_soc_percent=100,
            initial_soc_percent=100
        )
        
        load = Load(
            name="持续负载",
            device_type=DeviceType.DC,
            power_w=100,
            priority=LoadPriority.HIGH,
            start_time=time(0, 0),
            end_time=time(23, 59),
            duty_cycle_percent=100
        )
        
        plan = Plan(
            name="测试方案",
            simulation_start_hour=0,
            simulation_duration_hours=12
        )
        
        simulator = BatterySimulator(battery, [load], [], plan)
        state = simulator.simulate()
        
        assert state.current_soc_percent < 100
        assert state.total_consumption_wh > 0
        assert len(state.hourly_data) == 12
    
    def test_solar_charging(self):
        """测试太阳能充电"""
        battery = BatterySpec(
            name="测试电池",
            capacity_ah=50,
            voltage=48,
            chemistry=BatteryChemistry.LIFEPO4,
            min_soc_percent=20,
            max_soc_percent=100,
            initial_soc_percent=50
        )
        
        solar_panel = SolarPanel(
            name="太阳能板",
            max_power_w=500,
            efficiency_percent=90,
            start_time=time(8, 0),
            end_time=time(16, 0)
        )
        
        plan = Plan(
            name="充电测试",
            simulation_start_hour=8,
            simulation_duration_hours=8
        )
        
        simulator = BatterySimulator(battery, [], [solar_panel], plan)
        state = simulator.simulate()
        
        assert state.current_soc_percent > 50  # 应该充电了
        assert state.total_solar_generation_wh > 0
    
    def test_blackout_detection(self):
        """测试断电检测"""
        battery = BatterySpec(
            name="小容量电池",
            capacity_ah=10,
            voltage=12,
            chemistry=BatteryChemistry.LIFEPO4,
            min_soc_percent=10,
            max_soc_percent=100,
            initial_soc_percent=100
        )
        
        # 120W 负载，电池只有 120Wh，可用 108Wh（90%），应该在 54 分钟内断电
        load = Load(
            name="高功率负载",
            device_type=DeviceType.DC,
            power_w=120,
            priority=LoadPriority.HIGH,
            start_time=time(0, 0),
            end_time=time(23, 59)
        )
        
        plan = Plan(
            name="断电测试",
            simulation_start_hour=0,
            simulation_duration_hours=12
        )
        
        simulator = BatterySimulator(battery, [load], [], plan)
        state = simulator.simulate()
        
        assert state.blackout_hour is not None
