"""测试单位校验模块"""

import pytest
from error_propagation.unit_validator import UnitValidator
from error_propagation.types import Measurement, IssueType, Severity


class TestUnitValidator:
    """测试单位校验器"""

    def setup_method(self):
        self.validator = UnitValidator()

    def test_valid_unit(self):
        """测试有效单位"""
        m = Measurement(name='L', value=1.0, uncertainty=0.01, unit='m')
        issue = self.validator.validate_measurement(m)

        assert issue is None

    def test_invalid_unit(self):
        """测试无效单位"""
        m = Measurement(name='L', value=1.0, uncertainty=0.01, unit='xyz')
        issue = self.validator.validate_measurement(m)

        assert issue is not None
        assert issue.issue_type == IssueType.INVALID_UNIT
        assert issue.severity == Severity.ERROR

    def test_missing_unit(self):
        """测试缺失单位"""
        m = Measurement(name='L', value=1.0, uncertainty=0.01, unit='')
        issue = self.validator.validate_measurement(m)

        assert issue is not None
        assert issue.issue_type == IssueType.INVALID_UNIT
        assert issue.severity == Severity.WARNING

    def test_dimensionless_unit(self):
        """测试无量纲单位"""
        m = Measurement(name='ratio', value=1.5, uncertainty=0.01, unit='')
        issue = self.validator.validate_measurement(m)

        assert issue is not None
        assert issue.issue_type == IssueType.INVALID_UNIT

    def test_formula_unit_validation(self):
        """测试公式量纲验证"""
        measurements = {
            'm': Measurement(name='m', value=0.050, uncertainty=0.001, unit='kg'),
            'V': Measurement(name='V', value=0.000006, uncertainty=0.0000001, unit='m^3')
        }

        issues = self.validator.validate_formula_units('m / V', measurements, target_unit='kg/m^3')

        assert len(issues) == 0

    def test_formula_unit_mismatch(self):
        """测试公式量纲不匹配"""
        measurements = {
            'm': Measurement(name='m', value=0.050, uncertainty=0.001, unit='kg'),
            'V': Measurement(name='V', value=0.000006, uncertainty=0.0000001, unit='m^3')
        }

        issues = self.validator.validate_formula_units('m / V', measurements, target_unit='m/s^2')

        assert len(issues) > 0
        assert issues[0].issue_type == IssueType.UNIT_MISMATCH

    def test_suggest_units(self):
        """测试单位建议"""
        suggestions = self.validator._suggest_units('metr')

        assert len(suggestions) > 0
        assert any('m (' in s for s in suggestions)

    def test_significant_figures_check(self):
        """测试有效数字检查"""
        m = Measurement(
            name='L', value=1.234, uncertainty=0.001,
            unit='m', significant_figures=4
        )
        issue = self.validator._check_significant_figures(m)

        assert issue is None

    def test_too_many_uncertainty_digits(self):
        """测试不确定度有效数字过多"""
        m = Measurement(
            name='L', value=1.23, uncertainty=0.00123,
            unit='m', significant_figures=3
        )
        issue = self.validator._check_significant_figures(m)

        assert issue is not None
        assert issue.issue_type == IssueType.SIGNIFICANT_FIGURES

    def test_correlation_check_identical_values(self):
        """测试相同值的相关性检测"""
        measurements = {
            'L1': Measurement(name='L1', value=1.0, uncertainty=0.01, unit='m'),
            'L2': Measurement(name='L2', value=1.0, uncertainty=0.01, unit='m')
        }

        issues = self.validator.check_correlation(measurements)

        assert len(issues) > 0
        assert any(i.issue_type == IssueType.CORRELATED_VARIABLES for i in issues)

    def test_correlation_check_related_names(self):
        """测试相关名称的相关性检测"""
        measurements = {
            'L': Measurement(name='L', value=1.0, uncertainty=0.01, unit='m'),
            'ΔL': Measurement(name='ΔL', value=0.01, uncertainty=0.001, unit='m')
        }

        issues = self.validator.check_correlation(measurements)

        assert len(issues) > 0
        assert any(i.issue_type == IssueType.CORRELATED_VARIABLES for i in issues)

    def test_round_result(self):
        """测试结果舍入"""
        from error_propagation.types import PropagationResult
        result = PropagationResult(
            target_name='g',
            target_value=9.81234567,
            target_uncertainty=0.01234,
            target_unit='m/s^2',
            relative_uncertainty=0.00126,
            steps=[],
            combined_formula_latex='',
            uncertainty_contributions={},
            dominant_source='T',
            boundary_checks=[],
            interpretation=''
        )

        rounded = self.validator.round_result(result)

        assert rounded.target_uncertainty == 0.01
        assert rounded.target_value == 9.81

    def test_format_result(self):
        """测试结果格式化"""
        from error_propagation.types import PropagationResult
        result = PropagationResult(
            target_name='g',
            target_value=9.81,
            target_uncertainty=0.01,
            target_unit='m/s^2',
            relative_uncertainty=0.00102,
            steps=[],
            combined_formula_latex='',
            uncertainty_contributions={},
            dominant_source='T',
            boundary_checks=[],
            interpretation=''
        )

        formatted = self.validator.format_result(result)

        assert '9.81' in formatted
        assert '0.01' in formatted
        assert 'm/s^2' in formatted

    def test_are_names_related(self):
        """测试名称相关性判断"""
        assert self.validator._are_names_related('L', 'ΔL') is True
        assert self.validator._are_names_related('L', 'T') is False
        assert self.validator._are_names_related('length', 'lenght') is True

    def test_count_decimal_places(self):
        """测试小数位数计算"""
        assert self.validator._count_decimal_places(0.001) == 3
        assert self.validator._count_decimal_places(1.234) == 3
        assert self.validator._count_decimal_places(100) == 0
        assert self.validator._count_decimal_places(0) == 0
