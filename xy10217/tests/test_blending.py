import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models import (
    Inventory, 
    TeaRawMaterial, 
    TeaGrade, 
    BlendingCalculator,
    load_sample_inventory
)


class TestInventory:
    @pytest.fixture
    def inventory(self):
        inv = Inventory()
        inv.add_material(TeaRawMaterial(
            id="M001",
            name="明前龙井",
            grade=TeaGrade.SUPER,
            aroma_score=95.0,
            cost_per_kg=680.0,
            stock_kg=50.0,
            description="特级明前龙井"
        ))
        inv.add_material(TeaRawMaterial(
            id="M002",
            name="雨前龙井",
            grade=TeaGrade.GRADE1,
            aroma_score=88.0,
            cost_per_kg=420.0,
            stock_kg=120.0
        ))
        return inv
    
    def test_add_material(self, inventory):
        material = TeaRawMaterial(
            id="M003",
            name="二级龙井",
            grade=TeaGrade.GRADE2,
            aroma_score=80.0,
            cost_per_kg=280.0,
            stock_kg=200.0
        )
        inventory.add_material(material)
        
        assert inventory.get_material("M003") is not None
        assert len(inventory.get_all_materials()) == 3
    
    def test_get_material(self, inventory):
        material = inventory.get_material("M001")
        assert material is not None
        assert material.name == "明前龙井"
        assert material.grade == TeaGrade.SUPER
        assert material.aroma_score == 95.0
    
    def test_get_nonexistent_material(self, inventory):
        assert inventory.get_material("M999") is None
    
    def test_update_stock(self, inventory):
        inventory.update_stock("M001", 100.0)
        assert inventory.get_material("M001").stock_kg == 100.0
    
    def test_get_all_materials(self, inventory):
        materials = inventory.get_all_materials()
        assert len(materials) == 2
        names = [m.name for m in materials]
        assert "明前龙井" in names
        assert "雨前龙井" in names


class TestBlendingCalculator:
    @pytest.fixture
    def calculator(self):
        inv = load_sample_inventory()
        return BlendingCalculator(inv)
    
    def test_validate_proportions_valid(self, calculator):
        components = [
            {"material_id": "M001", "proportion": 50},
            {"material_id": "M002", "proportion": 50}
        ]
        is_valid, reasons = calculator.validate_proportions(components)
        assert is_valid is True
        assert len(reasons) == 0
    
    def test_validate_proportions_invalid_total(self, calculator):
        components = [
            {"material_id": "M001", "proportion": 50},
            {"material_id": "M002", "proportion": 40}
        ]
        is_valid, reasons = calculator.validate_proportions(components)
        assert is_valid is False
        assert "合计应为100%" in reasons[0]
    
    def test_validate_proportions_invalid_material(self, calculator):
        components = [
            {"material_id": "INVALID", "proportion": 100}
        ]
        is_valid, reasons = calculator.validate_proportions(components)
        assert is_valid is False
        assert any("不存在" in r for r in reasons)
    
    def test_calculate_plan_feasible(self, calculator):
        components = [
            {"material_id": "M002", "proportion": 70},
            {"material_id": "M003", "proportion": 30}
        ]
        plan = calculator.calculate_plan(
            batch_name="测试批次",
            target_weight_kg=100.0,
            target_aroma_score=80.0,
            max_cost_per_kg=500.0,
            components=components
        )
        
        assert plan.batch_name == "测试批次"
        assert plan.target_weight_kg == 100.0
        
        expected_aroma = 88.0 * 0.7 + 80.0 * 0.3
        assert abs(plan.avg_aroma_score - expected_aroma) < 0.01
        
        expected_cost = (100 * 0.7 * 420) + (100 * 0.3 * 280)
        assert abs(plan.total_cost - expected_cost) < 0.01
        
        assert plan.is_feasible is True
    
    def test_calculate_plan_insufficient_stock(self, calculator):
        components = [
            {"material_id": "M001", "proportion": 100}
        ]
        plan = calculator.calculate_plan(
            batch_name="库存不足测试",
            target_weight_kg=1000.0,
            target_aroma_score=80.0,
            max_cost_per_kg=1000.0,
            components=components
        )
        
        assert plan.is_feasible is False
        assert any("库存不足" in v for v in plan.violations)
    
    def test_calculate_plan_low_aroma_score(self, calculator):
        components = [
            {"material_id": "M004", "proportion": 100}
        ]
        plan = calculator.calculate_plan(
            batch_name="香气不足测试",
            target_weight_kg=10.0,
            target_aroma_score=90.0,
            max_cost_per_kg=1000.0,
            components=components
        )
        
        assert plan.is_feasible is False
        assert any("香气评分不足" in v for v in plan.violations)
    
    def test_calculate_plan_cost_exceeded(self, calculator):
        components = [
            {"material_id": "M001", "proportion": 100}
        ]
        plan = calculator.calculate_plan(
            batch_name="成本超标测试",
            target_weight_kg=10.0,
            target_aroma_score=80.0,
            max_cost_per_kg=500.0,
            components=components
        )
        
        assert plan.is_feasible is False
        assert any("成本超标" in v for v in plan.violations)
    
    def test_calculate_plan_three_materials(self, calculator):
        components = [
            {"material_id": "M001", "proportion": 30},
            {"material_id": "M002", "proportion": 40},
            {"material_id": "M003", "proportion": 30}
        ]
        plan = calculator.calculate_plan(
            batch_name="三原料测试",
            target_weight_kg=100.0,
            target_aroma_score=85.0,
            max_cost_per_kg=500.0,
            components=components
        )
        
        assert plan.is_feasible is True
        
        expected_aroma = 95.0 * 0.3 + 88.0 * 0.4 + 80.0 * 0.3
        assert abs(plan.avg_aroma_score - expected_aroma) < 0.01
        
        assert len(plan.components) == 3
    
    def test_feasibility_reasons_generated(self, calculator):
        components = [
            {"material_id": "M002", "proportion": 50},
            {"material_id": "M003", "proportion": 50}
        ]
        plan = calculator.calculate_plan(
            batch_name="可行性原因测试",
            target_weight_kg=50.0,
            target_aroma_score=80.0,
            max_cost_per_kg=400.0,
            components=components
        )
        
        if plan.is_feasible:
            assert len(plan.feasibility_reasons) > 0
            assert any("香气评分达标" in r for r in plan.feasibility_reasons)
            assert any("成本控制达标" in r for r in plan.feasibility_reasons)
    
    def test_generate_optimized_plans(self, calculator):
        plans = calculator.generate_optimized_plans(
            target_weight_kg=100.0,
            target_aroma_score=85.0,
            max_cost_per_kg=400.0
        )
        
        assert isinstance(plans, list)
        
        feasible_plans = [p for p in plans if p.is_feasible]
        for plan in feasible_plans:
            assert plan.avg_aroma_score >= 85.0
            assert plan.total_cost / plan.target_weight_kg <= 400.0
    
    def test_inventory_stock_check(self, calculator):
        super_material = calculator.inventory.get_material("M001")
        current_stock = super_material.stock_kg
        
        components = [
            {"material_id": "M001", "proportion": 100}
        ]
        plan = calculator.calculate_plan(
            batch_name="库存检查测试",
            target_weight_kg=current_stock,
            target_aroma_score=80.0,
            max_cost_per_kg=1000.0,
            components=components
        )
        
        assert plan.is_feasible is True
        assert plan.components[0].quantity_kg == current_stock


class TestSampleInventory:
    def test_load_sample_inventory(self):
        inv = load_sample_inventory()
        materials = inv.get_all_materials()
        
        assert len(materials) > 0
        
        super_grade_count = sum(1 for m in materials if m.grade == TeaGrade.SUPER)
        assert super_grade_count > 0
        
        for material in materials:
            assert material.aroma_score >= 0
            assert material.aroma_score <= 100
            assert material.cost_per_kg > 0
            assert material.stock_kg >= 0
    
    def test_grade_distribution(self):
        inv = load_sample_inventory()
        materials = inv.get_all_materials()
        
        for material in materials:
            if material.grade == TeaGrade.SUPER:
                assert material.aroma_score >= 90
            elif material.grade == TeaGrade.GRADE1:
                assert material.aroma_score >= 85


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
