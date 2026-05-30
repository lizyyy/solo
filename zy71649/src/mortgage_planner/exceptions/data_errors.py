"""数据类异常 - 数据录入错误、格式不正确、数值异常等"""

from .base import MortgageException, ErrorCategory, ErrorSeverity, ErrorContext


class DataValidationError(MortgageException):
    """数据验证错误"""
    category = ErrorCategory.DATA_ERROR
    severity = ErrorSeverity.ERROR
    default_message = "数据验证失败"

    def __init__(self, message: str, **kwargs):
        super().__init__(message, **kwargs)


class MissingFieldError(DataValidationError):
    """必填字段缺失"""
    severity = ErrorSeverity.ERROR
    default_message = "必填字段缺失"

    def __init__(self, field_name: str, entity: str = "数据", **kwargs):
        message = f"{entity}缺少必填字段: '{field_name}'"
        context = kwargs.pop("context", None) or ErrorContext(
            field=field_name,
            expected="非空值",
            suggestions=[
                f"请在{entity}中补充 '{field_name}' 字段",
                f"检查导入文件是否包含 '{field_name}' 列",
            ],
        )
        super().__init__(message, context=context, **kwargs)


class InvalidValueError(DataValidationError):
    """字段值无效"""
    severity = ErrorSeverity.ERROR
    default_message = "字段值无效"

    def __init__(self, field_name: str, value, expected: str, entity: str = "数据", **kwargs):
        message = f"{entity}字段 '{field_name}' 值 '{value}' 无效，{expected}"
        context = kwargs.pop("context", None) or ErrorContext(
            field=field_name,
            value=value,
            expected=expected,
            suggestions=[
                f"请修正 '{field_name}' 的值，{expected}",
                f"当前值: {value}",
            ],
        )
        super().__init__(message, context=context, **kwargs)


class InconsistentDataError(DataValidationError):
    """数据不一致"""
    severity = ErrorSeverity.WARNING
    default_message = "数据不一致"

    def __init__(self, message: str, fields: list = None, **kwargs):
        context = kwargs.pop("context", None) or ErrorContext(
            field=", ".join(fields) if fields else None,
            suggestions=[
                "请检查相关字段是否匹配",
                "确认数据来源是否一致",
                "如为修正数据，请使用更新方式重新导入",
            ],
        )
        super().__init__(message, context=context, **kwargs)


class InvalidDateFormatError(InvalidValueError):
    """日期格式错误"""
    def __init__(self, field_name: str, value, **kwargs):
        super().__init__(
            field_name=field_name,
            value=value,
            expected="请使用 YYYY-MM-DD 格式，如 2024-01-15",
            **kwargs,
        )


class InvalidAmountError(InvalidValueError):
    """金额格式错误"""
    def __init__(self, field_name: str, value, **kwargs):
        super().__init__(
            field_name=field_name,
            value=value,
            expected="请输入有效的数字金额（大于0）",
            suggestions=[
                f"请修正 '{field_name}' 的值为有效数字",
                f"示例: 1000000 或 1000000.00",
                f"当前值: {value}",
            ],
            **kwargs,
        )


class InvalidRateError(InvalidValueError):
    """利率格式错误"""
    def __init__(self, field_name: str, value, **kwargs):
        super().__init__(
            field_name=field_name,
            value=value,
            expected="请输入小数形式的利率（如 4.5% 应输入 0.045）",
            suggestions=[
                f"⚠️ 注意：利率应输入小数形式",
                f"4.5% → 0.045，而不是 4.5",
                f"当前值: {value}",
            ],
            **kwargs,
        )


class DuplicateRecordError(DataValidationError):
    """重复记录"""
    severity = ErrorSeverity.WARNING
    default_message = "发现重复记录"

    def __init__(self, entity: str, key_fields: dict, existing_id: str, **kwargs):
        key_desc = ", ".join([f"{k}={v}" for k, v in key_fields.items()])
        message = f"发现重复{entity}，键值: {key_desc}"
        context = kwargs.pop("context", None) or ErrorContext(
            record_id=existing_id,
            suggestions=[
                "如为相同数据，可选择 skip 跳过导入",
                "如为更新数据，可选择 update 更新现有记录",
                "如数据有冲突，可选择 ask 手动处理",
            ],
        )
        super().__init__(message, context=context, **kwargs)
