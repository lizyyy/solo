from fastapi import Request, status
from fastapi.responses import JSONResponse
from datetime import datetime
from typing import Optional, Dict, Any


class TicketAttributionException(Exception):
    def __init__(self, message: str, code: str, status_code: int, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}


class IdempotencyConflict(TicketAttributionException):
    def __init__(self, message: str = "重复提交", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "IDEMPOTENCY_CONFLICT", status.HTTP_409_CONFLICT, details)


class TicketNotFound(TicketAttributionException):
    def __init__(self, ticket_id: str):
        super().__init__(f"工单 {ticket_id} 不存在", "TICKET_NOT_FOUND", status.HTTP_404_NOT_FOUND)


class InvalidStatusTransition(TicketAttributionException):
    def __init__(self, from_status: str, to_status: str):
        super().__init__(f"无效的状态转换: {from_status} -> {to_status}",
                         "INVALID_STATUS_TRANSITION", status.HTTP_400_BAD_REQUEST,
                         {"from_status": from_status, "to_status": to_status})


class ValidationError(TicketAttributionException):
    def __init__(self, message: str, field: Optional[str] = None):
        details = {"field": field} if field else {}
        super().__init__(message, "VALIDATION_ERROR", status.HTTP_400_BAD_REQUEST, details)


def exception_handler(request: Request, exc: TicketAttributionException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.message,
            "code": exc.code,
            "details": exc.details,
            "timestamp": datetime.now().isoformat()
        }
    )


def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "服务器内部错误",
            "code": "INTERNAL_SERVER_ERROR",
            "details": {"type": type(exc).__name__},
            "timestamp": datetime.now().isoformat()
        }
    )