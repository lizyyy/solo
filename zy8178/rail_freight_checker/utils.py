"""工具函数模块 - 包含单位转换、数据验证等通用功能"""

import re
from typing import Tuple, Optional, Any


def parse_weight(weight: Any) -> Tuple[float, str]:
    """
    解析重量值，支持 kg 和 t 单位
    
    Args:
        weight: 重量值，可以是字符串（如 "1000kg"、"2.5t"）或数字
    
    Returns:
        Tuple[float, str]: 标准化的重量值（单位为 kg）和原始单位
    """
    if isinstance(weight, (int, float)):
        return float(weight), "kg"
    
    if isinstance(weight, str):
        weight = weight.strip().lower()
        
        # 匹配带单位的重量
        match = re.match(r'^([\d.]+)\s*(kg|t|吨)$', weight)
        if match:
            value = float(match.group(1))
            unit = match.group(2)
            
            if unit in ('t', '吨'):
                return value * 1000, 't'
            return value, 'kg'
        
        # 尝试直接转换为数字
        try:
            return float(weight), 'kg'
        except ValueError:
            pass
    
    raise ValueError(f"无法解析重量值: {weight}")


def parse_length(length: Any) -> Tuple[float, str]:
    """
    解析长度值，支持 mm、cm、m 单位
    
    Args:
        length: 长度值，可以是字符串（如 "1000mm"、"2.5m"）或数字
    
    Returns:
        Tuple[float, str]: 标准化的长度值（单位为 mm）和原始单位
    """
    if isinstance(length, (int, float)):
        return float(length), "mm"
    
    if isinstance(length, str):
        length = length.strip().lower()
        
        # 匹配带单位的长度
        match = re.match(r'^([\d.]+)\s*(mm|cm|m)$', length)
        if match:
            value = float(match.group(1))
            unit = match.group(2)
            
            if unit == 'm':
                return value * 1000, 'm'
            elif unit == 'cm':
                return value * 10, 'cm'
            return value, 'mm'
        
        # 尝试直接转换为数字
        try:
            return float(length), 'mm'
        except ValueError:
            pass
    
    raise ValueError(f"无法解析长度值: {length}")


def format_weight(kg: float, target_unit: str = 'kg') -> str:
    """
    格式化重量值为指定单位
    
    Args:
        kg: 重量值（单位为 kg）
        target_unit: 目标单位，'kg' 或 't'
    
    Returns:
        str: 格式化的重量字符串
    """
    if target_unit == 't':
        return f"{kg / 1000:.2f}t"
    return f"{kg:.2f}kg"


def format_length(mm: float, target_unit: str = 'mm') -> str:
    """
    格式化长度值为指定单位
    
    Args:
        mm: 长度值（单位为 mm）
        target_unit: 目标单位，'mm'、'cm' 或 'm'
    
    Returns:
        str: 格式化的长度字符串
    """
    if target_unit == 'm':
        return f"{mm / 1000:.2f}m"
    elif target_unit == 'cm':
        return f"{mm / 10:.2f}cm"
    return f"{mm:.2f}mm"


def validate_required_fields(data: dict, fields: list) -> list:
    """
    验证数据中是否包含必需的字段
    
    Args:
        data: 要验证的数据字典
        fields: 必需字段列表
    
    Returns:
        list: 缺失的字段列表
    """
    missing = []
    for field in fields:
        if field not in data or data[field] is None:
            missing.append(field)
    return missing


def safe_float(value: Any, default: float = 0.0) -> float:
    """
    安全地将值转换为浮点数
    
    Args:
        value: 要转换的值
        default: 转换失败时的默认值
    
    Returns:
        float: 转换后的浮点数
    """
    try:
        if isinstance(value, str):
            # 尝试解析带单位的字符串
            try:
                parsed, _ = parse_weight(value)
                return parsed
            except ValueError:
                pass
            try:
                parsed, _ = parse_length(value)
                return parsed
            except ValueError:
                pass
        
        return float(value)
    except (ValueError, TypeError):
        return default
