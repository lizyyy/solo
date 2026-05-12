"""工具函数"""

import json
import os
from datetime import datetime
from typing import Dict, Any
from .models import DataStore

DATA_FILE = "rain_garden_data.json"


def generate_id(prefix: str = "") -> str:
    """生成唯一 ID"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")
    return f"{prefix}{timestamp}"


def get_data_store_path() -> str:
    """获取数据存储文件路径"""
    return os.path.join(os.getcwd(), DATA_FILE)


def load_data_store() -> DataStore:
    """加载数据存储"""
    path = get_data_store_path()
    if not os.path.exists(path):
        return DataStore()
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return DataStore.from_dict(data)


def save_data_store(store: DataStore) -> None:
    """保存数据存储"""
    path = get_data_store_path()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(store.to_dict(), f, ensure_ascii=False, indent=2)


def get_now_str() -> str:
    """获取当前时间字符串"""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def print_header(title: str) -> None:
    """打印标题"""
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_status(message: str, status: str = "INFO") -> None:
    """打印状态消息"""
    status_colors = {
        "SUCCESS": "\033[92m",
        "WARNING": "\033[93m",
        "ERROR": "\033[91m",
        "INFO": "\033[94m",
    }
    color = status_colors.get(status, "\033[0m")
    reset = "\033[0m"
    print(f"{color}[{status}]{reset} {message}")


def print_table(headers: list, rows: list) -> None:
    """打印表格"""
    if not rows:
        print("  无数据")
        return
    
    col_widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            if i < len(col_widths):
                col_widths[i] = max(col_widths[i], len(str(cell)))
    
    def format_row(row):
        parts = []
        for i, cell in enumerate(row):
            if i < len(col_widths):
                parts.append(f"{str(cell):<{col_widths[i]}}")
        return "  " + " | ".join(parts)
    
    print(format_row(headers))
    print("  " + "-" * (sum(col_widths) + 3 * (len(col_widths) - 1)))
    for row in rows:
        print(format_row(row))
