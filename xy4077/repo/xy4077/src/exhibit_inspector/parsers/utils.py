"""解析器工具函数"""

from datetime import datetime
from typing import Optional


def parse_timestamp(value: str) -> str:
    """
    解析时间戳字符串，返回ISO 8601格式
    
    支持的格式：
    - ISO 8601: 2024-01-15T10:30:00, 2024-01-15 10:30:00
    - 中文格式: 2024年1月15日 10:30:00
    - 简单格式: 2024-01-15, 2024/01/15
    """
    value = value.strip()
    
    formats = [
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%Y年%m月%d日 %H:%M:%S",
        "%Y年%m月%d日 %H:%M",
        "%Y年%m月%d日",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(value, fmt)
            return dt.isoformat()
        except ValueError:
            continue
    
    raise ValueError(f"无法解析时间戳: {value}")


def fahrenheit_to_celsius(fahrenheit: float) -> float:
    """将华氏度转换为摄氏度"""
    return (fahrenheit - 32) * 5 / 9


def celsius_to_fahrenheit(celsius: float) -> float:
    """将摄氏度转换为华氏度"""
    return celsius * 9 / 5 + 32


def normalize_box_id(box_id: str) -> str:
    """标准化展箱编号"""
    box_id = box_id.strip()
    box_id = box_id.upper()
    box_id = box_id.replace(" ", "_")
    box_id = box_id.replace("-", "_")
    return box_id


def generate_record_id(prefix: str, index: int) -> str:
    """生成记录唯一标识"""
    return f"{prefix}_{index:06d}"
