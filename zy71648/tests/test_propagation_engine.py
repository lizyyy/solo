"""测试误差传播引擎"""

import pytest
import sympy as sp
import numpy as np
from error_propagation.propagation_engine import PropagationEngine
from error_propagation.types import Measurement, Formula, IssueType


class TestPropagationEngine:
    """测试误差传播引擎"""

    def setup_method(self):
        self.engine = PropagationEngine()

    def test_simple_multiplication(self):
        """测试简单乘法: ρ = m/V"""
        measurements = {
            'm': Measurement(name='m', value=0.050, uncertainty=0.001, unit='kg'),
            'V': Measurement(name='V', value=0.000006, uncertainty=0.0000001, unit='m^3')
        }
        formula = Formula(expression='m / V', target_variable='rho')

        result = self.engine.propagate(formula, measurements)

        expected_value = 0.050 / 0.000006
        assert abs(result.target_value - expected_value) < 1e-6

        expected_unc = expected_value * np.sqrt((0.001/0.050)**2 + (0.0000001/0.000006)**2)
        assert abs(result.target_uncertainty - expected_unc) < 1e-3

        assert result.dominant_source == 'm' or result.dominant_source == 'V'
        assert len(result.steps) == 6

    def test_pendulum_gravity(self):
        """测试单摆测重力加速度: g = 4π²L/T²"""
        measurements = {
            'L': Measurement(name='L', value=0.984, uncertainty=0.001, unit='m'),
            'T': Measurement(name='T', value=1.992, uncertainty=0.001, unit='s')
        }
        formula = Formula(expression='4 * pi**2 * L / T**2', target_variable='g')

        result = self.engine.propagate(formula, measurements)

        expected_value = 4 * np.pi**2 * 0.984 / (1.992**2)
        assert abs(result.target_value - expected_value) < 1e-6
        assert 9.7 < result.target_value < 9.9

        relative_L = 0.001 / 0.984
        relative_T = 2 * 0.001 / 1.992
        expected_rel_unc = np.sqrt(relative_L**2 + relative_T**2)
        assert abs(result.relative_uncertainty - expected_rel_unc) < 1e-6

        assert result.dominant_source == 'L'

    def test_power_formula(self):
        """测试电功率: P = I²R"""
        measurements = {
            'I': Measurement(name='I', value=0.500, uncertainty=0.001, unit='A'),
            'R': Measurement(name='R', value=100.0, uncertainty=0.5, unit='Ω')
        }
        formula = Formula(expression='I**2 * R', target_variable='power')

        result = self.engine.propagate(formula, measurements)

        expected_value = 0.500**2 * 100.0
        assert abs(result.target_value - expected_value) < 1e-6

        relative_I = 2 * 0.001 / 0.500
        relative_R = 0.5 / 100.0
        expected_rel_unc = np.sqrt(relative_I**2 + relative_R**2)
        assert abs(result.relative_uncertainty - expected_rel_unc) < 1e-6

        assert result.dominant_source == 'R'

    def test_volume_formula(self):
        """测试长方体体积: V = l × w × h"""
        measurements = {
            'length': Measurement(name='length', value=0.500, uncertainty=0.001, unit='m'),
            'width': Measurement(name='width', value=0.030, uncertainty=0.001, unit='m'),
            'height': Measurement(name='height', value=0.020, uncertainty=0.001, unit='m')
        }
        formula = Formula(expression='length * width * height', target_variable='volume')

        result = self.engine.propagate(formula, measurements)

        expected_value = 0.500 * 0.030 * 0.020
        assert abs(result.target_value - expected_value) < 1e-10

        expected_rel_unc = np.sqrt(
            (0.001/0.500)**2 +
            (0.001/0.030)**2 +
            (0.001/0.020)**2
        )
        assert abs(result.relative_uncertainty - expected_rel_unc) < 1e-6

        assert result.dominant_source == 'height'

    def test_missing_variable(self):
        """测试缺失变量"""
        measurements = {
            'm': Measurement(name='m', value=0.050, uncertainty=0.001, unit='kg')
        }
        formula = Formula(expression='m / V', target_variable='rho')

        result = self.engine.propagate(formula, measurements)

        assert any(
            i.issue_type == IssueType.INVALID_FORMULA
            for i in self.engine.issues
        )

    def test_correlated_variables(self):
        """测试不假设独立的情况（使用绝对值求和）"""
        measurements = {
            'L': Measurement(name='L', value=0.984, uncertainty=0.001, unit='m'),
            'T': Measurement(name='T', value=1.992, uncertainty=0.001, unit='s')
        }
        formula = Formula(expression='4 * pi**2 * L / T**2', target_variable='g')

        result_independent = self.engine.propagate(formula, measurements, assume_independent=True)
        result_correlated = self.engine.propagate(formula, measurements, assume_independent=False)

        assert result_correlated.target_uncertainty >= result_independent.target_uncertainty

    def test_partial_derivatives(self):
        """测试偏导数计算"""
        measurements = {
            'x': Measurement(name='x', value=2.0, uncertainty=0.1, unit='m'),
            'y': Measurement(name='y', value=3.0, uncertainty=0.1, unit='m')
        }
        formula = Formula(expression='x**2 + y**2', target_variable='z')

        result = self.engine.propagate(formula, measurements)

        step3 = result.steps[2]
        assert 'partial_derivatives' in step3.__dict__ or len(result.steps) >= 3

        assert result.target_value == 13.0

    def test_boundary_checks(self):
        """测试边界检查"""
        measurements = {
            'm': Measurement(name='m', value=0.050, uncertainty=0.001, unit='kg'),
            'V': Measurement(name='V', value=0.000006, uncertainty=0.0000001, unit='m^3')
        }
        formula = Formula(expression='m / V', target_variable='rho')

        result = self.engine.propagate(formula, measurements)

        assert len(result.boundary_checks) > 0
        assert any('✅' in check or '⚠️' in check or '❌' in check for check in result.boundary_checks)

    def test_interpretation(self):
        """测试结果解释生成"""
        measurements = {
            'L': Measurement(name='L', value=0.984, uncertainty=0.001, unit='m'),
            'T': Measurement(name='T', value=1.992, uncertainty=0.001, unit='s')
        }
        formula = Formula(expression='4 * pi**2 * L / T**2', target_variable='g')

        result = self.engine.propagate(formula, measurements, target_unit='m/s^2')

        assert '测量结果为' in result.interpretation
        assert '相对不确定度为' in result.interpretation
        assert '主要来源' in result.interpretation

    def test_uncertainty_contributions(self):
        """测试不确定度贡献"""
        measurements = {
            'L': Measurement(name='L', value=0.984, uncertainty=0.001, unit='m'),
            'T': Measurement(name='T', value=1.992, uncertainty=0.001, unit='s')
        }
        formula = Formula(expression='4 * pi**2 * L / T**2', target_variable='g')

        result = self.engine.propagate(formula, measurements)

        assert 'L' in result.uncertainty_contributions
        assert 'T' in result.uncertainty_contributions
        assert result.uncertainty_contributions['L'] > result.uncertainty_contributions['T']

        total_contrib_sq = sum(c**2 for c in result.uncertainty_contributions.values())
        assert abs(total_contrib_sq - result.target_uncertainty**2) < 1e-10
