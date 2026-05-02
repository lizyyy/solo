"""烧成计划CSV解析器"""

from pathlib import Path
from typing import Dict, Any

import pandas as pd

from kiln_validator.models import FiringPlan, FiringSegment, SegmentType


def parse_firing_plan_csv(csv_path: Path) -> FiringPlan:
    """
    从CSV文件解析烧成计划
    
    CSV格式支持两种：
    1. 简化格式：segment_type, name, start_temp_c, end_temp_c, duration_min
    2. 扩展格式：包含plan_name, plan_description, firing_type等元数据列

    列名大小写不敏感，支持别名：
    - type / segment_type
    - start_temp / start_temp_c / start_temperature / start_temperature_c
    - end_temp / end_temp_c / end_temperature / end_temperature_c
    - duration / duration_min / minutes
    """
    df = pd.read_csv(csv_path)
    df.columns = [c.strip().lower() for c in df.columns]
    
    metadata = _extract_plan_metadata(df)
    segments = _parse_segments(df)
    
    return FiringPlan(
        name=metadata.get("plan_name", "未命名计划"),
        description=metadata.get("plan_description", ""),
        firing_type=metadata.get("firing_type", "素烧"),
        segments=segments,
    )


def _extract_plan_metadata(df: pd.DataFrame) -> Dict[str, Any]:
    """从DataFrame提取计划元数据（如果有）"""
    metadata = {}
    
    for col in ["plan_name", "planname", "名称", "计划名称"]:
        if col in df.columns:
            val = df[col].dropna().iloc[0] if not df[col].dropna().empty else None
            if val:
                metadata["plan_name"] = str(val)
                break
    
    for col in ["plan_description", "description", "描述", "计划描述"]:
        if col in df.columns:
            val = df[col].dropna().iloc[0] if not df[col].dropna().empty else ""
            metadata["plan_description"] = str(val)
            break
    
    for col in ["firing_type", "type", "烧成类型", "类型"]:
        if col in df.columns:
            val = df[col].dropna().iloc[0] if not df[col].dropna().empty else None
            if val:
                metadata["firing_type"] = str(val)
                break
    
    return metadata


def _parse_segments(df: pd.DataFrame) -> list[FiringSegment]:
    """解析烧成段"""
    segments = []
    
    for idx, row in df.iterrows():
        try:
            segment = _parse_single_segment(row, idx)
            if segment:
                segments.append(segment)
        except (ValueError, KeyError) as e:
            continue
    
    if not segments:
        raise ValueError("无法从CSV解析到任何有效的烧成段")
    
    return segments


def _parse_single_segment(row: pd.Series, row_idx: int) -> FiringSegment | None:
    """解析单行成段"""
    
    seg_type = _parse_segment_type(row)
    if seg_type is None:
        return None
    
    name = _get_column_value(
        row,
        ["name", "segment_name", "名称", "段名称", "段名"],
        default=f"段_{row_idx + 1}",
    )
    
    start_temp = _get_temperature_value(
        row,
        ["start_temp", "start_temp_c", "start_temperature", "start_temperature_c", "起始温度"],
    )
    if start_temp is None:
        return None
    
    end_temp = _get_temperature_value(
        row,
        ["end_temp", "end_temp_c", "end_temperature", "end_temperature_c", "结束温度"],
    )
    if end_temp is None:
        end_temp = start_temp
    
    duration = _get_duration_value(
        row,
        ["duration", "duration_min", "minutes", "时间", "持续时间", "分钟"],
    )
    if duration is None or duration <= 0:
        return None
    
    return FiringSegment(
        segment_type=seg_type,
        name=str(name),
        start_temperature_c=float(start_temp),
        end_temperature_c=float(end_temp),
        duration_minutes=int(duration),
    )


def _parse_segment_type(row: pd.Series) -> SegmentType | None:
    """解析段类型"""
    type_str = _get_column_value(
        row,
        ["type", "segment_type", "段类型", "类型"],
        default=None,
    )
    
    if type_str is None:
        return None
    
    type_str = str(type_str).strip().lower()
    
    if type_str in ["ramp_up", "rampup", "ramp-up", "升温", "加热", "上升", "up", "加热段"]:
        return SegmentType.RAMP_UP
    elif type_str in ["soak", "hold", "保温", "保温段", "保持", "维持"]:
        return SegmentType.SOAK
    elif type_str in ["ramp_down", "rampdown", "ramp-down", "cool", "降温", "冷却", "强制降温", "down", "冷却段"]:
        return SegmentType.RAMP_DOWN
    elif type_str in ["natural_cool", "naturalcool", "natural-cool", "自然冷却", "自然降温"]:
        return SegmentType.NATURAL_COOL
    
    return None


def _get_temperature_value(row: pd.Series, possible_cols: list[str]) -> float | None:
    """获取温度值"""
    for col in possible_cols:
        if col in row.index and pd.notna(row[col]):
            try:
                val = float(row[col])
                if val >= 0:
                    return val
            except (ValueError, TypeError):
                continue
    return None


def _get_duration_value(row: pd.Series, possible_cols: list[str]) -> int | None:
    """获取持续时间值"""
    for col in possible_cols:
        if col in row.index and pd.notna(row[col]):
            try:
                val = int(float(row[col]))
                if val > 0:
                    return val
            except (ValueError, TypeError):
                continue
    return None


def _get_column_value(row: pd.Series, possible_cols: list[str], default=None):
    """通用列值获取"""
    for col in possible_cols:
        if col in row.index and pd.notna(row[col]):
            return row[col]
    return default
