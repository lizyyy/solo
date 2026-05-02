import pandas as pd
import numpy as np
from typing import Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class YawDirection(Enum):
    CLOCKWISE = "clockwise"
    COUNTERCLOCKWISE = "counterclockwise"


@dataclass
class YawCalculationResult:
    turbine_id: str
    yaw_error_deg: float
    absolute_yaw_error_deg: float
    estimated_power_loss_kw: float
    is_valid: bool
    wind_direction: float
    nacelle_angle: float
    nacelle_offset_applied: float
    timestamp: pd.Timestamp


def calculate_angular_difference(angle1: float, angle2: float) -> float:
    """计算两个角度的最小差值，处理 359/0 度环绕问题
    
    返回值范围: (-180, 180]
    正值表示 angle2 在 angle1 的顺时针方向
    负值表示 angle2 在 angle1 的逆时针方向
    """
    if pd.isna(angle1) or pd.isna(angle2):
        return np.nan
    
    angle1 = angle1 % 360
    angle2 = angle2 % 360
    
    diff = angle2 - angle1
    
    if diff > 180:
        diff -= 360
    elif diff <= -180:
        diff += 360
    
    return diff


def calculate_yaw_error(
    wind_direction: float,
    nacelle_angle: float,
    nacelle_offset: float = 0.0
) -> float:
    """计算偏航误差
    
    偏航误差 = 风向 - (机舱角度 + 机舱偏移)
    
    处理角度环绕问题
    """
    adjusted_nacelle = (nacelle_angle + nacelle_offset) % 360
    yaw_error = calculate_angular_difference(adjusted_nacelle, wind_direction)
    
    return yaw_error


def estimate_power_loss(
    yaw_error_deg: float,
    active_power_kw: float,
    rated_power_kw: float,
    wind_speed: float,
    power_loss_factor: float = 0.0015,
    valid_wind_speed_range: Tuple[float, float] = (3.0, 25.0)
) -> float:
    """估算偏航误差导致的功率损失
    
    基于功率损失系数计算:
    功率损失 = 实际功率 * (1 - cos(偏航误差角度)) * 损失系数
    
    只在有效风速范围内计算
    """
    if pd.isna(yaw_error_deg) or pd.isna(active_power_kw) or pd.isna(wind_speed):
        return 0.0
    
    min_ws, max_ws = valid_wind_speed_range
    if not (min_ws <= wind_speed <= max_ws):
        return 0.0
    
    yaw_error_rad = np.radians(abs(yaw_error_deg))
    
    cos_factor = np.cos(yaw_error_rad)
    power_loss = active_power_kw * (1 - cos_factor) * power_loss_factor
    
    return max(0.0, power_loss)


def rebuild_timeline_for_turbine(
    scada_df: pd.DataFrame,
    turbine_id: str,
    nacelle_offset: float = 0.0,
    rules: Optional[Dict[str, Any]] = None
) -> pd.DataFrame:
    """为单个机组重建时间线
    
    处理:
    1. 按时间排序
    2. 处理跨午夜数据（时间戳已包含日期，自动处理）
    3. 标记缺采样点
    4. 计算偏航误差和功率损失
    """
    if rules is None:
        rules = {}
    
    turbine_data = scada_df[scada_df["turbine_id"] == turbine_id].copy()
    
    if turbine_data.empty:
        return pd.DataFrame()
    
    turbine_data = turbine_data.sort_values("timestamp").reset_index(drop=True)
    
    turbine_data["time_diff"] = turbine_data["timestamp"].diff()
    
    expected_interval = pd.Timedelta(minutes=10)
    turbine_data["is_missing_sample"] = (turbine_data["time_diff"] > expected_interval * 1.5) & \
                                         (~turbine_data["time_diff"].isna())
    
    turbine_data["nacelle_offset_applied"] = nacelle_offset
    
    turbine_data["yaw_error_deg"] = turbine_data.apply(
        lambda row: calculate_yaw_error(
            row["wind_direction"],
            row["nacelle_angle"],
            nacelle_offset
        ),
        axis=1
    )
    
    turbine_data["absolute_yaw_error_deg"] = turbine_data["yaw_error_deg"].abs()
    
    power_loss_factor = rules.get("power_loss_factor", 0.0015)
    valid_ws_range = tuple(rules.get("valid_wind_speed_range", [3.0, 25.0]))
    rated_power = turbine_data.get("rated_power", 2000.0)
    
    if isinstance(rated_power, pd.Series):
        rated_power = rated_power.iloc[0] if not rated_power.empty else 2000.0
    
    turbine_data["estimated_power_loss_kw"] = turbine_data.apply(
        lambda row: estimate_power_loss(
            row["yaw_error_deg"],
            row["active_power"],
            rated_power,
            row["wind_speed"],
            power_loss_factor,
            valid_ws_range
        ),
        axis=1
    )
    
    min_ws, max_ws = valid_ws_range
    turbine_data["is_valid_for_analysis"] = (
        turbine_data["wind_speed"].between(min_ws, max_ws) &
        turbine_data["yaw_error_deg"].notna() &
        turbine_data["active_power"].notna()
    )
    
    return turbine_data


def calculate_turbine_statistics(timeline_df: pd.DataFrame) -> Dict[str, Any]:
    """计算单个机组的统计数据"""
    if timeline_df.empty:
        return {}
    
    valid_data = timeline_df[timeline_df["is_valid_for_analysis"]]
    
    if valid_data.empty:
        return {
            "total_samples": len(timeline_df),
            "valid_samples": 0,
            "missing_samples_count": int(timeline_df["is_missing_sample"].sum()),
            "has_data": False
        }
    
    stats = {
        "total_samples": len(timeline_df),
        "valid_samples": len(valid_data),
        "missing_samples_count": int(timeline_df["is_missing_sample"].sum()),
        "has_data": True,
        
        "mean_yaw_error_deg": float(valid_data["yaw_error_deg"].mean()),
        "median_yaw_error_deg": float(valid_data["yaw_error_deg"].median()),
        "mean_absolute_yaw_error_deg": float(valid_data["absolute_yaw_error_deg"].mean()),
        "max_absolute_yaw_error_deg": float(valid_data["absolute_yaw_error_deg"].max()),
        
        "total_power_loss_kwh": float(valid_data["estimated_power_loss_kw"].sum() * (10/60)),
        "mean_power_loss_kw": float(valid_data["estimated_power_loss_kw"].mean()),
        
        "data_start_time": valid_data["timestamp"].min(),
        "data_end_time": valid_data["timestamp"].max(),
        "coverage_hours": float((valid_data["timestamp"].max() - valid_data["timestamp"].min()).total_seconds() / 3600),
    }
    
    yaw_threshold = 15.0
    stats["samples_exceeding_yaw_threshold"] = int(
        (valid_data["absolute_yaw_error_deg"] > yaw_threshold).sum()
    )
    stats["yaw_threshold_exceed_rate"] = (
        stats["samples_exceeding_yaw_threshold"] / stats["valid_samples"]
        if stats["valid_samples"] > 0 else 0.0
    )
    
    return stats