#!/usr/bin/env python3
"""解析/校验模块 - 负责从 JSON/CSV 读取发酵方案并验证参数有效性"""

import json
import pandas as pd
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass
from enum import Enum


class CultureType(Enum):
    """菌种类型枚举"""
    YOGURT_STARTER = "yogurt_starter"  # 商用酸奶发酵剂
    STORE_BOUGHT_YOGURT = "store_bought"  # 市售酸奶作为菌种
    PROBIOTIC_CAPSULE = "probiotic"  # 益生菌胶囊
    HOMEMADE_YOGURT = "homemade"  # 自制酸奶作为菌种


# 必需字段列表
REQUIRED_FIELDS = [
    "name",  # 方案名称
    "milk_volume_ml",  # 牛奶量 (ml)
    "culture_type",  # 菌种类型
    "culture_activity",  # 菌种活性 (1-10)
    "inoculation_ratio",  # 接种比例 (%)
    "initial_temp_c",  # 初始温度 (°C)
    "target_temp_c",  # 目标保温温度 (°C)
    "total_duration_h",  # 总保温时长 (小时)
    "ambient_temp_c",  # 环境温度 (°C)
    "container_size_ml",  # 容器大小 (ml)
    "preheated",  # 是否预热 (bool)
]

# 可选字段
OPTIONAL_FIELDS = [
    "temperature_phases",  # 温度阶段 (列表，用于多段保温)
    "milk_fat_content",  # 牛奶脂肪含量 (%)
    "notes",  # 备注
]


def parse_input(file_path: str, file_type: str) -> List[Dict[str, Any]]:
    """
    从 JSON 或 CSV 文件解析发酵方案
    
    Args:
        file_path: 文件路径
        file_type: 文件类型 ('json' 或 'csv')
    
    Returns:
        发酵方案列表
    """
    if file_type == "json":
        return _parse_json(file_path)
    elif file_type == "csv":
        return _parse_csv(file_path)
    else:
        raise ValueError(f"不支持的文件类型: {file_type}")


def _parse_json(file_path: str) -> List[Dict[str, Any]]:
    """从 JSON 文件解析发酵方案"""
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 支持单个方案或方案列表
    if isinstance(data, dict):
        return [data]
    elif isinstance(data, list):
        return data
    else:
        raise ValueError("JSON 文件格式不正确，应为对象或对象数组")


def _parse_csv(file_path: str) -> List[Dict[str, Any]]:
    """从 CSV 文件解析发酵方案"""
    df = pd.read_csv(file_path)
    
    # 转换布尔字段
    bool_columns = ['preheated']
    for col in bool_columns:
        if col in df.columns:
            df[col] = df[col].astype(str).str.lower().replace(
                {'true': True, 'false': False, '1': True, '0': False, 'yes': True, 'no': False}
            )
    
    # 转换数值字段
    numeric_columns = [
        'milk_volume_ml', 'culture_activity', 'inoculation_ratio',
        'initial_temp_c', 'target_temp_c', 'total_duration_h',
        'ambient_temp_c', 'container_size_ml', 'milk_fat_content'
    ]
    for col in numeric_columns:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # 处理温度阶段（如果存在）
    if 'temperature_phases' in df.columns:
        df['temperature_phases'] = df['temperature_phases'].apply(
            lambda x: json.loads(x) if pd.notna(x) and isinstance(x, str) else None
        )
    
    return df.to_dict('records')


def validate_plan(plan: Dict[str, Any]) -> Dict[str, Any]:
    """
    验证单个发酵方案的参数有效性
    
    Args:
        plan: 发酵方案字典
    
    Returns:
        包含验证结果的字典:
        - valid: 是否有效
        - errors: 错误列表
        - warnings: 警告列表
    """
    errors = []
    warnings = []
    
    # 检查必需字段
    missing_fields = []
    for field in REQUIRED_FIELDS:
        if field not in plan or plan[field] is None or (
            isinstance(plan[field], str) and plan[field].strip() == ''
        ):
            missing_fields.append(field)
    
    if missing_fields:
        errors.append(f"缺少必需字段: {', '.join(missing_fields)}")
    
    # 如果有缺失字段，提前返回，避免后续验证出错
    if errors:
        return {
            "valid": False,
            "errors": errors,
            "warnings": warnings
        }
    
    # 验证数值字段
    _validate_numeric_fields(plan, errors, warnings)
    
    # 验证温度
    _validate_temperatures(plan, errors, warnings)
    
    # 验证时间
    _validate_durations(plan, errors, warnings)
    
    # 验证菌种参数
    _validate_culture(plan, errors, warnings)
    
    # 验证容器参数
    _validate_container(plan, errors, warnings)
    
    # 验证温度阶段（如果提供）
    if plan.get('temperature_phases'):
        _validate_temperature_phases(plan, errors, warnings)
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings
    }


def _validate_numeric_fields(plan: Dict[str, Any], errors: list, warnings: list):
    """验证数值字段"""
    # 牛奶量
    milk_vol = plan.get('milk_volume_ml')
    if milk_vol is not None:
        if milk_vol <= 0:
            errors.append(f"牛奶量必须大于 0，当前值: {milk_vol} ml")
        elif milk_vol < 100:
            warnings.append(f"牛奶量较少 ({milk_vol} ml)，发酵过程可能难以控制")
    
    # 接种比例
    inoc_ratio = plan.get('inoculation_ratio')
    if inoc_ratio is not None:
        if inoc_ratio <= 0:
            errors.append(f"接种比例必须大于 0，当前值: {inoc_ratio}%")
        elif inoc_ratio > 20:
            warnings.append(f"接种比例较高 ({inoc_ratio}%)，可能导致发酵过快或风味异常")
    
    # 菌种活性
    activity = plan.get('culture_activity')
    if activity is not None:
        if activity < 1 or activity > 10:
            errors.append(f"菌种活性应在 1-10 范围内，当前值: {activity}")


def _validate_temperatures(plan: Dict[str, Any], errors: list, warnings: list):
    """验证温度参数"""
    initial_temp = plan.get('initial_temp_c')
    target_temp = plan.get('target_temp_c')
    ambient_temp = plan.get('ambient_temp_c')
    
    # 温度范围合理性检查
    for temp_name, temp_value in [
        ("初始温度", initial_temp),
        ("目标保温温度", target_temp),
        ("环境温度", ambient_temp)
    ]:
        if temp_value is not None:
            if temp_value < 0 or temp_value > 100:
                errors.append(f"{temp_name}不合理，应在 0-100°C 范围内，当前值: {temp_value}°C")
    
    # 目标温度合理性（酸奶发酵通常在 37-45°C）
    if target_temp is not None:
        if target_temp < 30:
            warnings.append(f"目标保温温度较低 ({target_temp}°C)，发酵速度会很慢")
        elif target_temp > 50:
            warnings.append(f"目标保温温度较高 ({target_temp}°C)，可能导致菌种失活")
    
    # 初始温度与目标温度关系
    if initial_temp is not None and target_temp is not None:
        if initial_temp > target_temp + 10:
            warnings.append(f"初始温度 ({initial_temp}°C) 远高于目标温度 ({target_temp}°C)，降温过程可能影响发酵")


def _validate_durations(plan: Dict[str, Any], errors: list, warnings: list):
    """验证时间参数"""
    duration = plan.get('total_duration_h')
    
    if duration is not None:
        if duration <= 0:
            errors.append(f"发酵时长必须大于 0，当前值: {duration} 小时")
        elif duration < 2:
            warnings.append(f"发酵时长较短 ({duration} 小时)，可能无法完成凝固")
        elif duration > 24:
            warnings.append(f"发酵时长较长 ({duration} 小时)，可能过酸或存在安全风险")


def _validate_culture(plan: Dict[str, Any], errors: list, warnings: list):
    """验证菌种参数"""
    culture_type = plan.get('culture_type')
    activity = plan.get('culture_activity')
    inoc_ratio = plan.get('inoculation_ratio')
    
    # 菌种类型检查
    valid_types = [t.value for t in CultureType]
    if culture_type not in valid_types:
        warnings.append(f"未知的菌种类型: {culture_type}，使用默认参数")
    
    # 接种比例合理性
    if inoc_ratio is not None:
        if culture_type == CultureType.STORE_BOUGHT_YOGURT.value and inoc_ratio < 2:
            warnings.append(f"使用市售酸奶作为菌种时，建议接种比例不低于 2%，当前值: {inoc_ratio}%")
        elif culture_type == CultureType.PROBIOTIC_CAPSULE.value and inoc_ratio > 1:
            warnings.append(f"使用益生菌胶囊时，建议接种比例不高于 1%，当前值: {inoc_ratio}%")


def _validate_container(plan: Dict[str, Any], errors: list, warnings: list):
    """验证容器参数"""
    milk_vol = plan.get('milk_volume_ml')
    container_size = plan.get('container_size_ml')
    preheated = plan.get('preheated', False)
    
    if container_size is not None and milk_vol is not None:
        if container_size < milk_vol:
            errors.append(f"容器大小 ({container_size} ml) 小于牛奶量 ({milk_vol} ml)，会溢出")
        
        fill_ratio = milk_vol / container_size
        if fill_ratio > 0.9:
            warnings.append(f"容器填充率较高 ({fill_ratio*100:.1f}%)，发酵膨胀可能导致溢出")
        elif fill_ratio < 0.3:
            warnings.append(f"容器填充率较低 ({fill_ratio*100:.1f}%)，散热可能较快，温度控制困难")
    
    # 预热检查
    if preheated:
        initial_temp = plan.get('initial_temp_c')
        target_temp = plan.get('target_temp_c')
        if initial_temp is not None and target_temp is not None:
            if initial_temp < target_temp - 5:
                warnings.append(f"已标记为预热，但初始温度 ({initial_temp}°C) 低于目标温度 ({target_temp}°C) 较多")


def _validate_temperature_phases(plan: Dict[str, Any], errors: list, warnings: list):
    """验证多段温度阶段配置"""
    phases = plan.get('temperature_phases', [])
    total_duration = plan.get('total_duration_h', 0)
    
    if not isinstance(phases, list):
        errors.append("温度阶段配置格式错误，应为列表")
        return
    
    phase_duration_sum = 0
    for i, phase in enumerate(phases, 1):
        if not isinstance(phase, dict):
            errors.append(f"第 {i} 个温度阶段格式错误")
            continue
        
        temp = phase.get('temperature_c')
        duration = phase.get('duration_h')
        
        if temp is None:
            errors.append(f"第 {i} 个温度阶段缺少温度参数")
        elif temp < 0 or temp > 100:
            errors.append(f"第 {i} 个温度阶段温度不合理: {temp}°C")
        
        if duration is None:
            errors.append(f"第 {i} 个温度阶段缺少时长参数")
        elif duration <= 0:
            errors.append(f"第 {i} 个温度阶段时长必须大于 0")
        else:
            phase_duration_sum += duration
    
    # 检查阶段时长总和
    if phase_duration_sum > 0 and abs(phase_duration_sum - total_duration) > 0.1:
        warnings.append(
            f"温度阶段总时长 ({phase_duration_sum} 小时) 与配置的总时长 ({total_duration} 小时) 不一致"
        )


def normalize_plan(plan: Dict[str, Any]) -> Dict[str, Any]:
    """
    标准化发酵方案，填充默认值，转换单位等
    
    Args:
        plan: 原始发酵方案
    
    Returns:
        标准化后的发酵方案
    """
    normalized = plan.copy()
    
    # 为可选字段设置默认值
    defaults = {
        'milk_fat_content': 3.5,  # 全脂牛奶默认脂肪含量
        'temperature_phases': None,
        'notes': ''
    }
    
    for key, default_value in defaults.items():
        if key not in normalized or normalized[key] is None:
            normalized[key] = default_value
    
    # 确保布尔字段是布尔类型
    if 'preheated' in normalized:
        normalized['preheated'] = bool(normalized['preheated'])
    
    return normalized


def batch_validate(plans: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    批量验证发酵方案
    
    Args:
        plans: 发酵方案列表
    
    Returns:
        (有效方案列表, 无效方案列表)
    """
    valid_plans = []
    invalid_plans = []
    
    for i, plan in enumerate(plans, 1):
        validation = validate_plan(plan)
        plan_with_validation = {
            'plan_id': i,
            'plan': plan,
            'validation': validation
        }
        
        if validation['valid']:
            valid_plans.append(plan_with_validation)
        else:
            invalid_plans.append(plan_with_validation)
    
    return valid_plans, invalid_plans
