"""
测试规则引擎模块
"""

from datetime import date, timedelta

import pytest

from fragrance_checker.calculator import FormulaCalculator
from fragrance_checker.models import (
    AllergenRule,
    AllergenType,
    CalculationResult,
    Formula,
    FormulaIngredient,
    IFRARule,
    IngredientCalculation,
    RawMaterial,
    RawMaterialBatch,
    RuleSet,
    Unit,
)
from fragrance_checker.rules import RuleEngine


class TestRuleEngine:
    """测试规则引擎"""
    
    @pytest.fixture
    def raw_materials(self):
        """创建测试原料"""
        return {
            "RM001": RawMaterial(
                id="RM001",
                name="玫瑰精油",
                density=0.87,
                allergens=[AllergenType.LINALOOL, AllergenType.GERANIOL],
                is_fragrance=True,
                unit_cost=2.5,
            ),
            "RM002": RawMaterial(
                id="RM002",
                name="柠檬精油",
                density=0.85,
                allergens=[AllergenType.LIMONENE],
                is_fragrance=True,
                unit_cost=0.8,
            ),
            "RM003": RawMaterial(
                id="RM003",
                name="乙醇",
                density=0.79,
                allergens=[],
                is_ethanol=True,
                is_fragrance=False,
                unit_cost=0.05,
            ),
            "RM999": RawMaterial(
                id="RM999",
                name="禁用物质",
                density=1.0,
                allergens=[],
                is_fragrance=True,
                unit_cost=0.0,
            ),
        }
    
    @pytest.fixture
    def rule_set(self):
        """创建测试规则集"""
        return RuleSet(
            name="Test Rules",
            version="1.0",
            ifra_rules=[
                IFRARule(
                    raw_material_id="RM001",
                    limit_type="max_concentration",
                    limit_value=0.20,  # 20% 限制
                    product_category="fine-fragrance",
                ),
                IFRARule(
                    raw_material_id="RM002",
                    limit_type="max_concentration",
                    limit_value=0.10,  # 10% 限制
                    product_category="fine-fragrance",
                ),
            ],
            allergen_rules=[
                AllergenRule(
                    allergen_type=AllergenType.LINALOOL,
                    reporting_threshold=0.001,  # 0.1% 报告阈值
                    restriction_limit=0.08,  # 8% 限制
                ),
                AllergenRule(
                    allergen_type=AllergenType.GERANIOL,
                    reporting_threshold=0.001,
                    restriction_limit=0.08,
                ),
                AllergenRule(
                    allergen_type=AllergenType.LIMONENE,
                    reporting_threshold=0.001,
                    restriction_limit=0.10,
                ),
            ],
            banned_substances=["RM999"],
        )
    
    @pytest.fixture
    def batches(self):
        """创建测试批次"""
        return {
            "B001": RawMaterialBatch(
                batch_number="B001",
                raw_material_id="RM001",
                manufacture_date=date.today() - timedelta(days=30),
                expiry_date=date.today() + timedelta(days=365),
                quantity=500.0,
                unit=Unit.GRAM,
            ),
            "B002": RawMaterialBatch(
                batch_number="B002",
                raw_material_id="RM002",
                manufacture_date=date.today() - timedelta(days=30),
                expiry_date=date.today() + timedelta(days=15),  # 即将过期
                quantity=100.0,
                unit=Unit.GRAM,
            ),
            "B003": RawMaterialBatch(
                batch_number="B003",
                raw_material_id="RM003",
                manufacture_date=date.today() - timedelta(days=30),
                expiry_date=date.today() - timedelta(days=1),  # 已过期
                quantity=1000.0,
                unit=Unit.GRAM,
            ),
        }
    
    @pytest.fixture
    def valid_calculation_result(self, raw_materials):
        """创建有效的计算结果（合规的）"""
        # 注意：RM001 含有 linalool 和 geraniol，这两种过敏原的限制是 8%
        # 所以 RM001 的百分比必须低于 8% 才能通过检查
        return CalculationResult(
            formula_id="F001",
            target_amount=100.0,
            target_unit=Unit.GRAM,
            total_cost=20.0,
            ethanol_content=90.0,
            fragrance_content=10.0,
            ethanol_ratio=0.9,
            fragrance_ratio=0.1,
            ingredient_details=[
                IngredientCalculation(
                    raw_material_id="RM001",
                    raw_material_name="玫瑰精油",
                    original_amount=5.0,
                    original_unit=Unit.GRAM,
                    calculated_amount=5.0,  # 5% < 20% IFRA 限制
                    calculated_unit=Unit.GRAM,
                    cost=12.5,
                    percentage=0.05,  # 5% < 8% 过敏原限制
                ),
                IngredientCalculation(
                    raw_material_id="RM002",
                    raw_material_name="柠檬精油",
                    original_amount=5.0,
                    original_unit=Unit.GRAM,
                    calculated_amount=5.0,  # 5% < 10% 限制
                    calculated_unit=Unit.GRAM,
                    cost=4.0,
                    percentage=0.05,  # 5% < 10% limonene 限制
                ),
                IngredientCalculation(
                    raw_material_id="RM003",
                    raw_material_name="乙醇",
                    original_amount=90.0,
                    original_unit=Unit.GRAM,
                    calculated_amount=90.0,
                    calculated_unit=Unit.GRAM,
                    cost=4.5,
                    percentage=0.90,  # 90%
                ),
            ],
        )
    
    def test_check_passed(self, raw_materials, rule_set, valid_calculation_result):
        """测试合规检查通过"""
        engine = RuleEngine(rule_set, raw_materials)
        result = engine.check(valid_calculation_result)
        
        assert result.passed is True
        assert len(result.errors) == 0
    
    def test_banned_substance(self, raw_materials, rule_set):
        """测试禁用物质检查"""
        calc_result = CalculationResult(
            formula_id="F001",
            target_amount=100.0,
            target_unit=Unit.GRAM,
            total_cost=10.0,
            ethanol_content=90.0,
            fragrance_content=10.0,
            ethanol_ratio=0.9,
            fragrance_ratio=0.1,
            ingredient_details=[
                IngredientCalculation(
                    raw_material_id="RM999",
                    raw_material_name="禁用物质",
                    original_amount=10.0,
                    original_unit=Unit.GRAM,
                    calculated_amount=10.0,
                    calculated_unit=Unit.GRAM,
                    percentage=0.10,
                ),
            ],
        )
        
        engine = RuleEngine(rule_set, raw_materials)
        result = engine.check(calc_result)
        
        assert result.passed is False
        assert len(result.errors) >= 1
        
        banned_errors = [e for e in result.errors if e.code == "BANNED_SUBSTANCE"]
        assert len(banned_errors) == 1
    
    def test_ifra_limit_exceeded(self, raw_materials, rule_set):
        """测试 IFRA 超限检查"""
        calc_result = CalculationResult(
            formula_id="F001",
            target_amount=100.0,
            target_unit=Unit.GRAM,
            total_cost=0.0,
            ethanol_content=70.0,
            fragrance_content=30.0,
            ethanol_ratio=0.7,
            fragrance_ratio=0.3,
            ingredient_details=[
                IngredientCalculation(
                    raw_material_id="RM001",
                    raw_material_name="玫瑰精油",
                    original_amount=25.0,
                    original_unit=Unit.GRAM,
                    calculated_amount=25.0,  # 25% > 20% 限制
                    calculated_unit=Unit.GRAM,
                    percentage=0.25,  # 25%
                ),
                IngredientCalculation(
                    raw_material_id="RM003",
                    raw_material_name="乙醇",
                    original_amount=75.0,
                    original_unit=Unit.GRAM,
                    calculated_amount=75.0,
                    calculated_unit=Unit.GRAM,
                    percentage=0.75,
                ),
            ],
        )
        
        engine = RuleEngine(rule_set, raw_materials)
        result = engine.check(calc_result)
        
        assert result.passed is False
        ifra_errors = [e for e in result.errors if e.code == "IFRA_LIMIT_EXCEEDED"]
        assert len(ifra_errors) == 1
    
    def test_allergen_reporting_threshold(self, raw_materials, rule_set, valid_calculation_result):
        """测试过敏原报告阈值"""
        engine = RuleEngine(rule_set, raw_materials)
        result = engine.check(valid_calculation_result)
        
        # linalool: RM001 15% = 0.15 > 0.001 阈值
        # geraniol: RM001 15% = 0.15 > 0.001 阈值
        # limonene: RM002 5% = 0.05 > 0.001 阈值
        
        allergen_warnings = [
            w for w in result.warnings 
            if w.code == "ALLERGEN_REPORTING_THRESHOLD"
        ]
        assert len(allergen_warnings) >= 3
    
    def test_batch_expiry_check(self, raw_materials, rule_set, valid_calculation_result, batches):
        """测试批次过期检查"""
        engine = RuleEngine(rule_set, raw_materials)
        result = engine.check(valid_calculation_result, batches)
        
        # B003 已过期（RM003）
        # B002 即将过期（15天内）
        
        expired_warnings = [
            w for w in result.warnings 
            if w.code in ["SOME_BATCHES_EXPIRED", "BATCH_SOON_EXPIRY"]
        ]
        assert len(expired_warnings) >= 1
    
    def test_mixed_units(self, raw_materials, rule_set):
        """测试单位混用检查"""
        calc_result = CalculationResult(
            formula_id="F001",
            target_amount=100.0,
            target_unit=Unit.GRAM,
            total_cost=0.0,
            ethanol_content=80.0,
            fragrance_content=20.0,
            ethanol_ratio=0.8,
            fragrance_ratio=0.2,
            ingredient_details=[
                IngredientCalculation(
                    raw_material_id="RM001",
                    raw_material_name="玫瑰精油",
                    original_amount=15.0,
                    original_unit=Unit.GRAM,  # 质量单位
                    calculated_amount=15.0,
                    calculated_unit=Unit.GRAM,
                    percentage=0.15,
                ),
                IngredientCalculation(
                    raw_material_id="RM002",
                    raw_material_name="柠檬精油",
                    original_amount=5.0,
                    original_unit=Unit.MILLILITER,  # 体积单位
                    calculated_amount=5.0,
                    calculated_unit=Unit.GRAM,
                    percentage=0.05,
                ),
            ],
        )
        
        engine = RuleEngine(rule_set, raw_materials)
        result = engine.check(calc_result)
        
        mixed_unit_warnings = [
            w for w in result.warnings 
            if w.code == "MIXED_UNITS"
        ]
        assert len(mixed_unit_warnings) == 1
