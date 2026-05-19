class TaskException(Exception):
    error_code: str
    message: str
    details: dict

    def __init__(self, error_code: str, message: str, details: dict = None):
        self.error_code = error_code
        self.message = message
        self.details = details or {}


class MissingFieldException(TaskException):
    def __init__(self, field_name: str, message: str = None):
        super().__init__(
            error_code="MISSING_FIELD",
            message=message or f"缺少必填字段: {field_name}",
            details={"field": field_name}
        )


class InvalidStatusException(TaskException):
    def __init__(self, current_status: str, allowed_statuses: list, message: str = None):
        super().__init__(
            error_code="INVALID_STATUS",
            message=message or f"当前状态 '{current_status}' 不允许此操作",
            details={"current_status": current_status, "allowed_statuses": allowed_statuses}
        )


class NeedsReviewException(TaskException):
    def __init__(self, task_name: str, reason: str, message: str = None):
        super().__init__(
            error_code="NEEDS_REVIEW",
            message=message or f"任务 '{task_name}' 需要人工复核",
            details={"task_name": task_name, "reason": reason}
        )


class AlreadyProcessedException(TaskException):
    def __init__(self, task_name: str, message: str = None):
        super().__init__(
            error_code="ALREADY_PROCESSED",
            message=message or f"任务 '{task_name}' 已经处理过",
            details={"task_name": task_name}
        )


class RecoveryLockException(TaskException):
    def __init__(self, task_name: str, locked_by: str, locked_at: str, message: str = None):
        super().__init__(
            error_code="RECOVERY_LOCKED",
            message=message or f"任务 '{task_name}' 正在被其他人恢复中",
            details={"task_name": task_name, "locked_by": locked_by, "locked_at": locked_at}
        )


class TaskNotFoundException(TaskException):
    def __init__(self, task_id: int, message: str = None):
        super().__init__(
            error_code="TASK_NOT_FOUND",
            message=message or f"任务ID {task_id} 不存在",
            details={"task_id": task_id}
        )
