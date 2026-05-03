import sys
import os
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
from fitting import CurveFitter, PumpFlowModel, FittingResult, PumpSpeedRecommendation, curve_fitter


class TestPumpFlowModel:
    @pytest.fixture
    def model(self):
        return PumpFlowModel()
    
    def test_linear_model(self, model):
        func = model.get_model_function('linear')
        result = func(10.0, 0.5, 1.0)
        expected = 0.5 * 10.0 + 1.0
        assert result == expected
    
    def test_quadratic_model(self, model):
        func = model.get_model_function('quadratic')
        result = func(10.0, 0.01, 0.5, 1.0)
        expected = 0.01 * (10.0**2) + 0.5 * 10.0 + 1.0
        assert result == expected
    
    def test_power_model(self, model):
        func = model.get_model_function('power')
        result = func(10.0, 2.0, 0.8)
        expected = 2.0 * (10.0**0.8)
        assert abs(result - expected) < 0.0001
    
    def test_get_param_names(self, model):
        assert model.get_param_names('linear') == ['slope', 'intercept']
        assert model.get_param_names('quadratic') == ['a', 'b', 'c']
        assert model.get_param_names('power') == ['a', 'b']
    
    def test_invalid_model_type(self, model):
        with pytest.raises(ValueError):
            model.get_model_function('invalid')


class TestCurveFitter:
    @pytest.fixture
    def fitter(self):
        return CurveFitter()
    
    @pytest.fixture
    def linear_data(self):
        np.random.seed(42)
        x = np.array([10.0, 20.0, 30.0, 40.0, 50.0])
        true_slope = 0.12
        true_intercept = 0.5
        noise = np.random.normal(0, 0.05, size=len(x))
        y = true_slope * x + true_intercept + noise
        return x, y, true_slope, true_intercept
    
    def test_fit_linear_model(self, fitter, linear_data):
        x, y, true_slope, true_intercept = linear_data
        
        result = fitter.fit(x, y, model_type='linear')
        
        assert isinstance(result, FittingResult)
        assert result.model_type == 'linear'
        assert len(result.params) == 2
        assert result.r_squared > 0.9
    
    def test_fit_result_attributes(self, fitter, linear_data):
        x, y, true_slope, true_intercept = linear_data
        
        result = fitter.fit(x, y, model_type='linear')
        
        assert result.pump_speed_range == (float(np.min(x)), float(np.max(x)))
        assert result.flow_rate_range == (float(np.min(y)), float(np.max(y)))
        assert len(result.residuals) == len(x)
        assert result.rmse > 0
        assert result.mae > 0
    
    def test_fit_insufficient_data(self, fitter):
        x = np.array([10.0, 20.0])
        y = np.array([1.0, 2.0])
        
        with pytest.raises(ValueError, match="至少需要3个数据点"):
            fitter.fit(x, y, model_type='linear')
    
    def test_fit_mismatched_lengths(self, fitter):
        x = np.array([10.0, 20.0, 30.0])
        y = np.array([1.0, 2.0])
        
        with pytest.raises(ValueError, match="长度不一致"):
            fitter.fit(x, y, model_type='linear')
    
    def test_compare_models(self, fitter, linear_data):
        x, y, _, _ = linear_data
        
        results = fitter.compare_models(x, y, models=['linear', 'quadratic'])
        
        assert 'linear' in results
        assert 'quadratic' in results
        assert isinstance(results['linear'], FittingResult)
        assert isinstance(results['quadratic'], FittingResult)
    
    def test_select_best_model(self, fitter, linear_data):
        x, y, _, _ = linear_data
        
        results = fitter.compare_models(x, y, models=['linear', 'quadratic'])
        best_model, best_result = fitter.select_best_model(results)
        
        assert best_model in ['linear', 'quadratic']
        assert isinstance(best_result, FittingResult)
    
    def test_calculate_recommended_pump_speed(self, fitter, linear_data):
        x, y, true_slope, true_intercept = linear_data
        
        result = fitter.fit(x, y, model_type='linear')
        
        target_flow = 3.0
        recommendation = fitter.calculate_recommended_pump_speed(
            result, target_flow_rate=target_flow
        )
        
        assert isinstance(recommendation, PumpSpeedRecommendation)
        assert recommendation.target_flow_rate == target_flow
        
        expected_speed = (target_flow - true_intercept) / true_slope
        assert abs(recommendation.recommended_pump_speed - expected_speed) < 1.0
    
    def test_calculate_recommended_pump_speed_out_of_range(self, fitter, linear_data):
        x, y, _, _ = linear_data
        
        result = fitter.fit(x, y, model_type='linear')
        
        too_high_flow = np.max(y) * 2.0
        
        with pytest.raises(ValueError, match="超出数据范围"):
            fitter.calculate_recommended_pump_speed(result, target_flow_rate=too_high_flow)
    
    def test_get_param_info(self, fitter, linear_data):
        x, y, _, _ = linear_data
        
        result = fitter.fit(x, y, model_type='linear')
        param_info = result.get_param_info()
        
        assert 'slope' in param_info
        assert 'intercept' in param_info
        assert 'value' in param_info['slope']
        assert 'std_error' in param_info['slope']


class TestPumpSpeedRecommendation:
    def test_recommendation_attributes(self):
        rec = PumpSpeedRecommendation(
            target_flow_rate=3.0,
            target_flow_rate_unit='L/h',
            recommended_pump_speed=25.0,
            pump_speed_unit='Hz',
            lower_bound=23.0,
            upper_bound=27.0,
            confidence_level=0.95,
            exceedance_probability=0.025,
            risk_assessment="低风险"
        )
        
        assert rec.target_flow_rate == 3.0
        assert rec.recommended_pump_speed == 25.0
        assert rec.lower_bound == 23.0
        assert rec.upper_bound == 27.0
        assert rec.confidence_level == 0.95


class TestCurveFitterInstance:
    def test_singleton_instance(self):
        assert curve_fitter is not None
        assert isinstance(curve_fitter, CurveFitter)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
