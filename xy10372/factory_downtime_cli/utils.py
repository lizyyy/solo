"""
工具函数
"""

import hashlib
import json
from datetime import datetime
from typing import Any


def parse_datetime(date_str: str) -> datetime:
    """解析日期时间字符串"""
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        "%Y/%m/%d",
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except (ValueError, AttributeError):
            continue
    raise ValueError(f"无法解析日期时间: {date_str}")


def generate_hash(*args: Any) -> str:
    """生成哈希值用于去重"""
    data = json.dumps(args, default=str, sort_keys=True)
    return hashlib.md5(data.encode()).hexdigest()


def is_overlap(start1: datetime, end1: datetime, start2: datetime, end2: datetime) -> bool:
    """检查两个时间段是否重叠"""
    return start1 < end2 and start2 < end1


def format_minutes(minutes: float) -> str:
    """格式化分钟数显示"""
    if minutes < 60:
        return f"{minutes:.1f}分钟"
    hours = int(minutes // 60)
    mins = minutes % 60
    return f"{hours}小时{mins:.0f}分钟"


def format_efficiency(efficiency: float) -> str:
    """格式化效率显示"""
    return f"{efficiency:.1f}%"
