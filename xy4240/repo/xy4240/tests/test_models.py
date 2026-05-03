"""
测试数据模型模块
"""

from datetime import date, timedelta

import pytest

from fragrance_checker.models import (
    AllergenType,
    Formula,
    FormulaIngredient,
    RawMaterial,
    RawMaterialBatch,
    Unit,
)


class TestUnit:
    """测试单位枚举"""
    
    def test_from_string_valid(self):
        """测试从有效字符串创建单位"""
        assert Unit.from_string("g") == Unit.GRAM
        assert Unit.from_string("G") == Unit.GRAM
        assert Unit.from_string("mg") == Unit.MILLIGRAM
        assert Unit.from_string("ml") == Unit.MILLILITER
        assert Unit.from_string("drop") == Unit.DROP
        assert Unit.from_string("%") == Unit.PERCENT
    
    def test_from_string_invalid(self):
        """测试从无效字符串创建单位"""
        with pytest.raises(ValueError):
            Unit.from_string("invalid")
    
    def test_to_grams(self):
        """测试转换为克数"""
        assert Unit.GRAM.to_grams(1.0) == 1.0
        assert Unit.MILLIGRAM.to_grams(1000.0) == 1.0
        assert Unit.KILOGRAM.to_grams(1.0) == 1000.0
        assert Unit.MILLILITER.to_grams(1.0, 0.87) == 0.87
        assert Unit.DROP.to_grams(20.0) == 1.0  # 20滴 = 1克


class TestRawMaterialBatch:
    """测试原料批次"""
    
    def test_is_expired_false(self):
        """测试未过期"""
        batch = RawMaterialBatch(
            batch_number="B001",
            raw_material_id="RM001",
            manufacture_date=date.today() - timedelta(days=30),
            expiry_date=date.today() + timedelta(days=30),
        )
        assert batch.is_expired is False
    
    def test_is_expired_true(self):
        """测试已过期"""
        batch = RawMaterialBatch(
            batch_number="B001",
            raw_material_id="RM001",
            manufacture_date=date.today() - timedelta(days=60),
            expiry_date=date.today() - timedelta(days=1),
        )
        assert batch.is_expired is True
    
    def test_days_until_expiry(self):
        """测试距离过期天数"""
        batch = RawMaterialBatch(
            batch_number="B001",
            raw_material_id="RM001",
            manufacture_date=date.today() - timedelta(days=30),
            expiry_date=date.today() + timedelta(days=30),
        )
        assert batch.days_until_expiry == 30


class TestRawMaterial:
    """测试原料"""
    
    def test_creation(self):
        """测试创建原料"""
        material = RawMaterial(
            id="RM001",
            name="玫瑰精油",
            cas_number="8007-01-0",
            density=0.87,
            allergens=[AllergenType.LINALOOL, AllergenType.GERANIOL],
            is_fragrance=True,
            unit_cost=2.5,
        )
        assert material.id == "RM001"
        assert material.name == "玫瑰精油"
        assert len(material.allergens) == 2


class TestFormula:
    """测试配方"""
    
    def test_creation(self):
        """测试创建配方"""
        formula = Formula(
            id="F001",
            name="测试香水",
            version="1.0",
            created_date=date.today(),
            total_amount=100.0,
            unit=Unit.GRAM,
            ingredients=[
                FormulaIngredient(
                    raw_material_id="RM001",
                    amount=10.0,
                    unit=Unit.GRAM,
                ),
            ],
        )
        assert formula.id == "F001"
        assert len(formula.ingredients) == 1
