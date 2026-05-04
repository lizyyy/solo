"""单位换算模块 - 处理 EC、ppm、体积等单位转换"""
from typing import Dict, Tuple, Optional
import math


EC_CONVERSION_FACTORS = {
    'mS/cm': {'mS/cm': 1.0, 'dS/m': 1.0, 'μS/cm': 1000.0, 'ppm': 500.0},
    'dS/m': {'mS/cm': 1.0, 'dS/m': 1.0, 'μS/cm': 1000.0, 'ppm': 500.0},
    'μS/cm': {'mS/cm': 0.001, 'dS/m': 0.001, 'μS/cm': 1.0, 'ppm': 0.5},
    'ppm': {'mS/cm': 0.002, 'dS/m': 0.002, 'μS/cm': 2.0, 'ppm': 1.0},
}

VOLUME_CONVERSION_FACTORS = {
    'L': {'L': 1.0, 'mL': 1000.0, 'm³': 0.001, 'gal': 0.264172, 'qt': 1.05669},
    'mL': {'L': 0.001, 'mL': 1.0, 'm³': 0.000001, 'gal': 0.000264172, 'qt': 0.00105669},
    'm³': {'L': 1000.0, 'mL': 1000000.0, 'm³': 1.0, 'gal': 264.172, 'qt': 1056.69},
    'gal': {'L': 3.78541, 'mL': 3785.41, 'm³': 0.00378541, 'gal': 1.0, 'qt': 4.0},
    'qt': {'L': 0.946353, 'mL': 946.353, 'm³': 0.000946353, 'gal': 0.25, 'qt': 1.0},
}

VALID_EC_UNITS = {'mS/cm', 'dS/m', 'μS/cm', 'ppm'}
VALID_VOLUME_UNITS = {'L', 'mL', 'm³', 'gal', 'qt'}
VALID_PH_RANGE = (0.0, 14.0)
VALID_EC_RANGE = (0.0, 20.0)


def convert_ec(value: float, from_unit: str, to_unit: str) -> float:
    """
    转换 EC 单位
    
    注意: ppm 转换使用标准的 1 mS/cm = 500 ppm 近似值
    不同营养液配方的实际转换因子可能略有差异
    """
    if from_unit == to_unit:
        return value
    
    if from_unit not in EC_CONVERSION_FACTORS:
        raise ValueError(f"未知的 EC 单位: {from_unit}")
    
    if to_unit not in EC_CONVERSION_FACTORS[from_unit]:
        raise ValueError(f"不支持从 {from_unit} 转换到 {to_unit}")
    
    return value * EC_CONVERSION_FACTORS[from_unit][to_unit]


def convert_volume(value: float, from_unit: str, to_unit: str) -> float:
    """转换体积单位"""
    if from_unit == to_unit:
        return value
    
    if from_unit not in VOLUME_CONVERSION_FACTORS:
        raise ValueError(f"未知的体积单位: {from_unit}")
    
    if to_unit not in VOLUME_CONVERSION_FACTORS[from_unit]:
        raise ValueError(f"不支持从 {from_unit} 转换到 {to_unit}")
    
    return value * VOLUME_CONVERSION_FACTORS[from_unit][to_unit]


def normalize_ec_to_ms(value: float, unit: str) -> float:
    """将任意 EC 单位归一化为 mS/cm"""
    return convert_ec(value, unit, 'mS/cm')


def normalize_volume_to_liters(value: float, unit: str) -> float:
    """将任意体积单位归一化为升 (L)"""
    return convert_volume(value, unit, 'L')


def validate_ph(value: float) -> Tuple[bool, Optional[str]]:
    """
    验证 pH 值是否在合理范围内
    返回 (是否有效, 错误信息)
    """
    if not VALID_PH_RANGE[0] <= value <= VALID_PH_RANGE[1]:
        return False, f"pH 值 {value} 超出有效范围 ({VALID_PH_RANGE[0]}-{VALID_PH_RANGE[1]})"
    return True, None


def validate_ec(value: float, unit: str) -> Tuple[bool, Optional[str]]:
    """
    验证 EC 值是否在合理范围内
    返回 (是否有效, 错误信息)
    """
    if unit not in VALID_EC_UNITS:
        return False, f"未知的 EC 单位: {unit}，有效单位: {VALID_EC_UNITS}"
    
    ec_ms = normalize_ec_to_ms(value, unit)
    
    if not VALID_EC_RANGE[0] <= ec_ms <= VALID_EC_RANGE[1]:
        return False, f"EC 值 {value} {unit} (约 {ec_ms:.2f} mS/cm) 超出有效范围"
    
    return True, None


def validate_volume(value: float, unit: str) -> Tuple[bool, Optional[str]]:
    """
    验证体积值是否合理
    返回 (是否有效, 错误信息)
    """
    if unit not in VALID_VOLUME_UNITS:
        return False, f"未知的体积单位: {unit}，有效单位: {VALID_VOLUME_UNITS}"
    
    if value < 0:
        return False, f"体积值 {value} {unit} 不能为负数"
    
    return True, None


def calculate_target_volume(current_volume: float, target_volume: float, max_capacity: float) -> Tuple[float, float]:
    """
    计算需要补充/排放的体积
    返回 (需要补充的体积, 需要排放的体积)
    """
    if current_volume < target_volume:
        # 需要补水
        add_volume = min(target_volume - current_volume, max_capacity - current_volume)
        return add_volume, 0.0
    elif current_volume > target_volume:
        # 需要排水
        drain_volume = current_volume - target_volume
        return 0.0, drain_volume
    else:
        return 0.0, 0.0


def calculate_dilution_factor(
    current_ec: float,  # mS/cm
    current_volume: float,  # L
    target_ec: float,  # mS/cm
    max_capacity: float  # L
) -> Dict:
    """
    计算稀释 EC 所需的补水量
    当 EC 过高时，通过补水稀释
    """
    if current_ec <= target_ec:
        return {'add_water': 0.0, 'new_ec': current_ec}
    
    # C1*V1 = C2*V2
    # V2 = C1*V1 / C2
    target_volume = (current_ec * current_volume) / target_ec
    add_water = target_volume - current_volume
    
    # 不能超过最大容量
    if target_volume > max_capacity:
        # 无法仅通过补水达到目标 EC
        add_water = max_capacity - current_volume
        new_ec = (current_ec * current_volume) / max_capacity
        return {
            'add_water': add_water,
            'new_ec': new_ec,
            'target_unreachable': True,
            'message': f"无法仅通过补水将 EC 从 {current_ec:.2f} 降到 {target_ec:.2f}，需要部分换液"
        }
    
    return {
        'add_water': add_water,
        'new_ec': target_ec,
        'target_unreachable': False
    }


def calculate_nutrient_addition(
    current_ec: float,  # mS/cm
    current_volume: float,  # L
    target_ec: float,  # mS/cm
    a_concentration: float,  # A液每毫升增加的 EC (mS/cm per mL in 1L)
    b_concentration: float  # B液每毫升增加的 EC (mS/cm per mL in 1L)
) -> Dict:
    """
    计算需要添加的 A/B 营养液体积
    假设 A/B 液按 1:1 比例添加
    """
    if current_ec >= target_ec:
        return {'add_a_ml': 0.0, 'add_b_ml': 0.0, 'new_ec': current_ec}
    
    ec_deficit = target_ec - current_ec
    
    # 假设 A/B 液贡献相同，按 1:1 比例
    # 每毫升 A+B 液在 1L 水中增加 (a_concentration + b_concentration) mS/cm
    # 但实际上营养液是浓缩的，需要按配方说明
    # 这里简化为：每增加 1 mS/cm，需要 x 毫升 A 和 x 毫升 B 液
    # 假设 a_concentration 是每 mL A 液在 1L 中增加的 EC
    
    # 简化模型：假设需要达到的 EC 差 = 目标 - 当前
    # 每升水中每 mL A 液增加 a_concentration mS/cm
    # 所以总体积下需要的 A 液量 = ec_deficit * current_volume / a_concentration
    
    if a_concentration <= 0 or b_concentration <= 0:
        return {
            'add_a_ml': 0.0,
            'add_b_ml': 0.0,
            'new_ec': current_ec,
            'error': "营养液浓度参数无效"
        }
    
    # 按 1:1 比例，取较小的贡献值（保守计算）
    # 实际上应该根据配方精确计算
    # 这里假设 A 和 B 液贡献相等
    
    # 简单模型：目标 EC 增量 = (A液量 * a_concentration + B液量 * b_concentration) / 总体积
    # 假设 A = B = x
    # ec_delta = x * (a_concentration + b_concentration) / total_volume
    
    total_volume = current_volume
    ec_delta = target_ec - current_ec
    
    x = (ec_delta * total_volume) / (a_concentration + b_concentration)
    
    new_ec = current_ec + (x * (a_concentration + b_concentration)) / total_volume
    
    return {
        'add_a_ml': max(0.0, x),
        'add_b_ml': max(0.0, x),
        'new_ec': new_ec,
        'ec_delta': ec_delta
    }


def calculate_ph_adjustment(
    current_ph: float,
    target_ph: float,
    volume: float,  # L
    acid_strength: float = 0.1,  # 酸的浓度 (假设 0.1 M)
    base_strength: float = 0.1  # 碱的浓度 (假设 0.1 M)
) -> Dict:
    """
    估算 pH 调整所需的酸/碱量
    这是一个简化的估算模型，实际值受缓冲能力影响很大
    
    注意：这只是估算值，实际操作中应少量多次添加并测试
    """
    if math.isclose(current_ph, target_ph, abs_tol=0.1):
        return {'add_acid_ml': 0.0, 'add_base_ml': 0.0, 'reason': 'pH 已在目标范围内'}
    
    ph_delta = target_ph - current_ph
    
    # 简化模型：基于水的离子积和缓冲能力估算
    # 实际营养液有缓冲能力，这只是粗略估计
    
    if ph_delta < 0:
        # 需要加酸
        # 粗略估算：每升水降低 1 pH 约需 0.1 mL 浓酸（非常粗略）
        # 这里用更保守的估算
        acid_ml = volume * abs(ph_delta) * 0.5  # 每升每 pH 单位 0.5 mL 稀酸
        return {
            'add_acid_ml': round(acid_ml, 2),
            'add_base_ml': 0.0,
            'warning': '这只是估算值，请少量多次添加并测试 pH',
            'method': '逐步添加，每次测试'
        }
    else:
        # 需要加碱
        base_ml = volume * ph_delta * 0.5
        return {
            'add_acid_ml': 0.0,
            'add_base_ml': round(base_ml, 2),
            'warning': '这只是估算值，请少量多次添加并测试 pH',
            'method': '逐步添加，每次测试'
        }
