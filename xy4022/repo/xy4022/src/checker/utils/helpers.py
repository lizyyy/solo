"""通用工具函数"""

import hashlib
import os
import platform
import fnmatch
from pathlib import Path
from typing import List


def compute_sha256(file_path: str) -> str:
    """计算文件的SHA256哈希值"""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def normalize_path(path: str) -> str:
    """规范化路径"""
    return str(Path(path).resolve())


def is_case_sensitive() -> bool:
    """检查当前文件系统是否区分大小写"""
    return platform.system() != "Windows"


def check_case_sensitivity(actual_path: str, expected_path: str) -> bool:
    """检查实际路径和期望路径的大小写是否一致
    
    只有在不区分大小写的文件系统上才需要检查
    """
    actual_parts = Path(actual_path).parts
    expected_parts = Path(expected_path).parts
    
    if len(actual_parts) != len(expected_parts):
        return False
    
    for actual_part, expected_part in zip(actual_parts, expected_parts):
        if actual_part != expected_part:
            return False
    
    return True


def get_file_size(file_path: str) -> int:
    """获取文件大小（字节）"""
    return os.path.getsize(file_path)


def is_ignored(path: str, ignore_patterns: List[str], root_dir: str) -> bool:
    """检查路径是否符合忽略规则
    
    Args:
        path: 要检查的路径（相对于root_dir或绝对路径）
        ignore_patterns: 忽略模式列表（支持glob模式）
        root_dir: 根目录
    
    Returns:
        是否应该忽略该路径
    """
    # 转换为相对于root_dir的路径
    try:
        rel_path = os.path.relpath(path, root_dir)
    except ValueError:
        return False
    
    for pattern in ignore_patterns:
        # 处理目录模式（以/结尾）
        if pattern.endswith("/"):
            pattern = pattern.rstrip("/")
            # 检查路径是否匹配或父目录是否匹配
            parts = rel_path.split(os.sep)
            for i in range(len(parts)):
                partial_path = os.sep.join(parts[:i+1])
                if fnmatch.fnmatch(partial_path, pattern):
                    return True
        else:
            if fnmatch.fnmatch(rel_path, pattern):
                return True
            # 检查子路径匹配（**/pattern）
            if pattern.startswith("**/"):
                base_pattern = pattern[3:]
                if fnmatch.fnmatch(rel_path, base_pattern):
                    return True
                for i in range(len(rel_path.split(os.sep))):
                    partial = os.sep.join(rel_path.split(os.sep)[i:])
                    if fnmatch.fnmatch(partial, base_pattern):
                        return True
    
    return False


def format_file_size(size_bytes: int) -> str:
    """格式化文件大小为可读字符串"""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.2f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.2f} MB"
