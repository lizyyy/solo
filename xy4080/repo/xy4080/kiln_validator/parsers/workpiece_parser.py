"""作品清单CSV解析器"""

from pathlib import Path
from typing import Dict, Any, Optional

import pandas as pd

from kiln_validator.models import WorkpieceList, Workpiece, GlazeInfo


def parse_workpiece_csv(csv_path: Path) -> WorkpieceList:
    """
    从CSV文件解析作品清单
    
    必需列：
    - id / 作品编号: 作品唯一标识
    - thickness_cm / 厚度 / thickness: 坯体厚度（厘米）
    
    可选列：
    - name / 作品名称: 作品名称
    - clay_type / 粘土类型: 粘土类型
    - water_content / 含水率: 坯体含水率 (%)
    
    釉料列（可选，支持多格式）:
    格式1 - 合并列：
    - glaze_outer / 外层釉: "釉料名称;1200;1280" （名称;最低温;最高温）
    - glaze_inner / 内层釉: 同上
    
    格式2 - 分列：
    - glaze_outer_name, glaze_outer_min_c, glaze_outer_max_c
    - glaze_inner_name, glaze_inner_min_c, glaze_inner_max_c
    """
    df = pd.read_csv(csv_path)
    df.columns = [c.strip().lower() for c in df.columns]
    
    workpieces = []
    
    for idx, row in df.iterrows():
        workpiece = _parse_single_workpiece(row, idx)
        if workpiece:
            workpieces.append(workpiece)
    
    if not workpieces:
        raise ValueError("无法从CSV解析到任何有效的作品")
    
    return WorkpieceList(workpieces=workpieces)


def _parse_single_workpiece(row: pd.Series, row_idx: int) -> Workpiece | None:
    """解析单个作品"""
    
    workpiece_id = _get_column_value(
        row,
        ["id", "workpiece_id", "编号", "作品编号"],
        default=f"W{row_idx + 1:03d}",
    )
    
    thickness = _get_thickness_value(row)
    if thickness is None or thickness <= 0:
        return None
    
    name = _get_column_value(
        row,
        ["name", "作品名称", "名称"],
        default=None,
    )
    if name is not None:
        name = str(name)
    
    clay_type = _get_column_value(
        row,
        ["clay_type", "clay", "粘土", "粘土类型", "泥料"],
        default="unknown",
    )
    
    water_content = _get_column_value_float(
        row,
        ["water_content", "water_content_pct", "含水率", "水分"],
        default=5.0,
    )
    
    glaze_outer = _parse_glaze_info(row, "outer", "外层")
    glaze_inner = _parse_glaze_info(row, "inner", "内层")
    
    notes = _get_column_value(
        row,
        ["notes", "note", "备注", "说明"],
        default="",
    )
    
    return Workpiece(
        id=str(workpiece_id),
        name=name,
        thickness_cm=float(thickness),
        clay_type=str(clay_type),
        body_water_content_pct=float(water_content),
        glaze_outer=glaze_outer,
        glaze_inner=glaze_inner,
        notes=str(notes),
    )


def _parse_glaze_info(row: pd.Series, prefix: str, chinese_prefix: str) -> GlazeInfo | None:
    """解析釉料信息，支持合并格式和分栏格式"""
    
    combined_cols = [f"glaze_{prefix}", f"{chinese_prefix}釉", f"釉{chinese_prefix}"]
    for col in combined_cols:
        if col in row.index and pd.notna(row[col]) and str(row[col]).strip():
            result = _parse_combined_glaze(str(row[col]))
            if result:
                return result
    
    name_cols = [f"glaze_{prefix}_name", f"{chinese_prefix}釉名称", f"glaze_{prefix}"]
    min_cols = [f"glaze_{prefix}_min", f"glaze_{prefix}_min_c", f"{chinese_prefix}釉最低温"]
    max_cols = [f"glaze_{prefix}_max", f"glaze_{prefix}_max_c", f"{chinese_prefix}釉最高温"]
    
    name = _get_column_value(row, name_cols, default=None)
    min_temp = _get_column_value_float(row, min_cols, default=None)
    max_temp = _get_column_value_float(row, max_cols, default=None)
    
    if name and min_temp is not None and max_temp is not None:
        return GlazeInfo(
            name=str(name),
            maturing_temp_min_c=float(min_temp),
            maturing_temp_max_c=float(max_temp),
        )
    
    return None


def _parse_combined_glaze(value: str) -> GlazeInfo | None:
    """解析合并格式的釉料信息："釉料名称;1200;1280" 或 "釉料名称,1200,1280" """
    value = value.strip()
    if not value:
        return None
    
    if ";" in value:
        parts = [p.strip() for p in value.split(";")]
    elif "," in value and value.count(",") >= 2:
        parts = [p.strip() for p in value.split(",")]
    else:
        return None
    
    if len(parts) < 3:
        return None
    
    name = parts[0]
    try:
        min_temp = float(parts[1])
        max_temp = float(parts[2])
        
        if min_temp < 500 or max_temp < 500 or min_temp > max_temp:
            return None
        
        notes = parts[3] if len(parts) > 3 else ""
        
        return GlazeInfo(
            name=name,
            maturing_temp_min_c=min_temp,
            maturing_temp_max_c=max_temp,
            notes=notes,
        )
    except (ValueError, TypeError):
        return None


def _get_thickness_value(row: pd.Series) -> float | None:
    """获取厚度值"""
    cols = [
        "thickness_cm", "thickness", "厚度", "坯体厚度",
        "thickness_c", "thickness_mm",
    ]
    
    for col in cols:
        if col in row.index and pd.notna(row[col]):
            try:
                val = float(row[col])
                
                if "mm" in col.lower() or "毫米" in col:
                    val = val / 10.0
                
                if val > 0 and val < 50:
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


def _get_column_value_float(row: pd.Series, possible_cols: list[str], default: float | None = None) -> float | None:
    """获取浮点数列值"""
    for col in possible_cols:
        if col in row.index and pd.notna(row[col]):
            try:
                return float(row[col])
            except (ValueError, TypeError):
                continue
    return default
