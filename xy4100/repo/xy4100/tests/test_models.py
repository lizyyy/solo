"""配镜加工单守门员 - 测试套件"""

import pytest
from pathlib import Path
from datetime import datetime

from opto_guardian.models.config import StoreConfig, ValidationRules
from opto_guardian.models.prescription import (
    EyePrescription,
    Prescription,
    PrescriptionEntry,
)
from opto_guardian.models.frame import Frame, FrameEntry, FrameStyle
from opto_guardian.models.lens import (
    LensStock,
    LensInventory,
    LensEntry,
    LensType,
    LensMaterial,
)
from opto_guardian.models.validation import (
    ValidationResult,
    ValidationIssue,
    ValidationSeverity,
    ValidationCategory,
)


class TestEyePrescription:
    """单眼处方测试"""
    
    def test_basic_prescription(self):
        """测试基础处方创建"""
        eye = EyePrescription(sphere=-3.0, cylinder=-1.5, axis=180)
        assert eye.sphere == -3.0
        assert eye.cylinder == -1.5
        assert eye.axis == 180
    
    def test_is_myopia(self):
        """测试近视判断"""
        myopic = EyePrescription(sphere=-2.0)
        assert myopic.is_myopia() is True
        assert myopic.is_hyperopia() is False
    
    def test_is_hyperopia(self):
        """测试远视判断"""
        hyperopic = EyePrescription(sphere=+2.0)
        assert hyperopic.is_hyperopia() is True
        assert hyperopic.is_myopia() is False
    
    def test_has_astigmatism(self):
        """测试散光判断"""
        has_astig = EyePrescription(sphere=-2.0, cylinder=-1.5, axis=180)
        no_astig = EyePrescription(sphere=-2.0, cylinder=0.0)
        assert has_astig.has_astigmatism() is True
        assert no_astig.has_astigmatism() is False
    
    def test_to_minus_cylinder(self):
        """测试负柱镜转换"""
        eye = EyePrescription(sphere=-2.0, cylinder=+1.5, axis=90)
        converted = eye.to_minus_cylinder()
        assert converted.sphere == -0.5
        assert converted.cylinder == -1.5
        assert converted.axis == 180
    
    def test_equivalent_sphere(self):
        """测试等效球镜计算"""
        eye = EyePrescription(sphere=-3.0, cylinder=-1.5, axis=180)
        assert eye.equivalent_sphere() == -3.75


class TestPrescription:
    """完整处方测试"""
    
    def test_create_prescription(self):
        """测试创建完整处方"""
        rx = Prescription(
            prescription_id="RX-001",
            right_eye=EyePrescription(sphere=-3.0, cylinder=-1.5, axis=180),
            left_eye=EyePrescription(sphere=-2.75, cylinder=-1.25, axis=175),
            pd_total=62.0,
            pd_right=31.0,
            pd_left=31.0,
        )
        assert rx.prescription_id == "RX-001"
        assert rx.get_pd_total() == 62.0
    
    def test_pd_calculation(self):
        """测试瞳距计算"""
        rx = Prescription(
            prescription_id="RX-002",
            right_eye=EyePrescription(sphere=-1.0),
            left_eye=EyePrescription(sphere=-1.0),
            pd_right=30.0,
            pd_left=32.0,
        )
        assert rx.get_pd_total() == 62.0
        assert rx.get_pd_right() == 30.0
        assert rx.get_pd_left() == 32.0
    
    def test_has_pd_difference(self):
        """测试瞳距差异检测"""
        rx_diff = Prescription(
            prescription_id="RX-003",
            right_eye=EyePrescription(sphere=-1.0),
            left_eye=EyePrescription(sphere=-1.0),
            pd_right=28.0,
            pd_left=34.0,
        )
        rx_same = Prescription(
            prescription_id="RX-004",
            right_eye=EyePrescription(sphere=-1.0),
            left_eye=EyePrescription(sphere=-1.0),
            pd_right=31.0,
            pd_left=31.0,
        )
        assert rx_diff.has_pd_difference() is True
        assert rx_same.has_pd_difference() is False


class TestFrame:
    """镜架测试"""
    
    def test_create_frame(self):
        """测试创建镜架"""
        frame = Frame(
            frame_id="F-001",
            model="商务款",
            eye_size=52.0,
            bridge_size=18.0,
            style=FrameStyle.FULL_RIM,
        )
        assert frame.frame_id == "F-001"
        assert frame.get_box_center_distance() == 70.0
    
    def test_box_center_distance(self):
        """测试几何中心距计算"""
        frame = Frame(
            frame_id="F-002",
            model="测试款",
            eye_size=50.0,
            bridge_size=17.0,
        )
        assert frame.get_box_center_distance() == 67.0
        
        frame_with_bc = Frame(
            frame_id="F-003",
            model="指定BC",
            eye_size=50.0,
            bridge_size=17.0,
            box_center_distance=68.0,
        )
        assert frame_with_bc.get_box_center_distance() == 68.0
    
    def test_is_pd_compatible(self):
        """测试瞳距适配性"""
        frame = Frame(
            frame_id="F-004",
            model="测试",
            eye_size=52.0,
            bridge_size=18.0,
        )
        bc = 70.0
        assert frame.is_pd_compatible(68.0, tolerance=4.0) is True
        assert frame.is_pd_compatible(64.0, tolerance=4.0) is False
    
    def test_estimate_lens_diameter(self):
        """测试镜片直径估算"""
        frame = Frame(
            frame_id="F-005",
            model="测试",
            eye_size=52.0,
            bridge_size=18.0,
        )
        right_diam, left_diam = frame.estimate_lens_diameter(35.0, 35.0)
        assert right_diam == 52.0
        assert left_diam == 52.0
        
        right_diam2, left_diam2 = frame.estimate_lens_diameter(28.0, 34.0)
        assert right_diam2 == 66.0
        assert left_diam2 == 54.0


class TestLensStock:
    """镜片库存测试"""
    
    def test_create_lens_stock(self):
        """测试创建镜片库存"""
        lens = LensStock(
            stock_id="L-001",
            lens_type=LensType.SINGLE_VISION,
            material=LensMaterial.HIGH_INDEX_156,
            min_sphere=-6.0,
            max_sphere=+4.0,
            min_cylinder=-2.0,
            max_cylinder=0.0,
            quantity=10,
        )
        assert lens.stock_id == "L-001"
        assert lens.quantity == 10
    
    def test_can_process(self):
        """测试可加工性检查"""
        lens = LensStock(
            stock_id="L-002",
            lens_type=LensType.SINGLE_VISION,
            material=LensMaterial.CR39,
            min_sphere=-6.0,
            max_sphere=+4.0,
            sphere_step=0.25,
            min_cylinder=-2.0,
            max_cylinder=0.0,
            cylinder_step=0.25,
            quantity=10,
        )
        assert lens.can_process(-3.0, -1.0) is True
        assert lens.can_process(-7.0, 0.0) is False
        assert lens.can_process(-3.0, -2.5) is False
    
    def test_get_closest_sphere(self):
        """测试最近球镜计算"""
        lens = LensStock(
            stock_id="L-003",
            lens_type=LensType.SINGLE_VISION,
            material=LensMaterial.CR39,
            min_sphere=-6.0,
            max_sphere=+4.0,
            sphere_step=0.25,
            quantity=10,
        )
        assert lens.get_closest_sphere(-3.1) == -3.0
        assert lens.get_closest_sphere(-3.2) == -3.25
    
    def test_out_of_stock(self):
        """测试库存为0时不可加工"""
        lens = LensStock(
            stock_id="L-004",
            lens_type=LensType.SINGLE_VISION,
            material=LensMaterial.CR39,
            min_sphere=-6.0,
            max_sphere=+4.0,
            quantity=0,
        )
        assert lens.can_process(-3.0, 0.0) is False


class TestLensInventory:
    """镜片库存管理测试"""
    
    def test_add_item(self):
        """测试添加库存"""
        inventory = LensInventory()
        lens = LensStock(
            stock_id="L-005",
            lens_type=LensType.SINGLE_VISION,
            material=LensMaterial.CR39,
            min_sphere=-6.0,
            max_sphere=+4.0,
            quantity=10,
        )
        inventory.add_item(lens)
        assert len(inventory.items) == 1
    
    def test_find_matching_lenses(self):
        """测试查找匹配镜片"""
        inventory = LensInventory()
        
        lens1 = LensStock(
            stock_id="L-006",
            lens_type=LensType.SINGLE_VISION,
            material=LensMaterial.CR39,
            min_sphere=-6.0,
            max_sphere=+4.0,
            min_cylinder=-2.0,
            max_cylinder=0.0,
            quantity=10,
        )
        lens2 = LensStock(
            stock_id="L-007",
            lens_type=LensType.ANTI_BLUE,
            material=LensMaterial.HIGH_INDEX_156,
            min_sphere=-8.0,
            max_sphere=+6.0,
            min_cylinder=-4.0,
            max_cylinder=0.0,
            quantity=5,
        )
        
        inventory.add_item(lens1)
        inventory.add_item(lens2)
        
        matching = inventory.find_matching_lenses(sphere=-3.0, cylinder=-1.5)
        assert len(matching) == 2
        
        matching_anti_blue = inventory.find_matching_lenses(
            sphere=-3.0, cylinder=-1.5, lens_type=LensType.ANTI_BLUE
        )
        assert len(matching_anti_blue) == 1
    
    def test_get_summary(self):
        """测试获取库存摘要"""
        inventory = LensInventory()
        
        lens = LensStock(
            stock_id="L-008",
            lens_type=LensType.SINGLE_VISION,
            material=LensMaterial.CR39,
            min_sphere=-6.0,
            max_sphere=+4.0,
            quantity=20,
        )
        
        inventory.add_item(lens)
        summary = inventory.get_summary()
        
        assert summary["total_items"] == 1
        assert summary["total_quantity"] == 20


class TestValidationModels:
    """校验模型测试"""
    
    def test_validation_result(self):
        """测试校验结果"""
        result = ValidationResult(
            order_id="RX-001",
            prescription_id="RX-001",
        )
        assert result.passed is True
        assert result.error_count == 0
        assert result.warning_count == 0
        assert result.info_count == 0
    
    def test_add_issue(self):
        """测试添加问题"""
        result = ValidationResult(
            order_id="RX-002",
            prescription_id="RX-002",
        )
        
        issue = ValidationIssue(
            issue_id="TEST-001",
            category=ValidationCategory.POWER_RANGE,
            severity=ValidationSeverity.ERROR,
            message="球镜度数超出范围",
        )
        
        result.add_issue(issue)
        
        assert result.passed is False
        assert result.error_count == 1
        assert result.warning_count == 0
    
    def test_issue_severity_order(self):
        """测试严重程度顺序"""
        result = ValidationResult(
            order_id="RX-003",
            prescription_id="RX-003",
        )
        
        result.add_issue(ValidationIssue(
            issue_id="I1",
            category=ValidationCategory.OTHER,
            severity=ValidationSeverity.WARNING,
            message="警告",
        ))
        
        result.add_issue(ValidationIssue(
            issue_id="I2",
            category=ValidationCategory.OTHER,
            severity=ValidationSeverity.INFO,
            message="信息",
        ))
        
        assert result.passed is True
        assert result.error_count == 0
        assert result.warning_count == 1
        assert result.info_count == 1


class TestValidationRules:
    """校验规则测试"""
    
    def test_default_rules(self):
        """测试默认规则"""
        rules = ValidationRules()
        assert rules.min_sphere == -20.0
        assert rules.max_sphere == 6.0
        assert rules.min_cylinder == -6.0
        assert rules.max_cylinder == 4.0
        assert rules.min_pd == 50.0
        assert rules.max_pd == 75.0
    
    def test_custom_rules(self):
        """测试自定义规则"""
        rules = ValidationRules(
            min_sphere=-10.0,
            max_sphere=4.0,
            min_pd=52.0,
            max_pd=72.0,
        )
        assert rules.min_sphere == -10.0
        assert rules.max_sphere == 4.0
        assert rules.min_pd == 52.0


class TestStoreConfig:
    """门店配置测试"""
    
    def test_create_config(self):
        """测试创建门店配置"""
        config = StoreConfig(
            store_id="STORE-001",
            store_name="测试门店",
        )
        assert config.store_id == "STORE-001"
        assert config.store_name == "测试门店"
        assert config.rules is not None
    
    def test_custom_rules_config(self):
        """测试带自定义规则的配置"""
        rules = ValidationRules(min_sphere=-15.0, max_sphere=5.0)
        config = StoreConfig(
            store_id="STORE-002",
            store_name="自定义门店",
            rules=rules,
        )
        assert config.rules.min_sphere == -15.0
        assert config.rules.max_sphere == 5.0
