"""数据模型单元测试"""

import pytest
from datetime import datetime

from centrifuge_balance.models import (
    Rotor, TubeType, Sample, TubeMaterial,
    HoleResult, ImbalanceInfo, AdjustmentSuggestion,
    ValidationError, BalanceResult, BalanceConfig
)


class TestRotor:
    """转子模型测试"""
    
    def test_rotor_creation(self):
        """测试转子创建"""
        rotor = Rotor(
            id="test_rotor",
            name="测试转子",
            hole_count=12,
            radius_cm=10.0,
            max_rpm=12000
        )
        
        assert rotor.id == "test_rotor"
        assert rotor.name == "测试转子"
        assert rotor.hole_count == 12
        assert rotor.radius_cm == 10.0
        assert rotor.max_rpm == 12000
        assert rotor.usage_count == 0
        assert rotor.last_used is None
    
    def test_rotor_get_opposite_hole(self):
        """测试获取对称孔位"""
        rotor = Rotor(
            id="test",
            name="test",
            hole_count=12,
            radius_cm=10.0,
            max_rpm=12000
        )
        
        assert rotor.get_opposite_hole(1) == 7
        assert rotor.get_opposite_hole(6) == 12
        assert rotor.get_opposite_hole(7) == 1
        assert rotor.get_opposite_hole(12) == 6
    
    def test_rotor_get_opposite_hole_invalid(self):
        """测试无效孔位抛出异常"""
        rotor = Rotor(
            id="test",
            name="test",
            hole_count=12,
            radius_cm=10.0,
            max_rpm=12000
        )
        
        with pytest.raises(ValueError):
            rotor.get_opposite_hole(0)
        
        with pytest.raises(ValueError):
            rotor.get_opposite_hole(13)
    
    def test_rotor_get_hole_pairs(self):
        """测试获取孔位对"""
        rotor = Rotor(
            id="test",
            name="test",
            hole_count=12,
            radius_cm=10.0,
            max_rpm=12000
        )
        
        pairs = rotor.get_hole_pairs()
        
        assert len(pairs) == 6
        assert (1, 7) in pairs
        assert (6, 12) in pairs
    
    def test_rotor_to_dict_and_from_dict(self):
        """测试字典序列化和反序列化"""
        rotor = Rotor(
            id="test_rotor",
            name="测试转子",
            hole_count=12,
            radius_cm=10.0,
            max_rpm=12000,
            description="测试用转子",
            usage_count=5,
            last_used=datetime(2024, 1, 15, 10, 30, 0)
        )
        
        rotor_dict = rotor.to_dict()
        
        assert rotor_dict["id"] == "test_rotor"
        assert rotor_dict["usage_count"] == 5
        assert "last_used" in rotor_dict
        
        restored = Rotor.from_dict(rotor_dict)
        
        assert restored.id == "test_rotor"
        assert restored.usage_count == 5
        assert restored.last_used is not None
        assert restored.last_used.year == 2024


class TestTubeType:
    """管型模型测试"""
    
    def test_tube_type_creation(self):
        """测试管型创建"""
        tube = TubeType(
            id="tube_15ml",
            name="15ml离心管",
            empty_weight_g=1.5,
            max_volume_ml=15.0
        )
        
        assert tube.id == "tube_15ml"
        assert tube.empty_weight_g == 1.5
        assert tube.max_volume_ml == 15.0
        assert tube.material == TubeMaterial.PLASTIC
    
    def test_tube_type_to_dict_and_from_dict(self):
        """测试字典序列化"""
        tube = TubeType(
            id="tube_50ml",
            name="50ml离心管",
            empty_weight_g=4.0,
            max_volume_ml=50.0,
            material=TubeMaterial.POLYCARBONATE,
            description="聚碳酸酯管"
        )
        
        tube_dict = tube.to_dict()
        restored = TubeType.from_dict(tube_dict)
        
        assert restored.id == "tube_50ml"
        assert restored.material == TubeMaterial.POLYCARBONATE


class TestSample:
    """样品模型测试"""
    
    def test_sample_creation(self):
        """测试样品创建"""
        sample = Sample(
            hole_position=1,
            tube_type_id="tube_15ml",
            sample_volume_ml=10.0,
            sample_density_gml=1.05,
            label="测试样品"
        )
        
        assert sample.hole_position == 1
        assert sample.sample_volume_ml == 10.0
        assert sample.sample_density_gml == 1.05
    
    def test_sample_total_mass(self):
        """测试总质量计算"""
        sample = Sample(
            hole_position=1,
            tube_type_id="tube_15ml",
            sample_volume_ml=10.0,
            sample_density_gml=1.0
        )
        
        tube = TubeType(
            id="tube_15ml",
            name="15ml",
            empty_weight_g=1.5,
            max_volume_ml=15.0
        )
        
        total_mass = sample.total_mass_g(tube)
        
        assert total_mass == 1.5 + (10.0 * 1.0)
        assert total_mass == 11.5
    
    def test_sample_to_dict_and_from_dict(self):
        """测试字典序列化"""
        sample = Sample(
            hole_position=5,
            tube_type_id="tube_test",
            sample_volume_ml=8.5,
            sample_density_gml=1.1,
            label="高密度样品"
        )
        
        sample_dict = sample.to_dict()
        restored = Sample.from_dict(sample_dict)
        
        assert restored.hole_position == 5
        assert restored.sample_volume_ml == 8.5
        assert restored.label == "高密度样品"


class TestBalanceConfig:
    """配置模型测试"""
    
    def test_default_config(self):
        """测试默认配置"""
        config = BalanceConfig()
        
        assert config.mass_imbalance_threshold_g == 0.1
        assert config.moment_imbalance_threshold_gcm == 0.5
        assert config.default_sample_density_gml == 1.0
        assert config.allow_partial_loading == False
    
    def test_custom_config(self):
        """测试自定义配置"""
        config = BalanceConfig(
            mass_imbalance_threshold_g=0.2,
            moment_imbalance_threshold_gcm=1.0,
            default_sample_density_gml=1.05,
            allow_partial_loading=True
        )
        
        assert config.mass_imbalance_threshold_g == 0.2
        assert config.allow_partial_loading == True
    
    def test_config_to_dict_and_from_dict(self):
        """测试配置序列化"""
        config = BalanceConfig(
            mass_imbalance_threshold_g=0.15,
            moment_imbalance_threshold_gcm=0.75
        )
        
        config_dict = config.to_dict()
        restored = BalanceConfig.from_dict(config_dict)
        
        assert restored.mass_imbalance_threshold_g == 0.15
        assert restored.moment_imbalance_threshold_gcm == 0.75


class TestHoleResult:
    """孔位结果测试"""
    
    def test_hole_result_creation(self):
        """测试孔位结果创建"""
        result = HoleResult(
            hole_position=1,
            tube_type_id="tube_15ml",
            total_mass_g=11.5,
            mass_moment_gcm=115.0,
            sample_volume_ml=10.0,
            sample_density_gml=1.0,
            label="样品A"
        )
        
        assert result.hole_position == 1
        assert result.total_mass_g == 11.5
        assert result.mass_moment_gcm == 115.0


class TestImbalanceInfo:
    """不平衡信息测试"""
    
    def test_imbalance_info_creation(self):
        """测试不平衡信息创建"""
        info = ImbalanceInfo(
            hole_pair=(1, 7),
            hole1_position=1,
            hole2_position=7,
            hole1_mass_g=11.5,
            hole2_mass_g=10.5,
            mass_difference_g=1.0,
            mass_direction="孔位1较重",
            hole1_moment_gcm=115.0,
            hole2_moment_gcm=105.0,
            moment_difference_gcm=10.0
        )
        
        assert info.mass_difference_g == 1.0
        assert info.moment_difference_gcm == 10.0


class TestAdjustmentSuggestion:
    """调整建议测试"""
    
    def test_adjustment_suggestion_creation(self):
        """测试调整建议创建"""
        suggestion = AdjustmentSuggestion(
            suggestion_type="补液",
            description="在孔位7补充1.0ml溶剂",
            hole_position=7,
            adjustment_ml=1.0,
            priority="high"
        )
        
        assert suggestion.suggestion_type == "补液"
        assert suggestion.priority == "high"


class TestValidationError:
    """校验错误测试"""
    
    def test_validation_error_creation(self):
        """测试校验错误创建"""
        error = ValidationError(
            error_type="转速超限",
            message="转速超过最大限制",
            details={"set_rpm": 15000, "max_rpm": 12000}
        )
        
        assert error.error_type == "转速超限"
        assert error.details["set_rpm"] == 15000


class TestBalanceResult:
    """配平结果测试"""
    
    def test_balance_result_creation(self):
        """测试配平结果创建"""
        hole_result = HoleResult(
            hole_position=1,
            tube_type_id="tube_15ml",
            total_mass_g=11.5,
            mass_moment_gcm=115.0,
            sample_volume_ml=10.0,
            sample_density_gml=1.0
        )
        
        imbalance = ImbalanceInfo(
            hole_pair=(1, 7),
            hole1_position=1,
            hole2_position=7,
            hole1_mass_g=11.5,
            hole2_mass_g=11.5,
            mass_difference_g=0.0,
            mass_direction="",
            hole1_moment_gcm=115.0,
            hole2_moment_gcm=115.0,
            moment_difference_gcm=0.0
        )
        
        result = BalanceResult(
            rotor_id="test_rotor",
            run_rpm=10000,
            hole_results=[hole_result],
            imbalance_infos=[imbalance],
            adjustment_suggestions=[],
            validation_errors=[],
            is_balanced=True,
            max_mass_imbalance_g=0.0,
            max_moment_imbalance_gcm=0.0,
            notes="测试配平"
        )
        
        assert result.is_balanced == True
        assert result.max_mass_imbalance_g == 0.0
    
    def test_balance_result_to_dict_and_from_dict(self):
        """测试配平结果序列化"""
        result = BalanceResult(
            rotor_id="test",
            run_rpm=8000,
            hole_results=[],
            imbalance_infos=[],
            adjustment_suggestions=[],
            validation_errors=[],
            is_balanced=False,
            max_mass_imbalance_g=0.5,
            max_moment_imbalance_gcm=5.0
        )
        
        result_dict = result.to_dict()
        restored = BalanceResult.from_dict(result_dict)
        
        assert restored.rotor_id == "test"
        assert restored.is_balanced == False
        assert restored.max_mass_imbalance_g == 0.5
