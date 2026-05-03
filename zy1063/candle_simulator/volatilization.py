import math
from typing import Dict, List, Tuple, Optional
from candle_simulator.models import (
    Recipe, Ingredient, RecipeIngredient,
    IngredientType, NoteType, VolatilizationResult, VolatilizationPoint
)
from candle_simulator.calculator import normalize_to_grams, CalculatorError


class VolatilizationError(Exception):
    """挥发模拟错误"""
    pass


DEFAULT_HALF_LIVES = {
    NoteType.TOP: 2.0,
    NoteType.MIDDLE: 8.0,
    NoteType.BASE: 24.0
}


def get_effective_half_life(ingredient: Ingredient) -> float:
    """
    获取原料的有效半衰期（小时）
    优先级：half_life > volatility_coefficient > 默认值
    """
    if ingredient.half_life is not None and ingredient.half_life > 0:
        return ingredient.half_life
    
    if ingredient.volatility_coefficient is not None and ingredient.volatility_coefficient > 0:
        return math.log(2) / ingredient.volatility_coefficient
    
    if ingredient.note_type is not None:
        return DEFAULT_HALF_LIVES.get(ingredient.note_type, 8.0)
    
    return 8.0


def calculate_intensity_at_time(
    initial_amount: float,
    half_life: float,
    time_hours: float
) -> float:
    """
    计算指定时间的强度
    使用指数衰减模型: intensity = initial * (1/2)^(time/half_life)
    """
    if half_life <= 0:
        return initial_amount
    
    decay_factor = math.pow(0.5, time_hours / half_life)
    return initial_amount * decay_factor


def get_fragrance_ingredients(recipe: Recipe) -> List[Tuple[RecipeIngredient, float, NoteType]]:
    """
    获取配方中的香精原料及其标准化用量和香调类型
    返回: [(原料, 用量(克), 香调类型), ...]
    """
    fragrances = []
    
    for ing in recipe.ingredients:
        if not ing.ingredient:
            continue
        
        if ing.ingredient.type != IngredientType.FRAGRANCE:
            continue
        
        if ing.ingredient.note_type is None:
            continue
        
        try:
            normalized_amount = normalize_to_grams(ing.amount, ing.unit)
            fragrances.append((ing, normalized_amount, ing.ingredient.note_type))
        except CalculatorError:
            continue
    
    return fragrances


def simulate_volatilization(
    recipe: Recipe,
    max_time_hours: float = 72.0,
    time_step: float = 1.0,
    intensity_threshold: float = 0.05
) -> VolatilizationResult:
    """
    模拟香调挥发过程
    
    Args:
        recipe: 配方对象
        max_time_hours: 最大模拟时间（小时）
        time_step: 时间步长（小时）
        intensity_threshold: 强度阈值（低于此值视为消散）
    
    Returns:
        VolatilizationResult: 挥发模拟结果
    """
    fragrances = get_fragrance_ingredients(recipe)
    
    if not fragrances:
        raise VolatilizationError("配方中没有可用于挥发模拟的香精原料（缺少香调分类）")
    
    top_fragrances = [(ing, amt) for ing, amt, note in fragrances if note == NoteType.TOP]
    middle_fragrances = [(ing, amt) for ing, amt, note in fragrances if note == NoteType.MIDDLE]
    base_fragrances = [(ing, amt) for ing, amt, note in fragrances if note == NoteType.BASE]
    
    total_top = sum(amt for _, amt in top_fragrances)
    total_middle = sum(amt for _, amt in middle_fragrances)
    total_base = sum(amt for _, amt in base_fragrances)
    total_fragrance = total_top + total_middle + total_base
    
    time_points = []
    t = 0.0
    
    while t <= max_time_hours:
        top_intensity = 0.0
        middle_intensity = 0.0
        base_intensity = 0.0
        
        for ing, amt in top_fragrances:
            half_life = get_effective_half_life(ing.ingredient)
            top_intensity += calculate_intensity_at_time(amt, half_life, t)
        
        for ing, amt in middle_fragrances:
            half_life = get_effective_half_life(ing.ingredient)
            middle_intensity += calculate_intensity_at_time(amt, half_life, t)
        
        for ing, amt in base_fragrances:
            half_life = get_effective_half_life(ing.ingredient)
            base_intensity += calculate_intensity_at_time(amt, half_life, t)
        
        total_intensity = top_intensity + middle_intensity + base_intensity
        
        dominant_notes = []
        if total_intensity > 0:
            if top_intensity >= middle_intensity and top_intensity >= base_intensity and top_intensity > 0:
                dominant_notes.append("前调")
            if middle_intensity >= top_intensity and middle_intensity >= base_intensity and middle_intensity > 0:
                dominant_notes.append("中调")
            if base_intensity >= top_intensity and base_intensity >= middle_intensity and base_intensity > 0:
                dominant_notes.append("后调")
        
        normalized_top = top_intensity / total_fragrance if total_fragrance > 0 else 0
        normalized_middle = middle_intensity / total_fragrance if total_fragrance > 0 else 0
        normalized_base = base_intensity / total_fragrance if total_fragrance > 0 else 0
        normalized_total = total_intensity / total_fragrance if total_fragrance > 0 else 0
        
        time_points.append(VolatilizationPoint(
            time_hours=round(t, 2),
            top_intensity=round(normalized_top, 4),
            middle_intensity=round(normalized_middle, 4),
            base_intensity=round(normalized_base, 4),
            total_intensity=round(normalized_total, 4),
            dominant_notes=dominant_notes
        ))
        
        t += time_step
    
    longevity_hours = 0.0
    top_duration_hours = 0.0
    middle_duration_hours = 0.0
    base_duration_hours = 0.0
    base_note_gap = False
    base_gap_start_hours = None
    
    found_top_end = False
    found_middle_end = False
    found_base_end = False
    found_longevity_end = False
    
    for i, point in enumerate(time_points):
        if not found_top_end and point.top_intensity < intensity_threshold:
            top_duration_hours = point.time_hours
            found_top_end = True
        
        if not found_middle_end and point.middle_intensity < intensity_threshold:
            middle_duration_hours = point.time_hours
            found_middle_end = True
        
        if not found_base_end and point.base_intensity < intensity_threshold:
            base_duration_hours = point.time_hours
            found_base_end = True
        
        if not found_longevity_end and point.total_intensity < intensity_threshold:
            longevity_hours = point.time_hours
            found_longevity_end = True
        
        if i > 0 and not base_note_gap:
            prev_point = time_points[i-1]
            if prev_point.middle_intensity >= intensity_threshold and point.middle_intensity < intensity_threshold:
                if point.base_intensity < intensity_threshold * 2:
                    base_note_gap = True
                    base_gap_start_hours = point.time_hours
    
    if not found_top_end:
        top_duration_hours = max_time_hours
    if not found_middle_end:
        middle_duration_hours = max_time_hours
    if not found_base_end:
        base_duration_hours = max_time_hours
    if not found_longevity_end:
        longevity_hours = max_time_hours
    
    scent_score = calculate_scent_score(
        total_top, total_middle, total_base,
        top_duration_hours, middle_duration_hours, base_duration_hours,
        longevity_hours, base_note_gap
    )
    
    return VolatilizationResult(
        time_points=time_points,
        longevity_hours=round(longevity_hours, 1),
        top_duration_hours=round(top_duration_hours, 1),
        middle_duration_hours=round(middle_duration_hours, 1),
        base_duration_hours=round(base_duration_hours, 1),
        scent_score=round(scent_score, 2),
        base_note_gap=base_note_gap,
        base_gap_start_hours=round(base_gap_start_hours, 1) if base_gap_start_hours else None
    )


def calculate_scent_score(
    total_top: float,
    total_middle: float,
    total_base: float,
    top_duration: float,
    middle_duration: float,
    base_duration: float,
    longevity: float,
    base_gap: bool
) -> float:
    """
    计算留香评分（0-100分）
    """
    total = total_top + total_middle + total_base
    if total <= 0:
        return 0.0
    
    top_ratio = total_top / total
    middle_ratio = total_middle / total
    base_ratio = total_base / total
    
    balance_score = 0.0
    if top_ratio > 0 and middle_ratio > 0 and base_ratio > 0:
        ideal_ratio = 1/3
        ratio_deviation = (
            abs(top_ratio - ideal_ratio) +
            abs(middle_ratio - ideal_ratio) +
            abs(base_ratio - ideal_ratio)
        ) / 3
        balance_score = max(0, 30 * (1 - ratio_deviation * 2))
    else:
        balance_score = 10 if any(r > 0 for r in [top_ratio, middle_ratio, base_ratio]) else 0
    
    duration_score = 0.0
    if longevity >= 48:
        duration_score = 30
    elif longevity >= 24:
        duration_score = 25
    elif longevity >= 12:
        duration_score = 20
    elif longevity >= 6:
        duration_score = 15
    else:
        duration_score = 10
    
    progression_score = 0.0
    if base_duration > middle_duration and middle_duration > top_duration:
        progression_score = 25
    elif base_duration >= middle_duration >= top_duration:
        progression_score = 20
    elif base_duration > 0 and middle_duration > 0:
        progression_score = 15
    else:
        progression_score = 5
    
    gap_penalty = 15 if base_gap else 0
    
    total_score = balance_score + duration_score + progression_score - gap_penalty
    
    return max(0, min(100, total_score))


def get_note_distribution(recipe: Recipe) -> Dict[str, float]:
    """
    获取配方中各香调的分布比例
    """
    fragrances = get_fragrance_ingredients(recipe)
    
    if not fragrances:
        return {"前调": 0, "中调": 0, "后调": 0}
    
    total = sum(amt for _, amt, _ in fragrances)
    
    top = sum(amt for _, amt, note in fragrances if note == NoteType.TOP)
    middle = sum(amt for _, amt, note in fragrances if note == NoteType.MIDDLE)
    base = sum(amt for _, amt, note in fragrances if note == NoteType.BASE)
    
    if total == 0:
        return {"前调": 0, "中调": 0, "后调": 0}
    
    return {
        "前调": round(top / total * 100, 1),
        "中调": round(middle / total * 100, 1),
        "后调": round(base / total * 100, 1)
    }
