#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
光伏计算核心模块测试 - PV Calculation Tests

测试温度修正、I-V特性、遮挡损失、线缆压降计算。
"""

import pytest
import numpy as np

from pvchecker.pvcalc import (
    TemperatureCorrector,
    TemperatureCorrectedParams,
    IVCalculator,
    IVCurve,
    IVPoint,
    ShadingCalculator,
    ShadingLossResult,
    CableLossCalculator,
    CableLossResult,
    CalculationError,
)


class TestTemperatureCorrector:
    """温度修正计算器测试"""
    
    def test_stc_temperature(self, test_module):
        """测试STC温度下的修正"""
        corrector = TemperatureCorrector(test_module)
        params = corrector.calculate(25.0)
        
        assert params.temperature == 25.0
        assert abs(params.voc - test_module.voc) < 0.01
        assert abs(params.isc - test_module.isc) < 0.01
        assert abs(params.v_mp - test_module.v_mp) < 0.01
        assert abs(params.i_mp - test_module.i_mp) < 0.01
        assert abs(params.p_max - test_module.p_max) < 1.0
    
    def test_low_temperature_voc_increase(self, test_module):
        """测试低温下Voc升高"""
        corrector = TemperatureCorrector(test_module)
        
        stc_params = corrector.calculate(25.0)
        low_temp_params = corrector.calculate(-10.0)
        
        assert low_temp_params.voc > stc_params.voc
        assert low_temp_params.isc < stc_params.isc
    
    def test_high_temperature_voc_decrease(self, test_module):
        """测试高温下Voc降低"""
        corrector = TemperatureCorrector(test_module)
        
        stc_params = corrector.calculate(25.0)
        high_temp_params = corrector.calculate(60.0)
        
        assert high_temp_params.voc < stc_params.voc
        assert high_temp_params.isc > stc_params.isc
    
    def test_temperature_coeff_sign_validation(self, test_module):
        """测试温度系数符号验证"""
        invalid_module = test_module
        invalid_module.temp_coeff_voc = 0.32
        
        with pytest.raises(CalculationError, match="开路电压温度系数应为负值"):
            TemperatureCorrector(invalid_module)
    
    def test_calculate_range(self, test_module):
        """测试温度范围计算"""
        corrector = TemperatureCorrector(test_module)
        
        results = corrector.calculate_range(-10.0, 60.0, 10.0)
        
        # 序列: -10, 0, 10, 20, 30, 40, 50, 60
        assert len(results) == 8
        assert -10.0 in results
        assert 20.0 in results
        assert 60.0 in results
    
    def test_get_low_temp_voc(self, test_module):
        """测试获取低温Voc"""
        corrector = TemperatureCorrector(test_module)
        
        voc = corrector.get_low_temp_voc(-10.0)
        stc_voc = test_module.voc
        
        assert voc > stc_voc
    
    def test_get_high_temp_voc(self, test_module):
        """测试获取高温Voc"""
        corrector = TemperatureCorrector(test_module)
        
        voc = corrector.get_high_temp_voc(60.0)
        stc_voc = test_module.voc
        
        assert voc < stc_voc
    
    def test_estimate_cell_temperature(self, test_module):
        """测试估算电池温度"""
        corrector = TemperatureCorrector(test_module)
        
        cell_temp = corrector.estimate_cell_temperature(
            ambient_temp=25.0,
            irradiance=1000.0,
            wind_speed=1.0
        )
        
        assert cell_temp > 25.0
        assert 40.0 <= cell_temp <= 60.0


class TestIVCalculator:
    """I-V特性计算器测试"""
    
    def test_module_iv_stc(self, test_module):
        """测试STC条件下的组件I-V曲线"""
        calculator = IVCalculator(test_module)
        
        curve = calculator.calculate_module_iv(
            temperature=25.0,
            irradiance=1000.0
        )
        
        assert isinstance(curve, IVCurve)
        assert abs(curve.voc - test_module.voc) < 5.0
        assert abs(curve.isc - test_module.isc) < 1.0
        assert len(curve.points) > 0
    
    def test_module_iv_low_irradiance(self, test_module):
        """测试低辐照度下的I-V曲线"""
        calculator = IVCalculator(test_module)
        
        curve_full = calculator.calculate_module_iv(irradiance=1000.0)
        curve_half = calculator.calculate_module_iv(irradiance=500.0)
        
        assert curve_half.isc < curve_full.isc
        assert abs(curve_half.voc - curve_full.voc) < 5.0
    
    def test_string_iv_series(self, test_module):
        """测试串联组串I-V曲线"""
        calculator = IVCalculator(test_module)
        
        module_curve = calculator.calculate_module_iv()
        string_curve = calculator.calculate_string_iv(modules_per_string=10)
        
        assert string_curve.voc > module_curve.voc
        assert abs(string_curve.isc - module_curve.isc) < 0.5
    
    def test_string_iv_with_shading(self, test_module):
        """测试带遮挡的串联组串I-V曲线"""
        calculator = IVCalculator(test_module)
        
        no_shading_curve = calculator.calculate_string_iv(
            modules_per_string=10,
            module_shading_factors=[1.0] * 10
        )
        
        shaded_curve = calculator.calculate_string_iv(
            modules_per_string=10,
            module_shading_factors=[1.0, 1.0, 0.5, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
        )
        
        assert shaded_curve.isc < no_shading_curve.isc
        assert shaded_curve.p_max < no_shading_curve.p_max
    
    def test_parallel_iv(self, test_module):
        """测试并联组串I-V曲线"""
        calculator = IVCalculator(test_module)
        
        string_curve = calculator.calculate_string_iv(modules_per_string=10)
        
        parallel_curve = calculator.calculate_parallel_iv(
            string_curves=[string_curve, string_curve]
        )
        
        assert abs(parallel_curve.voc - string_curve.voc) < 5.0
        assert abs(parallel_curve.isc - string_curve.isc * 2) < 1.0


class TestShadingCalculator:
    """遮挡损失计算器测试"""
    
    def test_no_shading_loss(self, test_module):
        """测试无遮挡时的损失"""
        calculator = ShadingCalculator(test_module)
        
        result = calculator.calculate_string_shading_loss(
            modules_per_string=10,
            shading_factors=[1.0] * 10
        )
        
        assert isinstance(result, ShadingLossResult)
        assert result.min_shading_factor == 1.0
        assert result.estimated_power_loss_percent < 5.0
    
    def test_partial_shading_loss(self, test_module):
        """测试部分遮挡时的损失"""
        calculator = ShadingCalculator(test_module)
        
        no_shading_result = calculator.calculate_string_shading_loss(
            modules_per_string=10,
            shading_factors=[1.0] * 10
        )
        
        shaded_result = calculator.calculate_string_shading_loss(
            modules_per_string=10,
            shading_factors=[1.0, 1.0, 0.5, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
        )
        
        assert shaded_result.min_shading_factor == 0.5
        assert shaded_result.estimated_power_loss_percent > no_shading_result.estimated_power_loss_percent
        assert len(shaded_result.bottleneck_modules) > 0
    
    def test_check_current_mismatch(self, test_module):
        """测试电流不匹配检测"""
        calculator = ShadingCalculator(test_module)
        
        no_mismatch_result = calculator.check_current_mismatch(
            string_shading_factors=[
                [1.0] * 10,
                [1.0] * 10,
            ]
        )
        
        assert no_mismatch_result['mismatch'] == False
        assert no_mismatch_result['max_current_diff_percent'] < 5.0
        assert no_mismatch_result['risk_level'] == 'low'
        
        mismatch_result = calculator.check_current_mismatch(
            string_shading_factors=[
                [1.0] * 10,
                [0.7] * 10,
            ]
        )
        
        assert mismatch_result['max_current_diff_percent'] > 10.0


class TestCableLossCalculator:
    """线缆损失计算器测试"""
    
    def test_copper_cable_loss(self):
        """测试铜缆损失计算"""
        calculator = CableLossCalculator('copper')
        
        result = calculator.calculate(
            current=15.0,
            voltage=600.0,
            cable_length=50.0,
            cross_section=6.0,
            round_trip=True
        )
        
        assert isinstance(result, CableLossResult)
        assert result.voltage_drop > 0
        assert result.power_loss > 0
        assert result.wire_type == 'copper'
    
    def test_aluminum_cable_loss(self):
        """测试铝缆损失计算"""
        calculator = CableLossCalculator('aluminum')
        
        result = calculator.calculate(
            current=15.0,
            voltage=600.0,
            cable_length=50.0,
            cross_section=6.0,
            round_trip=True
        )
        
        assert result.wire_type == 'aluminum'
        assert result.voltage_drop > 0
    
    def test_invalid_wire_type(self):
        """测试无效线缆类型"""
        with pytest.raises(CalculationError, match="不支持的线缆类型"):
            CableLossCalculator('iron')
    
    def test_negative_current(self):
        """测试负电流"""
        calculator = CableLossCalculator('copper')
        
        with pytest.raises(CalculationError, match="电流不能为负值"):
            calculator.calculate(
                current=-10.0,
                voltage=600.0,
                cable_length=50.0,
                cross_section=6.0
            )
    
    def test_recommend_cable_size(self):
        """测试线缆规格推荐"""
        calculator = CableLossCalculator('copper')
        
        recommendation = calculator.recommend_cable_size(
            current=15.0,
            voltage=600.0,
            cable_length=50.0,
            max_voltage_drop_percent=2.0
        )
        
        assert 'recommended_size' in recommendation
        assert recommendation['recommended_size'] in calculator.STANDARD_CABLE_SIZES
    
    def test_check_cable_loss_risk(self):
        """测试线缆损失风险检测"""
        calculator = CableLossCalculator('copper')
        
        low_loss_result = calculator.calculate(
            current=5.0,
            voltage=600.0,
            cable_length=20.0,
            cross_section=10.0
        )
        
        risk = calculator.check_cable_loss_risk(
            low_loss_result,
            warning_threshold=2.0,
            critical_threshold=5.0
        )
        
        assert risk['risk_level'] == 'low'
        
        high_loss_result = calculator.calculate(
            current=30.0,
            voltage=100.0,
            cable_length=100.0,
            cross_section=2.5
        )
        
        high_risk = calculator.check_cable_loss_risk(
            high_loss_result,
            warning_threshold=2.0,
            critical_threshold=5.0
        )
        
        assert high_risk['risk_level'] in ['high', 'critical']
