"""异常处理模块。

定义所有业务相关的异常类型，确保异常信息包含足够的上下文供同事理解。
每个异常都包含：来源文件、原始行号、触发对象、异常理由。
"""

from __future__ import annotations

from typing import Any, Dict, Optional


class TideBerthException(Exception):
    """基础异常类，所有业务异常的基类。"""

    def __init__(
        self,
        message: str,
        source_file: Optional[str] = None,
        line_number: Optional[int] = None,
        object_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.source_file = source_file
        self.line_number = line_number
        self.object_id = object_id
        self.details = details or {}

    def __str__(self) -> str:
        parts = [f"[错误] {super().__str__()}"]
        if self.source_file:
            parts.append(f"  来源文件: {self.source_file}")
        if self.line_number is not None:
            parts.append(f"  原始行号: {self.line_number}")
        if self.object_id:
            parts.append(f"  触发对象: {self.object_id}")
        if self.details:
            parts.append("  详细信息:")
            for key, value in self.details.items():
                parts.append(f"    {key}: {value}")
        return "\n".join(parts)


class TimeZoneError(TideBerthException):
    """时区错误。

    当潮位数据的时区与预期不符、或缺失时区信息时触发。
    常见场景：
    - 潮位数据使用当地时间但未标注时区
    - 不同来源数据时区不一致（如UTC vs 北京时间）
    - 夏令时转换期间的时间歧义
    """

    def __init__(
        self,
        message: str,
        source_file: Optional[str] = None,
        line_number: Optional[int] = None,
        object_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        expected_tz: Optional[str] = None,
        actual_tz: Optional[str] = None,
    ) -> None:
        super().__init__(message, source_file, line_number, object_id, details)
        self.expected_tz = expected_tz
        self.actual_tz = actual_tz


class MissingDataError(TideBerthException):
    """数据缺失错误。

    当必要的数据字段缺失时触发，特别是风速缺测、潮位断档等。
    """

    def __init__(
        self,
        message: str,
        source_file: Optional[str] = None,
        line_number: Optional[int] = None,
        object_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        missing_field: Optional[str] = None,
        missing_time: Optional[str] = None,
    ) -> None:
        super().__init__(message, source_file, line_number, object_id, details)
        self.missing_field = missing_field
        self.missing_time = missing_time


class DraftExceedError(TideBerthException):
    """吃水超限错误。

    当船舶吃水超过泊位设计水深、或即使在高潮位也无法满足安全余量时触发。
    """

    def __init__(
        self,
        message: str,
        source_file: Optional[str] = None,
        line_number: Optional[int] = None,
        object_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ship_draft: Optional[float] = None,
        available_depth: Optional[float] = None,
        required_margin: Optional[float] = None,
    ) -> None:
        super().__init__(message, source_file, line_number, object_id, details)
        self.ship_draft = ship_draft
        self.available_depth = available_depth
        self.required_margin = required_margin


class WindSpeedExceedError(TideBerthException):
    """风速超限错误。

    当风速超过安全靠泊阈值时触发。
    """

    def __init__(
        self,
        message: str,
        source_file: Optional[str] = None,
        line_number: Optional[int] = None,
        object_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        wind_speed: Optional[float] = None,
        threshold: Optional[float] = None,
    ) -> None:
        super().__init__(message, source_file, line_number, object_id, details)
        self.wind_speed = wind_speed
        self.threshold = threshold


class DataConflictError(TideBerthException):
    """数据冲突错误。

    当同一时间点存在多份不一致的数据时触发。
    例如：同一时刻有两个不同的潮位值，需要保留所有版本供人工判断。
    """

    def __init__(
        self,
        message: str,
        source_file: Optional[str] = None,
        line_number: Optional[int] = None,
        object_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        conflict_time: Optional[str] = None,
        versions: Optional[list] = None,
    ) -> None:
        super().__init__(message, source_file, line_number, object_id, details)
        self.conflict_time = conflict_time
        self.versions = versions or []


class ValidationError(TideBerthException):
    """数据验证错误。

    当数据格式、单位、取值范围不符合预期时触发。
    """

    def __init__(
        self,
        message: str,
        source_file: Optional[str] = None,
        line_number: Optional[int] = None,
        object_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        field_name: Optional[str] = None,
        invalid_value: Optional[Any] = None,
        expected_range: Optional[str] = None,
    ) -> None:
        super().__init__(message, source_file, line_number, object_id, details)
        self.field_name = field_name
        self.invalid_value = invalid_value
        self.expected_range = expected_range


class UnitError(TideBerthException):
    """单位错误。

    当数据单位与预期不符时触发（如潮位用英尺但程序按米计算）。
    """

    def __init__(
        self,
        message: str,
        source_file: Optional[str] = None,
        line_number: Optional[int] = None,
        object_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        expected_unit: Optional[str] = None,
        actual_unit: Optional[str] = None,
    ) -> None:
        super().__init__(message, source_file, line_number, object_id, details)
        self.expected_unit = expected_unit
        self.actual_unit = actual_unit
