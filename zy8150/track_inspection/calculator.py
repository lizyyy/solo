from typing import Dict, List, Any, Tuple

from .models import SampledPoint, Violation


def get_threshold(
    indicator: str,
    section_type: str,
    rules: Dict[str, Any],
    curve_radius: float = None
) -> Dict[str, float]:
    """
    获取指标的超限阈值
    
    曲线段阈值不同于直线段
    """
    base_thresholds = rules['thresholds'].get(indicator, {})
    
    if section_type == 'curve' and 'curve' in base_thresholds:
        return base_thresholds['curve']
    else:
        return base_thresholds.get('straight', base_thresholds)


def calculate_deviation(
    value: float,
    threshold: Dict[str, float],
    indicator: str
) -> Tuple[float, float]:
    """
    计算偏差值和超限方向
    
    返回: (绝对偏差值, 超限方向对应的阈值基准)
    """
    if indicator in ['track_gauge', 'level']:
        nominal = threshold.get('nominal', 0)
        tolerance_plus = threshold.get('tolerance_plus', 0)
        tolerance_minus = threshold.get('tolerance_minus', 0)
        
        upper_limit = nominal + tolerance_plus
        lower_limit = nominal - tolerance_minus
        
        if value > upper_limit:
            return abs(value - upper_limit), upper_limit
        elif value < lower_limit:
            return abs(value - lower_limit), lower_limit
        return 0.0, nominal
    else:
        max_allow = threshold.get('max', 0)
        if abs(value) > max_allow:
            return abs(value) - max_allow, max_allow
        return 0.0, max_allow


def determine_violation_level(
    deviation: float,
    indicator: str,
    section_type: str,
    rules: Dict[str, Any]
) -> Tuple[str, int]:
    """
    根据偏差值确定超限等级和扣分数
    
    等级: 轻微、一般、严重
    扣分: 根据规则计算
    """
    scoring = rules.get('scoring', {})
    indicator_scoring = scoring.get(indicator, {})
    
    if section_type == 'curve' and 'curve' in indicator_scoring:
        level_config = indicator_scoring['curve']
    else:
        level_config = indicator_scoring.get('straight', indicator_scoring)
    
    minor_threshold = level_config.get('minor', {}).get('threshold', 0)
    general_threshold = level_config.get('general', {}).get('threshold', 0)
    severe_threshold = level_config.get('severe', {}).get('threshold', 0)
    
    if deviation >= severe_threshold:
        return '严重', level_config.get('severe', {}).get('score', 20)
    elif deviation >= general_threshold:
        return '一般', level_config.get('general', {}).get('score', 10)
    elif deviation >= minor_threshold:
        return '轻微', level_config.get('minor', {}).get('score', 5)
    
    return '无', 0


def calculate_violations(
    sampled_points: List[SampledPoint],
    rules: Dict[str, Any]
) -> List[Violation]:
    """
    计算所有采样点的超限情况
    
    检查指标:
    - track_gauge: 轨距
    - level: 水平
    - alignment: 轨向 (左右最大值)
    - profile: 高低 (左右最大值)
    """
    violations = []
    indicators = ['track_gauge', 'level', 'alignment', 'profile']
    
    for point in sampled_points:
        for indicator in indicators:
            threshold = get_threshold(
                indicator,
                point.section_type,
                rules,
                point.curve_radius
            )
            
            if indicator == 'track_gauge':
                value = point.track_gauge
            elif indicator == 'level':
                value = point.level
            elif indicator == 'alignment':
                value = point.alignment
            else:
                value = point.profile
            
            deviation, limit = calculate_deviation(value, threshold, indicator)
            
            if deviation > 0:
                level, score = determine_violation_level(
                    deviation,
                    indicator,
                    point.section_type,
                    rules
                )
                
                violation = Violation(
                    mileage=point.mileage,
                    indicator=indicator,
                    value=value,
                    threshold=limit,
                    deviation=deviation,
                    score=score,
                    level=level,
                    section_type=point.section_type
                )
                violations.append(violation)
    
    violations.sort(key=lambda v: (v.mileage, v.indicator))
    return violations
