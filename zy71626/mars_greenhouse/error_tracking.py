"""
错误追踪和异常处理系统
"""

from dataclasses import dataclass
from typing import List, Optional, Any, Dict
from datetime import datetime
import traceback
import logging
from .models import DataSource


logger = logging.getLogger(__name__)


@dataclass
class ErrorRecord:
    """错误记录"""
    error_id: str
    error_type: str
    error_message: str
    severity: str
    source_file: Optional[str]
    source_line: Optional[int]
    object_id: Optional[str]
    object_type: Optional[str]
    field_name: Optional[str]
    current_value: Any
    expected_range: Optional[str]
    timestamp: datetime
    stack_trace: Optional[str]
    data_source: Optional[DataSource]


class ErrorTracker:
    """错误追踪器"""
    
    def __init__(self):
        self.errors: List[ErrorRecord] = []
        self.warnings: List[ErrorRecord] = []
        self._error_counter = 0
    
    def track_error(
        self,
        error_type: str,
        error_message: str,
        severity: str = "error",
        source_file: Optional[str] = None,
        source_line: Optional[int] = None,
        object_id: Optional[str] = None,
        object_type: Optional[str] = None,
        field_name: Optional[str] = None,
        current_value: Any = None,
        expected_range: Optional[str] = None,
        data_source: Optional[DataSource] = None,
        exception: Optional[Exception] = None
    ) -> str:
        """
        记录错误
        
        Returns:
            error_id: 错误ID，用于后续追踪
        """
        self._error_counter += 1
        error_id = f"ERR_{self._error_counter:06d}"
        
        stack_trace = None
        if exception:
            stack_trace = traceback.format_exc()
        
        record = ErrorRecord(
            error_id=error_id,
            error_type=error_type,
            error_message=error_message,
            severity=severity,
            source_file=source_file,
            source_line=source_line,
            object_id=object_id,
            object_type=object_type,
            field_name=field_name,
            current_value=current_value,
            expected_range=expected_range,
            timestamp=datetime.now(),
            stack_trace=stack_trace,
            data_source=data_source
        )
        
        if severity == "warning":
            self.warnings.append(record)
            logger.warning(f"[{error_id}] {error_message}")
        else:
            self.errors.append(record)
            logger.error(f"[{error_id}] {error_message}")
        
        return error_id
    
    def get_errors_by_type(self, error_type: str) -> List[ErrorRecord]:
        """按类型获取错误"""
        return [e for e in self.errors if e.error_type == error_type]
    
    def get_errors_by_object(self, object_id: str) -> List[ErrorRecord]:
        """按对象ID获取错误"""
        return [e for e in self.errors if e.object_id == object_id]
    
    def get_error_summary(self) -> Dict[str, Any]:
        """获取错误摘要"""
        return {
            "total_errors": len(self.errors),
            "total_warnings": len(self.warnings),
            "error_types": list(set(e.error_type for e in self.errors)),
            "affected_objects": list(set(e.object_id for e in self.errors if e.object_id)),
            "latest_errors": self.errors[-5:] if self.errors else []
        }
    
    def has_critical_errors(self) -> bool:
        """是否有严重错误"""
        return any(e.severity == "critical" for e in self.errors)
    
    def clear(self):
        """清空所有错误记录"""
        self.errors.clear()
        self.warnings.clear()
    
    def generate_error_report(self) -> str:
        """生成错误报告（给同事看的格式）"""
        lines = []
        lines.append("=" * 80)
        lines.append("火星温室能量局 - 错误分析报告")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 80)
        lines.append("")
        
        lines.append(f"【统计概览】")
        lines.append(f"  错误总数: {len(self.errors)}")
        lines.append(f"  警告总数: {len(self.warnings)}")
        lines.append("")
        
        if self.errors:
            lines.append(f"【详细错误列表】")
            lines.append("-" * 80)
            for err in self.errors:
                lines.append(f"[{err.error_id}] {err.error_type} - {err.severity.upper()}")
                lines.append(f"  时间: {err.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
                lines.append(f"  描述: {err.error_message}")
                if err.source_file:
                    lines.append(f"  来源文件: {err.source_file}" + (f":{err.source_line}" if err.source_line else ""))
                if err.object_id:
                    lines.append(f"  关联对象: {err.object_type or 'unknown'}#{err.object_id}")
                if err.field_name:
                    lines.append(f"  字段: {err.field_name} = {repr(err.current_value)}")
                if err.expected_range:
                    lines.append(f"  期望范围: {err.expected_range}")
                if err.data_source:
                    lines.append(f"  数据来源: {err.data_source.file_path} (版本: {err.data_source.version})")
                lines.append("")
        
        if self.warnings:
            lines.append(f"【警告列表】")
            lines.append("-" * 80)
            for warn in self.warnings:
                lines.append(f"[{warn.error_id}] {warn.error_type}")
                lines.append(f"  描述: {warn.error_message}")
                lines.append("")
        
        lines.append("=" * 80)
        return "\n".join(lines)


# 全局错误追踪器实例
_global_error_tracker = ErrorTracker()


def get_global_error_tracker() -> ErrorTracker:
    """获取全局错误追踪器"""
    return _global_error_tracker


def track_error_safe(func):
    """
    装饰器：安全追踪函数错误，不抛出异常
    """
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            tracker = get_global_error_tracker()
            tracker.track_error(
                error_type="UnexpectedException",
                error_message=f"函数执行异常: {str(e)}",
                severity="critical",
                source_file=func.__code__.co_filename,
                source_line=func.__code__.co_firstlineno,
                exception=e
            )
            return None
    return wrapper
