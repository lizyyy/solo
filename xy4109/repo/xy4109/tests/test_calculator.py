from decimal import Decimal

import pytest

from water_activity_cli.calculator import (
    MoistureConverter,
    UnitConverter,
    WaterActivityCalculator,
    WaterActivityEstimator,
)
from water_activity_cli.models import Unit


class TestUnitConverter:
    def test_gram_conversions(self):
        assert UnitConverter.to_grams(Decimal("1"), Unit.GRAM) == Decimal("1")
        assert UnitConverter.to_grams(Decimal("1"), Unit.KILOGRAM) == Decimal("1000")
        assert UnitConverter.to_grams(Decimal("1000"), Unit.MILLIGRAM) == Decimal("1")
    
    def test_from_grams(self):
        assert UnitConverter.from_grams(Decimal("1000"), Unit.KILOGRAM) == Decimal("1")
        assert UnitConverter.from_grams(Decimal("1"), Unit.MILLIGRAM) == Decimal("1000")


class TestMoistureConverter:
    def test_wet_to_dry_basic(self):
        wet = Decimal("0.12")
        dry = MoistureConverter.wet_to_dry(wet)
        expected = Decimal("0.12") / Decimal("0.88")
        assert float(dry) == pytest.approx(float(expected))
    
    def test_dry_to_wet_basic(self):
        dry = Decimal("0.1364")
        wet = MoistureConverter.dry_to_wet(dry)
        assert float(wet) == pytest.approx(0.12, rel=0.01)
    
    def test_roundtrip(self):
        original_wet = Decimal("0.25")
        dry = MoistureConverter.wet_to_dry(original_wet)
        wet_back = MoistureConverter.dry_to_wet(dry)
        assert float(wet_back) == pytest.approx(float(original_wet))


class TestWaterActivityEstimator:
    def test_estimate_moisture_from_aw(self):
        aw = Decimal("0.65")
        moisture = WaterActivityEstimator.estimate_moisture_from_aw(aw)
        assert moisture > Decimal("0")
        assert moisture < Decimal("1")
    
    def test_estimate_aw_from_moisture(self):
        moisture = Decimal("0.15")
        aw = WaterActivityEstimator.estimate_aw_from_moisture(moisture)
        assert aw > Decimal("0")
        assert aw < Decimal("1")
    
    def test_mix_aw_by_weighted_average(self):
        data = [
            (Decimal("100"), Decimal("0.5")),
            (Decimal("100"), Decimal("0.7")),
        ]
        result = WaterActivityEstimator.mix_aw_by_weighted_average(data)
        assert float(result) == pytest.approx(0.6)


class TestWaterActivityCalculator:
    def test_calculate_basic(self, sample_recipe, sample_ingredients):
        calculator = WaterActivityCalculator(sample_ingredients)
        result = calculator.calculate(sample_recipe)
        
        assert result.recipe_name == "测试曲奇"
        assert result.total_input_weight == Decimal("1000")
        assert result.total_water_input > Decimal("0")
        assert result.total_dry_solids > Decimal("0")
    
    def test_calculate_moisture_values(self, sample_recipe, sample_ingredients):
        calculator = WaterActivityCalculator(sample_ingredients)
        result = calculator.calculate(sample_recipe)
        
        assert result.initial_moisture_wet_basis > Decimal("0")
        assert result.initial_moisture_wet_basis < Decimal("1")
        assert result.initial_moisture_dry_basis > result.initial_moisture_wet_basis
    
    def test_calculate_baking_loss(self, sample_recipe, sample_ingredients):
        calculator = WaterActivityCalculator(sample_ingredients)
        result = calculator.calculate(sample_recipe)
        
        assert result.baking_loss_amount == Decimal("80")
        assert result.baking_water_loss == Decimal("80")
        assert result.baking_solids_loss == Decimal("0")
    
    def test_calculate_adjustment(self, sample_recipe, sample_ingredients):
        calculator = WaterActivityCalculator(sample_ingredients)
        result = calculator.calculate(sample_recipe)
        
        assert result.adjustment_direction in ["add", "remove", "none"]
        assert result.water_adjustment_needed >= Decimal("0")
    
    def test_calculate_final_values(self, sample_recipe, sample_ingredients):
        calculator = WaterActivityCalculator(sample_ingredients)
        result = calculator.calculate(sample_recipe)
        
        assert result.final_expected_weight > Decimal("0")
        assert result.final_moisture_wet > Decimal("0")
        assert result.final_moisture_wet < Decimal("1")
        assert result.final_aw == sample_recipe.target.target_aw
    
    def test_no_baking_profile(self, sample_recipe, sample_ingredients):
        sample_recipe.baking_profile = None
        calculator = WaterActivityCalculator(sample_ingredients)
        result = calculator.calculate(sample_recipe)
        
        assert result.baking_loss_amount == Decimal("0")
        assert result.total_after_baking == result.total_input_weight
