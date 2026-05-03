from typing import Dict, List, Any
from candle_simulator.models import (
    Recipe, Ingredient, RecipeIngredient,
    IngredientType, NoteType, RiskResult, RiskItem,
    LoadRatioResult, CostResult, VolatilizationResult
)
from candle_simulator.calculator import normalize_to_grams, CalculatorError


FLASH_POINT_SAFE_THRESHOLD = 60.0
FLASH_POINT_WARNING_THRESHOLD = 90.0


def detect_risks(
    recipe: Recipe,
    load_ratio_result: LoadRatioResult,
    cost_result: CostResult,
    volatilization_result: VolatilizationResult
) -> RiskResult:
    """
    综合检测配方中的所有风险
    """
    risks: List[RiskItem] = []
    
    risks.extend(_detect_fragrance_ratio_risks(recipe, load_ratio_result))
    risks.extend(_detect_flash_point_risks(recipe))
    risks.extend(_detect_allergen_risks(recipe))
    risks.extend(_detect_container_capacity_risks(recipe))
    risks.extend(_detect_scent_gap_risks(volatilization_result))
    risks.extend(_detect_cost_risks(recipe, cost_result))
    risks.extend(_detect_material_balance_risks(recipe))
    risks.extend(_detect_unit_risks(recipe))
    
    high_count = sum(1 for r in risks if r.level == 'high')
    medium_count = sum(1 for r in risks if r.level == 'medium')
    low_count = sum(1 for r in risks if r.level == 'low')
    
    return RiskResult(
        risks=risks,
        high_count=high_count,
        medium_count=medium_count,
        low_count=low_count
    )


def _detect_fragrance_ratio_risks(
    recipe: Recipe,
    load_ratio_result: LoadRatioResult
) -> List[RiskItem]:
    """
    检测香精添加比例风险
    """
    risks = []
    
    current_ratio = load_ratio_result.fragrance_load_ratio
    
    if current_ratio > 10:
        risks.append(RiskItem(
            level='high',
            category='fragrance_ratio',
            message=f"香精负载比例过高：{current_ratio}%，超过一般安全建议控制在 10% 以内",
            details={
                'current_ratio': current_ratio,
                'recommended_max': 10.0
            }
        ))
    elif current_ratio > 8:
        risks.append(RiskItem(
            level='medium',
            category='fragrance_ratio',
            message=f"香精负载比例偏高：{current_ratio}%，建议控制在 8% 以内以获得更佳扩散效果",
            details={
                'current_ratio': current_ratio,
                'recommended_max': 8.0
            }
        ))
    
    for ing in recipe.ingredients:
        if not ing.ingredient:
            continue
        
        if ing.ingredient.type != IngredientType.FRAGRANCE:
            continue
        
        if ing.ingredient.max_ratio is not None:
            try:
                ing_amount_grams = normalize_to_grams(ing.amount, ing.unit)
                wax_amount = load_ratio_result.total_wax_amount
                
                if wax_amount > 0:
                    ing_ratio = (ing_amount_grams / wax_amount) * 100
                    
                    if ing_ratio > ing.ingredient.max_ratio:
                        risks.append(RiskItem(
                            level='high',
                            category='fragrance_ratio',
                            message=f"香精 '{ing.name}' 添加比例 ({ing_ratio:.1f}%) 超过建议最大值 ({ing.ingredient.max_ratio:.1f}%)",
                            details={
                                'ingredient': ing.name,
                                'current_ratio': round(ing_ratio, 2),
                                'max_ratio': ing.ingredient.max_ratio
                            }
                        ))
            except CalculatorError:
                pass
    
    return risks


def _detect_flash_point_risks(recipe: Recipe) -> List[RiskItem]:
    """
    检测闪点风险
    """
    risks = []
    
    low_fp_ingredients = []
    warning_fp_ingredients = []
    
    for ing in recipe.ingredients:
        if not ing.ingredient:
            continue
        
        fp = ing.ingredient.flash_point
        if fp is None:
            continue
        
        if fp < FLASH_POINT_SAFE_THRESHOLD:
            low_fp_ingredients.append((ing.name, fp))
        elif fp < FLASH_POINT_WARNING_THRESHOLD:
            warning_fp_ingredients.append((ing.name, fp))
    
    for name, fp in low_fp_ingredients:
        risks.append(RiskItem(
            level='high',
            category='flash_point',
            message=f"原料 '{name}' 闪点过低 ({fp}°C)，低于安全阈值 ({FLASH_POINT_SAFE_THRESHOLD}°C)，加热时存在火灾风险",
            details={
                'ingredient': name,
                'flash_point': fp,
                'safe_threshold': FLASH_POINT_SAFE_THRESHOLD
            }
        ))
    
    for name, fp in warning_fp_ingredients:
        risks.append(RiskItem(
            level='medium',
            category='flash_point',
            message=f"原料 '{name}' 闪点偏低 ({fp}°C)，建议加热温度不超过 {fp-10}°C",
            details={
                'ingredient': name,
                'flash_point': fp,
                'warning_threshold': FLASH_POINT_WARNING_THRESHOLD
            }
        ))
    
    return risks


def _detect_allergen_risks(recipe: Recipe) -> List[RiskItem]:
    """
    检测过敏原风险
    """
    risks = []
    
    all_allergens = set()
    allergen_sources: Dict[str, List[str]] = {}
    
    for ing in recipe.ingredients:
        if not ing.ingredient:
            continue
        
        for allergen in ing.ingredient.allergen_tags:
            all_allergens.add(allergen)
            if allergen not in allergen_sources:
                allergen_sources[allergen] = []
            allergen_sources[allergen].append(ing.name)
    
    if all_allergens:
        common_allergens = ['paraben', 'fragrance', 'linalool', 'limonene', 'citral', 'cinnamal', 'eugenol', 'geraniol']
        
        for allergen in all_allergens:
            allergen_lower = allergen.lower()
            if any(common in allergen_lower for common in common_allergens):
                risks.append(RiskItem(
                    level='medium',
                    category='allergen',
                    message=f"检测到常见过敏原 '{allergen}'，来自原料：{', '.join(allergen_sources[allergen])}",
                    details={
                        'allergen': allergen,
                        'sources': allergen_sources[allergen]
                    }
                ))
            else:
                risks.append(RiskItem(
                    level='low',
                    category='allergen',
                    message=f"检测到过敏原标签 '{allergen}'，来自原料：{', '.join(allergen_sources[allergen])}",
                    details={
                        'allergen': allergen,
                        'sources': allergen_sources[allergen]
                    }
                ))
    
    if len(all_allergens) >= 3:
        risks.append(RiskItem(
            level='medium',
            category='allergen',
            message=f"配方包含 {len(all_allergens)} 种不同过敏原，建议在产品标签上明确标注所有过敏原信息",
            details={
                'allergen_count': len(all_allergens),
                'allergens': list(all_allergens)
            }
        ))
    
    return risks


def _detect_container_capacity_risks(recipe: Recipe) -> List[RiskItem]:
    """
    检测容器容量风险
    """
    risks = []
    
    total_mass_grams = 0.0
    container_volume_grams = 0.0
    
    for ing in recipe.ingredients:
        if not ing.ingredient:
            continue
        
        if ing.ingredient.type == IngredientType.CONTAINER:
            try:
                container_volume_grams += normalize_to_grams(ing.amount, ing.unit)
            except CalculatorError:
                pass
        else:
            try:
                total_mass_grams += normalize_to_grams(ing.amount, ing.unit)
            except CalculatorError:
                pass
    
    if recipe.target_per_cup_capacity > 0 and recipe.container_count > 0:
        total_available_capacity = recipe.target_per_cup_capacity * recipe.container_count
        
        try:
            total_available_grams = normalize_to_grams(total_available_capacity, recipe.target_per_cup_unit)
        except CalculatorError:
            total_available_grams = total_available_capacity
        
        if total_mass_grams > total_available_grams:
            overflow_ratio = (total_mass_grams - total_available_grams) / total_available_grams * 100
            risks.append(RiskItem(
                level='high',
                category='container_capacity',
                message=f"总用料量 ({total_mass_grams:.1f}g) 超过容器总容量 ({total_available_grams:.1f}g)，超出约 {overflow_ratio:.1f}%，可能导致溢出",
                details={
                    'total_mass': round(total_mass_grams, 2),
                    'total_capacity': round(total_available_grams, 2),
                    'overflow_ratio': round(overflow_ratio, 2)
                }
            ))
        elif total_mass_grams > total_available_grams * 0.9:
            fill_ratio = total_mass_grams / total_available_grams * 100
            risks.append(RiskItem(
                level='medium',
                category='container_capacity',
                message=f"填充率较高 ({fill_ratio:.1f}%)，建议预留至少 10% 的空间以防止蜡液膨胀溢出",
                details={
                    'fill_ratio': round(fill_ratio, 2),
                    'recommended_max': 90.0
                }
            ))
    
    if total_mass_grams < recipe.total_batch_size * 0.9:
        risks.append(RiskItem(
            level='low',
            category='material_balance',
            message=f"原料总用量 ({total_mass_grams:.1f}g) 低于声明的总批量 ({recipe.total_batch_size:.1f}{recipe.total_batch_unit}) 的 90%，请确认是否遗漏原料",
            details={
                'total_ingredients': round(total_mass_grams, 2),
                'declared_batch': recipe.total_batch_size,
                'batch_unit': recipe.total_batch_unit
            }
        ))
    
    return risks


def _detect_scent_gap_risks(volatilization_result: VolatilizationResult) -> List[RiskItem]:
    """
    检测香调断层风险
    """
    risks = []
    
    if volatilization_result.base_note_gap:
        gap_time = volatilization_result.base_gap_start_hours or volatilization_result.middle_duration_hours
        risks.append(RiskItem(
            level='medium',
            category='scent_gap',
            message=f"检测到香调断层风险：中调在约 {gap_time:.1f} 小时后消散，但后调强度不足，可能导致香味体验中断",
            details={
                'gap_start_hours': gap_time,
                'top_duration': volatilization_result.top_duration_hours,
                'middle_duration': volatilization_result.middle_duration_hours,
                'base_duration': volatilization_result.base_duration_hours
            }
        ))
    
    if volatilization_result.base_duration_hours < 12:
        risks.append(RiskItem(
            level='low',
            category='scent_duration',
            message=f"后调持续时间较短 ({volatilization_result.base_duration_hours:.1f} 小时)，建议增加后调香精比例或选用更持久的后调原料",
            details={
                'base_duration': volatilization_result.base_duration_hours,
                'recommended_min': 12.0
            }
        ))
    
    if volatilization_result.middle_duration_hours < 6:
        risks.append(RiskItem(
            level='low',
            category='scent_duration',
            message=f"中调持续时间较短 ({volatilization_result.middle_duration_hours:.1f} 小时)，香味层次可能不够丰富",
            details={
                'middle_duration': volatilization_result.middle_duration_hours,
                'recommended_min': 6.0
            }
        ))
    
    if volatilization_result.longevity_hours < 24:
        risks.append(RiskItem(
            level='low',
            category='scent_duration',
            message=f"整体留香时间 ({volatilization_result.longevity_hours:.1f} 小时) 偏短，如用于蜡烛建议至少能持续燃烧 24 小时以上",
            details={
                'longevity': volatilization_result.longevity_hours,
                'recommended_min': 24.0
            }
        ))
    
    return risks


def _detect_cost_risks(recipe: Recipe, cost_result: CostResult) -> List[RiskItem]:
    """
    检测成本风险
    """
    risks = []
    
    if recipe.target_per_cup_cost > 0:
        actual_cost = cost_result.per_cup_cost
        target_cost = recipe.target_per_cup_cost
        
        if actual_cost > target_cost:
            over_ratio = (actual_cost - target_cost) / target_cost * 100
            level = 'high' if over_ratio > 20 else 'medium'
            
            risks.append(RiskItem(
                level=level,
                category='cost',
                message=f"单杯成本 ({actual_cost:.2f}) 超出目标 ({target_cost:.2f}) {over_ratio:.1f}%",
                details={
                    'actual_cost': round(actual_cost, 4),
                    'target_cost': target_cost,
                    'over_ratio': round(over_ratio, 2)
                }
            ))
        elif actual_cost > target_cost * 0.9:
            close_ratio = actual_cost / target_cost * 100
            risks.append(RiskItem(
                level='low',
                category='cost',
                message=f"单杯成本 ({actual_cost:.2f}) 接近目标 ({target_cost:.2f})，成本控制良好",
                details={
                    'actual_cost': round(actual_cost, 4),
                    'target_cost': target_cost,
                    'ratio': round(close_ratio, 2)
                }
            ))
    
    return risks


def _detect_material_balance_risks(recipe: Recipe) -> List[RiskItem]:
    """
    检测物料平衡风险
    """
    risks = []
    
    wax_ingredients = [ing for ing in recipe.ingredients if ing.ingredient and ing.ingredient.type == IngredientType.WAX]
    fragrance_ingredients = [ing for ing in recipe.ingredients if ing.ingredient and ing.ingredient.type == IngredientType.FRAGRANCE]
    
    if not wax_ingredients:
        risks.append(RiskItem(
            level='high',
            category='material_balance',
            message="配方中没有蜡基原料，这是蜡烛的基础成分",
            details={}
        ))
    
    if not fragrance_ingredients:
        risks.append(RiskItem(
            level='medium',
            category='material_balance',
            message="配方中没有香精原料，这将是无香蜡烛",
            details={}
        ))
    
    return risks


def _detect_unit_risks(recipe: Recipe) -> List[RiskItem]:
    """
    检测单位使用风险
    """
    risks = []
    
    mixed_units = set()
    for ing in recipe.ingredients:
        mixed_units.add(ing.unit.lower())
    
    if len(mixed_units) > 2:
        risks.append(RiskItem(
            level='low',
            category='unit_consistency',
            message=f"配方中使用了多种单位: {', '.join(mixed_units)}，建议统一单位以减少误差",
            details={
                'units_used': list(mixed_units)
            }
        ))
    
    return risks
