from typing import Dict, List, Any, Tuple
from collections import defaultdict

from .models import Violation, DefectSegment


def merge_defects(
    violations: List[Violation],
    sample_interval: float = 0.002,
    merge_gap: float = 0.01
) -> List[DefectSegment]:
    """
    将连续超限点合并成病害段
    
    参数:
        violations: 超限列表
        sample_interval: 采样间隔（公里）
        merge_gap: 合并间隔，超过此间隔则认为是新病害段
    
    合并规则:
        1. 按里程顺序处理超限点
        2. 同一指标的连续超限进行合并
        3. 不同指标在同一里程范围内的超限也合并到同一病害段
    """
    if not violations:
        return []
    
    violations.sort(key=lambda v: (v.mileage, v.indicator))
    
    mileage_groups = defaultdict(list)
    for v in violations:
        rounded_mileage = round(v.mileage / sample_interval) * sample_interval
        mileage_groups[rounded_mileage].append(v)
    
    sorted_mileages = sorted(mileage_groups.keys())
    
    segments = []
    current_segment = None
    
    for mileage in sorted_mileages:
        violations_at_mileage = mileage_groups[mileage]
        
        if current_segment is None:
            current_segment = {
                'start_mileage': mileage,
                'end_mileage': mileage,
                'violations': violations_at_mileage
            }
        else:
            gap = mileage - current_segment['end_mileage']
            
            if gap <= merge_gap:
                current_segment['end_mileage'] = mileage
                current_segment['violations'].extend(violations_at_mileage)
            else:
                defect = create_defect_segment(current_segment)
                segments.append(defect)
                
                current_segment = {
                    'start_mileage': mileage,
                    'end_mileage': mileage,
                    'violations': violations_at_mileage
                }
    
    if current_segment:
        defect = create_defect_segment(current_segment)
        segments.append(defect)
    
    for segment in segments:
        segment.priority = calculate_priority(segment)
    
    segments.sort(key=lambda s: (
        {'紧急': 0, '高': 1, '中': 2, '低': 3}[s.priority],
        -s.total_score,
        s.start_mileage
    ))
    
    return segments


def create_defect_segment(segment_data: Dict[str, Any]) -> DefectSegment:
    """从临时数据结构创建病害段"""
    violations = segment_data['violations']
    
    indicators = list(set(v.indicator for v in violations))
    indicators.sort()
    
    total_score = sum(v.score for v in violations)
    max_score = max(v.score for v in violations)
    
    section_types = list(set(v.section_type for v in violations))
    section_type = section_types[0] if len(section_types) == 1 else 'mixed'
    
    max_level = '轻微'
    for v in violations:
        if v.level == '严重':
            max_level = '严重'
            break
        elif v.level == '一般' and max_level == '轻微':
            max_level = '一般'
    
    length = segment_data['end_mileage'] - segment_data['start_mileage']
    
    return DefectSegment(
        start_mileage=segment_data['start_mileage'],
        end_mileage=segment_data['end_mileage'],
        length=length,
        indicators=indicators,
        total_score=total_score,
        max_score=max_score,
        priority='未评估',
        section_type=section_type,
        level=max_level
    )


def calculate_priority(segment: DefectSegment) -> str:
    """
    计算维修优先级
    
    优先级规则:
        紧急: 严重超限 + 长度超过50米 或 扣分超过50分
        高: 一般/严重超限 + 长度超过20米 或 扣分超过30分
        中: 轻微/一般超限 + 长度超过10米 或 扣分超过15分
        低: 其他情况
    """
    length_m = segment.length * 1000
    
    if segment.level == '严重':
        if length_m > 50 or segment.total_score > 50:
            return '紧急'
        return '高'
    elif segment.level == '一般':
        if length_m > 20 or segment.total_score > 30:
            return '高'
        elif length_m > 10 or segment.total_score > 15:
            return '中'
        return '低'
    else:
        if length_m > 10 or segment.total_score > 15:
            return '中'
        return '低'
