"""
测试配方计算模块
"""

from datetime import date

import pytest

from fragrance_checker.calculator import FormulaCalculator
from fragrance_checker.models import (
    AllergenType,
    Formula,
    FormulaIngredient,
    RawMaterial,
    Unit,
)


class TestFormulaCalculator:
    """测试配方计算器"""
    
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
                allergens=[AllergenType.LIMONENE, AllergenType.LINALOOL],
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
        }
    
    @pytest.fixture
    def formula(self):
        """创建测试配方"""
        return Formula(
            id="F001",
            name="测试香水",
            version="1.0",
            created_date=date.today(),
            total_amount=100.0,
            unit=Unit.GRAM,
            ingredients=[
                FormulaIngredient(
                    raw_material_id="RM001",
                    amount=15.0,
                    unit=Unit.GRAM,
                ),
                FormulaIngredient(
                    raw_material_id="RM002",
                    amount=5.0,
                    unit=Unit.GRAM,
                ),
                FormulaIngredient(
                    raw_material_id="RM003",
                    amount=80.0,
                    unit=Unit.GRAM,
                ),
            ],
        )
    
    def test_calculate_scale_factor(self, raw_materials, formula):
        """测试缩放比例计算"""
        calculator = FormulaCalculator(raw_materials)
        
        # 目标量是原来的2倍
        result = calculator.calculate(formula, 200.0, Unit.GRAM)
        
        # 检查总用量应该是原来的2倍
        assert result.target_amount == 200.0
        
        # 检查各原料用量
        for ing in result.ingredient_details:
            if ing.raw_material_id == "RM001":
                assert ing.calculated_amount == 30.0  # 15 * 2
    
    def test_cost_calculation(self, raw_materials, formula):
        """测试成本计算"""
        calculator = FormulaCalculator(raw_materials)
        
        result = calculator.calculate(formula, 100.0, Unit.GRAM)
        
        # 计算预期成本: 15*2.5 + 5*0.8 + 80*0.05 = 37.5 + 4 + 4 = 45.5
        expected_cost = 15 * 2.5 + 5 * 0.8 + 80 * 0.05
        assert result.total_cost == expected_cost
    
    def test_ethanol_ratio(self, raw_materials, formula):
        """测试乙醇比例计算"""
        calculator = FormulaCalculator(raw_materials)
        
        result = calculator.calculate(formula, 100.0, Unit.GRAM)
        
        # 乙醇占比应该是 80/100 = 0.8 = 80%
        assert result.ethanol_ratio == 0.8
        assert result.fragrance_ratio == 0.2  # 香精 20%
    
    def test_allergen_summary(self, raw_materials, formula):
        """测试过敏原摘要"""
        calculator = FormulaCalculator(raw_materials)
        
        result = calculator.calculate(formula, 100.0, Unit.GRAM)
        allergen_summary = calculator.get_allergen_summary(result)
        
        # 检查过敏原计算
        # RM001: 15% = 0.15, 含有 linalool, geraniol
        # RM002: 5% = 0.05, 含有 limonene, linalool
        # 所以 linalool 总共 = 0.15 + 0.05 = 0.20
        
        assert allergen_summary["linalool"] == 0.20  # 20%
        assert allergen_summary["geraniol"] == 0.15  # 15%
        assert allergen_summary["limonene"] == 0.05  # 5%
    
    def test_convert_unit(self, raw_materials):
        """测试单位转换"""
        calculator = FormulaCalculator(raw_materials)
        
        # 克到毫克
        assert calculator.convert_unit(1.0, Unit.GRAM, Unit.MILLIGRAM) == 1000.0
        
        # 毫克到克
        assert calculator.convert_unit(1000.0, Unit.MILLIGRAM, Unit.GRAM) == 1.0
        
        # 毫升到克（考虑密度）
        assert calculator.convert_unit(10.0, Unit.MILLILITER, Unit.GRAM, 0.87) == 8.7
        
        # 滴到克
        assert calculator.convert_unit(20.0, Unit.DROP, Unit.GRAM) == 1.0  # 20滴 = 1克
