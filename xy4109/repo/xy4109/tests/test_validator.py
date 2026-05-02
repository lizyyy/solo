from decimal import Decimal

import pytest

from water_activity_cli.models import (
    BakingProfile,
    FormulaIngredient,
    Ingredient,
    Recipe,
    Unit,
    ValidationIssue,
    ValidationReport,
    WaterActivityTarget,
)
from water_activity_cli.validator import (
    BatchScalingRule,
    IngredientDataRule,
    MoistureConsistencyRule,
    RecipeValidator,
    TargetFeasibilityRule,
    UnitConsistencyRule,
)


class TestUnitConsistencyRule:
    def test_mixed_units_detected(self):
        rule = UnitConsistencyRule()
        recipe = Recipe(
            name="test",
            batch_size=1,
            batch_unit=Unit.KILOGRAM,
            ingredients=[
                FormulaIngredient(name="A", amount=100, unit=Unit.GRAM),
                FormulaIngredient(name="B", amount=0.5, unit=Unit.KILOGRAM),
            ],
            target=WaterActivityTarget(target_aw=0.6),
        )
        
        issues = rule.validate(recipe, {})
        
        assert len(issues) > 0
        unit_issues = [i for i in issues if i.category == "unit_mix"]
        assert len(unit_issues) > 0
    
    def test_same_units_no_issue(self):
        rule = UnitConsistencyRule()
        recipe = Recipe(
            name="test",
            batch_size=1,
            batch_unit=Unit.KILOGRAM,
            ingredients=[
                FormulaIngredient(name="A", amount=100, unit=Unit.GRAM),
                FormulaIngredient(name="B", amount=200, unit=Unit.GRAM),
            ],
            target=WaterActivityTarget(target_aw=0.6),
        )
        
        issues = rule.validate(recipe, {})
        unit_issues = [i for i in issues if i.category == "unit_mix"]
        assert len(unit_issues) == 0


class TestIngredientDataRule:
    def test_missing_ingredient_error(self):
        rule = IngredientDataRule()
        recipe = Recipe(
            name="test",
            batch_size=1,
            batch_unit=Unit.KILOGRAM,
            ingredients=[
                FormulaIngredient(name="未知原料", amount=100, unit=Unit.GRAM),
            ],
            target=WaterActivityTarget(target_aw=0.6),
        )
        
        issues = rule.validate(recipe, {})
        
        errors = [i for i in issues if i.level == "error"]
        assert len(errors) > 0
    
    def test_ingredient_in_library_no_error(self, sample_ingredients):
        rule = IngredientDataRule()
        recipe = Recipe(
            name="test",
            batch_size=1,
            batch_unit=Unit.KILOGRAM,
            ingredients=[
                FormulaIngredient(name="面粉", amount=100, unit=Unit.GRAM),
            ],
            target=WaterActivityTarget(target_aw=0.6),
        )
        
        issues = rule.validate(recipe, sample_ingredients)
        
        errors = [i for i in issues if i.level == "error"]
        assert len(errors) == 0
    
    def test_moisture_override_no_error(self):
        rule = IngredientDataRule()
        recipe = Recipe(
            name="test",
            batch_size=1,
            batch_unit=Unit.KILOGRAM,
            ingredients=[
                FormulaIngredient(
                    name="未知原料",
                    amount=100,
                    unit=Unit.GRAM,
                    moisture_override=Decimal("0.12"),
                ),
            ],
            target=WaterActivityTarget(target_aw=0.6),
        )
        
        issues = rule.validate(recipe, {})
        
        errors = [i for i in issues if i.level == "error"]
        assert len(errors) == 0


class TestTargetFeasibilityRule:
    def test_invalid_bounds_error(self):
        rule = TargetFeasibilityRule()
        recipe = Recipe(
            name="test",
            batch_size=1,
            batch_unit=Unit.KILOGRAM,
            ingredients=[
                FormulaIngredient(name="A", amount=100, unit=Unit.GRAM),
            ],
            target=WaterActivityTarget(
                target_aw=0.5,
                min_aw=0.7,
                max_aw=0.6,
            ),
        )
        
        issues = rule.validate(recipe, {})
        
        errors = [i for i in issues if i.level == "error"]
        assert len(errors) > 0
    
    def test_target_out_of_range_low(self):
        rule = TargetFeasibilityRule()
        recipe = Recipe(
            name="test",
            batch_size=1,
            batch_unit=Unit.KILOGRAM,
            ingredients=[
                FormulaIngredient(name="A", amount=100, unit=Unit.GRAM),
            ],
            target=WaterActivityTarget(
                target_aw=0.5,
                min_aw=0.6,
                max_aw=0.8,
            ),
        )
        
        issues = rule.validate(recipe, {})
        
        errors = [i for i in issues if i.level == "error"]
        assert len(errors) > 0
    
    def test_extreme_low_aw_warning(self):
        rule = TargetFeasibilityRule()
        recipe = Recipe(
            name="test",
            batch_size=1,
            batch_unit=Unit.KILOGRAM,
            ingredients=[
                FormulaIngredient(name="A", amount=100, unit=Unit.GRAM),
            ],
            target=WaterActivityTarget(target_aw=0.1),
        )
        
        issues = rule.validate(recipe, {})
        
        warnings = [i for i in issues if i.level == "warning"]
        assert len(warnings) > 0
    
    def test_extreme_high_aw_warning(self):
        rule = TargetFeasibilityRule()
        recipe = Recipe(
            name="test",
            batch_size=1,
            batch_unit=Unit.KILOGRAM,
            ingredients=[
                FormulaIngredient(name="A", amount=100, unit=Unit.GRAM),
            ],
            target=WaterActivityTarget(target_aw=0.99),
        )
        
        issues = rule.validate(recipe, {})
        
        warnings = [i for i in issues if i.level == "warning"]
        assert len(warnings) > 0
    
    def test_normal_target_no_error(self):
        rule = TargetFeasibilityRule()
        recipe = Recipe(
            name="test",
            batch_size=1,
            batch_unit=Unit.KILOGRAM,
            ingredients=[
                FormulaIngredient(name="A", amount=100, unit=Unit.GRAM),
            ],
            target=WaterActivityTarget(
                target_aw=0.65,
                min_aw=0.60,
                max_aw=0.70,
            ),
        )
        
        issues = rule.validate(recipe, {})
        
        errors = [i for i in issues if i.level == "error"]
        assert len(errors) == 0


class TestBatchScalingRule:
    def test_small_batch_warning(self):
        rule = BatchScalingRule()
        recipe = Recipe(
            name="test",
            batch_size=Decimal("0.05"),
            batch_unit=Unit.KILOGRAM,
            ingredients=[
                FormulaIngredient(name="A", amount=50, unit=Unit.GRAM),
            ],
            target=WaterActivityTarget(target_aw=0.6),
        )
        
        issues = rule.validate(recipe, {})
        
        warnings = [i for i in issues if i.level == "warning"]
        small_batch_issues = [i for i in issues if i.category == "small_batch"]
        assert len(small_batch_issues) > 0
    
    def test_minuscule_amount_warning(self):
        rule = BatchScalingRule()
        recipe = Recipe(
            name="test",
            batch_size=1,
            batch_unit=Unit.KILOGRAM,
            ingredients=[
                FormulaIngredient(name="微量原料", amount=5, unit=Unit.MILLIGRAM),
            ],
            target=WaterActivityTarget(target_aw=0.6),
        )
        
        issues = rule.validate(recipe, {})
        
        minuscule_issues = [i for i in issues if i.category == "minuscule_amount"]
        assert len(minuscule_issues) > 0


class TestMoistureConsistencyRule:
    def test_invalid_moisture_override_error(self):
        rule = MoistureConsistencyRule()
        recipe = Recipe(
            name="test",
            batch_size=1,
            batch_unit=Unit.KILOGRAM,
            ingredients=[
                FormulaIngredient(
                    name="A",
                    amount=100,
                    unit=Unit.GRAM,
                    moisture_override=Decimal("1.5"),
                ),
            ],
            target=WaterActivityTarget(target_aw=0.6),
        )
        
        issues = rule.validate(recipe, {})
        
        errors = [i for i in issues if i.level == "error"]
        assert len(errors) > 0


class TestRecipeValidator:
    def test_valid_recipe(self, sample_recipe, sample_ingredients):
        validator = RecipeValidator(sample_ingredients)
        report = validator.validate(sample_recipe)
        
        assert report.valid is True
    
    def test_invalid_recipe_missing_ingredients(self):
        validator = RecipeValidator({})
        recipe = Recipe(
            name="test",
            batch_size=1,
            batch_unit=Unit.KILOGRAM,
            ingredients=[
                FormulaIngredient(name="未知", amount=100, unit=Unit.GRAM),
            ],
            target=WaterActivityTarget(target_aw=0.6),
        )
        
        report = validator.validate(recipe)
        
        assert report.valid is False
        assert report.summary["errors"] > 0
    
    def test_summary_counts(self, sample_recipe, sample_ingredients):
        validator = RecipeValidator(sample_ingredients)
        report = validator.validate(sample_recipe)
        
        assert "total" in report.summary
        assert "errors" in report.summary
        assert "warnings" in report.summary
