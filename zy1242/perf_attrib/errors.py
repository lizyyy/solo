"""
错误处理模块 - 定义自定义异常和格式化错误信息
"""

import traceback
from typing import Optional, Dict, Any


class PerfAttribError(Exception):
    """
    性能归因工具的基础异常类
    """
    
    def __init__(
        self, 
        message: str, 
        error_code: str = "UNKNOWN_ERROR",
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)
    
    def __str__(self):
        return f"[{self.error_code}] {self.message}"


class FileFormatError(PerfAttribError):
    """
    文件格式错误 - 当输入的性能数据文件格式不正确时抛出
    """
    
    def __init__(
        self, 
        message: str, 
        file_path: str,
        file_type: Optional[str] = None,
        line_number: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            error_code="FILE_FORMAT_ERROR",
            details={
                "file_path": file_path,
                "file_type": file_type,
                "line_number": line_number,
                **(details or {})
            }
        )
        self.file_path = file_path
        self.file_type = file_type
        self.line_number = line_number


class MissingDataError(PerfAttribError):
    """
    缺失数据错误 - 当分析需要的数据不存在时抛出
    """
    
    def __init__(
        self, 
        message: str, 
        missing_field: str,
        context: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            error_code="MISSING_DATA_ERROR",
            details={
                "missing_field": missing_field,
                "context": context,
                **(details or {})
            }
        )
        self.missing_field = missing_field
        self.context = context


class AnalysisNotFoundError(PerfAttribError):
    """
    分析记录不存在错误
    """
    
    def __init__(
        self, 
        analysis_id: int,
        message: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        if message is None:
            message = f"分析记录 ID {analysis_id} 不存在"
        super().__init__(
            message=message,
            error_code="ANALYSIS_NOT_FOUND",
            details={
                "analysis_id": analysis_id,
                **(details or {})
            }
        )
        self.analysis_id = analysis_id


class InvalidComparisonError(PerfAttribError):
    """
    无效对比错误
    """
    
    def __init__(
        self, 
        message: str,
        reason: str,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            error_code="INVALID_COMPARISON",
            details={
                "reason": reason,
                **(details or {})
            }
        )
        self.reason = reason


class ExportError(PerfAttribError):
    """
    导出错误
    """
    
    def __init__(
        self, 
        message: str,
        export_format: str,
        output_path: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            error_code="EXPORT_ERROR",
            details={
                "export_format": export_format,
                "output_path": output_path,
                **(details or {})
            }
        )
        self.export_format = export_format
        self.output_path = output_path


def format_error(e: Exception, include_traceback: bool = False) -> str:
    """
    格式化错误信息用于显示
    
    Args:
        e: 异常对象
        include_traceback: 是否包含堆栈跟踪
    
    Returns:
        格式化后的错误信息字符串
    """
    lines = []
    
    if isinstance(e, PerfAttribError):
        lines.append(f"\n❌ {e.message}")
        lines.append(f"   错误代码: {e.error_code}")
        
        if e.details:
            lines.append("   详细信息:")
            for key, value in e.details.items():
                if value is not None:
                    lines.append(f"      {key}: {value}")
    else:
        lines.append(f"\n❌ 错误: {str(e)}")
        lines.append(f"   类型: {type(e).__name__}")
    
    if include_traceback:
        lines.append("\n   堆栈跟踪:")
        tb_lines = traceback.format_exc().split("\n")
        for line in tb_lines:
            lines.append(f"   {line}")
    
    return "\n".join(lines)


def suggest_solution(e: Exception) -> Optional[str]:
    """
    为常见错误提供解决方案建议
    
    Args:
        e: 异常对象
    
    Returns:
        解决方案建议字符串，如果没有则返回 None
    """
    if isinstance(e, FileFormatError):
        suggestions = []
        suggestions.append(f"请检查文件格式是否正确: {e.file_path}")
        
        if e.file_type == "cprofile":
            suggestions.append("cProfile 文件应使用 `python -m cProfile -o output.prof script.py` 生成")
            suggestions.append("或者使用 pstats 格式的文本输出")
        
        if e.file_type == "pystats":
            suggestions.append("py-spy 采样应使用 `py-spy record -o profile.svg -- python script.py` 或 `py-spy dump` 格式")
        
        return "\n".join(suggestions)
    
    if isinstance(e, AnalysisNotFoundError):
        return f"请确认分析 ID 是否正确。使用 `perf-attrib list` 查看所有可用的分析记录。"
    
    if isinstance(e, MissingDataError):
        return f"缺少必要字段 '{e.missing_field}'。请确保输入的数据包含所有必要信息。"
    
    if isinstance(e, InvalidComparisonError):
        return f"对比无效: {e.reason}。请确保两个分析记录包含可对比的数据类型。"
    
    if isinstance(e, ExportError):
        if e.export_format == "markdown":
            return "请确保输出路径有写入权限，并且目录存在。"
        if e.export_format == "json":
            return "JSON 导出需要有效的分析数据。"
    
    return None
