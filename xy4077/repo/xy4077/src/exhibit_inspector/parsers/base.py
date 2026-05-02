"""解析器基类和通用类型"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Generic, Optional, TypeVar

T = TypeVar("T")


class ValidationError(Exception):
    """数据校验错误"""
    
    def __init__(
        self,
        message: str,
        field: Optional[str] = None,
        value: Optional[Any] = None,
        line_number: Optional[int] = None,
        source_file: Optional[str] = None,
    ):
        self.message = message
        self.field = field
        self.value = value
        self.line_number = line_number
        self.source_file = source_file
        super().__init__(self._format_message())
    
    def _format_message(self) -> str:
        parts = [self.message]
        if self.field:
            parts.append(f"[字段: {self.field}]")
        if self.line_number is not None:
            parts.append(f"[行号: {self.line_number}]")
        if self.source_file:
            parts.append(f"[文件: {self.source_file}]")
        return " ".join(parts)


@dataclass
class ParserResult(Generic[T]):
    """解析结果"""
    data: list[T] = field(default_factory=list)
    errors: list[ValidationError] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    source_file: Optional[str] = None
    total_rows: int = 0
    valid_rows: int = 0
    
    @property
    def has_errors(self) -> bool:
        return len(self.errors) > 0
    
    @property
    def has_warnings(self) -> bool:
        return len(self.warnings) > 0
    
    @property
    def success_rate(self) -> float:
        if self.total_rows == 0:
            return 0.0
        return self.valid_rows / self.total_rows
