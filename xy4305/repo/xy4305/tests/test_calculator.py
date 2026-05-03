"""配平计算器单元测试"""

import pytest

from centrifuge_balance.models import (
    Rotor, TubeType, Sample, BalanceConfig
)
from centrifuge_balance.calculator import BalanceCalculator


class TestBalanceCalculator:
    """配平计算器测试"""
    
    @pytest.fixture
    def default_rotor(self):
        """默认测试转子 - 12孔"""
        return Rotor(
            id="test_rotor",
            name="测试转子",
            hole_count=12,
            radius_cm=10.0,
            max_rpm=12000
        )
    
    @pytest.fixture
    def default_tube(self):
        """默认测试管型"""
        return TubeType(
            id="tube_15ml",
            name="15ml离心管",
            empty_weight_g=1.5,
            max_volume_ml=15.0
        )
    
    @pytest.fixture
    def default_config(self):
        """默认配置"""
        return BalanceConfig()
    
    @pytest.fixture
    def calculator(self, default_config):
        """计算器实例"""
        return BalanceCalculator(config=default_config)
    
    def test_calculate_hole_result(self, calculator, default_rotor, default_tube):
        """测试单个孔位计算"""
        sample = Sample(
            hole_position=1,
            tube_type_id="tube_15ml",
            sample_volume_ml=10.0,
            sample_density_gml=1.0
        )
        
        result = calculator.calculate_hole_result(sample, default_tube, default_rotor)
        
        expected_total_mass = 1.5 + (10.0 * 1.0)
        expected_moment = expected_total_mass * 10.0
        
        assert result.hole_position == 1
        assert result.total_mass_g == expected_total_mass
        assert result.mass_moment_gcm == expected_moment
    
    def test_calculate_imbalance(self, calculator):
        """测试不平衡量计算"""
        from centrifuge_balance.models import HoleResult
        
        hole1 = HoleResult(
            hole_position=1,
            tube_type_id="tube_15ml",
            total_mass_g=11.5,
            mass_moment_gcm=115.0,
            sample_volume_ml=10.0,
            sample_density_gml=1.0
        )
        
        hole2 = HoleResult(
            hole_position=7,
            tube_type_id="tube_15ml",
            total_mass_g=10.5,
            mass_moment_gcm=105.0,
            sample_volume_ml=9.0,
            sample_density_gml=1.0
        )
        
        imbalance = calculator.calculate_imbalance(hole1, hole2, (1, 7))
        
        assert imbalance.mass_difference_g == 1.0
        assert imbalance.moment_difference_gcm == 10.0
        assert imbalance.mass_direction == "孔位1较重"
    
    def test_validate_inputs_valid(self, calculator, default_rotor, default_tube):
        """测试有效输入校验"""
        samples = [
            Sample(hole_position=1, tube_type_id="tube_15ml", sample_volume_ml=10.0),
            Sample(hole_position=7, tube_type_id="tube_15ml", sample_volume_ml=10.0),
        ]
        
        tube_types = {"tube_15ml": default_tube}
        
        errors = calculator.validate_inputs(default_rotor, samples, tube_types, 10000)
        
        assert len(errors) == 0
    
    def test_validate_inputs_rpm_exceeded(self, calculator, default_rotor, default_tube):
        """测试转速超限"""
        samples = [
            Sample(hole_position=1, tube_type_id="tube_15ml", sample_volume_ml=10.0),
            Sample(hole_position=7, tube_type_id="tube_15ml", sample_volume_ml=10.0),
        ]
        
        tube_types = {"tube_15ml": default_tube}
        
        errors = calculator.validate_inputs(default_rotor, samples, tube_types, 15000)
        
        assert len(errors) == 1
        assert errors[0].error_type == "转速超限"
    
    def test_validate_inputs_invalid_rpm(self, calculator, default_rotor, default_tube):
        """测试无效转速"""
        samples = [
            Sample(hole_position=1, tube_type_id="tube_15ml", sample_volume_ml=10.0),
            Sample(hole_position=7, tube_type_id="tube_15ml", sample_volume_ml=10.0),
        ]
        
        tube_types = {"tube_15ml": default_tube}
        
        errors = calculator.validate_inputs(default_rotor, samples, tube_types, 0)
        
        assert len(errors) == 1
        assert errors[0].error_type == "转速无效"
    
    def test_validate_inputs_duplicate_hole(self, calculator, default_rotor, default_tube):
        """测试重复孔位"""
        samples = [
            Sample(hole_position=1, tube_type_id="tube_15ml", sample_volume_ml=10.0),
            Sample(hole_position=1, tube_type_id="tube_15ml", sample_volume_ml=10.0),
        ]
        
        tube_types = {"tube_15ml": default_tube}
        
        errors = calculator.validate_inputs(default_rotor, samples, tube_types, 10000)
        
        assert len(errors) >= 1
        duplicate_errors = [e for e in errors if e.error_type == "孔位重复"]
        assert len(duplicate_errors) == 1
    
    def test_validate_inputs_invalid_hole_position(self, calculator, default_rotor, default_tube):
        """测试无效孔位"""
        samples = [
            Sample(hole_position=0, tube_type_id="tube_15ml", sample_volume_ml=10.0),
            Sample(hole_position=13, tube_type_id="tube_15ml", sample_volume_ml=10.0),
        ]
        
        tube_types = {"tube_15ml": default_tube}
        
        errors = calculator.validate_inputs(default_rotor, samples, tube_types, 10000)
        
        invalid_errors = [e for e in errors if e.error_type == "孔位无效"]
        assert len(invalid_errors) == 2
    
    def test_validate_inputs_unknown_tube_type(self, calculator, default_rotor):
        """测试未知管型"""
        samples = [
            Sample(hole_position=1, tube_type_id="unknown_tube", sample_volume_ml=10.0),
        ]
        
        tube_types = {}
        
        errors = calculator.validate_inputs(default_rotor, samples, tube_types, 10000)
        
        tube_errors = [e for e in errors if e.error_type == "管型不存在"]
        assert len(tube_errors) == 1
    
    def test_validate_inputs_negative_volume(self, calculator, default_rotor, default_tube):
        """测试负体积"""
        samples = [
            Sample(hole_position=1, tube_type_id="tube_15ml", sample_volume_ml=-5.0),
        ]
        
        tube_types = {"tube_15ml": default_tube}
        
        errors = calculator.validate_inputs(default_rotor, samples, tube_types, 10000)
        
        volume_errors = [e for e in errors if e.error_type == "体积无效"]
        assert len(volume_errors) == 1
    
    def test_validate_inputs_volume_exceeded(self, calculator, default_rotor, default_tube):
        """测试体积超限"""
        samples = [
            Sample(hole_position=1, tube_type_id="tube_15ml", sample_volume_ml=20.0),
        ]
        
        tube_types = {"tube_15ml": default_tube}
        
        errors = calculator.validate_inputs(default_rotor, samples, tube_types, 10000)
        
        volume_errors = [e for e in errors if e.error_type == "体积超限"]
        assert len(volume_errors) == 1
    
    def test_validate_inputs_invalid_density(self, calculator, default_rotor, default_tube):
        """测试无效密度"""
        samples = [
            Sample(hole_position=1, tube_type_id="tube_15ml", sample_volume_ml=10.0, sample_density_gml=0.0),
        ]
        
        tube_types = {"tube_15ml": default_tube}
        
        errors = calculator.validate_inputs(default_rotor, samples, tube_types, 10000)
        
        density_errors = [e for e in errors if e.error_type == "密度无效"]
        assert len(density_errors) == 1
    
    def test_validate_inputs_missing_hole(self, calculator, default_rotor, default_tube):
        """测试缺孔"""
        samples = [
            Sample(hole_position=1, tube_type_id="tube_15ml", sample_volume_ml=10.0),
        ]
        
        tube_types = {"tube_15ml": default_tube}
        
        errors = calculator.validate_inputs(default_rotor, samples, tube_types, 10000)
        
        missing_errors = [e for e in errors if e.error_type == "缺孔"]
        assert len(missing_errors) == 1
    
    def test_validate_inputs_allow_partial_loading(self, default_rotor, default_tube):
        """测试允许部分装载"""
        config = BalanceConfig(allow_partial_loading=True)
        calculator = BalanceCalculator(config=config)
        
        samples = [
            Sample(hole_position=1, tube_type_id="tube_15ml", sample_volume_ml=10.0),
        ]
        
        tube_types = {"tube_15ml": default_tube}
        
        errors = calculator.validate_inputs(default_rotor, samples, tube_types, 10000)
        
        missing_errors = [e for e in errors if e.error_type == "缺孔"]
        assert len(missing_errors) == 0
    
    def test_calculate_balanced(self, calculator, default_rotor, default_tube):
        """测试配平计算 - 已配平"""
        samples = [
            Sample(hole_position=1, tube_type_id="tube_15ml", sample_volume_ml=10.0),
            Sample(hole_position=7, tube_type_id="tube_15ml", sample_volume_ml=10.0),
            Sample(hole_position=2, tube_type_id="tube_15ml", sample_volume_ml=5.0),
            Sample(hole_position=8, tube_type_id="tube_15ml", sample_volume_ml=5.0),
        ]
        
        tube_types = {"tube_15ml": default_tube}
        
        result = calculator.calculate(default_rotor, samples, tube_types, 10000)
        
        assert len(result.validation_errors) == 0
        assert result.is_balanced == True
        assert result.max_mass_imbalance_g == 0.0
    
    def test_calculate_imbalanced(self, calculator, default_rotor, default_tube):
        """测试配平计算 - 未配平"""
        samples = [
            Sample(hole_position=1, tube_type_id="tube_15ml", sample_volume_ml=12.0),
            Sample(hole_position=7, tube_type_id="tube_15ml", sample_volume_ml=8.0),
        ]
        
        tube_types = {"tube_15ml": default_tube}
        
        result = calculator.calculate(default_rotor, samples, tube_types, 10000)
        
        assert result.is_balanced == False
        assert result.max_mass_imbalance_g > 0
        assert len(result.adjustment_suggestions) > 0
    
    def test_calculate_with_validation_errors(self, calculator, default_rotor, default_tube):
        """测试存在校验错误时的计算"""
        samples = [
            Sample(hole_position=1, tube_type_id="tube_15ml", sample_volume_ml=10.0),
        ]
        
        tube_types = {"tube_15ml": default_tube}
        
        result = calculator.calculate(default_rotor, samples, tube_types, 10000)
        
        assert len(result.validation_errors) > 0
        assert result.is_balanced == False
        assert len(result.hole_results) == 0
    
    def test_generate_adjustment_suggestions(self, calculator, default_rotor, default_tube):
        """测试调整建议生成"""
        from centrifuge_balance.models import HoleResult, ImbalanceInfo
        
        hole1 = HoleResult(
            hole_position=1,
            tube_type_id="tube_15ml",
            total_mass_g=13.5,
            mass_moment_gcm=135.0,
            sample_volume_ml=12.0,
            sample_density_gml=1.0
        )
        
        hole2 = HoleResult(
            hole_position=7,
            tube_type_id="tube_15ml",
            total_mass_g=9.5,
            mass_moment_gcm=95.0,
            sample_volume_ml=8.0,
            sample_density_gml=1.0
        )
        
        imbalance = ImbalanceInfo(
            hole_pair=(1, 7),
            hole1_position=1,
            hole2_position=7,
            hole1_mass_g=13.5,
            hole2_mass_g=9.5,
            mass_difference_g=4.0,
            mass_direction="孔位1较重",
            hole1_moment_gcm=135.0,
            hole2_moment_gcm=95.0,
            moment_difference_gcm=40.0
        )
        
        tube_types = {"tube_15ml": default_tube}
        
        suggestions = calculator.generate_adjustment_suggestions(
            [imbalance], [hole1, hole2], tube_types, default_rotor
        )
        
        assert len(suggestions) > 0
        
        refill_suggestions = [s for s in suggestions if s.suggestion_type == "补液"]
        assert len(refill_suggestions) > 0
