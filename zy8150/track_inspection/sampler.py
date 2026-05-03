import bisect
from typing import List, Tuple, Optional

from .models import TrackSection, GeometryPoint, SampledPoint


def find_section_at_mileage(
    mileage: float,
    sections: List[TrackSection]
) -> Optional[TrackSection]:
    """根据里程查找所属区间（处理跨区间里程跳变）"""
    for section in sections:
        if section.start_km <= mileage < section.end_km:
            return section
    for section in sections:
        if abs(mileage - section.start_km) < 0.001 or abs(mileage - section.end_km) < 0.001:
            return section
    return None


def interpolate_value(
    x: float,
    x1: float, y1: float,
    x2: float, y2: float
) -> float:
    """线性插值"""
    if abs(x1 - x2) < 0.0001:
        return y1
    ratio = (x - x1) / (x2 - x1)
    return y1 + ratio * (y2 - y1)


def normalize_sampling(
    points: List[GeometryPoint],
    sections: List[TrackSection],
    sample_interval: float = 0.002,
    handle_jump: bool = True
) -> List[SampledPoint]:
    """
    按K里程归一采样点
    
    参数:
        points: 原始检测点列表
        sections: 轨道区间定义
        sample_interval: 采样间隔（公里），默认2米=0.002公里
        handle_jump: 是否处理跨区间里程跳变
    
    处理要点:
        1. 重复采样：同一里程可能有多个检测点，取平均值
        2. 跨区间里程跳变：识别区间边界并正确归属
    """
    if not points:
        return []
    
    deduped_points = dedupe_by_mileage(points)
    
    mileages = [p.mileage for p in deduped_points]
    min_mileage = mileages[0]
    max_mileage = mileages[-1]
    
    sampled_points = []
    
    current_mileage = round(min_mileage / sample_interval) * sample_interval
    if current_mileage < min_mileage:
        current_mileage += sample_interval
    
    while current_mileage <= max_mileage:
        idx = bisect.bisect_left(mileages, current_mileage)
        
        if idx == 0:
            point = deduped_points[0]
        elif idx >= len(deduped_points):
            point = deduped_points[-1]
        else:
            p_prev = deduped_points[idx - 1]
            p_curr = deduped_points[idx]
            
            track_gauge = interpolate_value(
                current_mileage, p_prev.mileage, p_prev.track_gauge,
                p_curr.mileage, p_curr.track_gauge
            )
            level = interpolate_value(
                current_mileage, p_prev.mileage, p_prev.level,
                p_curr.mileage, p_curr.level
            )
            alignment_left = interpolate_value(
                current_mileage, p_prev.mileage, p_prev.alignment_left,
                p_curr.mileage, p_curr.alignment_right
            )
            alignment_right = interpolate_value(
                current_mileage, p_prev.mileage, p_prev.alignment_right,
                p_curr.mileage, p_curr.alignment_right
            )
            profile_left = interpolate_value(
                current_mileage, p_prev.mileage, p_prev.profile_left,
                p_curr.mileage, p_curr.profile_left
            )
            profile_right = interpolate_value(
                current_mileage, p_prev.mileage, p_prev.profile_right,
                p_curr.mileage, p_curr.profile_right
            )
            
            alignment = max(abs(alignment_left), abs(alignment_right))
            profile = max(abs(profile_left), abs(profile_right))
            
            point = GeometryPoint(
                mileage=current_mileage,
                track_gauge=track_gauge,
                level=level,
                alignment_left=alignment_left,
                alignment_right=alignment_right,
                profile_left=profile_left,
                profile_right=profile_right
            )
            sampled_point = create_sampled_point(point, sections, current_mileage, alignment, profile)
            sampled_points.append(sampled_point)
            current_mileage += sample_interval
            continue
        
        alignment = max(abs(point.alignment_left), abs(point.alignment_right))
        profile = max(abs(point.profile_left), abs(point.profile_right))
        
        sampled_point = create_sampled_point(point, sections, current_mileage, alignment, profile)
        sampled_points.append(sampled_point)
        current_mileage += sample_interval
    
    return sampled_points


def dedupe_by_mileage(points: List[GeometryPoint]) -> List[GeometryPoint]:
    """处理重复采样：同一里程有多个检测点时取平均值"""
    from collections import defaultdict
    
    mileage_groups = defaultdict(list)
    for point in points:
        rounded_mileage = round(point.mileage, 5)
        mileage_groups[rounded_mileage].append(point)
    
    deduped = []
    for mileage in sorted(mileage_groups.keys()):
        group = mileage_groups[mileage]
        if len(group) == 1:
            deduped.append(group[0])
        else:
            avg_track_gauge = sum(p.track_gauge for p in group) / len(group)
            avg_level = sum(p.level for p in group) / len(group)
            avg_alignment_left = sum(p.alignment_left for p in group) / len(group)
            avg_alignment_right = sum(p.alignment_right for p in group) / len(group)
            avg_profile_left = sum(p.profile_left for p in group) / len(group)
            avg_profile_right = sum(p.profile_right for p in group) / len(group)
            
            deduped.append(GeometryPoint(
                mileage=mileage,
                track_gauge=avg_track_gauge,
                level=avg_level,
                alignment_left=avg_alignment_left,
                alignment_right=avg_alignment_right,
                profile_left=avg_profile_left,
                profile_right=avg_profile_right
            ))
    
    return deduped


def create_sampled_point(
    point: GeometryPoint,
    sections: List[TrackSection],
    mileage: float,
    alignment: float,
    profile: float
) -> SampledPoint:
    """创建采样点并确定所属区间类型"""
    section = find_section_at_mileage(mileage, sections)
    
    if section:
        return SampledPoint(
            mileage=mileage,
            track_gauge=point.track_gauge,
            level=point.level,
            alignment=alignment,
            profile=profile,
            section_type=section.section_type,
            curve_direction=section.curve_direction,
            curve_radius=section.curve_radius
        )
    else:
        return SampledPoint(
            mileage=mileage,
            track_gauge=point.track_gauge,
            level=point.level,
            alignment=alignment,
            profile=profile,
            section_type='unknown'
        )
