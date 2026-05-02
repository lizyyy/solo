import pandas as pd
import yaml
from pathlib import Path
from typing import Dict, Any, Optional
import numpy as np


def parse_turbine_csv(file_path: Path) -> pd.DataFrame:
    """解析 turbine.csv 文件，包含机组信息
    
    预期列: turbine_id, rated_power, installation_date, nacelle_direction_offset
    """
    df = pd.read_csv(file_path)
    required_columns = ["turbine_id", "rated_power"]
    for col in required_columns:
        if col not in df.columns:
            raise ValueError(f"turbine.csv 缺少必要列: {col}")
    
    df["rated_power"] = pd.to_numeric(df["rated_power"], errors="coerce")
    df["turbine_id"] = df["turbine_id"].astype(str).str.strip()
    
    if "nacelle_direction_offset" not in df.columns:
        df["nacelle_direction_offset"] = 0.0
    else:
        df["nacelle_direction_offset"] = pd.to_numeric(df["nacelle_direction_offset"], errors="coerce").fillna(0.0)
    
    return df


def parse_scada_10min_csv(file_path: Path) -> pd.DataFrame:
    """解析 scada_10min.csv 文件，处理时间戳和角度数据
    
    预期列: turbine_id, timestamp, wind_direction, nacelle_angle, active_power, wind_speed
    
    处理:
    - 跨午夜数据: 假设时间戳已包含日期
    - 缺采样: 标记 NaN 值
    """
    df = pd.read_csv(file_path)
    required_columns = ["turbine_id", "timestamp", "wind_direction", "nacelle_angle", "active_power", "wind_speed"]
    for col in required_columns:
        if col not in df.columns:
            raise ValueError(f"scada_10min.csv 缺少必要列: {col}")
    
    df["turbine_id"] = df["turbine_id"].astype(str).str.strip()
    
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    
    numeric_cols = ["wind_direction", "nacelle_angle", "active_power", "wind_speed"]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    
    df = _normalize_angles(df)
    
    df = df.sort_values(["turbine_id", "timestamp"]).reset_index(drop=True)
    
    return df


def _normalize_angles(df: pd.DataFrame) -> pd.DataFrame:
    """标准化角度数据到 [0, 360) 范围"""
    df = df.copy()
    
    for col in ["wind_direction", "nacelle_angle"]:
        if col in df.columns:
            df[col] = df[col].apply(lambda x: x % 360 if pd.notna(x) else x)
            df[col] = df[col].mask(df[col] < 0, df[col] + 360)
    
    return df


def parse_wind_rules_yaml(file_path: Path) -> Dict[str, Any]:
    """解析 wind_rules.yaml 规则配置文件"""
    with open(file_path, "r", encoding="utf-8") as f:
        rules = yaml.safe_load(f)
    
    default_rules = {
        "yaw_error_threshold": 15.0,
        "power_loss_factor": 0.0015,
        "anemometer_drift_threshold": 5.0,
        "long_term_bias_threshold": 8.0,
        "long_term_bias_period_hours": 24,
        "valid_wind_speed_range": [3.0, 25.0],
        "min_data_points_for_analysis": 10,
        "yaw_efficiency_target": 0.98,
    }
    
    if rules is None:
        rules = {}
    
    for key, default_value in default_rules.items():
        if key not in rules:
            rules[key] = default_value
    
    return rules


def load_all_data(
    turbine_path: Path,
    scada_path: Path,
    rules_path: Path
) -> tuple:
    """加载所有输入数据
    
    Returns:
        (turbine_df, scada_df, rules_dict)
    """
    turbine_df = parse_turbine_csv(turbine_path)
    scada_df = parse_scada_10min_csv(scada_path)
    rules = parse_wind_rules_yaml(rules_path)
    
    valid_turbine_ids = set(turbine_df["turbine_id"])
    scada_turbine_ids = set(scada_df["turbine_id"])
    missing_in_scada = valid_turbine_ids - scada_turbine_ids
    if missing_in_scada:
        print(f"警告: 以下机组在 SCADA 数据中未找到: {missing_in_scada}")
    
    return turbine_df, scada_df, rules