import sys
import os
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
from units import UnitConverter, DosageCalculator, unit_converter, dosage_calculator


class TestUnitConverter:
    @pytest.fixture
    def converter(self):
        return UnitConverter()
    
    def test_convert_flow_lh_to_mlmin(self, converter):
        result = converter.convert_flow(60.0, 'L/h', 'ml/min')
        expected = 60.0 / 16.6666667
        assert abs(result - expected) < 0.001
    
    def test_convert_flow_mlmin_to_lh(self, converter):
        result = converter.convert_flow(1.0, 'ml/min', 'L/h')
        expected = 16.6666667
        assert abs(result - expected) < 0.001
    
    def test_convert_flow_m3h_to_lh(self, converter):
        result = converter.convert_flow(1.0, 'm3/h', 'L/h')
        assert result == 1000.0
    
    def test_convert_concentration_mg_l_to_ppm(self, converter):
        result = converter.convert_concentration(5.0, 'mg/L', 'ppm')
        assert result == 5.0
    
    def test_convert_concentration_percent_to_mg_l(self, converter):
        result = converter.convert_concentration(0.1, '%', 'mg/L')
        assert result == 1000.0
    
    def test_convert_concentration_ug_l_to_mg_l(self, converter):
        result = converter.convert_concentration(500.0, 'ug/L', 'mg/L')
        assert result == 0.5
    
    def test_convert_volume_ml_to_l(self, converter):
        result = converter.convert_volume(1000.0, 'ml', 'L')
        assert result == 1.0
    
    def test_convert_volume_m3_to_l(self, converter):
        result = converter.convert_volume(1.0, 'm3', 'L')
        assert result == 1000.0
    
    def test_convert_time_minute_to_hour(self, converter):
        result = converter.convert_time(60.0, 'minute', 'hour')
        assert result == 1.0
    
    def test_convert_time_day_to_hour(self, converter):
        result = converter.convert_time(1.0, 'day', 'hour')
        assert result == 24.0
    
    def test_normalize_unit(self, converter):
        assert converter._normalize_unit('L/H') == 'l/h'
        assert converter._normalize_unit(' mg/L ') == 'mg/l'
        assert converter._normalize_unit('') == ''


class TestDosageCalculator:
    @pytest.fixture
    def calculator(self):
        return DosageCalculator()
    
    def test_calculate_required_flow_simple(self, calculator):
        result, unit = calculator.calculate_required_flow(
            target_concentration=5.0,
            target_concentration_unit='mg/L',
            stock_concentration=10000.0,
            stock_concentration_unit='mg/L',
            process_flow_rate=1.0,
            process_flow_unit='m3/h'
        )
        
        expected = (5.0 * 1.0) / 10000.0 * 1000
        assert abs(result - expected) < 0.0001
        assert unit == 'l/h'
    
    def test_calculate_required_flow_higher_target(self, calculator):
        result, unit = calculator.calculate_required_flow(
            target_concentration=10.0,
            target_concentration_unit='mg/L',
            stock_concentration=5000.0,
            stock_concentration_unit='mg/L',
            process_flow_rate=2.0,
            process_flow_unit='m3/h'
        )
        
        expected = (10.0 * 2.0) / 5000.0 * 1000
        assert abs(result - expected) < 0.0001
    
    def test_calculate_required_flow_zero_stock(self, calculator):
        with pytest.raises(ValueError, match="母液浓度必须大于0"):
            calculator.calculate_required_flow(
                target_concentration=5.0,
                target_concentration_unit='mg/L',
                stock_concentration=0.0,
                stock_concentration_unit='mg/L',
                process_flow_rate=1.0,
                process_flow_unit='m3/h'
            )
    
    def test_calculate_required_flow_negative_target(self, calculator):
        with pytest.raises(ValueError, match="目标浓度不能为负数"):
            calculator.calculate_required_flow(
                target_concentration=-1.0,
                target_concentration_unit='mg/L',
                stock_concentration=10000.0,
                stock_concentration_unit='mg/L',
                process_flow_rate=1.0,
                process_flow_unit='m3/h'
            )
    
    def test_calculate_error_perfect_match(self, calculator):
        result = calculator.calculate_error(measured_value=100.0, reference_value=100.0)
        assert result['absolute_error'] == 0.0
        assert result['relative_error'] == 0.0
        assert result['relative_error_percent'] == 0.0
    
    def test_calculate_error_positive_deviation(self, calculator):
        result = calculator.calculate_error(measured_value=110.0, reference_value=100.0)
        assert result['absolute_error'] == 10.0
        assert result['relative_error'] == 0.1
        assert result['relative_error_percent'] == 10.0
    
    def test_calculate_error_negative_deviation(self, calculator):
        result = calculator.calculate_error(measured_value=90.0, reference_value=100.0)
        assert result['absolute_error'] == -10.0
        assert result['relative_error'] == -0.1
        assert result['relative_error_percent'] == -10.0
    
    def test_calculate_error_zero_reference(self, calculator):
        result = calculator.calculate_error(measured_value=10.0, reference_value=0.0)
        assert result['absolute_error'] == 10.0
        assert np.isnan(result['relative_error'])


class TestUnitConverterInstance:
    def test_singleton_instance(self):
        assert unit_converter is not None
        assert isinstance(unit_converter, UnitConverter)
    
    def test_dosage_calculator_instance(self):
        assert dosage_calculator is not None
        assert isinstance(dosage_calculator, DosageCalculator)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
