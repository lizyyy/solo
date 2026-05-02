"""窑炉探头数据CSV解析器"""

from pathlib import Path
from typing import List, Dict, Any

import pandas as pd
import numpy as np

from kiln_validator.models import ProbeDataPoint


def parse_probe_data_csv(csv_path: Path) -> List[ProbeDataPoint]:
    """
    从CSV文件解析窑炉探头数据
    
    支持多种格式：
    
    格式1 - 简单格式（最常用）：
    time_minutes, temperature_c
    0, 25
    10, 100
    
    格式2 - 中文列名：
    时间(分钟), 温度(°C)
    
    格式3 - 多探头格式：
    time, probe_main, probe_upper, probe_lower
    
    列名支持别名（大小写不敏感）：
    - 时间列: time, time_min, time_minutes, minutes, 时间, 时间(分钟)
    - 温度列: temp, temperature, temperature_c, temp_c, 温度, 温度(°C), 温度(C)
    """
    df = pd.read_csv(csv_path)
    df.columns = [c.strip().lower() for c in df.columns]
    
    time_col = _find_time_column(df)
    if time_col is None:
        raise ValueError("无法找到时间列，需要包含 time/minutes/时间 等列")
    
    temp_cols = _find_temperature_columns(df)
    if not temp_cols:
        raise ValueError("无法找到温度列，需要包含 temp/temperature/温度 等列")
    
    data_points = []
    
    for idx, row in df.iterrows():
        time_val = _parse_time_value(row[time_col])
        if time_val is None:
            continue
        
        for probe_col in temp_cols:
            if pd.isna(row[probe_col]):
                continue
            
            try:
                temp_val = float(row[probe_col])
                if temp_val < -273:
                    continue
                
                probe_id = _extract_probe_id(probe_col, len(temp_cols))
                
                data_points.append(
                    ProbeDataPoint(
                        time_minutes=time_val,
                        temperature_c=temp_val,
                        probe_id=probe_id,
                    )
                )
            except (ValueError, TypeError):
                continue
    
    if not data_points:
        raise ValueError("无法从CSV解析到任何有效的探头数据点")
    
    data_points.sort(key=lambda p: (p.time_minutes, p.probe_id))
    
    return data_points


def _find_time_column(df: pd.DataFrame) -> str | None:
    """查找时间列"""
    time_aliases = [
        "time", "time_min", "time_minutes", "minutes", "mins",
        "时间", "时间(分钟)", "时间(min)", "时间(分)",
        "elapsed", "elapsed_time",
    ]
    
    for alias in time_aliases:
        if alias in df.columns:
            return alias
    
    for col in df.columns:
        if any(t in col for t in ["time", "min", "分钟", "时间"]):
            return col
    
    return None


def _find_temperature_columns(df: pd.DataFrame) -> List[str]:
    """查找所有温度列"""
    temp_aliases = [
        "temp", "temperature", "temp_c", "temperature_c",
        "temp_celsius",
        "温度", "温度(°c)", "温度(c)", "温度(摄氏度)",
    ]
    
    found_cols = []
    
    for alias in temp_aliases:
        if alias in df.columns and alias not in found_cols:
            found_cols.append(alias)
    
    for col in df.columns:
        if col in found_cols:
            continue
        if any(t in col for t in ["temp", "温度", "probe"]):
            time_keywords = ["time", "min", "分钟", "时间"]
            if not any(t in col for t in time_keywords):
                found_cols.append(col)
    
    return found_cols if found_cols else []


def _parse_time_value(value) -> int | None:
    """解析时间值"""
    if pd.isna(value):
        return None
    
    try:
        val = float(value)
        if val < 0:
            return None
        return int(np.round(val))
    except (ValueError, TypeError):
        pass
    
    if isinstance(value, str):
        value = value.strip()
        
        if ":" in value:
            parts = value.split(":")
            if len(parts) == 2:
                try:
                    hours = int(parts[0])
                    minutes = float(parts[1])
                    return int(hours * 60 + minutes)
                except (ValueError, TypeError):
                    pass
            elif len(parts) == 3:
                try:
                    hours = int(parts[0])
                    minutes = int(parts[1])
                    seconds = float(parts[2])
                    return int(hours * 60 + minutes + seconds / 60)
                except (ValueError, TypeError):
                    pass
        
        try:
            val = float(value.replace("分钟", "").replace("min", "").replace(" ", ""))
            return int(np.round(val))
        except (ValueError, TypeError):
            pass
    
    return None


def _extract_probe_id(col_name: str, total_probes: int) -> str:
    """从列名提取探头ID"""
    col_lower = col_name.lower()
    
    for prefix in ["probe_", "probe", "temp_", "temperature_"]:
        if col_lower.startswith(prefix):
            probe_id = col_lower[len(prefix):]
            if probe_id:
                return probe_id
    
    if "main" in col_lower:
        return "main"
    if "upper" in col_lower or "上" in col_name:
        return "upper"
    if "lower" in col_lower or "下" in col_name:
        return "lower"
    if "left" in col_lower or "左" in col_name:
        return "left"
    if "right" in col_lower or "右" in col_name:
        return "right"
    
    if total_probes == 1:
        return "main"
    
    return col_name
