"""规则引擎测试"""

import pytest
from pathlib import Path

from opto_guardian.models.config import StoreConfig, ValidationRules
from opto_guardian.models.prescription import EyePrescription, Prescription
from opto_guardian.models.frame import Frame
from opto_guardian.models.lens import LensInventory, LensStock, LensType, LensMaterial
from opto_guardian.models.validation import ValidationSeverity, ValidationCategory
from opto_guardian.rules.base import RuleContext, RuleEngine, get_default_rules
from opto_guardian.rules.power_rules import PowerRangeRule, PowerStepRule, CylinderFormatRule
from opto_guardian.rules.axis_rules import AxisValidationRule, AxisSwapDetectionRule
from opto_guardian.rules.pd_rules import PDValidationRule, PDFrameMatchRule, PHValidationRule


class TestRuleContext:
    """规则上下文测试"""
    
    def test_create_context(self):
        """测试创建规则上下文"""
        config = StoreConfig(store_id="TEST", store_name="测试")
        rx = Prescription(
            prescription_id="RX-001",
            right_eye=EyePrescription(sphere=-3.0, cylinder=-1.5, axis=180),
            left_eye=EyePrescription(sphere=-2.75, cylinder=-1.25, axis=175),
        )
        
        context = RuleContext(
            prescription=rx,
            store_config=config,
        )
        
        assert context.prescription == rx
        assert context.store_config == config
        assert context.rules is not None


class TestPowerRangeRule:
    """度数范围规则测试"""
    
    def test_normal_range(self):
        """测试正常范围内的度数"""
        config = StoreConfig(store_id="TEST", store_name="测试")
        rx = Prescription(
            prescription_id="RX-001",
            right_eye=EyePrescription(sphere=-3.0, cylinder=-1.5, axis=180),
            left_eye=EyePrescription(sphere=-2.75, cylinder=-1.25, axis=175),
        )
        
        context = RuleContext(prescription=rx, store_config=config)
        rule = PowerRangeRule()
        result = rule.execute(context)
        
        assert result.passed is True
    
    def test_sphere_out_of_range(self):
        """测试球镜超出范围"""
        config = StoreConfig(store_id="TEST", store_name="测试")
        rx = Prescription(
            prescription_id="RX-002",
            right_eye=EyePrescription(sphere=-25.0, cylinder=-1.5, axis=180),
            left_eye=EyePrescription(sphere=-2.75, cylinder=-1.25, axis=175),
        )
        
        context = RuleContext(prescription=rx, store_config=config)
        rule = PowerRangeRule()
        result = rule.execute(context)
        
        assert result.passed is False
        assert len(result.issues) > 0
        
        error_issues = [i for i in result.issues if i.severity == ValidationSeverity.ERROR]
        assert len(error_issues) >= 1


class TestPowerStepRule:
    """度数步长规则测试"""
    
    def test_valid_step(self):
        """测试有效步长"""
        config = StoreConfig(store_id="TEST", store_name="测试")
        rx = Prescription(
            prescription_id="RX-001",
            right_eye=EyePrescription(sphere=-3.0, cylinder=-1.5, axis=180),
            left_eye=EyePrescription(sphere=-2.75, cylinder=-1.25, axis=175),
        )
        
        context = RuleContext(prescription=rx, store_config=config)
        rule = PowerStepRule()
        result = rule.execute(context)
        
        assert result.passed is True
    
    def test_invalid_step(self):
        """测试无效步长"""
        config = StoreConfig(store_id="TEST", store_name="测试")
        rx = Prescription(
            prescription_id="RX-002",
            right_eye=EyePrescription(sphere=-3.1, cylinder=-1.6, axis=180),
            left_eye=EyePrescription(sphere=-2.75, cylinder=-1.25, axis=175),
        )
        
        context = RuleContext(prescription=rx, store_config=config)
        rule = PowerStepRule()
        result = rule.execute(context)
        
        assert len(result.issues) > 0


class TestCylinderFormatRule:
    """柱镜格式规则测试"""
    
    def test_minus_cylinder(self):
        """测试负柱镜格式（标准）"""
        config = StoreConfig(store_id="TEST", store_name="测试")
        rx = Prescription(
            prescription_id="RX-001",
            right_eye=EyePrescription(sphere=-3.0, cylinder=-1.5, axis=180),
            left_eye=EyePrescription(sphere=-2.75, cylinder=-1.25, axis=175),
        )
        
        context = RuleContext(prescription=rx, store_config=config)
        rule = CylinderFormatRule()
        result = rule.execute(context)
        
        info_issues = [i for i in result.issues if i.severity == ValidationSeverity.INFO]
        assert len(info_issues) >= 2
    
    def test_plus_cylinder(self):
        """测试正柱镜格式"""
        config = StoreConfig(store_id="TEST", store_name="测试")
        rx = Prescription(
            prescription_id="RX-002",
            right_eye=EyePrescription(sphere=-4.5, cylinder=+1.5, axis=90),
            left_eye=EyePrescription(sphere=-4.0, cylinder=+1.25, axis=85),
        )
        
        context = RuleContext(prescription=rx, store_config=config)
        rule = CylinderFormatRule()
        result = rule.execute(context)
        
        warning_issues = [i for i in result.issues if i.severity == ValidationSeverity.WARNING]
        assert len(warning_issues) >= 2


class TestAxisValidationRule:
    """轴位有效性规则测试"""
    
    def test_valid_axis(self):
        """测试有效轴位"""
        config = StoreConfig(store_id="TEST", store_name="测试")
        rx = Prescription(
            prescription_id="RX-001",
            right_eye=EyePrescription(sphere=-3.0, cylinder=-1.5, axis=180),
            left_eye=EyePrescription(sphere=-2.75, cylinder=-1.25, axis=175),
        )
        
        context = RuleContext(prescription=rx, store_config=config)
        rule = AxisValidationRule()
        result = rule.execute(context)
        
        assert result.passed is True
    
    def test_axis_out_of_range(self):
        """测试轴位超出范围 - 模型层验证"""
        with pytest.raises(Exception) as excinfo:
            EyePrescription(sphere=-3.0, cylinder=-1.5, axis=200)
        
        assert "轴位" in str(excinfo.value) or "axis" in str(excinfo.value).lower()
    
    def test_astigmatism_without_axis(self):
        """测试有散光但无轴位"""
        config = StoreConfig(store_id="TEST", store_name="测试")
        rx = Prescription(
            prescription_id="RX-003",
            right_eye=EyePrescription(sphere=-3.0, cylinder=-1.5, axis=None),
            left_eye=EyePrescription(sphere=-2.75, cylinder=0.0, axis=None),
        )
        
        context = RuleContext(prescription=rx, store_config=config)
        rule = AxisValidationRule()
        result = rule.execute(context)
        
        assert result.passed is False


class TestAxisSwapDetectionRule:
    """轴位互换检测规则测试"""
    
    def test_normal_axes(self):
        """测试正常轴位"""
        config = StoreConfig(store_id="TEST", store_name="测试")
        rx = Prescription(
            prescription_id="RX-001",
            right_eye=EyePrescription(sphere=-3.0, cylinder=-1.5, axis=180),
            left_eye=EyePrescription(sphere=-2.75, cylinder=-1.25, axis=175),
        )
        
        context = RuleContext(prescription=rx, store_config=config)
        rule = AxisSwapDetectionRule()
        result = rule.execute(context)
        
        assert result.passed is True
    
    def test_90_degree_difference(self):
        """测试轴位相差90度"""
        config = StoreConfig(store_id="TEST", store_name="测试")
        rx = Prescription(
            prescription_id="RX-002",
            right_eye=EyePrescription(sphere=-3.0, cylinder=-1.5, axis=0),
            left_eye=EyePrescription(sphere=-2.75, cylinder=-1.25, axis=90),
        )
        
        context = RuleContext(prescription=rx, store_config=config)
        rule = AxisSwapDetectionRule()
        result = rule.execute(context)
        
        critical_issues = [i for i in result.issues if i.severity == ValidationSeverity.CRITICAL]
        assert len(critical_issues) >= 1


class TestPDValidationRule:
    """瞳距校验规则测试"""
    
    def test_valid_pd(self):
        """测试有效瞳距"""
        config = StoreConfig(store_id="TEST", store_name="测试")
        rx = Prescription(
            prescription_id="RX-001",
            right_eye=EyePrescription(sphere=-3.0, cylinder=-1.5, axis=180),
            left_eye=EyePrescription(sphere=-2.75, cylinder=-1.25, axis=175),
            pd_total=62.0,
            pd_right=31.0,
            pd_left=31.0,
        )
        
        context = RuleContext(prescription=rx, store_config=config)
        rule = PDValidationRule()
        result = rule.execute(context)
        
        assert result.passed is True
    
    def test_missing_pd(self):
        """测试缺少瞳距"""
        config = StoreConfig(store_id="TEST", store_name="测试")
        rx = Prescription(
            prescription_id="RX-002",
            right_eye=EyePrescription(sphere=-3.0, cylinder=-1.5, axis=180),
            left_eye=EyePrescription(sphere=-2.75, cylinder=-1.25, axis=175),
        )
        
        context = RuleContext(prescription=rx, store_config=config)
        rule = PDValidationRule()
        result = rule.execute(context)
        
        assert result.passed is False
    
    def test_pd_out_of_range(self):
        """测试瞳距超出范围"""
        config = StoreConfig(store_id="TEST", store_name="测试")
        rx = Prescription(
            prescription_id="RX-003",
            right_eye=EyePrescription(sphere=-3.0, cylinder=-1.5, axis=180),
            left_eye=EyePrescription(sphere=-2.75, cylinder=-1.25, axis=175),
            pd_total=45.0,
        )
        
        context = RuleContext(prescription=rx, store_config=config)
        rule = PDValidationRule()
        result = rule.execute(context)
        
        assert result.passed is False


class TestPDFrameMatchRule:
    """瞳距镜架匹配规则测试"""
    
    def test_good_match(self):
        """测试良好匹配"""
        config = StoreConfig(store_id="TEST", store_name="测试")
        rx = Prescription(
            prescription_id="RX-001",
            right_eye=EyePrescription(sphere=-3.0, cylinder=-1.5, axis=180),
            left_eye=EyePrescription(sphere=-2.75, cylinder=-1.25, axis=175),
            pd_total=70.0,
            pd_right=35.0,
            pd_left=35.0,
        )
        frame = Frame(
            frame_id="F-001",
            model="测试",
            eye_size=52.0,
            bridge_size=18.0,
        )
        
        context = RuleContext(prescription=rx, frame=frame, store_config=config)
        rule = PDFrameMatchRule()
        result = rule.execute(context)
        
        info_issues = [i for i in result.issues if i.severity == ValidationSeverity.INFO]
        assert len(info_issues) >= 1
    
    def test_poor_match(self):
        """测试不良匹配"""
        config = StoreConfig(store_id="TEST", store_name="测试")
        rx = Prescription(
            prescription_id="RX-002",
            right_eye=EyePrescription(sphere=-3.0, cylinder=-1.5, axis=180),
            left_eye=EyePrescription(sphere=-2.75, cylinder=-1.25, axis=175),
            pd_total=60.0,
        )
        frame = Frame(
            frame_id="F-002",
            model="测试",
            eye_size=52.0,
            bridge_size=18.0,
        )
        
        context = RuleContext(prescription=rx, frame=frame, store_config=config)
        rule = PDFrameMatchRule()
        result = rule.execute(context)
        
        error_issues = [i for i in result.issues if i.severity == ValidationSeverity.ERROR]
        assert len(error_issues) >= 1


class TestRuleEngine:
    """规则引擎测试"""
    
    def test_execute_all_rules(self):
        """测试执行所有规则"""
        config = StoreConfig(store_id="TEST", store_name="测试")
        rx = Prescription(
            prescription_id="RX-001",
            right_eye=EyePrescription(sphere=-3.0, cylinder=-1.5, axis=180),
            left_eye=EyePrescription(sphere=-2.75, cylinder=-1.25, axis=175),
            pd_total=62.0,
        )
        
        engine = RuleEngine(get_default_rules())
        context = RuleContext(prescription=rx, store_config=config)
        
        all_passed, results = engine.execute_all(context)
        
        assert len(results) > 0


class TestInventoryRules:
    """库存规则测试"""
    
    def test_matching_inventory(self):
        """测试匹配库存"""
        from opto_guardian.rules.inventory_rules import InventoryAvailabilityRule
        
        config = StoreConfig(store_id="TEST", store_name="测试")
        rx = Prescription(
            prescription_id="RX-001",
            right_eye=EyePrescription(sphere=-3.0, cylinder=-1.5, axis=180),
            left_eye=EyePrescription(sphere=-2.75, cylinder=-1.25, axis=175),
        )
        
        inventory = LensInventory()
        lens = LensStock(
            stock_id="L-001",
            lens_type=LensType.SINGLE_VISION,
            material=LensMaterial.CR39,
            min_sphere=-6.0,
            max_sphere=+4.0,
            min_cylinder=-2.0,
            max_cylinder=0.0,
            quantity=10,
        )
        inventory.add_item(lens)
        
        context = RuleContext(
            prescription=rx,
            store_config=config,
            inventory=inventory,
        )
        
        rule = InventoryAvailabilityRule()
        result = rule.execute(context)
        
        info_issues = [i for i in result.issues if i.severity == ValidationSeverity.INFO]
        assert len(info_issues) >= 2
