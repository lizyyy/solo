from typing import Dict, Tuple, List
from candle_simulator.models import (
    Recipe, Ingredient, RecipeIngredient,
    IngredientType, CostResult, LoadRatioResult
)


class CalculatorError(Exception):
    """计算器错误"""
    pass


UNIT_CONVERSIONS = {
    'g': {'g': 1.0, 'kg': 0.001, 'mg': 1000.0},
    'kg': {'g': 1000.0, 'kg': 1.0, 'mg': 1000000.0},
    'mg': {'g': 0.001, 'kg': 0.000001, 'mg': 1.0},
    'ml': {'ml': 1.0, 'l': 0.001},
    'l': {'ml': 1000.0, 'l': 1.0},
    'oz': {'oz': 1.0, 'g': 28.3495},
    'lb': {'lb': 1.0, 'g': 453.592},
    'pcs': {'pcs': 1.0},
    'unit': {'unit': 1.0}
}


def convert_unit(amount: float, from_unit: str, to_unit: str) -> float:
    """
    单位转换
    """
    from_unit = from_unit.lower().strip()
    to_unit = to_unit.lower().strip()
    
    if from_unit == to_unit:
        return amount
    
    if from_unit not in UNIT_CONVERSIONS:
        raise CalculatorError(f"不支持的源单位: {from_unit}")
    
    if to_unit not in UNIT_CONVERSIONS[from_unit]:
        raise CalculatorError(f"无法从 {from_unit} 转换到 {to_unit}")
    
    return amount * UNIT_CONVERSIONS[from_unit][to_unit]


def normalize_to_grams(amount: float, unit: str) -> float:
    """
    将任意质量单位标准化为克
    """
    unit = unit.lower().strip()
    
    if unit == 'g':
        return amount
    elif unit == 'kg':
        return amount * 1000.0
    elif unit == 'mg':
        return amount / 1000.0
    elif unit == 'oz':
        return amount * 28.3495
    elif unit == 'lb':
        return amount * 453.592
    elif unit in ['ml', 'l', 'pcs', 'unit']:
        raise CalculatorError(f"无法将体积/数量单位 '{unit}' 标准化为质量单位")
    else:
        raise CalculatorError(f"不支持的单位: {unit}")


def calculate_costs(recipe: Recipe) -> CostResult:
    """
    计算配方的成本
    """
    cost_breakdown = {}
    total_batch_cost = 0.0
    total_quantity_grams = 0.0
    
    for ing in recipe.ingredients:
        if not ing.ingredient:
            continue
        
        try:
            normalized_amount = normalize_to_grams(ing.amount, ing.unit)
        except CalculatorError:
            normalized_amount = ing.amount
        
        price_per_unit = ing.ingredient.unit_price
        ingredient_unit = ing.ingredient.unit
        
        try:
            ingredient_cost = (normalized_amount / 1000.0) * price_per_unit if ingredient_unit == 'kg' else (normalized_amount * price_per_unit) if ingredient_unit == 'g' else normalized_amount * price_per_unit
        except Exception as e:
            raise CalculatorError(f"计算原料 '{ing.name}' 成本时出错: {e}")
        
        cost_breakdown[ing.name] = ingredient_cost
        total_batch_cost += ingredient_cost
        total_quantity_grams += normalized_amount
    
    per_cup_cost = 0.0
    per_unit_cost = 0.0
    
    if recipe.container_count > 0:
        per_cup_cost = total_batch_cost / recipe.container_count
    
    if total_quantity_grams > 0:
        per_unit_cost = total_batch_cost / total_quantity_grams
    
    return CostResult(
        total_batch_cost=round(total_batch_cost, 4),
        per_cup_cost=round(per_cup_cost, 4),
        per_unit_cost=round(per_unit_cost, 6),
        cost_breakdown={k: round(v, 4) for k, v in cost_breakdown.items()}
    )


def calculate_load_ratio(recipe: Recipe) -> LoadRatioResult:
    """
    计算香精负载比例
    香精负载比例 = 香精总重量 / 蜡基总重量
    """
    total_fragrance_grams = 0.0
    total_wax_grams = 0.0
    total_additive_grams = 0.0
    
    for ing in recipe.ingredients:
        if not ing.ingredient:
            continue
        
        try:
            normalized_amount = normalize_to_grams(ing.amount, ing.unit)
        except CalculatorError:
            continue
        
        if ing.ingredient.type == IngredientType.FRAGRANCE:
            total_fragrance_grams += normalized_amount
        elif ing.ingredient.type == IngredientType.WAX:
            total_wax_grams += normalized_amount
        elif ing.ingredient.type == IngredientType.ADDITIVE:
            total_additive_grams += normalized_amount
    
    fragrance_load_ratio = 0.0
    wax_ratio = 0.0
    additive_ratio = 0.0
    
    total_recipe_grams = total_wax_grams + total_fragrance_grams + total_additive_grams
    
    if total_wax_grams > 0:
        fragrance_load_ratio = (total_fragrance_grams / total_wax_grams) * 100
    
    if total_recipe_grams > 0:
        wax_ratio = (total_wax_grams / total_recipe_grams) * 100
        additive_ratio = (total_additive_grams / total_recipe_grams) * 100
    
    return LoadRatioResult(
        total_fragrance_amount=round(total_fragrance_grams, 4),
        total_wax_amount=round(total_wax_grams, 4),
        fragrance_load_ratio=round(fragrance_load_ratio, 2),
        wax_ratio=round(wax_ratio, 2),
        additive_ratio=round(additive_ratio, 2)
    )


def normalize_recipe_amounts(recipe: Recipe) -> Recipe:
    """
    标准化配方中的原料用量为克
    """
    normalized_ingredients = []
    
    for ing in recipe.ingredients:
        try:
            normalized_amount = normalize_to_grams(ing.amount, ing.unit)
            normalized_ingredient = RecipeIngredient(
                name=ing.name,
                amount=normalized_amount,
                unit='g',
                ingredient=ing.ingredient
            )
            normalized_ingredients.append(normalized_ingredient)
        except CalculatorError:
            normalized_ingredients.append(ing)
    
    return Recipe(
        name=recipe.name,
        description=recipe.description,
        ingredients=normalized_ingredients,
        total_batch_size=recipe.total_batch_size,
        total_batch_unit=recipe.total_batch_unit,
        target_per_cup_capacity=recipe.target_per_cup_capacity,
        target_per_cup_unit=recipe.target_per_cup_unit,
        container_count=recipe.container_count,
        target_per_cup_cost=recipe.target_per_cup_cost,
        notes=recipe.notes
    )


def get_allergen_summary(recipe: Recipe) -> Dict[str, int]:
    """
    获取配方中的过敏原汇总
    """
    allergen_count = {}
    
    for ing in recipe.ingredients:
        if not ing.ingredient:
            continue
        
        for allergen in ing.ingredient.allergen_tags:
            allergen_count[allergen] = allergen_count.get(allergen, 0) + 1
    
    return allergen_count


def calculate_total_mass(recipe: Recipe) -> float:
    """
    计算配方总质量（克）
    """
    total = 0.0
    
    for ing in recipe.ingredients:
        try:
            total += normalize_to_grams(ing.amount, ing.unit)
        except CalculatorError:
            continue
    
    return round(total, 4)
