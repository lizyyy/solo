from decimal import Decimal
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from water_activity_cli.models import (
    BakingProfile,
    CalculationResult,
    FormulaIngredient,
    Ingredient,
    Recipe,
    Unit,
    WaterActivityTarget,
)


class UnitConverter:
    TO_GRAM: Dict[Unit, Decimal] = {
        Unit.MILLIGRAM: Decimal("0.001"),
        Unit.GRAM: Decimal("1"),
        Unit.KILOGRAM: Decimal("1000"),
        Unit.PERCENT: Decimal("1"),
    }
    
    FROM_GRAM: Dict[Unit, Decimal] = {
        Unit.MILLIGRAM: Decimal("1000"),
        Unit.GRAM: Decimal("1"),
        Unit.KILOGRAM: Decimal("0.001"),
        Unit.PERCENT: Decimal("1"),
    }
    
    @classmethod
    def to_grams(cls, amount: Decimal, unit: Unit) -> Decimal:
        if unit == Unit.PERCENT:
            return amount
        return amount * cls.TO_GRAM[unit]
    
    @classmethod
    def from_grams(cls, grams: Decimal, target_unit: Unit) -> Decimal:
        if target_unit == Unit.PERCENT:
            return grams
        return grams * cls.FROM_GRAM[target_unit]


class MoistureConverter:
    @staticmethod
    def wet_to_dry(wet_basis: Decimal) -> Decimal:
        if wet_basis >= Decimal("1"):
            return Decimal("0")
        return wet_basis / (Decimal("1") - wet_basis)
    
    @staticmethod
    def dry_to_wet(dry_basis: Decimal) -> Decimal:
        if dry_basis < 0:
            return Decimal("0")
        return dry_basis / (Decimal("1") + dry_basis)


class WaterActivityEstimator:
    GAB_CONSTANTS = {
        "default": {"k": Decimal("0.7"), "c": Decimal("5.0"), "m0": Decimal("0.05")},
        "starch": {"k": Decimal("0.85"), "c": Decimal("10.0"), "m0": Decimal("0.06")},
        "sugar": {"k": Decimal("0.7"), "c": Decimal("5.0"), "m0": Decimal("0.03")},
        "protein": {"k": Decimal("0.8"), "c": Decimal("8.0"), "m0": Decimal("0.04")},
    }
    
    @classmethod
    def estimate_moisture_from_aw(
        cls,
        aw: Decimal,
        ingredient_type: str = "default",
    ) -> Decimal:
        constants = cls.GAB_CONSTANTS.get(ingredient_type, cls.GAB_CONSTANTS["default"])
        k = constants["k"]
        c = constants["c"]
        m0 = constants["m0"]
        
        if aw <= 0 or aw >= 1:
            return Decimal("0")
        
        denominator = (Decimal("1") - k * aw) * (Decimal("1") - k * aw + c * k * aw)
        if denominator == 0:
            return Decimal("0")
        
        moisture_dry = m0 * c * k * aw / denominator
        return moisture_dry
    
    @classmethod
    def estimate_aw_from_moisture(
        cls,
        moisture_dry: Decimal,
        ingredient_type: str = "default",
    ) -> Decimal:
        constants = cls.GAB_CONSTANTS.get(ingredient_type, cls.GAB_CONSTANTS["default"])
        k = constants["k"]
        c = constants["c"]
        m0 = constants["m0"]
        
        if moisture_dry <= 0:
            return Decimal("0.01")
        
        m_ratio = moisture_dry / m0
        
        c_minus_1 = c - Decimal("1")
        
        a = k * k * c_minus_1
        b = k * (Decimal("1") - c_minus_1 - m_ratio)
        c_coeff = m_ratio
        
        if a == 0:
            if b == 0:
                return Decimal("0.5")
            aw = c_coeff / b
        else:
            discriminant = b * b - Decimal("4") * a * c_coeff
            if discriminant < 0:
                return Decimal("0.5")
            sqrt_d = discriminant.sqrt()
            root1 = (-b + sqrt_d) / (Decimal("2") * a)
            root2 = (-b - sqrt_d) / (Decimal("2") * a)
            
            aw = root1
            if root1 > Decimal("0.95") or root1 < Decimal("0.01"):
                if root2 > Decimal("0.01") and root2 < Decimal("0.95"):
                    aw = root2
        
        aw = max(Decimal("0.01"), min(Decimal("0.99"), aw))
        return aw
    
    @classmethod
    def mix_aw_by_weighted_average(
        cls,
        ingredients_data: List[Tuple[Decimal, Decimal]],
    ) -> Decimal:
        if not ingredients_data:
            return Decimal("0.6")
        
        total_weight = Decimal("0")
        weighted_aw = Decimal("0")
        
        for weight, aw in ingredients_data:
            if weight > 0 and aw > 0:
                total_weight += weight
                weighted_aw += weight * aw
        
        if total_weight == 0:
            return Decimal("0.6")
        
        return weighted_aw / total_weight


class WaterActivityCalculator:
    def __init__(self, ingredient_library: Optional[Dict[str, Ingredient]] = None):
        self.ingredient_library = ingredient_library or {}
    
    def calculate(self, recipe: Recipe) -> CalculationResult:
        normalized_ingredients = self._normalize_batch(recipe)
        
        total_input_grams = Decimal("0")
        total_dry_solids_grams = Decimal("0")
        total_water_input_grams = Decimal("0")
        ingredients_aw_data: List[Tuple[Decimal, Decimal]] = []
        
        for ing in normalized_ingredients:
            amount_grams = UnitConverter.to_grams(ing.amount, ing.unit)
            total_input_grams += amount_grams
            
            moisture_wet = self._get_effective_moisture(ing)
            water_grams = amount_grams * moisture_wet
            dry_grams = amount_grams - water_grams
            
            total_water_input_grams += water_grams
            total_dry_solids_grams += dry_grams
            
            aw = self._get_effective_aw(ing)
            if aw:
                ingredients_aw_data.append((amount_grams, aw))
        
        initial_moisture_wet = total_water_input_grams / total_input_grams if total_input_grams > 0 else Decimal("0")
        initial_moisture_dry = MoistureConverter.wet_to_dry(initial_moisture_wet)
        
        initial_aw_estimate = WaterActivityEstimator.mix_aw_by_weighted_average(
            ingredients_aw_data
        ) if ingredients_aw_data else None
        
        (
            baking_loss_grams,
            baking_water_loss,
            baking_solids_loss,
            water_after_baking,
            total_after_baking,
        ) = self._calculate_baking_loss(
            total_input_grams,
            total_water_input_grams,
            total_dry_solids_grams,
            recipe.baking_profile,
        )
        
        moisture_after_wet = water_after_baking / total_after_baking if total_after_baking > 0 else Decimal("0")
        moisture_after_dry = MoistureConverter.wet_to_dry(moisture_after_wet)
        
        aw_after_baking = self._estimate_aw_after_baking(
            moisture_after_dry,
            ingredients_aw_data,
        )
        
        target_moisture_dry = WaterActivityEstimator.estimate_moisture_from_aw(
            recipe.target.target_aw
        )
        target_moisture_wet = MoistureConverter.dry_to_wet(target_moisture_dry)
        
        remaining_dry = total_dry_solids_grams - baking_solids_loss
        if remaining_dry <= 0:
            water_adjustment = Decimal("0")
            adjustment_direction = "none"
        else:
            target_total_water = target_moisture_dry * remaining_dry
            water_adjustment = target_total_water - water_after_baking
            adjustment_direction = "add" if water_adjustment > 0 else "remove"
        
        final_water = water_after_baking + water_adjustment
        final_total = remaining_dry + final_water
        
        final_moisture_wet = final_water / final_total if final_total > 0 else Decimal("0")
        final_moisture_dry = MoistureConverter.wet_to_dry(final_moisture_wet)
        
        final_aw = recipe.target.target_aw
        
        safety_checks = self._perform_safety_checks(
            recipe,
            initial_aw_estimate,
            aw_after_baking,
            final_moisture_wet,
            water_adjustment,
        )
        
        warnings = self._compile_warnings(safety_checks, recipe)
        
        return CalculationResult(
            recipe_name=recipe.name,
            timestamp=datetime.now().isoformat(),
            total_input_weight=total_input_grams,
            total_input_weight_unit=Unit.GRAM,
            total_dry_solids=total_dry_solids_grams,
            total_water_input=total_water_input_grams,
            initial_moisture_wet_basis=initial_moisture_wet,
            initial_moisture_dry_basis=initial_moisture_dry,
            initial_aw_estimate=initial_aw_estimate,
            baking_loss_amount=baking_loss_grams,
            baking_water_loss=baking_water_loss,
            baking_solids_loss=baking_solids_loss,
            water_after_baking=water_after_baking,
            total_after_baking=total_after_baking,
            moisture_after_baking_wet=moisture_after_wet,
            moisture_after_baking_dry=moisture_after_dry,
            aw_after_baking=aw_after_baking,
            target_moisture_wet_basis=target_moisture_wet,
            target_moisture_dry_basis=target_moisture_dry,
            water_adjustment_needed=abs(water_adjustment),
            adjustment_direction=adjustment_direction,
            final_expected_weight=final_total,
            final_moisture_wet=final_moisture_wet,
            final_moisture_dry=final_moisture_dry,
            final_aw=final_aw,
            safety_checks=safety_checks,
            warnings=warnings,
        )
    
    def _normalize_batch(self, recipe: Recipe) -> List[FormulaIngredient]:
        return recipe.ingredients
    
    def _get_effective_moisture(self, ing: FormulaIngredient) -> Decimal:
        if ing.moisture_override is not None:
            return ing.moisture_override
        library_ing = self.ingredient_library.get(ing.name)
        if library_ing:
            return library_ing.moisture_content_wet
        return Decimal("0.1")
    
    def _get_effective_aw(self, ing: FormulaIngredient) -> Optional[Decimal]:
        if ing.aw_override is not None:
            return ing.aw_override
        library_ing = self.ingredient_library.get(ing.name)
        if library_ing and library_ing.aw:
            return library_ing.aw
        moisture_wet = self._get_effective_moisture(ing)
        moisture_dry = MoistureConverter.wet_to_dry(moisture_wet)
        return WaterActivityEstimator.estimate_aw_from_moisture(moisture_dry)
    
    def _calculate_baking_loss(
        self,
        total_input: Decimal,
        total_water: Decimal,
        total_dry: Decimal,
        baking_profile: Optional[BakingProfile],
    ) -> Tuple[Decimal, Decimal, Decimal, Decimal, Decimal]:
        if not baking_profile:
            return Decimal("0"), Decimal("0"), Decimal("0"), total_water, total_input
        
        loss_pct = baking_profile.loss_percentage
        total_loss_grams = total_input * loss_pct
        
        if baking_profile.loss_is_water_only:
            water_loss = min(total_water, total_loss_grams)
            solids_loss = total_loss_grams - water_loss
        else:
            initial_water_ratio = total_water / total_input if total_input > 0 else Decimal("0.4")
            water_loss = total_loss_grams * initial_water_ratio
            solids_loss = total_loss_grams - water_loss
        
        remaining_water = total_water - water_loss
        remaining_dry = total_dry - solids_loss
        remaining_total = remaining_water + remaining_dry
        
        return total_loss_grams, water_loss, solids_loss, remaining_water, remaining_total
    
    def _estimate_aw_after_baking(
        self,
        moisture_dry: Decimal,
        ingredients_aw_data: List[Tuple[Decimal, Decimal]],
    ) -> Optional[Decimal]:
        estimated = WaterActivityEstimator.estimate_aw_from_moisture(moisture_dry)
        return estimated
    
    def _perform_safety_checks(
        self,
        recipe: Recipe,
        initial_aw: Optional[Decimal],
        after_baking_aw: Optional[Decimal],
        final_moisture: Decimal,
        water_adjustment: Decimal,
    ) -> dict:
        checks = {}
        
        target = recipe.target
        safety_margin = target.safety_margin_aw or Decimal("0.02")
        
        lower_bound = target.target_aw - safety_margin
        upper_bound = target.target_aw + safety_margin
        
        if target.min_aw:
            lower_bound = max(lower_bound, target.min_aw)
        if target.max_aw:
            upper_bound = min(upper_bound, target.max_aw)
        
        checks["safe_range"] = {
            "lower": float(lower_bound),
            "upper": float(upper_bound),
            "target": float(target.target_aw),
        }
        
        checks["moisture_valid"] = float(final_moisture) > 0 and float(final_moisture) < 1
        
        adjustment_abs = abs(float(water_adjustment))
        checks["adjustment_magnitude"] = {
            "amount_grams": adjustment_abs,
            "is_large": adjustment_abs > 100,
        }
        
        return checks
    
    def _compile_warnings(self, safety_checks: dict, recipe: Recipe) -> List[str]:
        warnings = []
        
        if safety_checks.get("adjustment_magnitude", {}).get("is_large"):
            amount = safety_checks["adjustment_magnitude"]["amount_grams"]
            warnings.append(f"补水量/排水量较大 ({amount:.1f}g)，建议核查配方合理性")
        
        if not safety_checks.get("moisture_valid", True):
            warnings.append("计算得到的含水率不在有效范围内，请检查原料数据")
        
        for ing in recipe.ingredients:
            if ing.name not in self.ingredient_library and ing.moisture_override is None:
                warnings.append(f"原料 '{ing.name}' 不在原料库中，使用默认含水率(10%)")
        
        return warnings
