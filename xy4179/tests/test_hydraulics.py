"""水力计算模块测试。"""

import pytest
import math

from zha_beng_yan_suan_qi.hydraulics import HydraulicCalculator
from zha_beng_yan_suan_qi.types import PumpCurve, GateLimit


class TestHydraulicCalculator:
    
    def test_calculate_pump_flow_running(self):
        """测试泵运行时的流量计算。"""
        pump = PumpCurve(
            pump_id="1",
            pump_name="测试泵",
            head_m=[0, 2, 4, 6],
            flow_m3h=[1200, 1100, 900, 500],
            power_kw=[75, 78, 80, 85],
            rated_flow_m3h=1200,
            rated_head_m=5,
            rated_power_kw=75,
        )
        
        flow, power = HydraulicCalculator.calculate_pump_flow(
            pump,
            inner_level=2.0,
            outer_level=5.0,
            is_running=True,
        )
        
        assert flow > 0
        assert power > 0
    
    def test_calculate_pump_flow_not_running(self):
        """测试泵未运行时的流量为0。"""
        pump = PumpCurve(
            pump_id="1",
            pump_name="测试泵",
            head_m=[0, 5],
            flow_m3h=[1200, 0],
            power_kw=[75, 0],
            rated_flow_m3h=1200,
            rated_head_m=5,
            rated_power_kw=75,
        )
        
        flow, power = HydraulicCalculator.calculate_pump_flow(
            pump,
            inner_level=2.0,
            outer_level=5.0,
            is_running=False,
        )
        
        assert flow == 0.0
        assert power == 0.0
    
    def test_calculate_gate_flow_no_opening(self):
        """测试闸门开度为0时流量为0。"""
        gate = GateLimit(
            gate_id="1",
            gate_name="测试闸",
            max_opening=1.5,
            min_opening=0.3,
            discharge_coefficient=0.62,
            width_m=8.0,
            sill_elevation=0.0,
        )
        
        flow, is_backflow = HydraulicCalculator.calculate_gate_flow(
            gate,
            inner_level=3.0,
            outer_level=2.5,
            opening=0.0,
        )
        
        assert flow == 0.0
        assert is_backflow is False
    
    def test_calculate_gate_flow_outflow(self):
        """测试外排时闸门流量。"""
        gate = GateLimit(
            gate_id="1",
            gate_name="测试闸",
            max_opening=1.5,
            min_opening=0.3,
            discharge_coefficient=0.62,
            width_m=8.0,
            sill_elevation=0.0,
        )
        
        flow, is_backflow = HydraulicCalculator.calculate_gate_flow(
            gate,
            inner_level=3.0,
            outer_level=2.5,
            opening=1.0,
        )
        
        assert flow > 0
        assert is_backflow is False
    
    def test_calculate_gate_flow_potential_backflow(self):
        """测试可能倒灌的情况。"""
        gate = GateLimit(
            gate_id="1",
            gate_name="测试闸",
            max_opening=1.5,
            min_opening=0.3,
            discharge_coefficient=0.62,
            width_m=8.0,
            sill_elevation=0.0,
        )
        
        flow, is_backflow = HydraulicCalculator.calculate_gate_flow(
            gate,
            inner_level=2.5,
            outer_level=3.0,
            opening=1.0,
        )
        
        assert is_backflow is True
    
    def test_calculate_storage_change(self):
        """测试库容变化计算。"""
        initial_storage = 10000.0
        inflow = 500.0
        pump_flow = 300.0
        gate_flow = 200.0
        step_hours = 1.0
        
        new_storage = HydraulicCalculator.calculate_storage_change(
            initial_storage,
            inflow,
            pump_flow,
            gate_flow,
            step_hours,
        )
        
        net_flow = inflow - pump_flow - gate_flow
        expected = initial_storage + net_flow * step_hours
        assert new_storage == expected
    
    def test_calculate_level_from_storage(self):
        """测试从库容计算水位。"""
        storage = 50000.0
        channel_area = 10000.0
        capacity = 100000.0
        base_level = 0.0
        
        level = HydraulicCalculator.calculate_level_from_storage(
            storage,
            channel_area,
            capacity,
            base_level,
        )
        
        expected = storage / channel_area
        assert level == expected
    
    def test_calculate_storage_from_level(self):
        """测试从水位计算库容。"""
        level = 5.0
        channel_area = 10000.0
        capacity = 100000.0
        
        storage = HydraulicCalculator.calculate_storage_from_level(
            level,
            channel_area,
            capacity,
        )
        
        expected = level * channel_area
        assert storage == expected
    
    def test_calculate_rainfall_inflow(self):
        """测试降雨产流计算。"""
        rainfall_mm = 30.0
        duration_hours = 1.0
        catchment_area = 1.0
        runoff_coefficient = 0.6
        
        inflow = HydraulicCalculator.calculate_rainfall_inflow(
            rainfall_mm,
            duration_hours,
            catchment_area,
            runoff_coefficient,
        )
        
        rainfall_m = rainfall_mm / 1000
        area_m2 = catchment_area * 1_000_000
        total_runoff = rainfall_m * area_m2 * runoff_coefficient
        expected = total_runoff / duration_hours
        
        assert inflow == expected
    
    def test_check_overtopping_risk_critical(self):
        """测试检查漫顶风险 - 临界情况。"""
        inner_level = 4.0
        critical_level = 3.5
        warning_level = 3.0
        
        has_risk, risk_level, exceed = HydraulicCalculator.check_overtopping_risk(
            inner_level,
            critical_level,
            warning_level,
        )
        
        assert has_risk is True
        assert risk_level == "critical"
        assert exceed == inner_level - critical_level
    
    def test_check_overtopping_risk_warning(self):
        """测试检查漫顶风险 - 警戒情况。"""
        inner_level = 3.2
        critical_level = 4.0
        warning_level = 3.0
        
        has_risk, risk_level, exceed = HydraulicCalculator.check_overtopping_risk(
            inner_level,
            critical_level,
            warning_level,
        )
        
        assert has_risk is True
        assert risk_level == "warning"
    
    def test_check_overtopping_risk_normal(self):
        """测试检查漫顶风险 - 正常情况。"""
        inner_level = 2.5
        critical_level = 4.0
        warning_level = 3.0
        
        has_risk, risk_level, exceed = HydraulicCalculator.check_overtopping_risk(
            inner_level,
            critical_level,
            warning_level,
        )
        
        assert has_risk is False
        assert risk_level == "normal"
    
    def test_check_backflow_risk_with_gate_open(self):
        """测试检查倒灌风险 - 闸门开启且外河水位高。"""
        inner_level = 2.5
        outer_level = 3.0
        gate_opening = 1.0
        
        has_risk, level_diff = HydraulicCalculator.check_backflow_risk(
            inner_level,
            outer_level,
            gate_opening,
        )
        
        assert has_risk is True
        assert level_diff == outer_level - inner_level
    
    def test_check_backflow_risk_gate_closed(self):
        """测试检查倒灌风险 - 闸门关闭。"""
        inner_level = 2.5
        outer_level = 3.0
        gate_opening = 0.0
        
        has_risk, level_diff = HydraulicCalculator.check_backflow_risk(
            inner_level,
            outer_level,
            gate_opening,
        )
        
        assert has_risk is False
    
    def test_check_pump_cycle_violation_violated(self):
        """测试检查泵启停间隔违规。"""
        last_change = 10.0
        current_time = 11.0
        min_cycle = 2.0
        
        violated, wait_time = HydraulicCalculator.check_pump_cycle_violation(
            last_change,
            current_time,
            min_cycle,
        )
        
        assert violated is True
        assert wait_time > 0
    
    def test_check_pump_cycle_violation_ok(self):
        """测试检查泵启停间隔合规。"""
        last_change = 10.0
        current_time = 13.0
        min_cycle = 2.0
        
        violated, wait_time = HydraulicCalculator.check_pump_cycle_violation(
            last_change,
            current_time,
            min_cycle,
        )
        
        assert violated is False
        assert wait_time == 0
    
    def test_check_energy_limit_over(self):
        """测试检查能耗超限。"""
        current_energy = 1500.0
        daily_limit = 1000.0
        hours_elapsed = 12.0
        
        over_limit, amount = HydraulicCalculator.check_energy_limit(
            current_energy,
            daily_limit,
            hours_elapsed,
        )
        
        assert over_limit is True
        assert amount > 0
    
    def test_check_energy_limit_no_limit(self):
        """测试检查能耗 - 无限制。"""
        current_energy = 1500.0
        daily_limit = None
        hours_elapsed = 12.0
        
        over_limit, amount = HydraulicCalculator.check_energy_limit(
            current_energy,
            daily_limit,
            hours_elapsed,
        )
        
        assert over_limit is False
