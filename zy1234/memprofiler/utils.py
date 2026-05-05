"""
工具函数模块
提供通用的辅助函数
"""

import re
import json
import os
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime


def format_size(size_bytes: int) -> str:
    """格式化字节大小为可读格式"""
    if size_bytes == 0:
        return "0 B"
    
    units = ["B", "KB", "MB", "GB", "TB"]
    size = size_bytes
    unit_index = 0
    
    while size >= 1024 and unit_index < len(units) - 1:
        size /= 1024
        unit_index += 1
    
    return f"{size:.2f} {units[unit_index]}"


def parse_size(size_str: str) -> int:
    """解析大小字符串为字节数"""
    size_str = size_str.strip().upper()
    
    patterns = {
        "TB": 1024**4,
        "GB": 1024**3,
        "MB": 1024**2,
        "KB": 1024,
        "B": 1,
    }
    
    for unit, multiplier in patterns.items():
        if size_str.endswith(unit):
            try:
                value = float(size_str[:-len(unit)].strip())
                return int(value * multiplier)
            except ValueError:
                pass
    
    try:
        return int(size_str)
    except ValueError:
        raise ValueError(f"无法解析大小: {size_str}")


def safe_json_loads(json_str: str, file_path: str = None) -> Tuple[Optional[Any], List[str]]:
    """安全解析JSON，返回解析结果和错误提示列表"""
    errors = []
    
    try:
        return json.loads(json_str), errors
    except json.JSONDecodeError as e:
        line = e.lineno
        col = e.colno
        msg = e.msg
        
        errors.append(f"JSON解析错误: {msg}")
        errors.append(f"位置: 第{line}行, 第{col}列")
        
        if file_path:
            errors.append(f"文件: {file_path}")
        
        lines = json_str.split("\n")
        if line <= len(lines):
            error_line = lines[line - 1]
            errors.append(f"问题行: {error_line}")
            
            if col <= len(error_line):
                pointer = " " * (col - 1) + "^"
                errors.append(f"        {pointer}")
        
        suggestions = []
        if msg == "Expecting property name enclosed in double quotes":
            suggestions.append("检查是否使用了单引号而不是双引号")
            suggestions.append("JSON要求属性名必须使用双引号")
        elif msg == "Expecting value":
            suggestions.append("检查是否有遗漏的逗号或括号")
            suggestions.append("检查最后一个元素后是否有多余的逗号")
        elif "control character" in msg.lower():
            suggestions.append("检查是否有未转义的控制字符")
            suggestions.append("换行符需要转义为 \\n")
        
        if suggestions:
            errors.append("建议:")
            for s in suggestions:
                errors.append(f"  - {s}")
        
        return None, errors


def validate_json_structure(data: Any, required_fields: List[str], 
                             file_path: str = None) -> List[str]:
    """验证JSON结构是否包含必需字段"""
    errors = []
    
    if not isinstance(data, dict):
        errors.append("JSON根节点必须是对象")
        return errors
    
    for field in required_fields:
        if field not in data:
            errors.append(f"缺少必需字段: {field}")
    
    if errors and file_path:
        errors.insert(0, f"文件: {file_path}")
    
    return errors


def extract_memory_patterns(text: str) -> Dict[str, List[str]]:
    """从文本中提取内存相关的模式"""
    patterns = {
        "memory_leak_keywords": [],
        "gc_related": [],
        "ref_count": [],
        "weakref": [],
        "del_method": [],
        "cycle_reference": [],
    }
    
    leak_keywords = [
        "memory.*leak", "内存泄漏", "内存泄露",
        "out of memory", "OOM", "内存不足",
        "memory.*grow", "内存增长",
        "memory.*increase", "内存增加",
    ]
    
    gc_keywords = [
        r"gc\.", "garbage.*collect", "垃圾回收",
        r"gc\.collect", r"gc\.disable", r"gc\.enable",
        r"gc\.set_debug", "DEBUG_LEAK",
    ]
    
    ref_keywords = [
        "refcount", "ref.*count", "引用计数",
        r"sys\.getrefcount",
    ]
    
    weakref_keywords = [
        "weakref", "WeakKeyDictionary", "WeakValueDictionary",
        "WeakSet", "弱引用",
    ]
    
    del_keywords = [
        r"__del__", r"del\s+",
    ]
    
    cycle_keywords = [
        "cycle.*reference", "循环引用",
        "circular.*reference",
        "uncollectable", "不可回收",
    ]
    
    def find_patterns(keywords: List[str]) -> List[str]:
        found = []
        for kw in keywords:
            matches = re.findall(kw, text, re.IGNORECASE)
            found.extend(matches)
        return list(set(found))
    
    patterns["memory_leak_keywords"] = find_patterns(leak_keywords)
    patterns["gc_related"] = find_patterns(gc_keywords)
    patterns["ref_count"] = find_patterns(ref_keywords)
    patterns["weakref"] = find_patterns(weakref_keywords)
    patterns["del_method"] = find_patterns(del_keywords)
    patterns["cycle_reference"] = find_patterns(cycle_keywords)
    
    return patterns


def parse_gc_log_line(line: str) -> Optional[Dict[str, Any]]:
    """解析单行GC日志"""
    result = {}
    
    uncollectable_pattern = r"uncollectable.*<([^>]+?)\s+at\s+(0x[0-9a-fA-F]+)>"
    match = re.search(uncollectable_pattern, line, re.IGNORECASE)
    if match:
        result["type"] = "uncollectable"
        result["obj_type"] = match.group(1)
        result["address"] = match.group(2)
    
    cycle_pattern = r"cycle.*\((\d+)\s+objects?\)"
    match = re.search(cycle_pattern, line, re.IGNORECASE)
    if match:
        result["cycle_objects"] = int(match.group(1))
    
    del_pattern = r"has\s+__del__"
    if re.search(del_pattern, line, re.IGNORECASE):
        result["has_del"] = True
    
    return result if result else None


def extract_code_snippets(file_path: str, keywords: List[str],
                           context_lines: int = 3) -> List[Dict[str, Any]]:
    """从文件中提取包含关键字的代码片段"""
    snippets = []
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except (UnicodeDecodeError, IOError):
        return snippets
    
    for i, line in enumerate(lines):
        for keyword in keywords:
            if re.search(keyword, line, re.IGNORECASE):
                start = max(0, i - context_lines)
                end = min(len(lines), i + context_lines + 1)
                
                snippet = {
                    "line_number": i + 1,
                    "keyword": keyword,
                    "snippet": "".join(lines[start:end]),
                    "start_line": start + 1,
                    "end_line": end,
                }
                snippets.append(snippet)
                break
    
    return snippets


def generate_timestamp() -> str:
    """生成时间戳字符串"""
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def ensure_dir(path: str) -> bool:
    """确保目录存在"""
    try:
        os.makedirs(path, exist_ok=True)
        return True
    except OSError:
        return False


def get_file_info(file_path: str) -> Dict[str, Any]:
    """获取文件信息"""
    if not os.path.exists(file_path):
        return {"exists": False}
    
    stat = os.stat(file_path)
    return {
        "exists": True,
        "size": stat.st_size,
        "size_formatted": format_size(stat.st_size),
        "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        "extension": os.path.splitext(file_path)[1].lower(),
    }


def truncate_text(text: str, max_length: int = 200) -> str:
    """截断文本到指定长度"""
    if len(text) <= max_length:
        return text
    return text[:max_length] + "..."
