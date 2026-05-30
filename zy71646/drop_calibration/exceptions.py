"""
自定义异常类，提供详细的错误定位信息
"""
from dataclasses import dataclass, field
from typing import Optional, Any, Dict, List


@dataclass
class ErrorLocation:
    """错误定位信息"""
    source_file: Optional[str] = None
    sheet_name: Optional[str] = None
    row_number: Optional[int] = None
    column_name: Optional[str] = None
    object_id: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None
    extra_info: Dict[str, Any] = field(default_factory=dict)

    def __str__(self) -> str:
        parts = []
        if self.source_file:
            parts.append(f"文件: {self.source_file}")
        if self.sheet_name:
            parts.append(f"工作表: {self.sheet_name}")
        if self.row_number is not None:
            parts.append(f"行号: {self.row_number}")
        if self.column_name:
            parts.append(f"列: {self.column_name}")
        if self.object_id:
            parts.append(f"对象ID: {self.object_id}")
        return ", ".join(parts) if parts else "未知位置"


class DropCalibrationError(Exception):
    """基础异常类，所有自定义异常的基类"""
    def __init__(
        self,
        message: str,
        location: Optional[ErrorLocation] = None,
        *args: Any
    ) -> None:
        self.location = location or ErrorLocation()
        super().__init__(message, *args)

    def __str__(self) -> str:
        base_msg = super().__str__()
        loc_str = str(self.location)
        if loc_str and loc_str != "未知位置":
            return f"{base_msg} (位置: {loc_str})"
        return base_msg


class DataImportError(DropCalibrationError):
    """数据导入异常"""
    pass


class DataValidationError(DropCalibrationError):
    """数据校验异常"""
    pass


class ProbabilityCalculationError(DropCalibrationError):
    """概率计算异常"""
    pass


class ReportExportError(DropCalibrationError):
    """报告导出异常"""
    pass


class BatchProcessingError(DropCalibrationError):
    """批量处理异常，包含多个子错误"""
    def __init__(
        self,
        message: str,
        errors: List[DropCalibrationError],
        location: Optional[ErrorLocation] = None,
        *args: Any
    ) -> None:
        super().__init__(message, location, *args)
        self.errors = errors

    def __str__(self) -> str:
        base_msg = super().__str__()
        error_details = "\n".join([f"  - {str(e)}" for e in self.errors])
        return f"{base_msg}\n详细错误:\n{error_details}"


def create_error_location(
    source_file: Optional[str] = None,
    sheet_name: Optional[str] = None,
    row_number: Optional[int] = None,
    column_name: Optional[str] = None,
    object_id: Optional[str] = None,
    raw_data: Optional[Dict[str, Any]] = None,
    **extra_info,
) -> ErrorLocation:
    """
    创建错误定位信息的辅助函数

    Args:
        source_file: 源文件路径
        sheet_name: 工作表名（Excel文件）
        row_number: 行号（从1开始）
        column_name: 列名
        object_id: 对象ID
        raw_data: 原始数据
        **extra_info: 额外信息

    Returns:
        ErrorLocation 对象
    """
    return ErrorLocation(
        source_file=source_file,
        sheet_name=sheet_name,
        row_number=row_number,
        column_name=column_name,
        object_id=object_id,
        raw_data=raw_data,
        extra_info=extra_info,
    )
