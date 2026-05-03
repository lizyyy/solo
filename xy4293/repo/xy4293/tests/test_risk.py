#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
风险规则模块测试 - Risk Rules Tests

测试风险检测和评估功能。
"""

import pytest
import numpy as np

from pvchecker.risk import (
    RiskRule,
    VoltageLimitRule,
    CurrentMismatchRule,
    CableLossRule,
    ShadingRiskRule,
    RiskAssessor,
    RiskLevel,
    RiskCategory,
    RiskThreshold,
)
from pvchecker.pvcalc import CableLossResult


class TestVoltageLimitRule:
    """电压超限风险规则测试"""
    
    def test_no_risk_at_stc(self, test_module, test_inverter):
        """测试STC条件下无电压风险"""
        rule = VoltageLimitRule()
        
        is_risky, risk_level, message = rule.evaluate(
            module=test_module,
            inverter=test_inverter,
            modules_per_string=10,
            min_temp=25.0
        )
        
        assert is_risky == False
        assert risk_level == RiskLevel.LOW
    
    def test_high_risk_at_low_temp(self, test_module, test_inverter):
        """测试低温下的电压风险"""
        rule = VoltageLimitRule()
        
        is_risky, risk_level, message = rule.evaluate(
            module=test_module,
            inverter=test_inverter,
            modules_per_string=30,
            min_temp=-20.0
        )
        
        assert is_risky == True
    
    def test_get_risk_item(self, test_module, test_inverter):
        """测试获取风险项"""
        rule = VoltageLimitRule()
        
        risk_item = rule.get_risk_item(
            module=test_module,
            inverter=test_inverter,
            modules_per_string=10,
            min_temp=-10.0
        )
        
        if risk_item:
            assert risk_item.rule_name == "低温开路电压超限风险"
            assert risk_item.severity in ['low', 'medium', 'high', 'critical']


class TestCurrentMismatchRule:
    """电流不匹配风险规则测试"""
    
    def test_no_mismatch_single_string(self):
        """测试单路串无不匹配风险"""
        rule = CurrentMismatchRule()
        
        is_risky, risk_level, message = rule.evaluate(
            string_currents=[10.0]
        )
        
        assert is_risky == False
        assert risk_level == RiskLevel.LOW
    
    def test_no_mismatch_identical_strings(self):
        """测试相同电流无风险"""
        rule = CurrentMismatchRule()
        
        is_risky, risk_level, message = rule.evaluate(
            string_currents=[10.0, 10.0, 10.0]
        )
        
        assert is_risky == False
        assert risk_level == RiskLevel.LOW
    
    def test_mismatch_detected(self):
        """测试电流不匹配检测"""
        rule = CurrentMismatchRule()
        
        is_risky, risk_level, message = rule.evaluate(
            string_currents=[10.0, 7.5, 10.0]
        )
        
        if is_risky:
            assert risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]
    
    def test_evaluate_from_shading(self, test_module):
        """测试从遮挡系数评估"""
        rule = CurrentMismatchRule()
        
        is_risky, risk_level, message = rule.evaluate_from_shading(
            string_shading_factors=[
                [1.0, 1.0, 1.0],
                [0.7, 1.0, 1.0],
            ],
            module=test_module,
            temperature=25.0
        )
        
        assert is_risky == True


class TestCableLossRule:
    """线缆损失风险规则测试"""
    
    def test_no_risk_low_loss(self):
        """测试低损失无风险"""
        rule = CableLossRule()
        
        result = CableLossResult(
            cable_length=100.0,
            cross_section=10.0,
            current=5.0,
            voltage_drop=2.0,
            voltage_drop_percent=1.0,
            power_loss=10.0,
            power_loss_percent=1.0,
            wire_type='copper'
        )
        
        is_risky, risk_level, message = rule.evaluate(cable_loss_result=result)
        
        assert is_risky == False
        assert risk_level == RiskLevel.LOW
    
    def test_high_risk_high_loss(self):
        """测试高损失风险"""
        rule = CableLossRule()
        
        result = CableLossResult(
            cable_length=200.0,
            cross_section=2.5,
            current=20.0,
            voltage_drop=30.0,
            voltage_drop_percent=10.0,
            power_loss=600.0,
            power_loss_percent=10.0,
            wire_type='copper'
        )
        
        is_risky, risk_level, message = rule.evaluate(cable_loss_result=result)
        
        assert is_risky == True
        assert risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]
    
    def test_evaluate_direct(self):
        """测试直接参数评估"""
        rule = CableLossRule()
        
        is_risky, risk_level, message = rule.evaluate_direct(
            current=15.0,
            voltage=100.0,
            cable_length=100.0,
            cross_section=2.5,
            round_trip=True,
            wire_type='copper'
        )
        
        assert is_risky == True


class TestShadingRiskRule:
    """遮挡损失风险规则测试"""
    
    def test_no_risk_low_shading(self):
        """测试低遮挡无风险"""
        rule = ShadingRiskRule()
        
        is_risky, risk_level, message = rule.evaluate(shading_loss_percent=3.0)
        
        assert is_risky == False
        assert risk_level == RiskLevel.LOW
    
    def test_risk_high_shading(self):
        """测试高遮挡风险"""
        rule = ShadingRiskRule()
        
        is_risky, risk_level, message = rule.evaluate(shading_loss_percent=8.0)
        
        assert is_risky == True
        assert risk_level in [RiskLevel.MEDIUM, RiskLevel.HIGH]


class TestRiskAssessor:
    """风险综合评估器测试"""
    
    def test_assess_solution(self, test_module, test_inverter, test_roof_zones):
        """测试方案风险评估"""
        from pvchecker.solver import ConfigurationSolver
        
        solver = ConfigurationSolver(
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
        )
        
        solutions = solver.solve()
        
        assessor = RiskAssessor()
        
        for sol in solutions:
            risks = assessor.assess_solution(
                solution=sol,
                module=test_module,
                inverter=test_inverter,
                min_temp=-10.0
            )
            
            assert isinstance(risks, list)
    
    def test_assess_all(self, test_module, test_inverter, test_roof_zones):
        """测试多方案风险评估"""
        from pvchecker.solver import ConfigurationSolver
        
        solver = ConfigurationSolver(
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
        )
        
        solutions = solver.solve()
        
        assessor = RiskAssessor()
        
        all_risks = assessor.assess_all(
            solutions=solutions,
            module=test_module,
            inverter=test_inverter,
            min_temp=-10.0
        )
        
        assert isinstance(all_risks, dict)
        assert len(all_risks) == len(solutions)
    
    def test_get_summary(self, test_module, test_inverter, test_roof_zones):
        """测试风险摘要"""
        from pvchecker.solver import ConfigurationSolver
        
        solver = ConfigurationSolver(
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
        )
        
        solutions = solver.solve()
        
        assessor = RiskAssessor()
        
        all_risks = assessor.assess_all(
            solutions=solutions,
            module=test_module,
            inverter=test_inverter,
            min_temp=-10.0
        )
        
        for risks in all_risks.values():
            summary = assessor.get_summary(risks)
            
            assert 'total_risks' in summary
            assert 'by_severity' in summary
            assert 'overall_status' in summary
    
    def test_compare_risk_profiles(self, test_module, test_inverter, test_roof_zones):
        """测试风险状况对比"""
        from pvchecker.solver import ConfigurationSolver
        
        solver = ConfigurationSolver(
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
        )
        
        solutions = solver.solve()
        
        assessor = RiskAssessor()
        
        all_risks = assessor.assess_all(
            solutions=solutions,
            module=test_module,
            inverter=test_inverter,
            min_temp=-10.0
        )
        
        comparison = assessor.compare_risk_profiles(all_risks)
        
        assert 'comparison' in comparison
        assert 'safest_solution' in comparison
        assert 'riskiest_solution' in comparison
