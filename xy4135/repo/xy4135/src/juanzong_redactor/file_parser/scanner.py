"""目录扫描模块 - 扫描目录并生成文件清单"""
import os
import hashlib
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional


DEFAULT_FILE_TYPES = {
    "pdf": [".pdf"],
    "image": [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".tif"],
    "document": [".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"],
    "csv": [".csv"],
    "text": [".txt", ".md", ".json", ".xml", ".html"],
}


def calculate_file_hash(file_path: str, algorithm: str = "sha256") -> str:
    """计算文件哈希值
    
    Args:
        file_path: 文件路径
        algorithm: 哈希算法，支持 md5, sha1, sha256
    
    Returns:
        十六进制格式的哈希字符串
    """
    hash_func = hashlib.new(algorithm)
    
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hash_func.update(chunk)
    
    return hash_func.hexdigest()


def get_file_metadata(file_path: str) -> Dict[str, Any]:
    """获取文件元数据
    
    Args:
        file_path: 文件路径
    
    Returns:
        包含文件元数据的字典
    """
    path = Path(file_path)
    stat = path.stat()
    
    return {
        "name": path.name,
        "extension": path.suffix.lower(),
        "size": stat.st_size,
        "size_human": format_file_size(stat.st_size),
        "created_time": datetime.fromtimestamp(stat.st_ctime).isoformat(),
        "modified_time": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        "absolute_path": str(path.absolute()),
    }


def format_file_size(size_bytes: int) -> str:
    """格式化文件大小为可读格式
    
    Args:
        size_bytes: 字节数
    
    Returns:
        格式化后的文件大小字符串，如 "2.5 MB"
    """
    if size_bytes == 0:
        return "0 B"
    
    size_names = ["B", "KB", "MB", "GB", "TB"]
    import math
    i = int(math.floor(math.log(size_bytes, 1024)))
    p = math.pow(1024, i)
    s = round(size_bytes / p, 2)
    
    return f"{s} {size_names[i]}"


def scan_directory(
    directory: str,
    recursive: bool = True,
    file_types: Optional[List[str]] = None,
    calculate_hash: bool = True,
) -> Dict[str, Any]:
    """扫描目录并生成文件清单
    
    Args:
        directory: 要扫描的目录路径
        recursive: 是否递归扫描子目录
        file_types: 要包含的文件类型列表，如 ["pdf", "image"] 或 ["pdf", "jpg", "png"]
        calculate_hash: 是否计算文件哈希值
    
    Returns:
        包含扫描结果的字典
    """
    base_path = Path(directory)
    
    if not base_path.exists():
        raise FileNotFoundError(f"目录不存在: {directory}")
    
    if not base_path.is_dir():
        raise NotADirectoryError(f"不是目录: {directory}")
    
    # 确定要扫描的文件扩展名
    extensions_to_include = set()
    
    if file_types:
        for ft in file_types:
            ft_lower = ft.lower().strip()
            # 检查是否是预定义的类型类别
            if ft_lower in DEFAULT_FILE_TYPES:
                extensions_to_include.update(DEFAULT_FILE_TYPES[ft_lower])
            else:
                # 如果是单独的扩展名
                if not ft_lower.startswith("."):
                    ft_lower = "." + ft_lower
                extensions_to_include.add(ft_lower)
    
    files = []
    total_size = 0
    
    # 递归或非递归扫描
    if recursive:
        file_iterator = base_path.rglob("*")
    else:
        file_iterator = base_path.iterdir()
    
    for file_path in file_iterator:
        if not file_path.is_file():
            continue
        
        # 检查文件扩展名
        if extensions_to_include:
            if file_path.suffix.lower() not in extensions_to_include:
                continue
        
        # 获取文件信息
        metadata = get_file_metadata(str(file_path))
        
        file_info = {
            "path": str(file_path.relative_to(base_path)),
            **metadata,
            "file_type": classify_file_type(file_path.suffix.lower()),
        }
        
        if calculate_hash:
            file_info["hash_sha256"] = calculate_file_hash(str(file_path), "sha256")
            file_info["hash_md5"] = calculate_file_hash(str(file_path), "md5")
        
        files.append(file_info)
        total_size += metadata["size"]
    
    # 按路径排序
    files.sort(key=lambda x: x["path"])
    
    result = {
        "scan_time": datetime.now().isoformat(),
        "base_directory": str(base_path.absolute()),
        "total_files": len(files),
        "total_size": total_size,
        "total_size_human": format_file_size(total_size),
        "recursive": recursive,
        "file_types_included": list(extensions_to_include) if extensions_to_include else None,
        "files": files,
        "summary": generate_scan_summary(files),
    }
    
    return result


def classify_file_type(extension: str) -> str:
    """根据文件扩展名分类文件类型
    
    Args:
        extension: 文件扩展名（带点）
    
    Returns:
        文件类型描述
    """
    ext = extension.lower()
    
    if ext in DEFAULT_FILE_TYPES["pdf"]:
        return "pdf"
    elif ext in DEFAULT_FILE_TYPES["image"]:
        return "image"
    elif ext in DEFAULT_FILE_TYPES["document"]:
        return "document"
    elif ext in DEFAULT_FILE_TYPES["csv"]:
        return "csv"
    elif ext in DEFAULT_FILE_TYPES["text"]:
        return "text"
    else:
        return "other"


def generate_scan_summary(files: List[Dict[str, Any]]) -> Dict[str, Any]:
    """生成扫描摘要
    
    Args:
        files: 文件列表
    
    Returns:
        摘要字典
    """
    from collections import defaultdict
    
    type_count = defaultdict(int)
    ext_count = defaultdict(int)
    
    for f in files:
        type_count[f["file_type"]] += 1
        ext_count[f["extension"]] += 1
    
    return {
        "by_type": dict(type_count),
        "by_extension": dict(ext_count),
    }
