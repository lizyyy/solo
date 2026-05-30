from typing import Dict, Any, Optional
from fastapi import Request, status
from fastapi.responses import JSONResponse
from .models import RiskType, GradingStatus


class MusicGradingException(Exception):
    def __init__(self, message: str, error_code: str = "GRADING_ERROR",
                 details: Optional[Dict[str, Any]] = None,
                 risk_type: Optional[RiskType] = None,
                 status: GradingStatus = GradingStatus.FAILED):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        self.risk_type = risk_type
        self.status = status
        super().__init__(message)


class InvalidAnswerFormatException(MusicGradingException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="INVALID_ANSWER_FORMAT",
            details=details,
            risk_type=None,
            status=GradingStatus.FAILED
        )


class QuestionTypeMismatchException(MusicGradingException):
    def __init__(self, message: str, expected_type: str, actual_type: str,
                 details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="QUESTION_TYPE_MISMATCH",
            details={
                "expected_type": expected_type,
                "actual_type": actual_type,
                **(details or {})
            },
            risk_type=RiskType.QUESTION_TYPE_MISMATCH,
            status=GradingStatus.NEEDS_REVIEW
        )


class StandardAnswerValidationException(MusicGradingException):
    def __init__(self, message: str, errors: list,
                 details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="STANDARD_ANSWER_INVALID",
            details={
                "validation_errors": errors,
                **(details or {})
            },
            risk_type=RiskType.PARTIAL_SCORE_MISS,
            status=GradingStatus.NEEDS_REVIEW
        )


class EnharmonicEquivalenceException(MusicGradingException):
    def __init__(self, message: str, student_note: str, standard_note: str,
                 position: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="ENHARMONIC_EQUIVALENCE",
            details={
                "student_note": student_note,
                "standard_note": standard_note,
                "position": position,
                **(details or {})
            },
            risk_type=RiskType.ENHARMONIC_MISJUDGE,
            status=GradingStatus.NEEDS_REVIEW
        )


class IncompleteAnswerException(MusicGradingException):
    def __init__(self, message: str, missing_fields: list,
                 details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="INCOMPLETE_ANSWER",
            details={
                "missing_fields": missing_fields,
                **(details or {})
            },
            risk_type=RiskType.PARTIAL_SCORE_MISS,
            status=GradingStatus.NEEDS_REVIEW
        )


class CalculationException(MusicGradingException):
    def __init__(self, message: str, original_error: str,
                 details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="CALCULATION_ERROR",
            details={
                "original_error": original_error,
                **(details or {})
            },
            risk_type=None,
            status=GradingStatus.FAILED
        )


async def music_grading_exception_handler(request: Request, exc: MusicGradingException) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "details": exc.details,
                "risk_type": exc.risk_type.value if exc.risk_type else None,
                "grading_status": exc.status.value
            }
        }
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "服务器内部错误，请联系管理员",
                "details": {"error_type": type(exc).__name__},
                "risk_type": None,
                "grading_status": GradingStatus.FAILED.value
            }
        }
    )
