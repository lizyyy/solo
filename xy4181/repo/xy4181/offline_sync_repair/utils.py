"""工具函数模块"""

import hashlib
import json
import os
from pathlib import Path
from typing import Any, Dict, Optional


def calculate_file_hash(file_path: Path, algorithm: str = "sha256") -> str:
    """计算文件哈希值"""
    hash_obj = hashlib.new(algorithm)
    with open(file_path, "rb") as f:
        while chunk := f.read(8192):
            hash_obj.update(chunk)
    return hash_obj.hexdigest()


def calculate_string_hash(content: str, algorithm: str = "sha256") -> str:
    """计算字符串哈希值"""
    hash_obj = hashlib.new(algorithm)
    hash_obj.update(content.encode("utf-8"))
    return hash_obj.hexdigest()


def load_json(file_path: Path) -> Dict[str, Any]:
    """加载JSON文件"""
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(data: Any, file_path: Path, indent: int = 2) -> None:
    """保存JSON文件"""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)


def ensure_dir(path: Path) -> Path:
    """确保目录存在"""
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_file_size_str(size_bytes: int) -> str:
    """获取文件大小的可读字符串"""
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.2f} PB"
