"""基础CSV解析器"""

import csv
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Generic, List, Optional, TypeVar, Union

T = TypeVar("T")


@dataclass
class ParseError:
    """解析错误"""

    line_number: int
    field_name: Optional[str]
    error_type: str
    message: str
    raw_value: Optional[Any] = None
    context: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "line_number": self.line_number,
            "field_name": self.field_name,
            "error_type": self.error_type,
            "message": self.message,
            "raw_value": self.raw_value,
            "context": self.context,
        }


@dataclass
class ParseResult(Generic[T]):
    """解析结果"""

    success: bool = True
    data: Optional[T] = None
    raw_records: List[Dict[str, Any]] = field(default_factory=list)
    errors: List[ParseError] = field(default_factory=list)
    warnings: List[ParseError] = field(default_factory=list)
    source_file: Optional[str] = None
    parsed_at: datetime = field(default_factory=datetime.now)
    total_lines: int = 0
    valid_lines: int = 0
    invalid_lines: int = 0

    def add_error(self, error: ParseError) -> None:
        """添加错误"""
        self.errors.append(error)
        self.success = False

    def add_warning(self, warning: ParseError) -> None:
        """添加警告"""
        self.warnings.append(warning)

    def has_errors(self) -> bool:
        """是否有错误"""
        return len(self.errors) > 0

    def has_warnings(self) -> bool:
        """是否有警告"""
        return len(self.warnings) > 0

    def get_error_count(self) -> int:
        """获取错误数量"""
        return len(self.errors)

    def get_warning_count(self) -> int:
        """获取警告数量"""
        return len(self.warnings)


class BaseCSVParser(ABC, Generic[T]):
    """基础CSV解析器抽象类"""

    def __init__(
        self,
        encoding: str = "utf-8-sig",
        delimiter: str = ",",
        quotechar: str = '"',
        has_header: bool = True,
        strict_mode: bool = False,
    ):
        """
        初始化解析器

        Args:
            encoding: 文件编码
            delimiter: 分隔符
            quotechar: 引号字符
            has_header: 是否有表头
            strict_mode: 严格模式（所有列必须匹配）
        """
        self.encoding = encoding
        self.delimiter = delimiter
        self.quotechar = quotechar
        self.has_header = has_header
        self.strict_mode = strict_mode
        self._field_mapping: Dict[str, str] = {}  # CSV列名 -> 内部字段名映射

    @abstractmethod
    def get_required_fields(self) -> List[str]:
        """获取必需的字段列表"""
        pass

    @abstractmethod
    def get_optional_fields(self) -> List[str]:
        """获取可选的字段列表"""
        pass

    @abstractmethod
    def get_field_mapping(self) -> Dict[str, str]:
        """
        获取CSV列名到内部字段名的映射

        返回:
            Dict[csv_column_name, internal_field_name]
        """
        pass

    @abstractmethod
    def parse_record(self, record: Dict[str, Any], line_number: int) -> Optional[Any]:
        """
        解析单条记录

        Args:
            record: CSV行数据（字典格式）
            line_number: 行号

        Returns:
            解析后的对象，如果解析失败返回None
        """
        pass

    @abstractmethod
    def build_result(self, records: List[Any], raw_records: List[Dict[str, Any]], source_file: str) -> T:
        """
        构建最终结果对象

        Args:
            records: 解析后的记录列表
            raw_records: 原始CSV记录列表
            source_file: 源文件名

        Returns:
            最终的结果对象
        """
        pass

    def parse_file(self, file_path: Union[str, Path]) -> ParseResult[T]:
        """
        解析CSV文件

        Args:
            file_path: CSV文件路径

        Returns:
            解析结果
        """
        file_path = Path(file_path).resolve()
        result = ParseResult[T](
            source_file=str(file_path),
            total_lines=0,
            valid_lines=0,
            invalid_lines=0,
        )

        try:
            with open(file_path, "r", encoding=self.encoding) as f:
                reader = csv.DictReader(
                    f,
                    delimiter=self.delimiter,
                    quotechar=self.quotechar,
                )

                # 验证表头
                if reader.fieldnames:
                    self._validate_headers(list(reader.fieldnames), result)
                else:
                    result.add_error(ParseError(
                        line_number=1,
                        field_name=None,
                        error_type="header_error",
                        message="CSV文件缺少表头",
                    ))
                    return result

                parsed_records: List[Any] = []
                raw_records: List[Dict[str, Any]] = []

                for line_number, row in enumerate(reader, start=2):  # 行号从2开始（表头是第1行）
                    result.total_lines += 1
                    raw_records.append(dict(row))

                    try:
                        # 应用字段映射
                        mapped_row = self._apply_field_mapping(row)

                        # 验证必需字段
                        validation_errors = self._validate_required_fields(mapped_row, line_number)
                        if validation_errors:
                            for error in validation_errors:
                                result.add_error(error)
                            result.invalid_lines += 1
                            continue

                        # 解析记录
                        parsed = self.parse_record(mapped_row, line_number)
                        if parsed is not None:
                            parsed_records.append(parsed)
                            result.valid_lines += 1
                        else:
                            result.invalid_lines += 1

                    except Exception as e:
                        result.add_error(ParseError(
                            line_number=line_number,
                            field_name=None,
                            error_type="parse_exception",
                            message=f"解析行时发生异常: {str(e)}",
                            raw_value=dict(row),
                        ))
                        result.invalid_lines += 1

                # 构建最终结果
                result.raw_records = raw_records
                if parsed_records:
                    result.data = self.build_result(
                        parsed_records,
                        raw_records,
                        str(file_path),
                    )

        except FileNotFoundError:
            result.add_error(ParseError(
                line_number=0,
                field_name=None,
                error_type="file_not_found",
                message=f"文件不存在: {file_path}",
            ))
        except Exception as e:
            result.add_error(ParseError(
                line_number=0,
                field_name=None,
                error_type="read_error",
                message=f"读取文件时发生错误: {str(e)}",
            ))

        return result

    def _validate_headers(self, headers: List[str], result: ParseResult) -> None:
        """验证表头"""
        mapping = self.get_field_mapping()
        required_csv_fields = [k for k, v in mapping.items() if v in self.get_required_fields()]

        for required in required_csv_fields:
            if required not in headers:
                result.add_error(ParseError(
                    line_number=1,
                    field_name=required,
                    error_type="missing_header",
                    message=f"缺少必需的表头列: {required}",
                ))

    def _apply_field_mapping(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """应用字段映射"""
        mapping = self.get_field_mapping()
        result: Dict[str, Any] = {}

        for csv_col, internal_field in mapping.items():
            if csv_col in row:
                value = row[csv_col]
                if isinstance(value, str):
                    value = value.strip()
                result[internal_field] = value

        # 同时保留原始键（用于调试）
        for k, v in row.items():
            if k not in result:
                if isinstance(v, str):
                    v = v.strip()
                result[k] = v

        return result

    def _validate_required_fields(self, row: Dict[str, Any], line_number: int) -> List[ParseError]:
        """验证必需字段"""
        errors: List[ParseError] = []
        required = self.get_required_fields()

        for field in required:
            if field not in row or row[field] is None or str(row[field]).strip() == "":
                errors.append(ParseError(
                    line_number=line_number,
                    field_name=field,
                    error_type="missing_required_field",
                    message=f"缺少必需字段: {field}",
                ))

        return errors

    def _parse_float(self, value: Any, field_name: str, line_number: int, default: Optional[float] = None) -> Optional[float]:
        """解析浮点数值"""
        if value is None or str(value).strip() == "":
            return default
        try:
            return float(str(value).strip().replace(",", ""))
        except ValueError:
            return default

    def _parse_int(self, value: Any, field_name: str, line_number: int, default: Optional[int] = None) -> Optional[int]:
        """解析整数值"""
        if value is None or str(value).strip() == "":
            return default
        try:
            return int(str(value).strip().replace(",", ""))
        except ValueError:
            return default

    def _parse_bool(self, value: Any, field_name: str, line_number: int, default: bool = False) -> bool:
        """解析布尔值"""
        if value is None:
            return default
        if isinstance(value, bool):
            return value
        value_str = str(value).strip().lower()
        return value_str in ["是", "yes", "y", "true", "t", "1"]

    def _parse_list(self, value: Any, field_name: str, line_number: int, separator: str = ",") -> List[str]:
        """解析列表值"""
        if value is None or str(value).strip() == "":
            return []
        return [item.strip() for item in str(value).split(separator) if item.strip()]
