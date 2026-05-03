"""缓冲液配方求解模块 - Henderson-Hasselbalch方程计算"""

import math
from typing import List, Optional, Tuple, Dict, Any

from .models import (
    BufferSystem,
    BufferRecipe,
    StockSolution,
)


def calculate_pka_temperature_correction(
    pka_25: float,
    temperature: float,
    delta_h: Optional[float] = None,
) -> float:
    """
    计算温度校正后的pKa值
    
    使用van't Hoff方程进行近似校正：
    pKa(T) = pKa(25°C) + (ΔH° / (2.303 * R)) * (1/T - 1/298.15)
    
    Args:
        pka_25: 25°C时的pKa值
        temperature: 目标温度 (°C)
        delta_h: 焓变 (kJ/mol)，如果未提供则使用近似值
    
    Returns:
        校正后的pKa值
    """
    if abs(temperature - 25.0) < 0.1:
        return pka_25
    
    T = temperature + 273.15
    T_ref = 298.15
    
    R = 8.314
    
    if delta_h is None:
        if pka_25 < 3:
            delta_h = -5000
        elif pka_25 < 7:
            delta_h = 0
        else:
            delta_h = 5000
    
    ln_factor = delta_h * (1 / T - 1 / T_ref) / (R * math.log(10))
    
    pka_corrected = pka_25 + ln_factor
    
    return pka_corrected


def henderson_hasselbalch(
    ph: float,
    pka: float,
) -> Tuple[float, float]:
    """
    使用Henderson-Hasselbalch方程计算酸碱比例
    
    pH = pKa + log([A-]/[HA])
    => [A-]/[HA] = 10^(pH - pKa)
    
    Args:
        ph: 目标pH值
        pka: 酸的pKa值
    
    Returns:
        (酸的比例, 碱的比例) - 总和为1.0
    """
    ratio = math.pow(10, ph - pka)
    
    total = 1 + ratio
    acid_ratio = 1 / total
    base_ratio = ratio / total
    
    return acid_ratio, base_ratio


def calculate_buffer_capacity(
    acid_concentration: float,
    base_concentration: float,
    ph: float,
    pka: float,
) -> float:
    """
    计算缓冲容量
    
    β = 2.303 * [HA] * [A-] / ([HA] + [A-])
    
    简化公式（假设总浓度为c_total = [HA] + [A-]）：
    β = 2.303 * c_total * (10^(pH-pKa) / (1 + 10^(pH-pKa))^2)
    
    Args:
        acid_concentration: 酸的浓度 (mol/L)
        base_concentration: 碱的浓度 (mol/L)
        ph: 溶液pH值
        pka: 酸的pKa值
    
    Returns:
        缓冲容量 β (mol/(L·pH))
    """
    c_total = acid_concentration + base_concentration
    
    if c_total < 1e-10:
        return 0.0
    
    ph_diff = ph - pka
    ratio = math.pow(10, ph_diff)
    
    beta = 2.303 * c_total * ratio / math.pow(1 + ratio, 2)
    
    return beta


def estimate_buffer_range(pka: float) -> Tuple[float, float]:
    """
    估算缓冲液的有效pH范围
    
    通常缓冲液的有效范围是 pKa ± 1
    
    Args:
        pka: 酸的pKa值
    
    Returns:
        (最小有效pH, 最大有效pH)
    """
    return (pka - 1.0, pka + 1.0)


def select_optimal_pka(pka_list: List[float], target_ph: float) -> float:
    """
    从多个pKa值中选择最适合目标pH的pKa
    
    Args:
        pka_list: pKa值列表
        target_ph: 目标pH值
    
    Returns:
        最接近目标pH的pKa值
    """
    if not pka_list:
        return 7.0
    
    best_pka = pka_list[0]
    min_distance = abs(best_pka - target_ph)
    
    for pka in pka_list:
        distance = abs(pka - target_ph)
        if distance < min_distance:
            min_distance = distance
            best_pka = pka
    
    return best_pka


def calculate_buffer_recipe(
    target_ph: float,
    target_volume: float,
    buffer_system: BufferSystem,
    temperature: float = 25.0,
    total_concentration: Optional[float] = None,
) -> BufferRecipe:
    """
    计算缓冲液配方
    
    Args:
        target_ph: 目标pH值
        target_volume: 目标体积 (mL)
        buffer_system: 缓冲体系
        temperature: 温度 (°C)
        total_concentration: 总浓度 (mol/L)，如未提供则使用母液浓度
    
    Returns:
        BufferRecipe对象，包含完整的配方信息
    """
    warnings: List[str] = []
    is_outside_optimal = False
    
    acid = buffer_system.acid
    base = buffer_system.base
    
    pka_list = acid.pka or [7.0]
    effective_pka = select_optimal_pka(pka_list, target_ph)
    
    if abs(temperature - 25.0) > 0.5:
        effective_pka = calculate_pka_temperature_correction(effective_pka, temperature)
        warnings.append(f"已应用温度校正: pKa从{acid.pka[0] if acid.pka else 'N/A':.2f}调整为{effective_pka:.2f}")
    
    ph_min, ph_max = estimate_buffer_range(effective_pka)
    
    if target_ph < ph_min or target_ph > ph_max:
        is_outside_optimal = True
        warnings.append(
            f"目标pH {target_ph:.2f} 超出最佳缓冲范围 (pKa±1: {ph_min:.2f}-{ph_max:.2f})，"
            f"缓冲能力可能较弱"
        )
    
    effective_ph_range = buffer_system.effective_ph_range
    if target_ph < effective_ph_range[0] or target_ph > effective_ph_range[1]:
        warnings.append(
            f"目标pH {target_ph:.2f} 超出该缓冲体系推荐的有效范围 "
            f"({effective_ph_range[0]:.2f}-{effective_ph_range[1]:.2f})"
        )
    
    acid_ratio, base_ratio = henderson_hasselbalch(target_ph, effective_pka)
    
    if total_concentration is None:
        acid_conc = acid.concentration
        base_conc = base.concentration
        
        total_conc = (acid_ratio * acid_conc + base_ratio * base_conc)
    else:
        total_conc = total_concentration
        acid_conc = acid.concentration
        base_conc = base.concentration
    
    target_volume_L = target_volume / 1000.0
    
    moles_acid = acid_ratio * total_conc * target_volume_L
    moles_base = base_ratio * total_conc * target_volume_L
    
    acid_volume = (moles_acid / acid_conc) * 1000 if acid_conc > 0 else 0
    base_volume = (moles_base / base_conc) * 1000 if base_conc > 0 else 0
    
    if acid_volume < 0:
        acid_volume = 0
        warnings.append("酸体积计算为负值，已设置为0")
    if base_volume < 0:
        base_volume = 0
        warnings.append("碱体积计算为负值，已设置为0")
    
    if acid_volume + base_volume > target_volume * 1.1:
        warnings.append(
            f"酸+碱体积 ({acid_volume + base_volume:.1f} mL) 接近或超过目标体积 ({target_volume} mL)，"
            f"可能需要使用更高浓度的母液"
        )
    
    acid_mass = None
    base_mass = None
    
    if acid.density and acid.purity:
        acid_mass = (moles_acid * acid.formula_weight) if hasattr(acid, 'formula_weight') else None
    elif acid.density:
        acid_mass = acid_volume * acid.density
    
    if base.density and base.purity:
        base_mass = (moles_base * base.formula_weight) if hasattr(base, 'formula_weight') else None
    elif base.density:
        base_mass = base_volume * base.density
    
    actual_acid_ratio = acid_volume / (acid_volume + base_volume) if (acid_volume + base_volume) > 0 else 0
    actual_base_ratio = base_volume / (acid_volume + base_volume) if (acid_volume + base_volume) > 0 else 0
    
    if actual_acid_ratio > 0:
        theoretical_ph = effective_pka + math.log10(actual_base_ratio / actual_acid_ratio)
    else:
        theoretical_ph = effective_pka + 3
    
    ph_deviation = abs(theoretical_ph - target_ph)
    
    if ph_deviation > 0.1:
        warnings.append(
            f"理论pH ({theoretical_ph:.2f}) 与目标pH ({target_ph:.2f}) 偏差较大 ({ph_deviation:.2f})，"
            f"建议使用pH计进行最终调整"
        )
    
    final_acid_conc = (moles_acid / target_volume_L) if target_volume_L > 0 else 0
    final_base_conc = (moles_base / target_volume_L) if target_volume_L > 0 else 0
    
    buffer_capacity = calculate_buffer_capacity(
        final_acid_conc,
        final_base_conc,
        target_ph,
        effective_pka,
    )
    
    min_capacity = 0.01
    if buffer_capacity < min_capacity:
        warnings.append(
            f"缓冲容量较低 ({buffer_capacity:.6f} mol/(L·pH))，"
            f"建议增加总浓度或选择更接近pKa的缓冲体系"
        )
    
    recipe = BufferRecipe(
        target_ph=target_ph,
        target_volume=target_volume,
        temperature=temperature,
        system_name=buffer_system.name,
        acid_volume=acid_volume,
        base_volume=base_volume,
        acid_mass=acid_mass,
        base_mass=base_mass,
        theoretical_ph=theoretical_ph,
        buffer_capacity=buffer_capacity,
        ph_deviation=ph_deviation,
        warnings=warnings,
        is_outside_optimal_range=is_outside_optimal,
    )
    
    return recipe


def validate_buffer_recipe(
    recipe: BufferRecipe,
    buffer_system: BufferSystem,
) -> Dict[str, Any]:
    """
    验证缓冲液配方的合理性
    
    Args:
        recipe: 缓冲液配方
        buffer_system: 缓冲体系
    
    Returns:
        验证结果字典
    """
    validation = {
        'valid': True,
        'errors': [],
        'warnings': [],
        'checks': [],
    }
    
    if recipe.acid_volume < 0 or recipe.base_volume < 0:
        validation['errors'].append("体积不能为负值")
        validation['valid'] = False
    
    if recipe.acid_volume == 0 and recipe.base_volume == 0:
        validation['errors'].append("酸和碱体积不能同时为0")
        validation['valid'] = False
    
    total_volume = recipe.acid_volume + recipe.base_volume
    if total_volume > recipe.target_volume:
        validation['warnings'].append(
            f"酸+碱体积 ({total_volume:.1f} mL) 超过目标体积 ({recipe.target_volume} mL)"
        )
    
    if recipe.ph_deviation > 0.5:
        validation['warnings'].append(
            f"pH偏差较大 ({recipe.ph_deviation:.2f})，建议重新评估"
        )
    
    if recipe.is_outside_optimal_range:
        validation['warnings'].append("目标pH在最佳缓冲范围之外")
    
    if recipe.buffer_capacity < 0.005:
        validation['warnings'].append("缓冲容量非常低")
    
    validation['checks'] = [
        {'name': '体积非负', 'passed': recipe.acid_volume >= 0 and recipe.base_volume >= 0},
        {'name': '总体积合理', 'passed': total_volume <= recipe.target_volume * 1.5},
        {'name': 'pH偏差可接受', 'passed': recipe.ph_deviation <= 0.3},
        {'name': '在最佳范围', 'passed': not recipe.is_outside_optimal_range},
        {'name': '缓冲容量充足', 'passed': recipe.buffer_capacity >= 0.01},
    ]
    
    return validation


def suggest_buffer_systems(
    target_ph: float,
    available_systems: Dict[str, BufferSystem],
    temperature: float = 25.0,
) -> List[Tuple[str, BufferSystem, float]]:
    """
    为目标pH推荐最合适的缓冲体系
    
    Args:
        target_ph: 目标pH值
        available_systems: 可用缓冲体系字典
        temperature: 温度 (°C)
    
    Returns:
        按适用性排序的 (体系名称, 缓冲体系, 与pKa距离) 列表
    """
    candidates = []
    
    for name, system in available_systems.items():
        pka_list = system.acid.pka or [7.0]
        best_pka = select_optimal_pka(pka_list, target_ph)
        
        if abs(temperature - 25.0) > 0.5:
            best_pka = calculate_pka_temperature_correction(best_pka, temperature)
        
        ph_min, ph_max = estimate_buffer_range(best_pka)
        in_range = ph_min <= target_ph <= ph_max
        
        eff_min, eff_max = system.effective_ph_range
        in_effective = eff_min <= target_ph <= eff_max
        
        distance = abs(best_pka - target_ph)
        
        score = distance
        if not in_range:
            score += 2.0
        if not in_effective:
            score += 1.0
        
        candidates.append((name, system, score, best_pka, in_range))
    
    candidates.sort(key=lambda x: x[2])
    
    return [(name, system, score) for name, system, score, _, _ in candidates]
