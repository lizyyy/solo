from typing import Optional, Any


class QualityCheckException(Exception):
    def __init__(
        self,
        message: str,
        user_friendly_message: Optional[str] = None,
        status_code: int = 400,
        error_code: str = "QC_ERROR",
        details: Optional[Any] = None
    ):
        self.message = message
        self.user_friendly_message = user_friendly_message or message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details
        super().__init__(self.message)


class ResourceNotFoundException(QualityCheckException):
    def __init__(
        self,
        resource: str,
        resource_id: Optional[Any] = None,
        user_friendly_message: Optional[str] = None
    ):
        message = f"{resource} not found"
        if resource_id:
            message += f" with id: {resource_id}"
        super().__init__(
            message=message,
            user_friendly_message=user_friendly_message or f"找不到对应的{resource}哦～",
            status_code=404,
            error_code="RESOURCE_NOT_FOUND"
        )


class ValidationException(QualityCheckException):
    def __init__(
        self,
        message: str,
        user_friendly_message: Optional[str] = None,
        details: Optional[Any] = None
    ):
        super().__init__(
            message=message,
            user_friendly_message=user_friendly_message or "数据格式有问题，检查一下内容再试试？",
            status_code=400,
            error_code="VALIDATION_ERROR",
            details=details
        )


class FileParseException(QualityCheckException):
    def __init__(
        self,
        filename: str,
        message: str,
        user_friendly_message: Optional[str] = None
    ):
        super().__init__(
            message=f"Failed to parse file {filename}: {message}",
            user_friendly_message=user_friendly_message or f"文件 {filename} 解析失败，检查一下文件格式？",
            status_code=400,
            error_code="FILE_PARSE_ERROR"
        )


class BusinessException(QualityCheckException):
    def __init__(
        self,
        message: str,
        user_friendly_message: Optional[str] = None,
        error_code: str = "BUSINESS_ERROR",
        details: Optional[Any] = None
    ):
        super().__init__(
            message=message,
            user_friendly_message=user_friendly_message or message,
            status_code=400,
            error_code=error_code,
            details=details
        )
