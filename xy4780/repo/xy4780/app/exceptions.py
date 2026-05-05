from fastapi import HTTPException, status
from typing import Optional, Dict, Any


class AppException(HTTPException):
    error_code: str
    
    def __init__(
        self,
        status_code: int,
        error_code: str,
        message: str,
        details: Optional[Dict[str, Any]] = None
    ):
        self.error_code = error_code
        self.details = details
        super().__init__(
            status_code=status_code,
            detail={
                "error_code": error_code,
                "message": message,
                "details": details
            }
        )


class ApplicationNotFoundException(AppException):
    def __init__(self, application_id: int):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="APPLICATION_NOT_FOUND",
            message=f"申请记录不存在: {application_id}",
            details={"application_id": application_id}
        )


class InvalidStatusTransitionException(AppException):
    def __init__(self, from_status: str, to_status: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="INVALID_STATUS_TRANSITION",
            message=f"无效的状态转换: {from_status} -> {to_status}",
            details={"from_status": from_status, "to_status": to_status}
        )


class TerminalStatusException(AppException):
    def __init__(self, status: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="TERMINAL_STATUS",
            message=f"申请已处于终态，无法进行操作: {status}",
            details={"status": status}
        )


class PermissionDeniedException(AppException):
    def __init__(self, role: str, required_roles: list):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="PERMISSION_DENIED",
            message=f"当前角色 '{role}' 无权限执行此操作",
            details={"current_role": role, "required_roles": required_roles}
        )


class VersionConflictException(AppException):
    def __init__(self, expected: int, actual: int):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            error_code="VERSION_CONFLICT",
            message="版本冲突，请刷新后重试",
            details={"expected_version": expected, "actual_version": actual}
        )


class IdempotentKeyConflictException(AppException):
    def __init__(self, key: str, existing_status: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            error_code="IDEMPOTENT_KEY_CONFLICT",
            message=f"幂等键已被使用但结果不同: {key}",
            details={"idempotent_key": key, "existing_status": existing_status}
        )


class MissingEthicsApprovalException(AppException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="MISSING_ETHICS_APPROVAL",
            message="未上传伦理批件，无法提交申请",
            details={"requirement": "必须上传伦理批件文件"}
        )


class DeidentificationNotPassedException(AppException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="DEIDENTIFICATION_NOT_PASSED",
            message="脱敏复核未通过，无法开放下载",
            details={"requirement": "脱敏复核必须通过"}
        )


class ValidationException(AppException):
    def __init__(self, message: str, field: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="VALIDATION_ERROR",
            message=message,
            details={"field": field} if field else None
        )


class UserNotFoundException(AppException):
    def __init__(self, user_id: int):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="USER_NOT_FOUND",
            message=f"用户不存在: {user_id}",
            details={"user_id": user_id}
        )
