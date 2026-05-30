"""异常分类模块"""

from .base import (
    MortgageException,
    ErrorCategory,
    ErrorSeverity,
    ErrorContext,
)
from .data_errors import (
    DataValidationError,
    MissingFieldError,
    InvalidValueError,
    InconsistentDataError,
)
from .rule_errors import (
    RuleViolationError,
    InvalidPenaltyRuleError,
    UnsupportedStrategyError,
)
from .material_errors import (
    MaterialMissingError,
    IncompleteDataError,
    PendingConfirmationError,
)
from .handler import ExceptionHandler, format_error_message

__all__ = [
    "MortgageException",
    "ErrorCategory",
    "ErrorSeverity",
    "ErrorContext",
    "DataValidationError",
    "MissingFieldError",
    "InvalidValueError",
    "InconsistentDataError",
    "RuleViolationError",
    "InvalidPenaltyRuleError",
    "UnsupportedStrategyError",
    "MaterialMissingError",
    "IncompleteDataError",
    "PendingConfirmationError",
    "ExceptionHandler",
    "format_error_message",
]
