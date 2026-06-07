import uuid
import hashlib
from datetime import datetime, timezone
from typing import Any


def generate_id(prefix: str = "") -> str:
    """生成唯一ID"""
    uid = str(uuid.uuid4()).replace("-", "")[:16]
    return f"{prefix}_{uid}" if prefix else uid


def get_current_time() -> datetime:
    """获取当前时间（UTC）"""
    return datetime.now(timezone.utc)


def hash_data(data: Any) -> str:
    """计算数据的哈希值，用于检测重复导入"""
    if isinstance(data, dict):
        data_str = str(sorted(data.items()))
    elif isinstance(data, list):
        data_str = str(sorted([str(d) for d in data]))
    else:
        data_str = str(data)
    return hashlib.md5(data_str.encode("utf-8")).hexdigest()
